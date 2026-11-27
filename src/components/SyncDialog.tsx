import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { resolveTestUrl } from "../lib/syncClient";
import { useStore } from "../store/useStore";
import { Modal } from "./Modal";
import { ToggleSwitch } from "./ToggleSwitch";
import { CloudIcon, CompletedIcon, SyncIcon, WarningIcon } from "./icons";

type ProviderId = "jianguoyun" | "nextcloud" | "custom";

const PROVIDERS: {
  id: ProviderId;
  label: string;
  prefix: string;
  urlPlaceholder: string;
  userPlaceholder: string;
  passLabel: string;
  passPlaceholder: string;
}[] = [
  {
    id: "jianguoyun",
    label: "坚果云",
    prefix: "https://dav.jianguoyun.com/dav/",
    urlPlaceholder: "https://dav.jianguoyun.com/dav/",
    userPlaceholder: "登录邮箱",
    passLabel: "应用密码",
    passPlaceholder: "在安全选项中生成的应用密码",
  },
  {
    id: "nextcloud",
    label: "Nextcloud",
    prefix: "https://",
    urlPlaceholder: "https://cloud.example.com/remote.php/dav/files/user/MyTasks",
    userPlaceholder: "用户名",
    passLabel: "应用密码 / 密码",
    passPlaceholder: "密码",
  },
  {
    id: "custom",
    label: "群晖 / 自定义",
    prefix: "https://",
    urlPlaceholder: "https://dav.example.com/MyTasks",
    userPlaceholder: "用户名",
    passLabel: "密码",
    passPlaceholder: "密码",
  },
];

function detectProvider(rawUrl?: string): ProviderId {
  const lower = (rawUrl ?? "").toLowerCase();
  if (!lower || lower.includes("jianguoyun.com")) return "jianguoyun";
  if (lower.includes("remote.php/dav")) return "nextcloud";
  return "custom";
}

export function SyncDialog() {
  const db = useStore((s) => s.db);
  const openDialog = useStore((s) => s.openDialog);
  const updateSettings = useStore((s) => s.updateSettings);
  const syncNow = useStore((s) => s.syncNow);
  const sync = useStore((s) => s.sync);

  const [provider, setProvider] = useState<ProviderId>(() =>
    detectProvider(db.settings.webdavUrl),
  );
  const [url, setUrl] = useState(db.settings.webdavUrl ?? "");
  const [user, setUser] = useState(db.settings.webdavUser ?? "");
  const [password, setPassword] = useState("");
  const [encrypt, setEncrypt] = useState(Boolean(db.settings.webdavEncrypt));
  const [passphrase, setPassphrase] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; text: string } | null
  >(null);

  useEffect(() => {
    (async () => {
      try {
        setPassword((await api.secretGet("webdav-password")) ?? "");
        setPassphrase((await api.secretGet("sync-passphrase")) ?? "");
      } catch {
        /* 浏览器环境 */
      }
    })();
  }, []);

  const currentProvider =
    PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  const selectProvider = (nextId: ProviderId) => {
    const next = PROVIDERS.find((p) => p.id === nextId);
    if (!next) return;
    const trimmed = url.trim();
    const isTemplate =
      !trimmed || PROVIDERS.some((p) => p.prefix === trimmed);
    if (isTemplate) {
      setUrl(nextId === "jianguoyun" ? next.prefix : "");
    }
    setProvider(nextId);
    setTestResult(null);
  };

  const close = () => openDialog(null);

  const test = async () => {
    if (!url.trim() || !user.trim()) {
      setTestResult({ ok: false, text: "请先填写地址和用户名" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.webdavTest(
        resolveTestUrl(url),
        user.trim(),
        password,
      );
      if ([200, 207].includes(res.status)) {
        setTestResult({
          ok: true,
          text: "连接成功",
        });
      } else if (res.status === 401) {
        setTestResult({
          ok: false,
          text: "认证失败：请检查用户名与密码（坚果云需使用应用密码）",
        });
      } else if (res.status === 403) {
        setTestResult({
          ok: false,
          text: "无访问权限（HTTP 403），请检查账号权限或应用密码",
        });
      } else if (res.status === 404 || res.status === 409) {
        setTestResult({
          ok: false,
          text: "目标文件夹不存在，请先在网盘中创建该目录，或直接点「保存并同步」尝试自动创建",
        });
      } else {
        setTestResult({ ok: false, text: `服务器返回 HTTP ${res.status}` });
      }
    } catch (err) {
      setTestResult({ ok: false, text: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const saveAndSync = async () => {
    if (!url.trim() || !user.trim()) {
      setTestResult({ ok: false, text: "请先填写地址和用户名" });
      return;
    }
    if (encrypt && !passphrase) {
      setTestResult({ ok: false, text: "开启加密时必须填写口令" });
      return;
    }
    setTestResult(null);
    try {
      updateSettings({
        webdavUrl: url.trim(),
        webdavUser: user.trim(),
        webdavEncrypt: encrypt,
      });
      await api.secretSet("webdav-password", password);
      if (encrypt) await api.secretSet("sync-passphrase", passphrase);
      await syncNow();
    } catch (err) {
      setTestResult({ ok: false, text: String(err) });
    }
  };

  const lastSyncAt = db.settings.lastSyncAt
    ? new Date(db.settings.lastSyncAt).toLocaleString("zh-CN")
    : null;

  const statusNode = (() => {
    if (testResult) {
      return (
        <div className={`status-line ${testResult.ok ? "success" : "error"}`}>
          {testResult.ok ? (
            <CompletedIcon size={15} />
          ) : (
            <WarningIcon size={15} />
          )}
          <span className="status-line-text">{testResult.text}</span>
        </div>
      );
    }
    if (sync.error) {
      return (
        <div className="status-line error">
          <WarningIcon size={15} />
          <span className="status-line-text">{sync.error}</span>
        </div>
      );
    }
    if (sync.message) {
      return (
        <div className="status-line success">
          <CompletedIcon size={15} />
          <span className="status-line-text">{sync.message}</span>
          {lastSyncAt ? (
            <span className="status-line-time">{lastSyncAt}</span>
          ) : null}
        </div>
      );
    }
    if (sync.running || lastSyncAt) {
      return (
        <div className="dialog-meta-bar">
          <CloudIcon size={14} strokeWidth={1.6} />
          <span>
            {sync.running ? "正在同步…" : `上次同步：${lastSyncAt}`}
          </span>
        </div>
      );
    }
    return null;
  })();

  return (
    <Modal
      title="WebDAV 同步"
      onClose={close}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={() => void test()}
            disabled={testing || sync.running}
          >
            {testing ? <span className="spinner" /> : null}
            测试连接
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={close}>
            取消
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void saveAndSync()}
            disabled={sync.running}
          >
            {sync.running ? <span className="spinner" /> : <SyncIcon size={14} />}
            保存并同步
          </button>
        </>
      }
    >
      <div className="segmented" role="tablist" aria-label="网盘服务">
        {PROVIDERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={provider === item.id}
            className={`segmented-item ${provider === item.id ? "active" : ""}`}
            onClick={() => selectProvider(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="form-row">
        <label htmlFor="sync-url">服务器地址</label>
        <input
          id="sync-url"
          type="text"
          value={url}
          placeholder={currentProvider.urlPlaceholder}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="form-grid-2">
        <div className="form-row">
          <label htmlFor="sync-user">用户名</label>
          <input
            id="sync-user"
            type="text"
            value={user}
            placeholder={currentProvider.userPlaceholder}
            onChange={(e) => setUser(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="sync-pass">{currentProvider.passLabel}</label>
          <input
            id="sync-pass"
            type="password"
            value={password}
            placeholder={currentProvider.passPlaceholder}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      <div className="dialog-toggle-row">
        <div className="dialog-toggle-label">
          <span>端到端加密</span>
          <span className="dialog-pill">AES-256</span>
        </div>
        <ToggleSwitch
          checked={encrypt}
          showText={false}
          ariaLabel="启用端到端加密"
          onChange={setEncrypt}
        />
      </div>

      {encrypt ? (
        <div className="form-row" style={{ marginTop: 8 }}>
          <label htmlFor="sync-passphrase">加密口令</label>
          <input
            id="sync-passphrase"
            type="password"
            value={passphrase}
            placeholder="输入加密口令（丢失无法恢复）"
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </div>
      ) : null}

      {statusNode}
    </Modal>
  );
}
