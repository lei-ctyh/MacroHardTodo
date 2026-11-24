mod crypto;
mod graph;
mod secret;
mod storage;
mod sync;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "打开主界面", true, None::<&str>)?;
            let quick = MenuItem::with_id(app, "quick", "快速添加", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quick, &quit])?;
            let icon = app.default_window_icon().cloned().ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "缺少窗口图标")
            })?;
            let tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("MacroHard Todo")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quick" => {
                        show_main(app);
                        let _ = app.emit("global-quick-add", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            app.manage(tray);

            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyT);
            app.global_shortcut()
                .on_shortcut(shortcut, |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        show_main(app);
                        let _ = app.emit("global-quick-add", ());
                    }
                })?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            storage::load_db,
            storage::save_db,
            storage::data_dir_path,
            storage::export_data,
            storage::import_data,
            storage::attachment_add,
            storage::attachment_save,
            storage::attachment_read,
            storage::attachment_exists,
            storage::attachment_delete,
            storage::attachment_reveal,
            secret::secret_set,
            secret::secret_get,
            secret::secret_delete,
            crypto::crypto_encrypt,
            crypto::crypto_decrypt,
            sync::webdav_test,
            sync::webdav_download,
            sync::webdav_upload,
            sync::webdav_mkcol,
            sync::webdav_upload_binary,
            sync::webdav_download_binary,
            graph::graph_device_start,
            graph::graph_poll_token,
            graph::graph_refresh,
            graph::graph_list_lists,
            graph::graph_list_tasks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MacroHard Todo");
}
