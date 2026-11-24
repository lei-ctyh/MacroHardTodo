use keyring::Entry;

const SERVICE: &str = "MacroHardTodo";

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| format!("凭据存储不可用: {e}"))?;
    entry
        .set_password(&value)
        .map_err(|e| format!("保存凭据失败: {e}"))
}

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| format!("凭据存储不可用: {e}"))?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("读取凭据失败: {e}")),
    }
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| format!("凭据存储不可用: {e}"))?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("删除凭据失败: {e}")),
    }
}
