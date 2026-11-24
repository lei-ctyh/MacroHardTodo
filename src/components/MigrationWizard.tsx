import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, type GraphDeviceInfo, type GraphListRawLite } from "../lib/api";
import {
  applyGraphImport,
  type GraphListRaw,
  type GraphTaskRaw,
  type ImportStats,
} from "../lib/graphImport";
import { useStore } from "../store/useStore";
import { Modal } from "./Modal";
import {
  BackIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  InfoIcon,
  OpenIcon,
  PersonIcon,
  WarningIcon,
} from "./icons";

type Step = "config" | "auth" | "fetching" | "preview" | "done";

export function MigrationWizard() {
  const db = useStore((s) => s.db);
  const openDialog = useStore((s) => s.openDialog);
  const updateSettings = useStore((s) => s.updateSettings);
  const replaceDb = useStore((s) => s.replaceDb);

  const [step, setStep] = useState<Step>("config");
  const [clientId, setClientId] = useState(db.settings.graphClientId ?? "");
  const [device, setDevice] = useState<GraphDeviceInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [lists, setLists] = useState<GraphListRawLite[]>([]);
  const [tasksByList, setTasksByList] = useState<Record<string, GraphTaskRaw[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => openDialog(null);

  const totals = useMemo(() => {
    let tasks = 0;
    let steps = 0;
    for (const id of selected) {
      const items = tasksByList[id] ?? [];
      tasks += items.length;
      for (const t of items) steps += t.checklistItems?.length ?? 0;
    }
    return { tasks, steps };
  }, [selected, tasksByList]);

  const start = async () => {
    setError(null);
    if (!clientId.trim()) {
      setError("请填写应用程序(客户端) ID");
      return;
    }
    try {
      updateSettings({ graphClientId: clientId.trim() });
      const info = await api.graphDeviceStart(clientId.trim());
      setDevice(info);
      setStep("auth");
      try {
        await openUrl(info.verificationUri);
      } catch {
        /* 用户可手动打开 */
      }
    } catch (err) {
      setError(String(err));
    }
  };

  // 轮询设备码授权
  useEffect(() => {
    if (step !== "auth" || !device) return;
    let disposed = false;
    let interval = Math.max(3, device.interval || 5);
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await api.graphPollToken(clientId.trim(), device.deviceCode);
        if (disposed) return;
        if (res.status === "ok" && res.accessToken) {
          setToken(res.accessToken);
          setStep("fetching");
          return;
        }
        if (res.status === "pending") {
          timer = setTimeout(poll, interval * 1000);
          return;
        }
        if (res.status === "slow_down") {
          interval += 5;
          timer = setTimeout(poll, interval * 1000);
          return;
        }
        setError(res.message ?? "授权未完成，请重试");
      } catch (err) {
        if (!disposed) setError(String(err));
      }
    };

    timer = setTimeout(poll, interval * 1000);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [step, device, clientId]);

  // 拉取全部列表与任务
  useEffect(() => {
    if (step !== "fetching" || !token) return;
    let disposed = false;
    (async () => {
      try {
        setProgress("正在读取列表…");
        const all: GraphListRawLite[] = [];
        let next: string | null = null;
        do {
          const page = await api.graphListLists(token, next);
          all.push(...page.items);
          next = page.nextLink;
        } while (next);

        const byList: Record<string, GraphTaskRaw[]> = {};
        let done = 0;
        for (const list of all) {
          setProgress(
            `正在读取「${list.displayName ?? "未命名列表"}」（${done + 1}/${all.length}）…`,
          );
          let tnext: string | null = null;
          const items: GraphTaskRaw[] = [];
          do {
            const page = await api.graphListTasks(token, list.id, tnext);
            items.push(...(page.items as unknown as GraphTaskRaw[]));
            tnext = page.nextLink;
          } while (tnext);
          byList[list.id] = items;
          done++;
        }
        if (disposed) return;
        setLists(all);
        setTasksByList(byList);
        setSelected(new Set(all.map((l) => l.id)));
        setStep("preview");
      } catch (err) {
        if (!disposed) setError(String(err));
      }
    })();
    return () => {
      disposed = true;
    };
  }, [step, token]);

  const doImport = () => {
    try {
      const chosen = lists.filter((l) => selected.has(l.id));
      const filtered: Record<string, GraphTaskRaw[]> = {};
      for (const l of chosen) filtered[l.id] = tasksByList[l.id] ?? [];
      const result = applyGraphImport(
        db,
        db.deviceId,
        chosen as unknown as GraphListRaw[],
        filtered,
      );
      replaceDb(result.db);
      setStats(result.stats);
      setStep("done");
    } catch (err) {
      setError(String(err));
    }
  };

  const copyCode = async () => {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Modal
      title="从微软 To Do 迁移"
      wide
      onClose={close}
      footer={
        <>
          {step === "preview" ? (
            <button className="btn" onClick={() => setStep("config")}>
              <BackIcon /> 上一步
            </button>
          ) : null}
          <span className="spacer" />
          {step === "config" ? (
            <button className="btn primary" onClick={start}>
              <PersonIcon /> 登录微软账号
            </button>
          ) : null}
          {step === "preview" ? (
            <button className="btn primary" onClick={doImport}>
              <DownloadIcon /> 导入所选（{totals.tasks} 个任务）
            </button>
          ) : null}
          {step === "done" ? (
            <button className="btn primary" onClick={close}>
              完成
            </button>
          ) : null}
          {step === "auth" || step === "fetching" ? (
            <button className="btn" onClick={close}>
              取消
            </button>
          ) : null}
        </>
      }
    >
      {error ? (
        <div className="status-line error">
          <WarningIcon />
          <span>{error}</span>
        </div>
      ) : null}

      {step === "config" ? (
        <>
          <div className="status-line info">
            <InfoIcon />
            <span>
              迁移通过微软官方 Microsoft Graph 接口读取你自己的数据，只在本次迁移时使用访问令牌，不会上传到任何第三方。
            </span>
          </div>

          <div className="form-row">
            <label>应用程序(客户端) ID</label>
            <input
              type="text"
              value={clientId}
              placeholder="例如 11111111-2222-3333-4444-555555555555"
              onChange={(e) => setClientId(e.target.value)}
            />
            <div className="hint">
              需要一个免费的 Entra 应用注册（一次性，约 3 分钟），见下方步骤。
            </div>
          </div>

          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              如何获取客户端 ID
            </summary>
            <ol
              style={{
                fontSize: 12,
                lineHeight: 1.9,
                color: "var(--text-secondary)",
                paddingLeft: 20,
                marginTop: 8,
              }}
            >
              <li>
                打开{" "}
                <button
                  className="btn small"
                  onClick={() =>
                    openUrl("https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade").catch(
                      () => {},
                    )
                  }
                >
                  <OpenIcon /> Entra 应用注册
                </button>
              </li>
              <li>点击「新注册」，名称随意。</li>
              <li>受支持的帐户类型选择「仅个人 Microsoft 帐户」或「任何组织目录 + 个人帐户」。</li>
              <li>重定向 URI 留空，直接「注册」。</li>
              <li>在概述页复制「应用程序(客户端) ID」。</li>
              <li>进入「身份验证」→ 允许公共客户端流 → 选「是」并保存。</li>
              <li>进入「API 权限」→ 添加权限 → Microsoft Graph → 委托的权限 → 勾选 Tasks.Read → 添加。</li>
            </ol>
          </details>

          <div className="status-line warn">
            可迁移：列表、任务、步骤、截止日期、提醒、重要、重复规则、备注。
            无法迁移：My Day 的历史安排、标记邮件（Graph 接口不提供）。
          </div>
        </>
      ) : null}

      {step === "auth" && device ? (
        <>
          <div className="status-line info">
            <InfoIcon />
            <span>
              已在浏览器中打开微软登录页。输入下面的代码并完成登录；如果浏览器没有打开，请访问{" "}
              <span className="mono">{device.verificationUri}</span>。
            </span>
          </div>
          <div className="code-box">
            <span className="mono">{device.userCode}</span>
            <button className="icon-btn" onClick={copyCode} title="复制代码">
              <CopyIcon />
            </button>
          </div>
          {copied ? (
            <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 6 }}>
              已复制
            </div>
          ) : null}
          <div className="settings-line" style={{ marginTop: 10 }}>
            <span className="spinner" />
            <div className="grow">
              <div>等待登录完成…</div>
              <div className="sub">登录后会自动继续，无需刷新</div>
            </div>
            <button
              className="btn small"
              onClick={() => openUrl(device.verificationUri).catch(() => {})}
            >
              重新打开登录页
            </button>
          </div>
        </>
      ) : null}

      {step === "fetching" ? (
        <div className="settings-line">
          <span className="spinner" />
          <div className="grow">
            <div>{progress || "正在读取…"}</div>
            <div className="sub">数据量较大时需要一点时间，请勿关闭窗口</div>
          </div>
        </div>
      ) : null}

      {step === "preview" ? (
        <>
          <div className="status-line info">
            <InfoIcon />
            <span>
              找到 {lists.length} 个列表，共 {totals.tasks} 个任务、{totals.steps} 个步骤。默认全部导入，可取消勾选不需要的列表。
            </span>
          </div>
          <div className="list-picker">
            {lists.map((list) => {
              const count = tasksByList[list.id]?.length ?? 0;
              const checked = selected.has(list.id);
              return (
                <label key={list.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(list.id);
                      else next.delete(list.id);
                      setSelected(next);
                    }}
                  />
                  <span style={{ flex: 1 }}>{list.displayName ?? "未命名列表"}</span>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {count} 项
                  </span>
                </label>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "var(--text-tertiary)",
              display: "flex",
              gap: 6,
            }}
          >
            <CheckIcon />
            重复运行只会补充新任务，不会重复创建。
          </div>
        </>
      ) : null}

      {step === "done" && stats ? (
        <>
          <div className="status-line info">
            <CheckIcon />
            <span>迁移完成。</span>
          </div>
          <div className="settings-line">
            <div className="grow">新建列表</div>
            <strong>{stats.createdLists}</strong>
          </div>
          <div className="settings-line">
            <div className="grow">新建任务</div>
            <strong>{stats.createdTasks}</strong>
          </div>
          <div className="settings-line">
            <div className="grow">跳过已存在的任务</div>
            <strong>{stats.skippedTasks}</strong>
          </div>
          <div className="status-line warn">
            建议现在到设置里导出一次 JSON 备份，或者配置 WebDAV 同步。
          </div>
        </>
      ) : null}
    </Modal>
  );
}
