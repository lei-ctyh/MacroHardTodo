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
  CheckSmallIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  OpenIcon,
  PersonIcon,
  WarningIcon,
} from "./icons";

type Step = "config" | "auth" | "fetching" | "preview" | "done";

const WIZARD_STEPS = ["配置", "授权", "选择", "完成"] as const;
const ENTRA_PORTAL_URL =
  "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade";

function stepIndex(step: Step): number {
  switch (step) {
    case "config":
      return 0;
    case "auth":
    case "fetching":
      return 1;
    case "preview":
      return 2;
    case "done":
      return 3;
  }
}

export function MigrationWizard() {
  const db = useStore((s) => s.db);
  const openDialog = useStore((s) => s.openDialog);
  const updateSettings = useStore((s) => s.updateSettings);
  const replaceDb = useStore((s) => s.replaceDb);

  const [step, setStep] = useState<Step>("config");
  const [clientId, setClientId] = useState(db.settings.graphClientId ?? "");
  const [guideOpen, setGuideOpen] = useState(false);
  const [device, setDevice] = useState<GraphDeviceInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [lists, setLists] = useState<GraphListRawLite[]>([]);
  const [tasksByList, setTasksByList] = useState<Record<string, GraphTaskRaw[]>>(
    {},
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState("");
  const [authNotice, setAuthNotice] = useState<string | null>(null);
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
    setAuthNotice(null);
    if (!clientId.trim()) {
      setError("请先填写应用程序 (客户端) ID");
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

  // 轮询设备码授权（网络抖动自动重试，直到成功、明确拒绝或设备码过期）
  useEffect(() => {
    if (step !== "auth" || !device) return;
    let disposed = false;
    let interval = Math.max(3, device.interval || 5);
    let consecutiveFailures = 0;
    const expiresAt = Date.now() + (device.expiresIn || 900) * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = (delaySec: number) => {
      if (disposed) return;
      if (Date.now() >= expiresAt) {
        setAuthNotice(null);
        setError("设备码已过期，请重新获取");
        return;
      }
      timer = setTimeout(poll, delaySec * 1000);
    };

    const poll = async () => {
      try {
        const res = await api.graphPollToken(clientId.trim(), device.deviceCode);
        if (disposed) return;
        consecutiveFailures = 0;
        setAuthNotice(null);
        if (res.status === "ok" && res.accessToken) {
          setError(null);
          setToken(res.accessToken);
          setStep("fetching");
          return;
        }
        if (res.status === "pending") {
          scheduleNext(interval);
          return;
        }
        if (res.status === "slow_down") {
          interval += 5;
          scheduleNext(interval);
          return;
        }
        setError(res.message ?? "授权未完成，请重试");
      } catch {
        if (disposed) return;
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) {
          setAuthNotice(`网络波动，正在自动重试（第 ${consecutiveFailures} 次）…`);
        }
        scheduleNext(Math.min(10, interval + consecutiveFailures));
      }
    };

    scheduleNext(interval);
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

  const allSelected = lists.length > 0 && selected.size === lists.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(lists.map((l) => l.id)));
  };

  const activeIdx = stepIndex(step);

  return (
    <Modal
      title="从微软 To Do 迁移"
      onClose={close}
      footer={
        <>
          {step === "preview" ? (
            <button
              type="button"
              className="btn"
              onClick={() => setStep("config")}
            >
              <BackIcon size={14} /> 上一步
            </button>
          ) : null}
          <span className="spacer" />
          {step === "config" ? (
            <>
              <button type="button" className="btn" onClick={close}>
                取消
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => void start()}
              >
                <PersonIcon size={14} /> 登录微软账号
              </button>
            </>
          ) : null}
          {step === "preview" ? (
            <button
              type="button"
              className="btn primary"
              disabled={selected.size === 0}
              onClick={doImport}
            >
              <DownloadIcon size={14} /> 导入所选（{totals.tasks}）
            </button>
          ) : null}
          {step === "done" ? (
            <button type="button" className="btn primary" onClick={close}>
              完成
            </button>
          ) : null}
          {step === "auth" || step === "fetching" ? (
            <>
              {step === "auth" && error ? (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void start()}
                >
                  重新获取设备码
                </button>
              ) : null}
              <button type="button" className="btn" onClick={close}>
                取消
              </button>
            </>
          ) : null}
        </>
      }
    >
      <div className="wizard-steps" aria-label="迁移步骤">
        {WIZARD_STEPS.map((label, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          return (
            <div
              key={label}
              className={`wizard-step ${active ? "active" : ""} ${
                done ? "done" : ""
              }`}
            >
              <span className="wizard-step-dot">
                {done ? <CheckSmallIcon size={11} /> : idx + 1}
              </span>
              <span className="wizard-step-label">{label}</span>
              {idx < WIZARD_STEPS.length - 1 ? (
                <span className="wizard-step-line" aria-hidden />
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="status-line error">
          <WarningIcon size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      {step === "config" ? (
        <>
          <div className="form-row">
            <label htmlFor="graph-client-id">应用程序 (客户端) ID</label>
            <input
              id="graph-client-id"
              type="text"
              value={clientId}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>

          <div className="wizard-guide">
            <div className="wizard-guide-head">
              <button
                type="button"
                className="wizard-guide-toggle"
                aria-expanded={guideOpen}
                onClick={() => setGuideOpen((open) => !open)}
              >
                {guideOpen ? (
                  <ChevronDownIcon size={15} />
                ) : (
                  <ChevronRightIcon size={15} />
                )}
                <span>如何获取客户端 ID</span>
              </button>
              <button
                type="button"
                className="wizard-link-btn"
                onClick={() => void openUrl(ENTRA_PORTAL_URL).catch(() => {})}
              >
                <span>打开 Azure Portal</span>
                <OpenIcon size={12} />
              </button>
            </div>
            {guideOpen ? (
              <ol className="wizard-guide-list">
                <li>在 Entra 应用注册中点击「新注册」，名称随意。</li>
                <li>帐户类型选「仅个人 Microsoft 帐户」或「任何组织目录 + 个人帐户」。</li>
                <li>重定向 URI 留空，直接点击「注册」，复制概述页的客户端 ID。</li>
                <li>进入「身份验证」→ 开启「允许公共客户端流」并保存。</li>
                <li>进入「API 权限」→ 添加 Microsoft Graph 委托权限 Tasks.Read。</li>
              </ol>
            ) : null}
          </div>
        </>
      ) : null}

      {step === "auth" && device ? (
        <div className="wizard-auth">
          <div className="code-card">
            <div className="code-card-value mono">{device.userCode}</div>
            <button
              type="button"
              className="btn small"
              onClick={() => void copyCode()}
            >
              <CopyIcon size={13} />
              {copied ? "已复制" : "复制代码"}
            </button>
          </div>
          <div className="wizard-auth-status">
            {!error ? <span className="spinner" /> : null}
            <span>
              {error
                ? "授权已中断"
                : authNotice ?? "请在浏览器输入代码完成登录…"}
            </span>
            <button
              type="button"
              className="wizard-link-btn"
              onClick={() =>
                void openUrl(device.verificationUri).catch(() => {})
              }
            >
              <span>重新打开</span>
              <OpenIcon size={12} />
            </button>
          </div>
        </div>
      ) : null}

      {step === "fetching" ? (
        <div className="wizard-loading">
          <span className="spinner" />
          <span>{progress || "正在读取列表与任务…"}</span>
        </div>
      ) : null}

      {step === "preview" ? (
        <>
          <div className="wizard-preview-head">
            <span>
              已选 {selected.size} / {lists.length} 个列表 · {totals.tasks}{" "}
              个任务
              {totals.steps > 0 ? ` · ${totals.steps} 个步骤` : ""}
            </span>
            <button
              type="button"
              className="wizard-link-btn"
              onClick={toggleAll}
            >
              {allSelected ? "取消全选" : "全选"}
            </button>
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
                  <span className="check-row-name">
                    {list.displayName ?? "未命名列表"}
                  </span>
                  <span className="check-row-count">{count}</span>
                </label>
              );
            })}
          </div>
        </>
      ) : null}

      {step === "done" && stats ? (
        <div className="wizard-done">
          <div className="wizard-done-icon">
            <CheckIcon size={22} />
          </div>
          <div className="wizard-done-title">迁移完成</div>
          <div className="wizard-stats">
            <div className="wizard-stat-card">
              <div className="wizard-stat-num">{stats.createdLists}</div>
              <div className="wizard-stat-label">新建列表</div>
            </div>
            <div className="wizard-stat-card">
              <div className="wizard-stat-num">{stats.createdTasks}</div>
              <div className="wizard-stat-label">新建任务</div>
            </div>
            <div className="wizard-stat-card">
              <div className="wizard-stat-num">{stats.skippedTasks}</div>
              <div className="wizard-stat-label">跳过重复</div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
