import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";
import { Modal } from "./Modal";
import {
  CloudIcon,
  DownloadIcon,
  FolderIcon,
  InfoIcon,
  RefreshIcon,
  UploadIcon,
} from "./icons";

export function SettingsDialog() {
  const db = useStore((s) => s.db);
  const openDialog = useStore((s) => s.openDialog);
  const updateSettings = useStore((s) => s.updateSettings);
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);
  const exportCsv = useStore((s) => s.exportCsv);
  const importCsv = useStore((s) => s.importCsv);
  const sync = useStore((s) => s.sync);

  const [dataDir, setDataDir] = useState("");
  const [autostart, setAutostart] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<
    { kind: "ok" | "err" | "info"; text: string } | null
  >(null);

  useEffect(() => {
    api
      .dataDir()
      .then(setDataDir)
      .catch(() => setDataDir(""));
    isEnabled()
      .then(setAutostart)
      .catch(() => setAutostart(false));
  }, []);

  const close = () => openDialog(null);

  const toggleAutostart = async () => {
    try {
      if (autostart) await disable();
      else await enable();
      setAutostart(await isEnabled());
    } catch (err) {
      setMessage({ kind: "err", text: `开机自启设置失败：${String(err)}` });
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

  return (
    <Modal
      title="设置"
      onClose={close}
      footer={
        <>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            MacroHard Todo 0.1.0
          </span>
          <span className="spacer" />
          <button className="btn primary" onClick={close}>
            完成
          </button>
        </>
      }
    >
      {message ? (
        <div
          className={`status-line ${
            message.kind === "ok" ? "info" : message.kind === "err" ? "error" : "info"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="settings-section">
        <h3>外观</h3>
        <div className="radio-group">
          {(
            [
              ["light", "浅色"],
              ["dark", "深色"],
              ["system", "跟随系统"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={`radio-chip ${
                db.settings.theme === value ? "active" : ""
              }`}
              onClick={() => updateSettings({ theme: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>启动与提醒</h3>
        <div className="settings-line">
          <div className="grow">
            <div>开机自动启动</div>
            <div className="sub">配合托盘常驻，关闭窗口后仍能收到提醒</div>
          </div>
          <button
            className={`btn small ${autostart ? "primary" : ""}`}
            onClick={toggleAutostart}
          >
            {autostart ? "已开启" : "开启"}
          </button>
        </div>
        <div className="settings-line">
          <div className="grow">
            <div>任务提醒</div>
            <div className="sub">应用运行时检查；到期后通过系统通知提醒</div>
          </div>
          <button
            className={`btn small ${
              db.settings.reminderEnabled ? "primary" : ""
            }`}
            onClick={() =>
              updateSettings({
                reminderEnabled: !db.settings.reminderEnabled,
              })
            }
          >
            {db.settings.reminderEnabled ? "已开启" : "关闭"}
          </button>
        </div>
        <div className="settings-line">
          <div className="grow">
            <div>全局快速添加</div>
            <div className="sub">在任何程序里按 Ctrl + Alt + T</div>
          </div>
        </div>
        <div className="settings-line">
          <div className="grow">
            <div>关闭窗口时</div>
            <div className="sub">最小化到系统托盘，从托盘菜单可退出</div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>数据</h3>
        <div className="settings-line">
          <FolderIcon />
          <div className="grow">
            <div>数据目录</div>
            <div className="sub mono">{dataDir || "（读取中）"}</div>
          </div>
        </div>
        <div className="settings-line">
          <div className="grow">
            <div>自动清理已完成的旧任务</div>
            <div className="sub">0 表示不自动清理</div>
          </div>
          <input
            type="number"
            min={0}
            className="date-input"
            style={{ width: 72 }}
            value={db.settings.autoPurgeCompletedDays}
            onChange={(e) =>
              updateSettings({
                autoPurgeCompletedDays: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>天</span>
        </div>
        <div className="settings-line" style={{ flexWrap: "wrap", gap: 8 }}>
          <button
            className="btn small"
            disabled={busy !== null}
            onClick={doExportJson}
          >
            <DownloadIcon /> 导出 JSON
          </button>
          <button
            className="btn small"
            disabled={busy !== null}
            onClick={doImportJson}
          >
            <UploadIcon /> 导入 JSON
          </button>
          <button
            className="btn small"
            disabled={busy !== null}
            onClick={doExportCsv}
          >
            <DownloadIcon /> 导出 CSV
          </button>
          <button
            className="btn small"
            disabled={busy !== null}
            onClick={doImportCsv}
          >
            <UploadIcon /> 导入 CSV
          </button>
        </div>
        <div className="hint" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          导入 JSON 会与现有数据按修改时间合并，不会直接覆盖。
        </div>
      </div>

      <div className="settings-section">
        <h3>同步与迁移</h3>
        <div className="settings-line">
          <CloudIcon />
          <div className="grow">
            <div>WebDAV 同步</div>
            <div className="sub">
              {db.settings.webdavUrl
                ? db.settings.lastSyncAt
                  ? `上次同步：${new Date(
                      db.settings.lastSyncAt,
                    ).toLocaleString("zh-CN")}`
                  : "已配置，尚未同步"
                : "未配置（坚果云 / Nextcloud / 群晖）"}
              {sync.error ? ` · ${sync.error}` : ""}
            </div>
          </div>
          <button className="btn small" onClick={() => openDialog("sync")}>
            配置
          </button>
        </div>
        <div className="settings-line">
          <RefreshIcon />
          <div className="grow">
            <div>从微软 To Do 迁移</div>
            <div className="sub">通过 Microsoft Graph 拉取现有列表与任务</div>
          </div>
          <button className="btn small" onClick={() => openDialog("migration")}>
            开始迁移
          </button>
        </div>
      </div>

      <div className="status-line info">
        <InfoIcon />
        <span>
          本应用是独立实现，与微软没有关联，也不包含微软的任何素材。数据和同步凭据只保存在你的电脑与你自己选择的网盘中。
        </span>
      </div>
    </Modal>
  );
}
