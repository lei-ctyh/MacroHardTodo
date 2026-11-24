import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";
import {
  activeLists,
  type RecurrenceRule,
} from "../lib/model";
import {
  dueLabel,
  reminderLabel,
  todayISO,
} from "../lib/dates";
import { describeRecurrence, WEEKDAY_NAMES } from "../lib/recurrence";
import {
  AttachIcon,
  BellIcon,
  CalendarIcon,
  CheckIcon,
  CheckSmallIcon,
  CloseIcon,
  CopyIcon,
  FolderIcon,
  PlusIcon,
  RepeatIcon,
  StarFilledIcon,
  StarOutlineIcon,
  SunIcon,
  TrashIcon,
} from "./icons";

function toLocalInput(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TaskDetail() {
  const db = useStore((s) => s.db);
  const selectedId = useStore((s) => s.selectedTaskId);
  const selectTask = useStore((s) => s.selectTask);
  const updateTask = useStore((s) => s.updateTask);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const deleteTask = useStore((s) => s.deleteTask);
  const duplicateTask = useStore((s) => s.duplicateTask);
  const toggleImportance = useStore((s) => s.toggleImportance);
  const setMyDay = useStore((s) => s.setMyDay);
  const addStep = useStore((s) => s.addStep);
  const updateStep = useStore((s) => s.updateStep);
  const toggleStep = useStore((s) => s.toggleStep);
  const deleteStep = useStore((s) => s.deleteStep);
  const addAttachment = useStore((s) => s.addAttachment);
  const removeAttachment = useStore((s) => s.removeAttachment);
  const ensureAttachment = useStore((s) => s.ensureAttachment);
  const moveTask = useStore((s) => s.moveTask);

  const task = db.tasks.find((t) => t.id === selectedId && !t.deletedAt);

  const [editor, setEditor] = useState<"due" | "reminder" | "repeat" | null>(null);
  const [stepTitle, setStepTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEditor(null);
    setStepTitle("");
    setTagInput("");
  }, [selectedId]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [task?.title, selectedId]);

  if (!task) return null;

  const steps = task.steps.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order);
  const attachments = (task.attachments ?? []).filter((a) => !a.deletedAt);
  const lists = activeLists(db);
  const inMyDay = task.myDay === todayISO();

  const setRecurrence = (rule: RecurrenceRule | undefined) => {
    updateTask(task.id, {
      recurrence: rule
        ? { ...rule, occurrenceIndex: rule.occurrenceIndex ?? 1 }
        : undefined,
    });
  };

  const ensureRule = (): RecurrenceRule =>
    task.recurrence ?? { freq: "daily", interval: 1, occurrenceIndex: 1 };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const tags = Array.from(new Set([...(task.tags ?? []), trimmed]));
    updateTask(task.id, { tags });
    setTagInput("");
  };

  return (
    <section className="detail-panel">
      <div className="detail-head">
        <button
          className={`icon-btn ${task.importance === "high" ? "active" : ""}`}
          onClick={() => toggleImportance(task.id)}
          title="标记重要"
          style={task.importance === "high" ? { color: "var(--star)" } : undefined}
        >
          {task.importance === "high" ? <StarFilledIcon /> : <StarOutlineIcon />}
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="icon-btn"
          onClick={() => duplicateTask(task.id)}
          title="创建副本"
        >
          <CopyIcon />
        </button>
        <button
          className="icon-btn"
          onClick={() => deleteTask(task.id)}
          title="删除任务"
        >
          <TrashIcon />
        </button>
        <button
          className="icon-btn"
          onClick={() => selectTask(null)}
          title="关闭"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="detail-scroll">
        <div className="detail-title-row">
          <button
            className={`detail-checkbox ${task.completed ? "checked" : ""}`}
            onClick={() => toggleComplete(task.id)}
            aria-label="完成"
          >
            <CheckIcon />
          </button>
          <textarea
            ref={titleRef}
            className={`detail-title ${task.completed ? "completed" : ""}`}
            rows={1}
            value={task.title}
            onChange={(e) => updateTask(task.id, { title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </div>

        <div className="detail-block">
          <div className="steps-list">
            {steps.map((step) => (
              <div key={step.id} className="step-row">
                <button
                  className={`step-check ${step.completed ? "checked" : ""}`}
                  onClick={() => toggleStep(task.id, step.id)}
                  aria-label="完成步骤"
                >
                  <CheckSmallIcon />
                </button>
                <input
                  className={`step-input ${step.completed ? "done" : ""}`}
                  value={step.title}
                  onChange={(e) =>
                    updateStep(task.id, step.id, { title: e.target.value })
                  }
                />
                <button
                  className="step-del"
                  onClick={() => deleteStep(task.id, step.id)}
                  aria-label="删除步骤"
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
            <div className="add-step-row">
              <PlusIcon />
              <input
                value={stepTitle}
                placeholder="添加步骤"
                onChange={(e) => setStepTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addStep(task.id, stepTitle);
                    setStepTitle("");
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="detail-block">
          <button
            className="detail-row"
            onClick={() => setEditor(editor === "due" ? null : "due")}
          >
            <span className="row-icon">
              <CalendarIcon />
            </span>
            <span className={`row-value ${task.dueDate ? "" : "muted"}`}>
              {task.dueDate ? dueLabel(task.dueDate, task.dueTime) : "添加截止日期"}
            </span>
            {task.dueDate ? (
              <span
                className="clear-btn"
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateTask(task.id, { dueDate: undefined, dueTime: undefined });
                }}
              >
                <CloseIcon />
              </span>
            ) : null}
          </button>
          {editor === "due" ? (
            <div className="inline-editor">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="date"
                  className="date-input"
                  value={task.dueDate ?? ""}
                  onChange={(e) =>
                    updateTask(task.id, { dueDate: e.target.value || undefined })
                  }
                />
                <input
                  type="time"
                  className="date-input"
                  style={{ width: 120 }}
                  value={task.dueTime ?? ""}
                  onChange={(e) =>
                    updateTask(task.id, { dueTime: e.target.value || undefined })
                  }
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn small"
                  onClick={() =>
                    updateTask(task.id, {
                      dueDate: todayISO(),
                      dueTime: undefined,
                    })
                  }
                >
                  今天
                </button>
                <button
                  className="btn small"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    updateTask(task.id, {
                      dueDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                      dueTime: undefined,
                    });
                  }}
                >
                  明天
                </button>
              </div>
            </div>
          ) : null}

          <button
            className="detail-row"
            onClick={() => setEditor(editor === "reminder" ? null : "reminder")}
          >
            <span className="row-icon">
              <BellIcon />
            </span>
            <span className={`row-value ${task.reminderAt ? "" : "muted"}`}>
              {task.reminderAt ? reminderLabel(task.reminderAt) : "提醒我"}
            </span>
            {task.reminderAt ? (
              <span
                className="clear-btn"
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateTask(task.id, { reminderAt: undefined });
                }}
              >
                <CloseIcon />
              </span>
            ) : null}
          </button>
          {editor === "reminder" ? (
            <div className="inline-editor">
              <input
                type="datetime-local"
                className="date-input"
                value={toLocalInput(task.reminderAt)}
                onChange={(e) => {
                  const value = e.target.value;
                  const ts = value ? new Date(value).getTime() : undefined;
                  updateTask(task.id, { reminderAt: ts });
                }}
              />
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                仅在应用运行时提醒；可开启托盘常驻与开机自启。
              </div>
            </div>
          ) : null}

          <button
            className="detail-row"
            onClick={() => setEditor(editor === "repeat" ? null : "repeat")}
          >
            <span className="row-icon">
              <RepeatIcon />
            </span>
            <span className={`row-value ${task.recurrence ? "" : "muted"}`}>
              {task.recurrence ? describeRecurrence(task.recurrence) : "重复"}
            </span>
            {task.recurrence ? (
              <span
                className="clear-btn"
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRecurrence(undefined);
                }}
              >
                <CloseIcon />
              </span>
            ) : null}
          </button>
          {editor === "repeat" ? (
            <div className="inline-editor">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  className="select-input"
                  style={{ flex: "1 1 150px" }}
                  value={task.recurrence?.freq ?? ""}
                  onChange={(e) => {
                    const freq = e.target.value;
                    if (!freq) {
                      setRecurrence(undefined);
                      return;
                    }
                    setRecurrence({
                      freq: freq as RecurrenceRule["freq"],
                      interval: task.recurrence?.interval ?? 1,
                      byWeekday:
                        freq === "weekly"
                          ? (task.recurrence?.byWeekday ?? [
                              task.dueDate
                                ? new Date(`${task.dueDate}T00:00:00`).getDay()
                                : new Date().getDay(),
                            ])
                          : undefined,
                      endDate: task.recurrence?.endDate,
                      totalOccurrences: task.recurrence?.totalOccurrences,
                    });
                  }}
                >
                  <option value="">不重复</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                  <option value="yearly">每年</option>
                </select>
                {task.recurrence ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flex: "0 0 auto",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ fontSize: 12 }}>间隔</span>
                    <input
                      type="number"
                      min={1}
                      className="date-input"
                      style={{ width: 64 }}
                      value={task.recurrence.interval}
                      onChange={(e) =>
                        setRecurrence({
                          ...ensureRule(),
                          interval: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
              {task.recurrence?.freq === "weekly" ? (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {WEEKDAY_NAMES.map((name, index) => {
                    const on = task.recurrence?.byWeekday?.includes(index);
                    return (
                      <button
                        key={name}
                        className="radio-chip"
                        style={
                          on
                            ? {
                                background: "var(--accent-soft)",
                                borderColor: "var(--accent)",
                                color: "var(--accent)",
                              }
                            : { height: 24, padding: "0 8px" }
                        }
                        onClick={() => {
                          const current = new Set(task.recurrence?.byWeekday ?? []);
                          if (current.has(index)) current.delete(index);
                          else current.add(index);
                          if (current.size === 0) current.add(index);
                          setRecurrence({
                            ...ensureRule(),
                            byWeekday: [...current].sort(),
                          });
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {task.recurrence ? (
                <div>
                  <span className="field-label">结束日期（可选）</span>
                  <input
                    type="date"
                    className="date-input"
                    value={task.recurrence.endDate ?? ""}
                    onChange={(e) =>
                      setRecurrence({
                        ...ensureRule(),
                        endDate: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              ) : null}
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                完成当前任务后，会自动生成下一次实例。
              </div>
            </div>
          ) : null}

          <button
            className="detail-row"
            onClick={() => setMyDay(task.id, inMyDay ? null : todayISO())}
          >
            <span className="row-icon" style={inMyDay ? { color: "var(--accent)" } : undefined}>
              <SunIcon />
            </span>
            <span className="row-value">
              {inMyDay ? "从我的一天移除" : "添加到「我的一天」"}
            </span>
          </button>
        </div>

        <div className="detail-block">
          <span className="field-label">备注</span>
          <textarea
            className="notes-area"
            placeholder="添加备注"
            value={task.notes ?? ""}
            onChange={(e) =>
              updateTask(task.id, { notes: e.target.value || undefined })
            }
          />
        </div>

        <div className="detail-block">
          <span className="field-label">标签</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {(task.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="badge"
                style={{ gap: 4, height: 22 }}
              >
                {tag}
                <button
                  onClick={() =>
                    updateTask(task.id, {
                      tags: (task.tags ?? []).filter((t) => t !== tag),
                    })
                  }
                  aria-label={`删除标签 ${tag}`}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <CloseIcon />
                </button>
              </span>
            ))}
          </div>
          <input
            className="text-input"
            placeholder="输入标签后按 Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
            }}
          />
        </div>

        <div className="detail-block">
          <span className="field-label">附件</span>
          {attachments.map((att) => (
            <div
              key={att.id}
              className="attachment-row"
              onClick={async () => {
                const ok = await ensureAttachment(att.relPath);
                if (!ok) return;
                await api.attachmentReveal(att.relPath);
              }}
            >
              <AttachIcon />
              <span className="att-name">{att.name}</span>
              <span className="att-size">{formatSize(att.size)}</span>
              <button
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                onClick={(e) => {
                  e.stopPropagation();
                  removeAttachment(task.id, att.id);
                }}
                aria-label="移除附件"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
          <button
            className="detail-row"
            onClick={async () => {
              try {
                const path = await open({ multiple: false, directory: false });
                if (typeof path === "string") await addAttachment(task.id, path);
              } catch {
                /* 用户取消或环境不支持 */
              }
            }}
          >
            <span className="row-icon">
              <FolderIcon />
            </span>
            <span className="row-value muted">添加附件</span>
          </button>
        </div>
      </div>

      <div className="detail-footer">
        <span>{new Date(task.createdAt).toLocaleDateString("zh-CN")} 创建</span>
        {task.completedAt ? (
          <span>· {new Date(task.completedAt).toLocaleDateString("zh-CN")} 完成</span>
        ) : null}
        <span className="spacer" />
        <select
          className="select-input"
          style={{ width: 130, height: 28, fontSize: 12 }}
          value={task.listId}
          onChange={(e) => moveTask(task.id, e.target.value)}
          title="移动到列表"
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
