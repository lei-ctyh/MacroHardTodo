import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../lib/api";
import type { ToggleableSmartViewId } from "../lib/model";
import { useStore } from "../store/useStore";
import { useAvatar } from "./useAvatar";
import {
  AllIcon,
  BackIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CloudIcon,
  CompletedIcon,
  CopyIcon,
  DownloadIcon,
  FolderIcon,
  InfoIcon,
  OpenIcon,
  RefreshIcon,
  SparklesIcon,
  StarFilledIcon,
  StarOutlineIcon,
  UploadIcon,
} from "./icons";

type DataDirStatus =
  | { state: "loading" }
  | { state: "ready"; path: string }
  | { state: "unavailable" };

const SMART_LIST_SETTINGS: {
  id: ToggleableSmartViewId;
  label: string;
  Icon: typeof StarOutlineIcon;
  color: string;
}[] = [
  {
    id: "important",
    label: "重要",
    Icon: StarOutlineIcon,
    color: "var(--text-secondary)",
  },
  {
    id: "planned",
    label: "计划内",
    Icon: CalendarIcon,
    color: "var(--text-secondary)",
  },
  {
    id: "completed",
    label: "已完成",
    Icon: CompletedIcon,
    color: "var(--smart-red)",
  },
  {
    id: "all",
    label: "全部",
    Icon: AllIcon,
    color: "var(--smart-red)",
  },
];

const THEME_OPTIONS = [
  { value: "light", label: "浅色主题" },
  { value: "dark", label: "深色主题" },
  { value: "system", label: "使用我的 Windows 主题" },
] as const;

const PURGE_DAY_PRESETS = [0, 7, 14, 30, 90, 180, 365] as const;
const APP_VERSION = "0.1.0";
const REPO_URL = "https://github.com/lei-ctyh/MacroHardTodo";
const RELEASES_URL = `${REPO_URL}/releases`;
const ISSUES_URL = `${REPO_URL}/issues`;

export function SettingsPage() {
  const db = useStore((s) => s.db);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const closeSettings = useStore((s) => s.closeSettings);
  const openDialog = useStore((s) => s.openDialog);
  const updateSettings = useStore((s) => s.updateSettings);
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);
  const exportCsv = useStore((s) => s.exportCsv);
  const importCsv = useStore((s) => s.importCsv);
  const syncNow = useStore((s) => s.syncNow);
  const sync = useStore((s) => s.sync);
  const { avatarUrl, hasCustomAvatar, pickAvatar, clearAvatar } = useAvatar();

  const [dataDirStatus, setDataDirStatus] = useState<DataDirStatus>({
    state: "loading",
  });
  const [autostart, setAutostart] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedAbout, setCopiedAbout] = useState(false);
  const [starBannerVisible, setStarBannerVisible] = useState(true);
  const [message, setMessage] = useState<
    { kind: "ok" | "err" | "info"; text: string } | null
  >(null);

  useEffect(() => {
    let alive = true;
    api
      .dataDir()
      .then((path) => {
        if (!alive) return;
        setDataDirStatus(
          path ? { state: "ready", path } : { state: "unavailable" },
        );
      })
      .catch(() => {
        if (alive) setDataDirStatus({ state: "unavailable" });
      });
    isEnabled()
      .then((enabled) => {
        if (alive) setAutostart(enabled);
      })
      .catch(() => {
        if (alive) setAutostart(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const settings = db.settings;

  const toggleAutostart = async (next: boolean) => {
    try {
      if (next) await enable();
      else await disable();
      setAutostart(await isEnabled());
    } catch (err) {
      setMessage({ kind: "err", text: `开机自启设置失败：${String(err)}` });
    }
  };

  const toggleSmartList = (id: ToggleableSmartViewId, visible: boolean) => {
    updateSettings({
      smartListVisibility: {
        ...settings.smartListVisibility,
        [id]: visible,
      },
    });
    if (!visible && view.type === "smart" && view.id === id) {
      setView({ type: "smart", id: "myday" });
    }
  };

  const copyDataDir = async () => {
    if (dataDirStatus.state !== "ready") return;
    try {
      await navigator.clipboard.writeText(dataDirStatus.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1800);
    } catch {
      setMessage({ kind: "err", text: "复制路径失败，请手动选中复制" });
    }
  };

  const openExternal = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const copyAppInfo = async () => {
    try {
      await navigator.clipboard.writeText(
        `MacroHard Todo v${APP_VERSION}\nDevice: ${db.deviceId}`,
      );
      setCopiedAbout(true);
      setTimeout(() => setCopiedAbout(false), 1800);
    } catch {
      setMessage({ kind: "err", text: "复制版本信息失败" });
    }
  };

  const doExportJson = async () => {
    try {
      const path = await save({
        defaultPath: "macrohard-todo-backup.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      setBusy("export-json");
      await exportJson(path);
      setMessage({ kind: "ok", text: "已导出 JSON 备份" });
    } catch (err) {
      setMessage({ kind: "err", text: `导出失败：${String(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const doImportJson = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (typeof path !== "string") return;
      setBusy("import-json");
      await importJson(path);
      setMessage({ kind: "ok", text: "已导入并合并备份" });
    } catch (err) {
      setMessage({ kind: "err", text: `导入失败：${String(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const doExportCsv = async () => {
    try {
      const path = await save({
        defaultPath: "macrohard-todo.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!path) return;
      setBusy("export-csv");
      await exportCsv(path);
      setMessage({ kind: "ok", text: "已导出 CSV" });
    } catch (err) {
      setMessage({ kind: "err", text: `导出失败：${String(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const doImportCsv = async () => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (typeof path !== "string") return;
      setBusy("import-csv");
      await importCsv(path);
      setMessage({ kind: "ok", text: "已从 CSV 导入任务" });
    } catch (err) {
      setMessage({ kind: "err", text: `导入失败：${String(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const hasWebdav = Boolean(settings.webdavUrl && settings.webdavUser);
  const syncSummary = sync.running
    ? "正在同步…"
    : sync.error
      ? `同步失败：${sync.error}`
      : hasWebdav
        ? settings.lastSyncAt
          ? `上次同步：${new Date(settings.lastSyncAt).toLocaleString("zh-CN")}`
          : "尚未同步"
        : "未配置";

  const purgeOptions = PURGE_DAY_PRESETS.includes(
    settings.autoPurgeCompletedDays as (typeof PURGE_DAY_PRESETS)[number],
  )
    ? [...PURGE_DAY_PRESETS]
    : [...PURGE_DAY_PRESETS, settings.autoPurgeCompletedDays].sort(
        (a, b) => a - b,
      );

  return (
    <div className="settings-page">
      <header className="settings-topbar">
        <button
          type="button"
          className="settings-back-btn"
          onClick={closeSettings}
          aria-label="返回"
          title="返回 (Esc)"
        >
          <BackIcon size={18} strokeWidth={1.75} />
        </button>
        <h1 className="settings-page-title">设置</h1>
      </header>

      <div className="settings-scroll">
        <div className="settings-content">
          {message ? (
            <div
              className={`status-line ${
                message.kind === "err" ? "error" : "info"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <section className="settings-profile">
            <button
              type="button"
              className={`settings-avatar ${avatarUrl ? "has-photo" : "has-logo"}`}
              onClick={() => void pickAvatar()}
              title="更换头像"
              aria-label="更换头像"
            >
              <img src={avatarUrl ?? "/logo.png"} alt="" />
            </button>
            <div className="settings-profile-info">
              <div className="settings-profile-name">本地用户</div>
              <div className="settings-profile-sub">
                {settings.webdavUser ? `WebDAV · ${settings.webdavUser}` : "本地数据"}
              </div>
            </div>
            <div className="settings-profile-actions">
              <button
                type="button"
                className="btn small"
                onClick={() => void pickAvatar()}
              >
                更换头像
              </button>
              {hasCustomAvatar ? (
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={clearAvatar}
                >
                  恢复默认
                </button>
              ) : null}
            </div>
          </section>

          <section className="settings-section">
            <h2>常规</h2>
            <SettingToggleItem
              label="在顶部添加新任务"
              checked={settings.addTasksOnTop}
              onChange={(checked) => updateSettings({ addTasksOnTop: checked })}
            />
            <SettingToggleItem
              label="将带有星标的任务移至顶部"
              checked={settings.moveStarredToTop}
              onChange={(checked) =>
                updateSettings({ moveStarredToTop: checked })
              }
            />
            <SettingToggleItem
              label="播放完成提示音"
              checked={settings.playCompletionSound}
              onChange={(checked) =>
                updateSettings({ playCompletionSound: checked })
              }
            />
            <SettingToggleItem
              label="在删除前确认"
              checked={settings.confirmBeforeDelete}
              onChange={(checked) =>
                updateSettings({ confirmBeforeDelete: checked })
              }
            />
            <SettingToggleItem
              label="使用 Windows 启动自动启动应用"
              checked={autostart}
              onChange={(checked) => void toggleAutostart(checked)}
            />
            <div className="settings-item">
              <label className="settings-item-label" htmlFor="week-start-select">
                一周的开始
              </label>
              <select
                id="week-start-select"
                className="settings-select"
                value={settings.weekStartsOn}
                onChange={(e) =>
                  updateSettings({
                    weekStartsOn: Number(e.target.value) === 0 ? 0 : 1,
                  })
                }
              >
                <option value={1}>周一</option>
                <option value={0}>周日</option>
              </select>
            </div>
          </section>

          <section className="settings-section">
            <h2>主题</h2>
            <div
              className="theme-radio-group"
              role="radiogroup"
              aria-label="主题"
            >
              {THEME_OPTIONS.map((opt) => {
                const selected = settings.theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`theme-radio ${selected ? "checked" : ""}`}
                    onClick={() => updateSettings({ theme: opt.value })}
                  >
                    <span className="theme-radio-dot" aria-hidden />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="settings-section">
            <h2>智能列表</h2>
            <div className="settings-smart-list">
              {SMART_LIST_SETTINGS.map(({ id, label, Icon, color }) => {
                const checked = settings.smartListVisibility?.[id] !== false;
                return (
                  <div key={id} className="settings-smart-row">
                    <span className="settings-smart-icon" style={{ color }}>
                      <Icon size={16} strokeWidth={1.5} />
                    </span>
                    <span className="settings-smart-label">{label}</span>
                    <ToggleSwitch
                      checked={checked}
                      ariaLabel={`显示智能列表「${label}」`}
                      onChange={(next) => toggleSmartList(id, next)}
                    />
                  </div>
                );
              })}
            </div>
            <div className="settings-sub-group">
              <SettingToggleItem
                label="自动隐藏空的智能列表"
                checked={settings.autoHideEmptySmartLists}
                onChange={(checked) =>
                  updateSettings({ autoHideEmptySmartLists: checked })
                }
              />
              <SettingToggleItem
                label="在“我的一天”中显示“今天截止”的任务"
                checked={settings.showDueTodayInMyDay}
                onChange={(checked) =>
                  updateSettings({ showDueTodayInMyDay: checked })
                }
              />
            </div>
          </section>

          <section className="settings-section">
            <h2>通知</h2>
            <SettingToggleItem
              label="提醒"
              checked={settings.reminderEnabled}
              onChange={(checked) =>
                updateSettings({ reminderEnabled: checked })
              }
            />
          </section>

          <section className="settings-section">
            <h2>同步与数据</h2>
            <div className="settings-action-list">
              <div
                className="settings-action-row clickable"
                role="button"
                tabIndex={0}
                onClick={() => openDialog("sync")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDialog("sync");
                  }
                }}
              >
                <span className="settings-action-icon">
                  <CloudIcon size={16} strokeWidth={1.5} />
                </span>
                <span className="settings-action-label">WebDAV 同步</span>
                <span className="settings-action-trail">
                  <span
                    className={`settings-action-status ${sync.error ? "error" : ""}`}
                  >
                    {syncSummary}
                  </span>
                  {hasWebdav ? (
                    <button
                      type="button"
                      className="settings-chip-btn primary"
                      disabled={sync.running}
                      onClick={(e) => {
                        e.stopPropagation();
                        void syncNow();
                      }}
                    >
                      {sync.running ? "同步中" : "同步"}
                    </button>
                  ) : null}
                  <ChevronRightIcon
                    size={16}
                    strokeWidth={1.5}
                    className="settings-action-chevron"
                  />
                </span>
              </div>

              <button
                type="button"
                className="settings-action-row clickable"
                onClick={() => openDialog("migration")}
              >
                <span className="settings-action-icon">
                  <RefreshIcon size={16} strokeWidth={1.5} />
                </span>
                <span className="settings-action-label">从微软 To Do 迁移</span>
                <span className="settings-action-trail">
                  <ChevronRightIcon
                    size={16}
                    strokeWidth={1.5}
                    className="settings-action-chevron"
                  />
                </span>
              </button>

              <div className="settings-action-row">
                <span className="settings-action-icon">
                  <DownloadIcon size={16} strokeWidth={1.5} />
                </span>
                <span className="settings-action-label">导出数据</span>
                <span className="settings-action-trail">
                  <button
                    type="button"
                    className="settings-chip-btn"
                    disabled={busy !== null}
                    onClick={() => void doExportJson()}
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    className="settings-chip-btn"
                    disabled={busy !== null}
                    onClick={() => void doExportCsv()}
                  >
                    CSV
                  </button>
                </span>
              </div>

              <div className="settings-action-row">
                <span className="settings-action-icon">
                  <UploadIcon size={16} strokeWidth={1.5} />
                </span>
                <span className="settings-action-label">导入数据</span>
                <span className="settings-action-trail">
                  <button
                    type="button"
                    className="settings-chip-btn"
                    disabled={busy !== null}
                    onClick={() => void doImportJson()}
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    className="settings-chip-btn"
                    disabled={busy !== null}
                    onClick={() => void doImportCsv()}
                  >
                    CSV
                  </button>
                </span>
              </div>

              <div className="settings-action-row">
                <span className="settings-action-icon">
                  <ClockIcon size={16} strokeWidth={1.5} />
                </span>
                <label
                  className="settings-action-label"
                  htmlFor="purge-days-select"
                >
                  自动清理已完成任务
                </label>
                <span className="settings-action-trail">
                  <select
                    id="purge-days-select"
                    className="settings-inline-select"
                    value={settings.autoPurgeCompletedDays}
                    onChange={(e) =>
                      updateSettings({
                        autoPurgeCompletedDays: Math.max(
                          0,
                          Number(e.target.value) || 0,
                        ),
                      })
                    }
                  >
                    {purgeOptions.map((days) => (
                      <option key={days} value={days}>
                        {days === 0 ? "关闭" : `${days} 天后`}
                      </option>
                    ))}
                  </select>
                </span>
              </div>

              {dataDirStatus.state === "ready" ? (
                <button
                  type="button"
                  className="settings-action-row clickable"
                  title={dataDirStatus.path}
                  onClick={() => void copyDataDir()}
                >
                  <span className="settings-action-icon">
                    <FolderIcon size={16} strokeWidth={1.5} />
                  </span>
                  <span className="settings-action-label">数据目录</span>
                  <span className="settings-action-trail">
                    <span className="settings-action-path mono">
                      {copiedPath ? "已复制路径" : dataDirStatus.path}
                    </span>
                    <CopyIcon
                      size={14}
                      strokeWidth={1.5}
                      className="settings-action-chevron"
                    />
                  </span>
                </button>
              ) : dataDirStatus.state === "unavailable" ? (
                <div className="settings-action-row">
                  <span className="settings-action-icon">
                    <FolderIcon size={16} strokeWidth={1.5} />
                  </span>
                  <span className="settings-action-label">数据目录</span>
                  <span className="settings-action-trail">
                    <span className="settings-action-status">浏览器本地存储</span>
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="settings-section settings-about">
            <h2>关于</h2>
            <div className="settings-card">
              <div className="settings-about-head">
                <div className="settings-about-logo">
                  <img src="/logo.png" alt="" />
                </div>
                <div className="settings-about-heading">
                  <div className="settings-about-name">MacroHard Todo</div>
                  <div className="settings-about-sub">
                    版本 v{APP_VERSION} · MIT
                  </div>
                </div>
                <button
                  type="button"
                  className="btn small settings-about-check-btn"
                  onClick={() => void openExternal(RELEASES_URL)}
                >
                  <RefreshIcon size={13} />
                  <span>检查更新</span>
                </button>
              </div>

              <div className="settings-card-actions">
                <button
                  type="button"
                  className="btn small"
                  onClick={() => void openExternal(REPO_URL)}
                >
                  <OpenIcon size={13} />
                  <span>GitHub 仓库</span>
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => void openExternal(RELEASES_URL)}
                >
                  <SparklesIcon size={13} />
                  <span>更新日志</span>
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => void openExternal(ISSUES_URL)}
                >
                  <InfoIcon size={13} />
                  <span>问题反馈</span>
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => void copyAppInfo()}
                >
                  <CopyIcon size={13} />
                  <span>{copiedAbout ? "已复制" : "复制版本信息"}</span>
                </button>
              </div>

              {starBannerVisible ? (
                <div className="settings-star-banner">
                  <StarFilledIcon size={16} className="settings-star-icon" />
                  <span className="settings-star-text">
                    今日待办 +1：去 GitHub 给项目点颗星
                  </span>
                  <button
                    type="button"
                    className="btn small settings-star-cta"
                    onClick={() => void openExternal(REPO_URL)}
                  >
                    <OpenIcon size={13} />
                    <span>去点 Star</span>
                  </button>
                  <button
                    type="button"
                    className="settings-star-close"
                    onClick={() => setStarBannerVisible(false)}
                    aria-label="关闭提示"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingToggleItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="settings-item">
      <div className="settings-item-label">{label}</div>
      <div className="settings-item-control">
        <ToggleSwitch checked={checked} ariaLabel={label} onChange={onChange} />
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`toggle-switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track" aria-hidden>
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-text">{checked ? "开" : "关"}</span>
    </button>
  );
}
