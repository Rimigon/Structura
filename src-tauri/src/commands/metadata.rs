use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MediaMetadata {
    pub kind: String,
    pub exif_date: Option<String>,
    pub exif_camera: Option<String>,
    pub exif_lens: Option<String>,
    pub exif_width: Option<u32>,
    pub exif_height: Option<u32>,
    pub id3_artist: Option<String>,
    pub id3_title: Option<String>,
    pub id3_album: Option<String>,
    pub id3_year: Option<i32>,
    pub id3_track: Option<u32>,
}

#[tauri::command]
pub async fn extract_metadata(path: String) -> AppResult<MediaMetadata> {
    let p = PathBuf::from(&path);
    if !p.is_file() {
        return Err(AppError::NotFound { path });
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mut meta = MediaMetadata::default();
    meta.kind = classify(&ext).into();

    if is_image(&ext) {
        read_exif(&p, &mut meta);
    }
    if is_audio(&ext) {
        read_id3(&p, &mut meta);
    }
    Ok(meta)
}

fn classify(ext: &str) -> &'static str {
    if is_image(ext) {
        "image"
    } else if is_audio(ext) {
        "audio"
    } else if is_video(ext) {
        "video"
    } else {
        "other"
    }
}

fn is_image(ext: &str) -> bool {
    matches!(
        ext,
        "jpg" | "jpeg" | "tiff" | "tif" | "heic" | "heif" | "webp" | "png"
    )
}

fn is_audio(ext: &str) -> bool {
    matches!(ext, "mp3" | "wav" | "flac" | "ogg" | "m4a" | "aiff")
}

fn is_video(ext: &str) -> bool {
    matches!(ext, "mp4" | "mkv" | "mov" | "avi" | "webm")
}

fn read_exif(path: &Path, out: &mut MediaMetadata) {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return,
    };
    let mut reader = std::io::BufReader::new(file);
    let parser = exif::Reader::new();
    let exif = match parser.read_from_container(&mut reader) {
        Ok(e) => e,
        Err(_) => return,
    };
    for f in exif.fields() {
        match f.tag {
            exif::Tag::DateTimeOriginal => {
                out.exif_date = Some(f.display_value().to_string());
            }
            exif::Tag::DateTime if out.exif_date.is_none() => {
                out.exif_date = Some(f.display_value().to_string());
            }
            exif::Tag::Model => {
                out.exif_camera = Some(f.display_value().to_string().trim_matches('"').into());
            }
            exif::Tag::LensModel => {
                out.exif_lens = Some(f.display_value().to_string().trim_matches('"').into());
            }
            exif::Tag::PixelXDimension | exif::Tag::ImageWidth => {
                if let Some(v) = f.value.get_uint(0) {
                    out.exif_width = Some(v);
                }
            }
            exif::Tag::PixelYDimension | exif::Tag::ImageLength => {
                if let Some(v) = f.value.get_uint(0) {
                    out.exif_height = Some(v);
                }
            }
            _ => {}
        }
    }
}

fn read_id3(path: &Path, out: &mut MediaMetadata) {
    use id3::TagLike;
    let tag = match id3::Tag::read_from_path(path) {
        Ok(t) => t,
        Err(_) => return,
    };
    out.id3_artist = tag.artist().map(str::to_string);
    out.id3_title = tag.title().map(str::to_string);
    out.id3_album = tag.album().map(str::to_string);
    out.id3_year = tag.year();
    out.id3_track = tag.track();
}
