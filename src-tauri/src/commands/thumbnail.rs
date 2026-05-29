use std::io::Cursor;
use std::path::Path;

use base64::Engine;

use crate::error::{AppError, AppResult};

/// Files larger than this are never decoded by the fallback `image` path —
/// guards against multi-hundred-MB images locking a worker thread. The Windows
/// shell path is unaffected (it reads OS-cached thumbnails).
const MAX_DECODE_BYTES: u64 = 64 * 1024 * 1024;

/// Generate a downscaled preview of a media file and return it as a base64
/// `data:` URL ready for an `<img src>`.
///
/// On Windows the real Explorer thumbnail is fetched via `IShellItemImageFactory`
/// (works for photos of any format the OS can read — JPEG/HEIC/RAW — plus video
/// frames, PDFs, etc.). SVGs are passed through verbatim; everything else falls
/// back to decoding with the `image` crate.
#[tauri::command]
pub async fn get_thumbnail(path: String, max_size: Option<u32>) -> AppResult<String> {
    let max = max_size.unwrap_or(160).clamp(16, 1024);
    tauri::async_runtime::spawn_blocking(move || gen_thumb(&path, max))
        .await
        .map_err(|e| AppError::Io(e.to_string()))?
}

/// Raster formats the `image` crate decodes directly — fast + reliable, so we
/// never route these through the OS shell path.
const RASTER_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "tif", "tiff", "ico",
];

fn gen_thumb(path: &str, max: u32) -> AppResult<String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "svg" {
        let bytes = std::fs::read(path).map_err(|e| AppError::Io(e.to_string()))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        return Ok(format!("data:image/svg+xml;base64,{b64}"));
    }

    let meta = std::fs::metadata(path).map_err(|e| AppError::Io(e.to_string()))?;
    let size = meta.len();
    let mtime = mtime_ms(&meta);

    // Disk cache: keyed by path + mtime + size + requested size, so repeat loads
    // (zoom, re-scan, relaunch) skip decoding entirely.
    let cache = cache_path(path, mtime, size, max);
    if let Ok(cached) = std::fs::read_to_string(&cache) {
        if cached.starts_with("data:") {
            return Ok(cached);
        }
    }

    let url = produce(path, &ext, size, max)?;
    if let Some(dir) = cache.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(&cache, &url);
    Ok(url)
}

fn produce(path: &str, ext: &str, size: u64, max: u32) -> AppResult<String> {
    // Try the OS thumbnail first — Windows caches the same previews Explorer
    // shows, so this is near-instant when cached (no full decode). The shell
    // path rejects blank/uniform output, so a GDI miss falls through cleanly.
    #[cfg(windows)]
    {
        if let Ok(png) = windows_shell::shell_thumbnail(path, max) {
            let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
            return Ok(format!("data:image/png;base64,{b64}"));
        }
    }
    // Fallback: decode raster with the image crate. Non-raster formats the crate
    // can't read return an error (frontend then tries the asset protocol).
    if RASTER_EXTS.contains(&ext) {
        return decode_with_image(path, size, max);
    }
    decode_with_image(path, size, max)
}

fn mtime_ms(meta: &std::fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn cache_path(path: &str, mtime: u64, size: u64, max: u32) -> std::path::PathBuf {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut h);
    mtime.hash(&mut h);
    size.hash(&mut h);
    max.hash(&mut h);
    std::env::temp_dir()
        .join("structura-thumb-cache")
        .join(format!("{:016x}.txt", h.finish()))
}

fn decode_with_image(path: &str, size: u64, max: u32) -> AppResult<String> {
    use image::{DynamicImage, ImageFormat, ImageReader};

    if size > MAX_DECODE_BYTES {
        return Err(AppError::Io("image too large for preview".into()));
    }

    let img = ImageReader::open(path)
        .map_err(|e| AppError::Io(e.to_string()))?
        .with_guessed_format()
        .map_err(|e| AppError::Io(e.to_string()))?
        .decode()
        .map_err(|e| AppError::Io(e.to_string()))?;

    let thumb = img.thumbnail(max, max);
    let mut buf = Cursor::new(Vec::new());
    let (out, format, mime): (DynamicImage, ImageFormat, &str) = if thumb.color().has_alpha() {
        (
            DynamicImage::ImageRgba8(thumb.to_rgba8()),
            ImageFormat::Png,
            "image/png",
        )
    } else {
        (
            DynamicImage::ImageRgb8(thumb.to_rgb8()),
            ImageFormat::Jpeg,
            "image/jpeg",
        )
    };
    out.write_to(&mut buf, format)
        .map_err(|e| AppError::Io(e.to_string()))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(buf.get_ref());
    Ok(format!("data:{mime};base64,{b64}"))
}

#[cfg(windows)]
mod windows_shell {
    use std::ffi::c_void;
    use std::io::Cursor;

    use image::{DynamicImage, ImageFormat, RgbaImage};
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{SIZE, S_FALSE, S_OK};
    use windows::Win32::Graphics::Gdi::{
        DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
    };
    use windows::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_RESIZETOFIT,
        SIIGBF_THUMBNAILONLY,
    };

    use crate::error::{AppError, AppResult};

    /// Fetch the OS thumbnail for `path` (square `max`), returned as PNG bytes.
    pub fn shell_thumbnail(path: &str, max: u32) -> AppResult<Vec<u8>> {
        unsafe {
            let hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let need_uninit = hr == S_OK || hr == S_FALSE;
            let result = extract(path, max);
            if need_uninit {
                CoUninitialize();
            }
            result
        }
    }

    unsafe fn extract(path: &str, max: u32) -> AppResult<Vec<u8>> {
        let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let factory: IShellItemImageFactory =
            SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None)
                .map_err(|e| AppError::Io(e.to_string()))?;

        let size = SIZE {
            cx: max as i32,
            cy: max as i32,
        };
        // THUMBNAILONLY: only genuine content previews, never a generic file icon.
        let hbitmap = factory
            .GetImage(size, SIIGBF_RESIZETOFIT | SIIGBF_THUMBNAILONLY)
            .map_err(|e| AppError::Io(e.to_string()))?;

        let png = hbitmap_to_png(hbitmap);
        let _ = DeleteObject(HGDIOBJ(hbitmap.0));
        png
    }

    unsafe fn hbitmap_to_png(hbitmap: HBITMAP) -> AppResult<Vec<u8>> {
        let mut bm = BITMAP::default();
        let got = GetObjectW(
            HGDIOBJ(hbitmap.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bm as *mut BITMAP as *mut c_void),
        );
        if got == 0 {
            return Err(AppError::Io("GetObject failed".into()));
        }
        let w = bm.bmWidth;
        let h = bm.bmHeight;
        if w <= 0 || h <= 0 {
            return Err(AppError::Io("empty thumbnail".into()));
        }

        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h, // negative = top-down rows
                biPlanes: 1,
                biBitCount: 32,
                biCompression: 0, // BI_RGB
                ..Default::default()
            },
            ..Default::default()
        };

        let hdc = GetDC(None);
        let mut buf = vec![0u8; (w as usize) * (h as usize) * 4];
        let scanned = GetDIBits(
            hdc,
            hbitmap,
            0,
            h as u32,
            Some(buf.as_mut_ptr() as *mut c_void),
            &mut info,
            DIB_RGB_COLORS,
        );
        ReleaseDC(None, hdc);
        if scanned == 0 {
            return Err(AppError::Io("GetDIBits failed".into()));
        }

        // GDI gives BGRA. Some providers leave alpha at 0 for opaque thumbs —
        // detect that and force opacity so the preview isn't fully transparent.
        let any_alpha = buf.chunks_exact(4).any(|p| p[3] != 0);
        let mut rgba = vec![0u8; buf.len()];
        let (mut lo, mut hi) = (255u8, 0u8);
        for (dst, src) in rgba.chunks_exact_mut(4).zip(buf.chunks_exact(4)) {
            dst[0] = src[2];
            dst[1] = src[1];
            dst[2] = src[0];
            dst[3] = if any_alpha { src[3] } else { 255 };
            for &c in &dst[..3] {
                if c < lo {
                    lo = c;
                }
                if c > hi {
                    hi = c;
                }
            }
        }
        // Reject blank/near-uniform output (a GDI miss) so the caller can fall
        // back to a real decode instead of showing a black/empty tile.
        if hi.saturating_sub(lo) < 8 {
            return Err(AppError::Io("blank shell thumbnail".into()));
        }

        let img = RgbaImage::from_raw(w as u32, h as u32, rgba)
            .ok_or_else(|| AppError::Io("thumbnail buffer mismatch".into()))?;
        let mut out = Cursor::new(Vec::new());
        DynamicImage::ImageRgba8(img)
            .write_to(&mut out, ImageFormat::Png)
            .map_err(|e| AppError::Io(e.to_string()))?;
        Ok(out.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, RgbImage};
    use tempfile::tempdir;

    fn write_png(path: &std::path::Path) {
        let img = RgbImage::from_fn(80, 60, |x, y| {
            image::Rgb([(x * 3 % 256) as u8, (y * 5 % 256) as u8, 120])
        });
        img.save_with_format(path, ImageFormat::Png).unwrap();
    }

    #[test]
    fn produces_data_url_for_png() {
        let dir = tempdir().unwrap();
        let p = dir.path().join("pic.png");
        write_png(&p);
        let url = gen_thumb(p.to_str().unwrap(), 160).unwrap();
        assert!(url.starts_with("data:image/"), "got: {}", &url[..url.len().min(40)]);
        assert!(url.len() > 200);
    }

    #[test]
    fn works_with_forward_slash_paths() {
        // Real node.originalPath values are normalised to forward slashes.
        let dir = tempdir().unwrap();
        let p = dir.path().join("pic.jpg");
        let img = RgbImage::from_fn(120, 90, |x, _| image::Rgb([(x % 256) as u8, 80, 40]));
        img.save_with_format(&p, ImageFormat::Jpeg).unwrap();
        let fwd = p.to_str().unwrap().replace('\\', "/");
        let url = gen_thumb(&fwd, 160).unwrap();
        assert!(url.starts_with("data:image/"), "got: {}", &url[..url.len().min(40)]);
    }

    #[test]
    fn works_with_cyrillic_and_spaces_in_path() {
        // Real paths under e.g. "C:/Users/nikit/Рабочий стол/..." have Cyrillic + spaces.
        let dir = tempdir().unwrap();
        let sub = dir.path().join("Рабочий стол");
        std::fs::create_dir_all(&sub).unwrap();
        let p = sub.join("фото 1.png");
        write_png(&p);
        let fwd = p.to_str().unwrap().replace('\\', "/");
        let url = gen_thumb(&fwd, 160).unwrap();
        assert!(url.starts_with("data:image/"), "got: {}", &url[..url.len().min(60)]);
    }

    #[test]
    fn second_call_hits_disk_cache() {
        let dir = tempdir().unwrap();
        let p = dir.path().join("c.png");
        write_png(&p);
        let a = gen_thumb(p.to_str().unwrap(), 96).unwrap();
        let b = gen_thumb(p.to_str().unwrap(), 96).unwrap();
        assert_eq!(a, b);
    }
}
