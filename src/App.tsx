import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useStore } from "./store/useStore";
import { Sidebar } from "./components/Sidebar";
import { MainPane } from "./components/MainPane";
import { TaskDetail } from "./components/TaskDetail";
import { SettingsDialog } from "./components/SettingsDialog";
import { SyncDialog } from "./components/SyncDialog";
import { MigrationWizard } from "./components/MigrationWizard";
import { CheckIcon, CloseSmallIcon, WarningIcon } from "./components/icons";

const notified = new Set<string>();

export default function App() {
  const ready = useStore((s) => s.ready);
  const db = useStore((s) => s.db);
  const dialog = useStore((s) => s.dialog);
  const selectedTaskId = useStore((s) => s.selectedTaskId);
  const loadWarning = useStore((s) => s.loadWarning);
  const [warningDismissed, setWarningDismissed] = useState(false);

  useEffect(() => {
    void useStore.getState().init();
  }, []);

  // 主题
  useEffect(() => {
    const theme = db.settings.theme;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [db.settings.theme]);

  // 全局快捷键 -> 聚焦快速添加
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("global-quick-add", () => {
      useStore.getState().focusQuickAdd();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {
        /* 浏览器环境 */
      });
    return () => unlisten?.();
  }, []);

  // 应用内快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useStore.getState().focusQuickAdd();
      }
      if (e.key === "Escape") {
        const st = useStore.getState();
        if (!st.dialog) st.selectTask(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 提醒
  useEffect(() => {
    if (!ready) return;
    let permissionOk = false;
    let cancelled = false;

    const check = () => {
      const st = useStore.getState();
      if (!st.db.settings.reminderEnabled) return;
      const now = Date.now();
      for (const t of st.db.tasks) {
        if (t.deletedAt || t.completed || !t.reminderAt) continue;
        const key = `${t.id}@${t.reminderAt}`;
        if (t.reminderAt <= now - 10 * 60 * 1000) {
          notified.add(key);
          continue;
        }
        if (t.reminderAt <= now && !notified.has(key)) {
          notified.add(key);
          try {
            sendNotification({ title: "任务提醒", body: t.title });
          } catch {
            /* ignore */
          }
        }
      }
    };

    (async () => {
      try {
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        permissionOk = granted;
      } catch {
        permissionOk = false;
      }
      if (!cancelled && permissionOk) check();
    })();

    const timer = setInterval(() => {
      if (permissionOk) check();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready]);

  // 定时自动同步
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      const st = useStore.getState();
      const s = st.db.settings;
      if (!s.webdavUrl || !s.webdavUser || st.sync.running) return;
      if (Date.now() - (s.lastSyncAt ?? 0) > 5 * 60 * 1000) {
        void st.syncNow();
      }
    }, 60 * 1000);

    const initial = setTimeout(() => {
      const st = useStore.getState();
      const s = st.db.settings;
      if (s.webdavUrl && s.webdavUser && !st.sync.running) {
        void st.syncNow();
      }
    }, 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [ready]);

  if (!ready) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: "var(--text-secondary)",
        }}
      >
        <div className="brand-logo">
          <CheckIcon />
        </div>
        正在加载…
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <MainPane />
      {selectedTaskId ? <TaskDetail /> : null}

      {dialog === "settings" ? <SettingsDialog /> : null}
      {dialog === "sync" ? <SyncDialog /> : null}
      {dialog === "migration" ? <MigrationWizard /> : null}

      {loadWarning && !warningDismissed ? (
        <div
          className="status-line warn"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            maxWidth: 640,
            boxShadow: "var(--shadow)",
            background: "var(--bg-main)",
            zIndex: 80,
          }}
        >
          <WarningIcon />
          <span style={{ flex: 1 }}>{loadWarning}</span>
          <button
            className="icon-btn"
            style={{ width: 24, height: 24 }}
            onClick={() => setWarningDismissed(true)}
            aria-label="关闭提示"
          >
            <CloseSmallIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}
