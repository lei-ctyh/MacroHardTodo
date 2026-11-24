import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useStore } from "./store/useStore";
import { api } from "./lib/api";
import { Sidebar } from "./components/Sidebar";
import { MainPane } from "./components/MainPane";
import { TaskDetail } from "./components/TaskDetail";
import { SettingsDialog } from "./components/SettingsDialog";
import { SyncDialog } from "./components/SyncDialog";
import { MigrationWizard } from "./components/MigrationWizard";
import { CloseSmallIcon, WarningIcon } from "./components/icons";

const notified = new Set<string>();

export default function App() {
  const ready = useStore((s) => s.ready);
  const db = useStore((s) => s.db);
  const dialog = useStore((s) => s.dialog);
  const selectedTaskId = useStore((s) => s.selectedTaskId);
  const loadWarning = useStore((s) => s.loadWarning);
  const updateSettings = useStore((s) => s.updateSettings);
  const [warningDismissed, setWarningDismissed] = useState(false);

  const savedSidebarWidth = db.settings.sidebarWidth;
  const [sidebarWidth, setSidebarWidth] = useState(savedSidebarWidth ?? 240);
  const resizeDrag = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  const clampSidebarWidth = (value: number) =>
    Math.min(420, Math.max(200, Math.round(value)));

  useEffect(() => {
    if (typeof savedSidebarWidth === "number") {
      setSidebarWidth(savedSidebarWidth);
    }
  }, [savedSidebarWidth]);

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeDrag.current = { startX: event.clientX, startWidth: sidebarWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (e: PointerEvent) => {
      if (!resizeDrag.current) return;
      setSidebarWidth(
        clampSidebarWidth(
          resizeDrag.current.startWidth +
            e.clientX -
            resizeDrag.current.startX,
        ),
      );
    };
    const cleanup = () => {
      resizeDrag.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    const onUp = (e: PointerEvent) => {
      const drag = resizeDrag.current;
      if (drag) {
        const width = clampSidebarWidth(
          drag.startWidth + e.clientX - drag.startX,
        );
        setSidebarWidth(width);
        updateSettings({ sidebarWidth: width });
      }
      cleanup();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  };

  const resetSidebarWidth = () => {
    setSidebarWidth(240);
    updateSettings({ sidebarWidth: 240 });
  };

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
      void api.setTitleBarTheme(dark).catch(() => {
        /* 浏览器预览或非 Windows 环境 */
      });
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
          <img src="/logo.png" alt="" />
        </div>
        正在加载…
      </div>
    );
  }

  return (
    <div
      className="app-shell"
      style={{ "--sidebar-w": `${sidebarWidth}px` } as CSSProperties}
    >
      <Sidebar />
      <div
        className="sidebar-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={200}
        aria-valuemax={420}
        aria-valuenow={Math.round(sidebarWidth)}
        title="拖动调整侧栏宽度，双击恢复默认"
        onPointerDown={startSidebarResize}
        onDoubleClick={resetSidebarWidth}
      />
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
