use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellIntegrationStatus {
    pub platform: String,
    pub installed: bool,
    pub supported: bool,
    pub note: String,
}

#[tauri::command]
pub async fn shell_integration_status() -> AppResult<ShellIntegrationStatus> {
    #[cfg(windows)]
    {
        let installed = windows_is_installed().unwrap_or(false);
        return Ok(ShellIntegrationStatus {
            platform: "windows".into(),
            installed,
            supported: true,
            note: "Пункт «Открыть в Structura» в контекстном меню папок (для текущего пользователя)".into(),
        });
    }
    #[cfg(not(windows))]
    {
        Ok(ShellIntegrationStatus {
            platform: std::env::consts::OS.into(),
            installed: false,
            supported: false,
            note: "Интеграция с оболочкой пока доступна только на Windows".into(),
        })
    }
}

#[tauri::command]
pub async fn install_shell_integration() -> AppResult<()> {
    #[cfg(windows)]
    {
        windows_install().map_err(|e| AppError::Io(format!("registry write: {e}")))
    }
    #[cfg(not(windows))]
    {
        Err(AppError::Io(
            "интеграция с оболочкой пока доступна только на Windows".into(),
        ))
    }
}

#[tauri::command]
pub async fn uninstall_shell_integration() -> AppResult<()> {
    #[cfg(windows)]
    {
        windows_uninstall().map_err(|e| AppError::Io(format!("registry delete: {e}")))
    }
    #[cfg(not(windows))]
    {
        Err(AppError::Io(
            "интеграция с оболочкой пока доступна только на Windows".into(),
        ))
    }
}

#[cfg(windows)]
fn exe_path() -> std::io::Result<String> {
    let p = std::env::current_exe()?;
    Ok(p.to_string_lossy().replace('/', "\\"))
}

#[cfg(windows)]
fn windows_install() -> std::io::Result<()> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let exe = exe_path()?;
    let command = format!("\"{exe}\" \"%1\"");

    // Right-click on a directory
    let (k, _) = hkcu.create_subkey(r"Software\Classes\Directory\shell\Structura")?;
    k.set_value("", &"Открыть в Structura")?;
    k.set_value("Icon", &exe.as_str())?;
    let (kc, _) = hkcu.create_subkey(r"Software\Classes\Directory\shell\Structura\command")?;
    kc.set_value("", &command)?;

    // Right-click on empty space inside a directory
    let (b, _) = hkcu.create_subkey(r"Software\Classes\Directory\Background\shell\Structura")?;
    b.set_value("", &"Открыть эту папку в Structura")?;
    b.set_value("Icon", &exe.as_str())?;
    let (bc, _) = hkcu.create_subkey(r"Software\Classes\Directory\Background\shell\Structura\command")?;
    let command_bg = format!("\"{exe}\" \"%V\"");
    bc.set_value("", &command_bg)?;

    Ok(())
}

#[cfg(windows)]
fn windows_uninstall() -> std::io::Result<()> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let _ = hkcu.delete_subkey_all(r"Software\Classes\Directory\shell\Structura");
    let _ = hkcu.delete_subkey_all(r"Software\Classes\Directory\Background\shell\Structura");
    Ok(())
}

#[cfg(windows)]
fn windows_is_installed() -> std::io::Result<bool> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    Ok(hkcu
        .open_subkey(r"Software\Classes\Directory\shell\Structura\command")
        .is_ok())
}
