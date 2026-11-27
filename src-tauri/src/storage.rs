use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct LoadResult {
    db: Option<serde_json::Value>,
    path: String,
    warning: Option<String>,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位数据目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建数据目录: {e}"))?;
    Ok(dir)
}

#[tauri::command]
pub fn load_db(app: AppHandle) -> Result<LoadResult, String> {
    let dir = data_dir(&app)?;
    let path = dir.join("todo-data.json");
    if !path.exists() {
        return Ok(LoadResult {
            db: None,
            path: path.to_string_lossy().into_owned(),
            warning: None,
        });
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("读取数据失败: {e}"))?;
    match serde_json::from_str::<serde_json::Value>(&text) {
        Ok(db) => Ok(LoadResult {
            db: Some(db),
            path: path.to_string_lossy().into_owned(),
            warning: None,
        }),
        Err(err) => {
            // 保留损坏文件，避免丢失用户数据
            let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
            let corrupt = dir.join(format!("todo-data.corrupt-{stamp}.json"));
            let _ = fs::copy(&path, &corrupt);
            Ok(LoadResult {
                db: None,
                path: path.to_string_lossy().into_owned(),
                warning: Some(format!(
                    "数据文件解析失败（{err}），已备份到 {}。",
                    corrupt.to_string_lossy()
                )),
            })
        }
    }
}

/// 原子写入：先写临时文件，再替换目标文件。
fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, content).map_err(|e| format!("写入临时文件失败: {e}"))?;
    match fs::rename(&tmp, path) {
        Ok(()) => Ok(()),
        Err(_) => {
            // Windows 上 rename 不能覆盖已有文件
            if path.exists() {
                let _ = fs::remove_file(path);
            }
            fs::rename(&tmp, path).map_err(|e| {
                let _ = fs::remove_file(&tmp);
                format!("替换数据文件失败: {e}")
            })
        }
    }
}

fn daily_backup(dir: &Path, current: &Path) -> Result<(), String> {
    if !current.exists() {
        return Ok(());
    }
    let backups = dir.join("backups");
    fs::create_dir_all(&backups).map_err(|e| format!("创建备份目录失败: {e}"))?;
    let day = chrono::Local::now().format("%Y-%m-%d").to_string();
    let target = backups.join(format!("todo-{day}.json"));
    if !target.exists() {
        fs::copy(current, &target).map_err(|e| format!("创建每日备份失败: {e}"))?;
        prune_backups(&backups, 21);
    }
    Ok(())
}

fn prune_backups(dir: &Path, keep: usize) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().map(|e| e == "json").unwrap_or(false))
        .collect();
    files.sort();
    if files.len() > keep {
        for old in &files[..files.len() - keep] {
            let _ = fs::remove_file(old);
        }
    }
}

#[tauri::command]
pub fn save_db(app: AppHandle, db: serde_json::Value) -> Result<(), String> {
    let dir = data_dir(&app)?;
    let path = dir.join("todo-data.json");
    daily_backup(&dir, &path)?;
    let text = serde_json::to_string(&db).map_err(|e| format!("序列化失败: {e}"))?;
    write_atomic(&path, &text)
}

#[tauri::command]
pub fn data_dir_path(app: AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn export_data(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("导出失败: {e}"))
}

#[tauri::command]
pub fn import_data(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取失败: {e}"))
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentInfo {
    id: String,
    name: String,
    size: u64,
    mime: String,
    rel_path: String,
}

fn guess_mime(name: &str) -> &'static str {
    let ext = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "txt" | "md" => "text/plain",
        "json" => "application/json",
        "zip" => "application/zip",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub fn attachment_add(app: AppHandle, src_path: String) -> Result<AttachmentInfo, String> {
    let src = Path::new(&src_path);
    if !src.is_file() {
        return Err("所选文件不存在".into());
    }
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".into());
    let id = uuid::Uuid::new_v4().to_string();
    let ext = src
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let rel_path = format!("attachments/{id}{ext}");
    let dir = data_dir(&app)?;
    let dest = dir.join(&rel_path);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建附件目录失败: {e}"))?;
    }
    fs::copy(src, &dest).map_err(|e| format!("复制附件失败: {e}"))?;
    let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    Ok(AttachmentInfo {
        id,
        name: name.clone(),
        size,
        mime: guess_mime(&name).to_string(),
        rel_path,
    })
}

fn safe_attachment_path(app: &AppHandle, rel_path: &str) -> Result<PathBuf, String> {
    if rel_path.contains("..") || !rel_path.starts_with("attachments/") {
        return Err("非法的附件路径".into());
    }
    let dir = data_dir(app)?;
    let p = dir.join(rel_path);
    if !p.starts_with(dir.join("attachments")) {
        return Err("非法的附件路径".into());
    }
    Ok(p)
}

#[tauri::command]
pub fn attachment_save(app: AppHandle, rel_path: String, base64: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let p = safe_attachment_path(&app, &rel_path)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bytes = STANDARD.decode(base64).map_err(|e| format!("附件解码失败: {e}"))?;
    fs::write(&p, bytes).map_err(|e| format!("保存附件失败: {e}"))
}

#[tauri::command]
pub fn attachment_read(app: AppHandle, rel_path: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let p = safe_attachment_path(&app, &rel_path)?;
    let bytes = fs::read(p).map_err(|e| format!("读取附件失败: {e}"))?;
    Ok(STANDARD.encode(bytes))
}

#[tauri::command]
pub fn attachment_exists(app: AppHandle, rel_path: String) -> Result<bool, String> {
    Ok(safe_attachment_path(&app, &rel_path)?.exists())
}

#[tauri::command]
pub fn attachment_delete(app: AppHandle, rel_path: String) -> Result<(), String> {
    let p = safe_attachment_path(&app, &rel_path)?;
    if p.exists() {
        fs::remove_file(p).map_err(|e| format!("删除附件失败: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn attachment_reveal(app: AppHandle, rel_path: String) -> Result<(), String> {
    let p = safe_attachment_path(&app, &rel_path)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", p.to_string_lossy()))
            .spawn()
            .map_err(|e| format!("无法打开资源管理器: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&p)
            .spawn()
            .map_err(|e| format!("无法在访达中显示文件: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        let target = p.parent().unwrap_or(&p);
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {e}"))?;
    }
    Ok(())
}
