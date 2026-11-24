use serde_json::{json, Value};
use std::time::Duration;

const AUTH: &str = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH: &str = "https://graph.microsoft.com/v1.0";
const SCOPE: &str = "offline_access Tasks.Read";

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(40))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))
}

#[tauri::command]
pub async fn graph_device_start(client_id: String) -> Result<Value, String> {
    let res = client()?
        .post(format!("{AUTH}/devicecode"))
        .form(&[("client_id", client_id.as_str()), ("scope", SCOPE)])
        .send()
        .await
        .map_err(|e| format!("无法连接微软登录服务: {e}"))?;
    let status = res.status();
    let body: Value = res
        .json()
        .await
        .map_err(|e| format!("响应解析失败: {e}"))?;
    if !status.is_success() {
        let desc = body
            .get("error_description")
            .and_then(|v| v.as_str())
            .unwrap_or("申请设备码失败");
        return Err(format!("{desc}（请确认应用 ID 正确且已允许公共客户端）"));
    }
    Ok(json!({
        "deviceCode": body.get("device_code").cloned().unwrap_or(Value::Null),
        "userCode": body.get("user_code").cloned().unwrap_or(Value::Null),
        "verificationUri": body.get("verification_uri").cloned().unwrap_or(Value::Null),
        "expiresIn": body.get("expires_in").cloned().unwrap_or(Value::Null),
        "interval": body.get("interval").cloned().unwrap_or(Value::Null)
    }))
}

#[tauri::command]
pub async fn graph_poll_token(client_id: String, device_code: String) -> Result<Value, String> {
    let res = client()?
        .post(format!("{AUTH}/token"))
        .form(&[
            ("client_id", client_id.as_str()),
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:device_code",
            ),
            ("device_code", device_code.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("轮询授权失败: {e}"))?;
    let status = res.status();
    let body: Value = res
        .json()
        .await
        .map_err(|e| format!("响应解析失败: {e}"))?;
    if status.is_success() {
        return Ok(json!({
            "status": "ok",
            "accessToken": body.get("access_token").cloned().unwrap_or(Value::Null),
            "refreshToken": body.get("refresh_token").cloned().unwrap_or(Value::Null),
            "expiresIn": body.get("expires_in").cloned().unwrap_or(Value::Null)
        }));
    }
    let err = body.get("error").and_then(|v| v.as_str()).unwrap_or("unknown");
    let desc = body
        .get("error_description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    Ok(match err {
        "authorization_pending" => json!({ "status": "pending" }),
        "slow_down" => json!({ "status": "slow_down" }),
        "expired_token" => json!({ "status": "expired", "message": "设备码已过期，请重新开始" }),
        "authorization_declined" => json!({ "status": "declined", "message": "登录被拒绝" }),
        _ => json!({ "status": "error", "message": format!("{err}: {desc}") }),
    })
}

#[tauri::command]
pub async fn graph_refresh(client_id: String, refresh_token: String) -> Result<Value, String> {
    let res = client()?
        .post(format!("{AUTH}/token"))
        .form(&[
            ("client_id", client_id.as_str()),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
            ("scope", SCOPE),
        ])
        .send()
        .await
        .map_err(|e| format!("刷新令牌失败: {e}"))?;
    let status = res.status();
    let body: Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err("登录已过期，请重新授权".into());
    }
    Ok(json!({
        "accessToken": body.get("access_token").cloned().unwrap_or(Value::Null),
        "refreshToken": body.get("refresh_token").cloned().unwrap_or(Value::Null),
        "expiresIn": body.get("expires_in").cloned().unwrap_or(Value::Null)
    }))
}

async fn get_json(token: &str, url: &str) -> Result<Value, String> {
    let res = client()?
        .get(url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("请求 Graph 失败: {e}"))?;
    let status = res.status();
    let body: Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let msg = body
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("Graph 请求失败");
        return Err(format!("{msg}（HTTP {}）", status.as_u16()));
    }
    Ok(body)
}

#[tauri::command]
pub async fn graph_list_lists(token: String, next_link: Option<String>) -> Result<Value, String> {
    let url = next_link.unwrap_or_else(|| format!("{GRAPH}/me/todo/lists?$top=100"));
    let body = get_json(&token, &url).await?;
    Ok(json!({
        "items": body.get("value").cloned().unwrap_or_else(|| json!([])),
        "nextLink": body.get("@odata.nextLink").cloned().unwrap_or(Value::Null)
    }))
}

#[tauri::command]
pub async fn graph_list_tasks(
    token: String,
    list_id: String,
    next_link: Option<String>,
) -> Result<Value, String> {
    let url = match next_link {
        Some(link) => link,
        None => {
            let mut u = reqwest::Url::parse(&format!("{GRAPH}/me/todo/lists/"))
                .map_err(|e| e.to_string())?;
            {
                let mut seg = u.path_segments_mut().map_err(|_| "URL 构造失败".to_string())?;
                seg.push(&list_id);
                seg.push("tasks");
            }
            u.query_pairs_mut()
                .append_pair("$expand", "checklistItems")
                .append_pair("$top", "100");
            u.to_string()
        }
    };
    let body = get_json(&token, &url).await?;
    Ok(json!({
        "items": body.get("value").cloned().unwrap_or_else(|| json!([])),
        "nextLink": body.get("@odata.nextLink").cloned().unwrap_or(Value::Null)
    }))
}
