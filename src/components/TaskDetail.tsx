import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";
import {
  type RecurrenceRule,
  type Task,
} from "../lib/model";
import { smartTheme, themeAccent } from "../lib/themes";
import { DateTimePicker } from "./DateTimePicker";
import { RepeatDialog } from "./RepeatDialog";
import {
  dateToISO,
  dayLabel,
  daysBetweenISO,
  isOverdue,
  todayISO,
} from "../lib/dates";
import {
  describeRecurrence,
  nextOccurrenceOnOrAfter,
} from "../lib/recurrence";
import {
  AttachIcon,
  BellIcon,
  CalendarArrowUpIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CalendarRangeIcon,
  CheckIcon,
  CheckSmallIcon,
  ChevronsRightIcon,
  CircleIcon,
  ClockIcon,
  CloseIcon,
  CompletedIcon,
  ArrowRightIcon,
  MoreVerticalIcon,
  PlusIcon,
  RepeatIcon,
  SparklesIcon,
  StarFilledIcon,
  StarOutlineIcon,
  SunIcon,
  TrashIcon,
} from "./icons";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function createdAtLabel(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  const date = new Date(ts);
  const today = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
  if (days === 0 && diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)} 小时前`;
  }
  if (days === 1) return "昨天";
  return date.toLocaleDateString("zh-CN");
}

/** 日期的口语标签：今天 / 明天 / 昨天 / 11月29日, 周日 */

function tomorrowDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

function nextMondayDate(): Date {
  const d = new Date();
  const delta = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function weekdayLabel(d: Date): string {
  return `周${"日一二三四五六"[d.getDay()]}`;
}

function timeLabel(hours: number, minutes = 0): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function clockLabel(ts: number): string {
  const d = new Date(ts);
  return timeLabel(d.getHours(), d.getMinutes());
}

export function TaskDetail() {
  const db = useStore((s) => s.db);
  const view = useStore((s) => s.view);
  const selectedId = useStore((s) => s.selectedTaskId);
  const selectTask = useStore((s) => s.selectTask);
  const updateTask = useStore((s) => s.updateTask);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const deleteTask = useStore((s) => s.deleteTask);
  const confirmDelete = useStore((s) => s.confirmDelete);
  const addTask = useStore((s) => s.addTask);
  const toggleImportance = useStore((s) => s.toggleImportance);
  const setMyDay = useStore((s) => s.setMyDay);
  const addStep = useStore((s) => s.addStep);
  const updateStep = useStore((s) => s.updateStep);
  const toggleStep = useStore((s) => s.toggleStep);
  const deleteStep = useStore((s) => s.deleteStep);
  const addAttachment = useStore((s) => s.addAttachment);
  const removeAttachment = useStore((s) => s.removeAttachment);
  const ensureAttachment = useStore((s) => s.ensureAttachment);

  const task = db.tasks.find((t) => t.id === selectedId && !t.deletedAt);

  const [menu, setMenu] = useState<"due" | "reminder" | "repeat" | null>(null);
  const [picker, setPicker] = useState<"due" | "reminder" | null>(null);
  const [repeatDialogOpen, setRepeatDialogOpen] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [stepInputFocused, setStepInputFocused] = useState(false);
  const [stepMenu, setStepMenu] = useState<{
    stepId: string;
    x: number;
    y: number;
  } | null>(null);
  const [tagInput, setTagInput] = useState("");
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const stepInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const stepMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenu(null);
    setPicker(null);
    setRepeatDialogOpen(false);
    setStepTitle("");
    setStepInputFocused(false);
    setStepMenu(null);
    setTagInput("");
  }, [selectedId]);

  useEffect(() => {
    if (!stepMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        stepMenuRef.current &&
        !stepMenuRef.current.contains(event.target as Node)
      ) {
        setStepMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setStepMenu(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [stepMenu]);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.(".detail-row-wrap")) return;
      setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [task?.title, selectedId]);

  if (!task) return null;

  const viewTheme =
    view.type === "list"
      ? db.lists.find((l) => l.id === view.id && !l.deletedAt)?.theme
      : smartTheme(db, view.id);
  const accent = themeAccent(viewTheme);
  const accentStyle = accent
    ? ({
        "--theme-accent-light": accent.base,
        "--theme-accent-hover-light": accent.hover,
        "--theme-accent-dark": accent.darkBase,
        "--theme-accent-hover-dark": accent.darkHover,
      } as CSSProperties)
    : undefined;

  const steps = task.steps.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order);
  const attachments = (task.attachments ?? []).filter((a) => !a.deletedAt);
  const today = todayISO();
  const manuallyInMyDay = task.myDay === today;
  const autoInMyDay =
    !manuallyInMyDay &&
    (db.settings.showDueTodayInMyDay ?? true) &&
    task.dueDate === today;
  const inMyDay = manuallyInMyDay || autoInMyDay;
  const reminderUpcoming = Boolean(
    task.reminderAt && task.reminderAt > Date.now(),
  );
  const stepEditing = stepInputFocused || stepTitle.length > 0;

  const setRecurrence = (rule: RecurrenceRule | undefined) => {
    updateTask(task.id, {
      recurrence: rule
        ? { ...rule, occurrenceIndex: rule.occurrenceIndex ?? 1 }
        : undefined,
      // 没有截止日期时设置重复：默认用今天作为锚点
      ...(rule && !task.dueDate ? { dueDate: todayISO() } : {}),
    });
  };

  /** 每月/每年把原始日号（和月份）记进规则，避免遇到短月后日期漂移 */
  const withRecurrenceAnchor = (rule: RecurrenceRule): RecurrenceRule => {
    if (rule.freq !== "monthly" && rule.freq !== "yearly") return rule;
    const base = task.dueDate
      ? new Date(`${task.dueDate}T00:00:00`)
      : new Date();
    return {
      ...rule,
      anchorDay: base.getDate(),
      anchorMonth: rule.freq === "yearly" ? base.getMonth() : undefined,
    };
  };

  const applyDue = (d: Date) => {
    updateTask(task.id, { dueDate: dateToISO(d), dueTime: undefined });
    setMenu(null);
  };

  const applyReminder = (d: Date) => {
    updateTask(task.id, { reminderAt: d.getTime() });
    setMenu(null);
  };

  const applyRepeat = (rule: RecurrenceRule) => {
    setRecurrence(withRecurrenceAnchor(rule));
    setMenu(null);
  };

  const overdueRecurring = Boolean(
    !task.completed &&
      task.recurrence &&
      task.dueDate &&
      task.dueDate < todayISO(),
  );

  const jumpToCurrent = () => {
    if (!task.recurrence || !task.dueDate) return;
    const next = nextOccurrenceOnOrAfter(
      task.dueDate,
      task.recurrence,
      todayISO(),
    );
    if (!next) return;
    const patch: Partial<Task> = {
      dueDate: next,
      occurrenceKey: `${task.seriesId ?? task.id}:${next}`,
    };
    if (task.reminderAt) {
      const reminder = new Date(task.reminderAt);
      const offset = daysBetweenISO(task.dueDate, dateToISO(reminder));
      const shifted = new Date(`${next}T00:00:00`);
      shifted.setDate(shifted.getDate() + offset);
      shifted.setHours(reminder.getHours(), reminder.getMinutes(), 0, 0);
      patch.reminderAt = shifted.getTime();
    }
    updateTask(task.id, patch);
  };

  const openPicker = (which: "due" | "reminder") => {
    setMenu(null);
    setPicker(which);
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const tags = Array.from(new Set([...(task.tags ?? []), trimmed]));
    updateTask(task.id, { tags });
    setTagInput("");
  };

  return (
    <>
    <section className="detail-panel" style={accentStyle}>
      <div className="detail-topbar">
        <button
          type="button"
          className="icon-btn detail-close-btn"
          onClick={() => selectTask(null)}
          title="关闭"
          aria-label="关闭"
        >
          <CloseIcon size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className="detail-scroll">
        <div className="detail-card detail-title-card">
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
            <button
              className={`icon-btn detail-star ${
                task.importance === "high" ? "on" : ""
              }`}
              onClick={() => toggleImportance(task.id)}
              title="标记重要"
              aria-label="标记重要"
            >
              {task.importance === "high" ? (
                <StarFilledIcon />
              ) : (
                <StarOutlineIcon />
              )}
            </button>
          </div>

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
                <div className="step-body">
                  <input
                    className={`step-input ${step.completed ? "done" : ""}`}
                    value={step.title}
                    onChange={(e) =>
                      updateStep(task.id, step.id, { title: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="step-more"
                    aria-label="步骤操作"
                    aria-haspopup="menu"
                    aria-expanded={stepMenu?.stepId === step.id}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setStepMenu(
                        stepMenu?.stepId === step.id
                          ? null
                          : {
                              stepId: step.id,
                              x: Math.max(8, Math.min(rect.right - 204, window.innerWidth - 212)),
                              y: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 156)),
                            },
                      );
                    }}
                  >
                    <MoreVerticalIcon size={15} strokeWidth={1.6} />
                  </button>
                </div>
              </div>
            ))}
            {(() => {
              const addStepLabel = steps.length === 0 ? "添加步骤" : "下一步";
              return (
                <div
                  className={`add-step-row ${stepEditing ? "editing" : ""}`}
                  onClick={() => stepInputRef.current?.focus()}
                >
                  {stepEditing ? (
                    <span className="step-check step-check-placeholder" aria-hidden />
                  ) : (
                    <PlusIcon size={16} strokeWidth={1.6} />
                  )}
                  <input
                    ref={stepInputRef}
                    value={stepTitle}
                    placeholder={stepInputFocused ? "" : addStepLabel}
                    title={addStepLabel}
                    aria-label={addStepLabel}
                    onFocus={() => setStepInputFocused(true)}
                    onBlur={() => setStepInputFocused(false)}
                    onChange={(e) => setStepTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addStep(task.id, stepTitle);
                        setStepTitle("");
                      } else if (e.key === "Escape") {
                        e.stopPropagation();
                        setStepTitle("");
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </div>
              );
            })()}
          </div>
        </div>

        <div className="detail-block">
          <button
            className="detail-row"
            onClick={() => {
              if (!manuallyInMyDay) setMyDay(task.id, today);
              else setMyDay(task.id, null);
            }}
          >
            <span className={`row-icon ${inMyDay ? "accent" : ""}`}>
              <SunIcon />
            </span>
            <span className={`row-value ${inMyDay ? "accent" : "muted"}`}>
              {inMyDay ? "已添加到“我的一天”" : "添加到“我的一天”"}
            </span>
            {manuallyInMyDay ? (
              <span
                className="clear-btn"
                role="button"
                aria-label="从我的一天移除"
                onClick={(e) => {
                  e.stopPropagation();
                  setMyDay(task.id, null);
                }}
              >
                <CloseIcon />
              </span>
            ) : null}
          </button>
        </div>

        <div className="detail-block">
          <div className="detail-row-wrap">
            <button
              className="detail-row"
              onClick={() => {
                setMenu(menu === "reminder" ? null : "reminder");
              }}
            >
              <span
                className={`row-icon ${
                  task.reminderAt ? (reminderUpcoming ? "accent" : "past") : ""
                }`}
              >
                <BellIcon />
              </span>
              <span className={`row-value ${task.reminderAt ? "stacked" : "muted"}`}>
                {task.reminderAt ? (
                  <>
                    <span
                      className={`row-main ${
                        reminderUpcoming ? "accent" : "past"
                      }`}
                    >
                      在 {clockLabel(task.reminderAt)} 时提醒我
                    </span>
                    <span className="row-sub">
                      {dayLabel(dateToISO(new Date(task.reminderAt)))}
                    </span>
                  </>
                ) : (
                  "提醒我"
                )}
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
            {menu === "reminder" ? (
              <div
                className="detail-menu"
                ref={menuRef}
                role="menu"
                aria-label="提醒"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    const d = new Date();
                    d.setHours(19, 0, 0, 0);
                    applyReminder(d);
                  }}
                >
                  <span className="menu-icon"><ClockIcon /></span>
                  <span>今日晚些时候</span>
                  <span className="menu-value">{timeLabel(19)}</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    const d = tomorrowDate();
                    d.setHours(9, 0, 0, 0);
                    applyReminder(d);
                  }}
                >
                  <span className="menu-icon"><ArrowRightIcon /></span>
                  <span>明天</span>
                  <span className="menu-value">
                    {weekdayLabel(tomorrowDate())}, {timeLabel(9)}
                  </span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    const d = nextMondayDate();
                    d.setHours(9, 0, 0, 0);
                    applyReminder(d);
                  }}
                >
                  <span className="menu-icon"><ChevronsRightIcon /></span>
                  <span>下周</span>
                  <span className="menu-value">周一, {timeLabel(9)}</span>
                </button>
                <button role="menuitem" onClick={() => openPicker("reminder")}>
                  <span className="menu-icon"><CalendarIcon /></span>
                  <span>选择日期和时间</span>
                </button>
              </div>
            ) : null}
            {picker === "reminder" ? (
              <DateTimePicker
                initialDate={
                  task.reminderAt
                    ? dateToISO(new Date(task.reminderAt))
                    : undefined
                }
                initialTime={
                  task.reminderAt ? clockLabel(task.reminderAt) : "09:00"
                }
                onCancel={() => setPicker(null)}
                onSave={(date, time) => {
                  updateTask(task.id, {
                    reminderAt: new Date(`${date}T${time}:00`).getTime(),
                  });
                  setPicker(null);
                }}
              />
            ) : null}
          </div>

          <div className="detail-row-wrap">
            <button
              className="detail-row"
              onClick={() => {
                setMenu(menu === "due" ? null : "due");
              }}
            >
              <span
                className={`row-icon ${
                  task.dueDate
                    ? isOverdue(task.dueDate, task.dueTime)
                      ? "danger"
                      : "accent"
                    : ""
                }`}
              >
                <CalendarIcon />
              </span>
              <span
                className={`row-value ${
                  task.dueDate
                    ? isOverdue(task.dueDate, task.dueTime)
                      ? "danger"
                      : "accent"
                    : "muted"
                }`}
              >
                {task.dueDate
                  ? `${dayLabel(task.dueDate)}${
                      task.dueTime ? ` ${task.dueTime}` : ""
                    } 到期`
                  : "添加截止日期"}
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
            {menu === "due" ? (
              <div
                className="detail-menu"
                ref={menuRef}
                role="menu"
                aria-label="截止日期"
              >
                <button role="menuitem" onClick={() => applyDue(new Date())}>
                  <span className="menu-icon"><CalendarDaysIcon /></span>
                  <span>今天</span>
                  <span className="menu-value">{weekdayLabel(new Date())}</span>
                </button>
                <button role="menuitem" onClick={() => applyDue(tomorrowDate())}>
                  <span className="menu-icon"><CalendarArrowUpIcon /></span>
                  <span>明天</span>
                  <span className="menu-value">{weekdayLabel(tomorrowDate())}</span>
                </button>
                <button role="menuitem" onClick={() => applyDue(nextMondayDate())}>
                  <span className="menu-icon"><CalendarRangeIcon /></span>
                  <span>下周</span>
                  <span className="menu-value">周一</span>
                </button>
                <button role="menuitem" onClick={() => openPicker("due")}>
                  <span className="menu-icon"><CalendarIcon /></span>
                  <span>选择日期</span>
                </button>
              </div>
            ) : null}
            {picker === "due" ? (
              <DateTimePicker
                initialDate={task.dueDate}
                withTime={false}
                onCancel={() => setPicker(null)}
                onSave={(date) => {
                  updateTask(task.id, { dueDate: date, dueTime: undefined });
                  setPicker(null);
                }}
              />
            ) : null}
          </div>

          <div className="detail-row-wrap">
            <button
              className="detail-row"
              onClick={() => {
                setMenu(menu === "repeat" ? null : "repeat");
              }}
            >
              <span className={`row-icon ${task.recurrence ? "accent" : ""}`}>
                <RepeatIcon />
              </span>
              <span className={`row-value ${task.recurrence ? "accent" : "muted"}`}>
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
            {menu === "repeat" ? (
              <div
                className="detail-menu"
                ref={menuRef}
                role="menu"
                aria-label="重复"
              >
                <button
                  role="menuitem"
                  onClick={() => applyRepeat({ freq: "daily", interval: 1 })}
                >
                  <span className="menu-icon"><CalendarDaysIcon /></span>
                  <span>每天</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() =>
                    applyRepeat({
                      freq: "weekly",
                      interval: 1,
                      byWeekday: [1, 2, 3, 4, 5],
                    })
                  }
                >
                  <span className="menu-icon"><CalendarCheckIcon /></span>
                  <span>工作日</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    const day = task.dueDate
                      ? new Date(`${task.dueDate}T00:00:00`).getDay()
                      : new Date().getDay();
                    applyRepeat({
                      freq: "weekly",
                      interval: 1,
                      byWeekday: [day],
                    });
                  }}
                >
                  <span className="menu-icon"><CalendarRangeIcon /></span>
                  <span>每周</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => applyRepeat({ freq: "monthly", interval: 1 })}
                >
                  <span className="menu-icon"><CalendarIcon /></span>
                  <span>每月</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => applyRepeat({ freq: "yearly", interval: 1 })}
                >
                  <span className="menu-icon"><SparklesIcon /></span>
                  <span>每年</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    setRepeatDialogOpen(true);
                  }}
                >
                  <span className="menu-icon"><RepeatIcon /></span>
                  <span>自定义</span>
                </button>
              </div>
            ) : null}
          </div>

        </div>

        {overdueRecurring ? (
          <div className="detail-cleanup">
            <div className="detail-cleanup-title">清理未完成的任务</div>
            <div className="detail-cleanup-text">
              尚未将某些定期任务标记为已完成。是否要删除未完成的任务并跳到当前任务？
            </div>
            <button
              type="button"
              className="detail-cleanup-action"
              onClick={jumpToCurrent}
            >
              跳转到当前任务
            </button>
          </div>
        ) : null}

        <div className="detail-block">
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
              <AttachIcon />
            </span>
            <span className="row-value muted">添加文件</span>
          </button>
        </div>

        <div className="detail-block">
          <textarea
            className="notes-area"
            placeholder="添加备注"
            value={task.notes ?? ""}
            onChange={(e) =>
              updateTask(task.id, { notes: e.target.value || undefined })
            }
          />
        </div>

        <div className="detail-block detail-tags">
          <span className="field-label">标签</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {(task.tags ?? []).map((tag) => (
              <span key={tag} className="badge" style={{ gap: 4, height: 22 }}>
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
      </div>

      <div className="detail-footer">
        <span className="detail-footer-spacer" aria-hidden />
        <span className="detail-footer-meta">
          {task.completedAt
            ? `已完成于 ${createdAtLabel(task.completedAt)}`
            : `创建于 ${createdAtLabel(task.createdAt)}`}
        </span>
        <button
          type="button"
          className="icon-btn detail-delete-btn"
          onClick={() =>
            confirmDelete({
              title: "删除任务",
              message: `将永久删除任务“${task.title}”？`,
              confirmLabel: "删除",
              danger: true,
              onConfirm: () => deleteTask(task.id),
            })
          }
          title="删除任务"
          aria-label="删除任务"
        >
          <TrashIcon size={16} strokeWidth={1.5} />
        </button>
      </div>
    </section>
    {(() => {
      if (!stepMenu) return null;
      const targetStep = steps.find((s) => s.id === stepMenu.stepId);
      if (!targetStep) return null;
      return createPortal(
        <div
          ref={stepMenuRef}
          className="menu step-menu"
          role="menu"
          aria-label="步骤操作"
          style={{ position: "fixed", left: stepMenu.x, top: stepMenu.y }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            role="menuitem"
            onClick={() => {
              toggleStep(task.id, targetStep.id);
              setStepMenu(null);
            }}
          >
            {targetStep.completed ? (
              <CircleIcon size={18} strokeWidth={1.4} />
            ) : (
              <CompletedIcon size={18} strokeWidth={1.4} />
            )}
            <span>{targetStep.completed ? "标记为未完成" : "标记为已完成"}</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              const title = targetStep.title.trim();
              if (title) {
                addTask({ listId: task.listId, title });
                deleteStep(task.id, targetStep.id);
              }
              setStepMenu(null);
            }}
          >
            <PlusIcon size={18} strokeWidth={1.4} />
            <span>提升为任务</span>
          </button>
          <div className="sep" />
          <button
            role="menuitem"
            className="danger"
            onClick={() => {
              deleteStep(task.id, targetStep.id);
              setStepMenu(null);
            }}
          >
            <TrashIcon size={18} strokeWidth={1.4} />
            <span>删除步骤</span>
          </button>
        </div>,
        document.body,
      );
    })()}
    {repeatDialogOpen ? (
      <RepeatDialog
        rule={task.recurrence}
        dueDate={task.dueDate}
        onCancel={() => setRepeatDialogOpen(false)}
        onSave={(rule) => {
          applyRepeat(rule);
          setRepeatDialogOpen(false);
        }}
      />
    ) : null}
    </>
  );
}
