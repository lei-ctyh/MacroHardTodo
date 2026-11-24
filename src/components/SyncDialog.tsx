import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { resolveDataUrl } from "../lib/syncClient";
import { useStore } from "../store/useStore";
import { Modal } from "./Modal";
import { CloudIcon, InfoIcon, SyncIcon } from "./icons";

export function SyncDialog() {
  const db = useStore((s) => s.db);
  const openDialog = useStore((s) => s.openDialog);
  const updateSettings = useStore((s) => s.updateSettings);
  const syncNow = useStore((s) => s.syncNow);
  const sync = useStore((s) => s.sync);

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
        resolveDataUrl(url),
        user.trim(),
        password,
      );
      if ([200, 207, 404].includes(res.status)) {
        setTestResult({
          ok: true,
          text: `连接成功（HTTP ${res.status}${res.server ? ` · ${res.server}` : ""}）`,
        });
      } else if (res.status === 401) {
        setTestResult({
          ok: false,
          text: "认证失败：坚果云请使用「应用密码」而不是登录密码",
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

  return (
    <Modal
      title="WebDAV 同步"
      onClose={close}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={close}>
            关闭
          </button>
          <button
            className="btn primary"
            onClick={saveAndSync}
            disabled={sync.running}
          >
            {sync.running ? <span className="spinner" /> : <SyncIcon />}
            保存并同步
          </button>
        </>
      }
    >
      <div className="status-line info">
        <InfoIcon />
        <span>
          推荐坚果云：地址填{" "}
          <span className="mono">https://dav.jianguoyun.com/dav/你的文件夹</span>
          ，用户名用登录邮箱，密码用「安全选项 → 应用密码」。请先在网盘里创建该文件夹。
        </span>
      </div>

      <div className="form-row">
        <label>WebDAV 地址</label>
        <input
          type="text"
          value={url}
          placeholder="https://dav.jianguoyun.com/dav/MyTasks"
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="hint">
          可填目录或完整文件地址；默认会在目录下创建 MacroHardTodo/data.json。
        </div>
      </div>

      <div className="form-row">
        <label>用户名</label>
        <input
          type="text"
          value={user}
          placeholder="登录邮箱"
          onChange={(e) => setUser(e.target.value)}
        />
      </div>

      <div className="form-row">
        <label>密码 / 应用密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="hint">保存在 Windows 凭据管理器，不写入数据文件。</div>
      </div>

      <div className="form-row">
        <label>
          <input
            type="checkbox"
            checked={encrypt}
            onChange={(e) => setEncrypt(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          启用端到端加密（AES-256-GCM）
        </label>
        {encrypt ? (
          <input
            type="password"
            value={passphrase}
            placeholder="加密口令（请务必记住）"
            onChange={(e) => setPassphrase(e.target.value)}
          />
        ) : null}
        <div className="hint">
          加密后网盘里只保存密文；口令丢失将无法恢复，请自行备份。
        </div>
      </div>

      {testResult ? (
        <div className={`status-line ${testResult.ok ? "info" : "error"}`}>
          {testResult.text}
        </div>
      ) : null}

      {sync.error ? (
        <div className="status-line error">{sync.error}</div>
      ) : sync.message ? (
        <div className="status-line info">{sync.message}</div>
      ) : null}

      <div className="settings-line">
        <CloudIcon />
        <div className="grow">
          <div>当前状态</div>
          <div className="sub">
            {sync.running
              ? "正在同步…"
              : db.settings.lastSyncAt
                ? `上次同步：${new Date(db.settings.lastSyncAt).toLocaleString("zh-CN")}`
                : "尚未同步"}
          </div>
        </div>
        <button
          className="btn small"
          onClick={test}
          disabled={testing || sync.running}
        >
          {testing ? <span className="spinner" /> : null}
          测试连接
        </button>
      </div>

      <div className="status-line warn">
        两台设备同时编辑时，按任务的最后修改时间合并，删除用墓碑标记；同一任务在两边都被修改时以较新的为准。
      </div>
    </Modal>
  );
}
