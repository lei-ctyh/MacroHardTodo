import { createStep, nowMs, uid, type RecurrenceRule, type Task } from "./model";
import { dateToISO, daysBetweenISO, isoToDate, todayISO } from "./dates";

export const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

/** 根据当前实例的日期与规则，返回下一次发生的日期（YYYY-MM-DD）；已结束返回 null */
export function nextOccurrence(currentISO: string, rule: RecurrenceRule): string | null {
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const index = rule.occurrenceIndex ?? 1;
  if (rule.totalOccurrences && index >= rule.totalOccurrences) return null;

  const start = isoToDate(currentISO);
  let next: Date | null = null;

  switch (rule.freq) {
    case "daily": {
      const d = new Date(start);
      d.setDate(d.getDate() + interval);
      next = d;
      break;
    }
    case "weekly": {
      const days = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [start.getDay()];
      const baseWeekStart = new Date(start);
      baseWeekStart.setDate(start.getDate() - start.getDay());
      const limit = Math.min(7 * interval * 53, 3660);
      for (let i = 1; i <= limit; i++) {
        const cand = new Date(start);
        cand.setDate(start.getDate() + i);
        if (!days.includes(cand.getDay())) continue;
        const candWeek = new Date(cand);
        candWeek.setDate(cand.getDate() - cand.getDay());
        const weekDiff = Math.round(
          (candWeek.getTime() - baseWeekStart.getTime()) / (7 * 86400000),
        );
        if (weekDiff % interval !== 0) continue;
        next = cand;
        break;
      }
      break;
    }
    case "monthly": {
      const day = rule.anchorDay ?? start.getDate();
      const target = new Date(start.getFullYear(), start.getMonth() + interval, 1);
      const lastDay = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0,
      ).getDate();
      target.setDate(Math.min(day, lastDay));
      next = target;
      break;
    }
    case "yearly": {
      const month = rule.anchorMonth ?? start.getMonth();
      const day = rule.anchorDay ?? start.getDate();
      const target = new Date(start.getFullYear() + interval, month, 1);
      const lastDay = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0,
      ).getDate();
      target.setDate(Math.min(day, lastDay));
      next = target;
      break;
    }
  }

  if (!next) return null;
  const nextISO = dateToISO(next);
  if (rule.endDate && nextISO > rule.endDate) return null;
  return nextISO;
}

/** 从 currentISO 起按规则向后找第一个 >= minISO 的日期；用于逾期任务的「跳转到当前任务」 */
export function nextOccurrenceOnOrAfter(
  currentISO: string,
  rule: RecurrenceRule,
  minISO: string,
): string | null {
  let cursor = currentISO;
  for (let index = 0; index < 10000; index += 1) {
    const next = nextOccurrence(cursor, rule);
    if (!next) return null;
    if (next >= minISO) return next;
    cursor = next;
  }
  return null;
}

/** 完成一个重复任务时，生成下一次实例（不修改原任务） */
export function buildNextTask(deviceId: string, task: Task, nextISO: string): Task {
  const now = nowMs();
  const seriesId = task.seriesId ?? task.id;
  const steps = task.steps.map((s, i) =>
    createStep(deviceId, s.title, s.order ?? i),
  );

  let reminderAt: number | undefined;
  if (task.reminderAt) {
    const rem = new Date(task.reminderAt);
    const remISO = dateToISO(rem);
    const offset = task.dueDate ? daysBetweenISO(task.dueDate, remISO) : 0;
    const d = isoToDate(nextISO);
    d.setDate(d.getDate() + offset);
    d.setHours(rem.getHours(), rem.getMinutes(), 0, 0);
    reminderAt = d.getTime();
  }

  const occurrenceIndex = (task.recurrence?.occurrenceIndex ?? 1) + 1;

  return {
    ...task,
    id: uid("task"),
    completed: false,
    completedAt: undefined,
    createdAt: now,
    updatedAt: now,
    updatedBy: deviceId,
    dueDate: nextISO,
    reminderAt,
    myDay: null,
    steps,
    // 附件沿用同一份文件，避免重复占用空间
    seriesId,
    occurrenceKey: `${seriesId}:${nextISO}`,
    recurrence: task.recurrence
      ? { ...task.recurrence, occurrenceIndex }
      : undefined,
    order: task.order,
    sourceId: undefined,
  };
}

/** 任务完成时应生成的下一次日期；不符合条件返回 null */
export function nextDateForTask(task: Task): string | null {
  if (!task.recurrence) return null;
  const anchor = task.dueDate ?? todayISO();
  return nextOccurrence(anchor, {
    ...task.recurrence,
    occurrenceIndex: task.recurrence.occurrenceIndex ?? 1,
  });
}

export function describeRecurrence(rule: RecurrenceRule): string {
  const interval = Math.max(1, rule.interval || 1);
  const unit =
    rule.freq === "daily"
      ? "天"
      : rule.freq === "weekly"
        ? "周"
        : rule.freq === "monthly"
          ? "个月"
          : "年";
  const every = interval === 1 ? `每${unit}` : `每 ${interval} ${unit}`;
  if (
    rule.freq === "weekly" &&
    interval === 1 &&
    rule.byWeekday?.length === 5 &&
    [1, 2, 3, 4, 5].every((day) => rule.byWeekday!.includes(day))
  ) {
    return "工作日";
  }
  if (rule.freq === "weekly" && rule.byWeekday?.length) {
    const days = rule.byWeekday.map((d) => `周${WEEKDAY_NAMES[d]}`).join("、");
    return `${every} ${days}`;
  }
  return every;
}
