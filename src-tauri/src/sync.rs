use serde_json::{json, Value};
use std::time::Duration;

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(40))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))
}

#[tauri::command]
pub async fn webdav_test(url: String, username: String, password: String) -> Result<Value, String> {
    let body = r#"<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>"#;
    let res = client()?
        .request(
            reqwest::Method::from_bytes(b"PROPFIND").map_err(|e| e.to_string())?,
            &url,
        )
        .basic_auth(&username, Some(&password))
        .header("Depth", "0")
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("连接失败: {e}"))?;
    let status = res.status().as_u16();
    let server = res
        .headers()
        .get("server")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    Ok(json!({ "status": status, "server": server }))
}

#[tauri::command]
pub async fn webdav_download(
    url: String,
    username: String,
    password: String,
) -> Result<Option<Value>, String> {
    let res = client()?
        .get(&url)
        .basic_auth(&username, Some(&password))
        .send()
        .await
        .map_err(|e| format!("下载失败: {e}"))?;
    if res.status().as_u16() == 404 {
        return Ok(None);
    }
    if !res.status().is_success() {
        return Err(format!("下载失败: HTTP {}", res.status()));
    }
    let etag = res
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let body = res.text().await.map_err(|e| format!("读取响应失败: {e}"))?;
    Ok(Some(json!({ "body": body, "etag": etag })))
}

#[tauri::command]
pub async fn webdav_upload(
    url: String,
    username: String,
    password: String,
    body: String,
    if_match: Option<String>,
) -> Result<Value, String> {
    let mut req = client()?
        .put(&url)
        .basic_auth(&username, Some(&password))
        .header("Content-Type", "application/json; charset=utf-8");
    if let Some(tag) = if_match {
        if !tag.is_empty() && tag != "\"\"" {
            req = req.header("If-Match", tag);
        }
    }
    let res = req
        .body(body)
        .send()
        .await
        .map_err(|e| format!("上传失败: {e}"))?;
    let status = res.status();
    if status.as_u16() == 412 {
        return Ok(json!({ "status": 412, "precondition": true }));
    }
    if !status.is_success() {
        let code = status.as_u16();
        let hint = match code {
            401 => "认证失败，请检查用户名与密码（坚果云需使用应用密码）",
            403 => "无权限写入该目录",
            409 | 404 => "目标目录不存在，请先在网盘中创建文件夹",
            _ => "上传失败",
        };
        return Err(format!("{hint}（HTTP {code}）"));
    }
    let etag = res
        .headers()
        .get("etag")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    Ok(json!({ "status": status.as_u16(), "precondition": false, "etag": etag }))
}

#[tauri::command]
pub async fn webdav_mkcol(
    url: String,
    username: String,
    password: String,
) -> Result<Value, String> {
    let res = client()?
        .request(
            reqwest::Method::from_bytes(b"MKCOL").map_err(|e| e.to_string())?,
            &url,
        )
        .basic_auth(&username, Some(&password))
        .send()
        .await
        .map_err(|e| format!("创建目录失败: {e}"))?;
    Ok(json!({ "status": res.status().as_u16() }))
}

#[tauri::command]
pub async fn webdav_upload_binary(
    url: String,
    username: String,
    password: String,
    base64: String,
) -> Result<Value, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let bytes = STANDARD
        .decode(base64)
        .map_err(|e| format!("附件编码错误: {e}"))?;
    let res = client()?
        .put(&url)
        .basic_auth(&username, Some(&password))
        .header("Content-Type", "application/octet-stream")
        .body(bytes)
        .send()
        .await
        .map_err(|e| format!("上传附件失败: {e}"))?;
    let status = res.status();
    if !status.is_success() {
        return Err(format!("上传附件失败: HTTP {}", status.as_u16()));
    }
    Ok(json!({ "status": status.as_u16() }))
}

#[tauri::command]
pub async fn webdav_download_binary(
    url: String,
    username: String,
    password: String,
) -> Result<Option<String>, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let res = client()?
        .get(&url)
        .basic_auth(&username, Some(&password))
        .send()
        .await
        .map_err(|e| format!("下载附件失败: {e}"))?;
    if res.status().as_u16() == 404 {
        return Ok(None);
    }
    if !res.status().is_success() {
        return Err(format!("下载附件失败: HTTP {}", res.status().as_u16()));
    }
    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("读取附件失败: {e}"))?;
    Ok(Some(STANDARD.encode(bytes)))
}
