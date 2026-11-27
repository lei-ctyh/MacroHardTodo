import {
  Fragment,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { Task } from "../lib/model";
import { dateToISO, dueDateLabel, todayISO } from "../lib/dates";
import { stepProgress } from "../lib/views";
import {
  AttachIcon,
  BellIcon,
  CalendarIcon,
  CheckIcon,
  NoteIcon,
  RepeatIcon,
  StarFilledIcon,
  StarOutlineIcon,
  SunIcon,
} from "./icons";

export interface TaskRowProps {
  task: Task;
  selected: boolean;
  listName?: string;
  hideMyDay?: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onToggleStar: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  setNodeRef?: (el: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function TaskRow({
  task,
  selected,
  listName,
  hideMyDay,
  onSelect,
  onToggle,
  onToggleStar,
  onContextMenu,
  setNodeRef,
  style,
  isDragging,
  dragHandleProps,
}: TaskRowProps) {
  const today = todayISO();
  const { done, total } = stepProgress(task);
  const overdue = !task.completed && Boolean(task.dueDate && task.dueDate < today);
  const dueToday = !task.completed && task.dueDate === today;
  const overdueRecurring = overdue && Boolean(task.recurrence);
  const attachments = (task.attachments ?? []).filter((a) => !a.deletedAt).length;
  const hasNotes = Boolean(task.notes?.trim());

  const meta: { key: string; node: ReactNode }[] = [];
  if (!hideMyDay && task.myDay === today) {
    meta.push({
      key: "myday",
      node: (
        <span className="meta" title="我的一天">
          <SunIcon strokeWidth={1.6} />
          我的一天
        </span>
      ),
    });
  }
  if (listName) {
    meta.push({
      key: "list",
      node: <span className="meta">{listName}</span>,
    });
  }
  if (total > 0) {
    meta.push({
      key: "steps",
      node: (
        <span className="meta">
          第 {done} 步，共 {total} 步
        </span>
      ),
    });
  }
  if (task.dueDate) {
    meta.push({
      key: "due",
      node: (
        <span
          className={`meta ${overdue ? "overdue" : dueToday ? "due-today" : ""}`}
        >
          <CalendarIcon strokeWidth={1.6} />
          <span>{dueDateLabel(task.dueDate)}</span>
          {task.recurrence ? (
            <RepeatIcon
              className="meta-repeat"
              strokeWidth={1.6}
              aria-label="重复任务"
            />
          ) : null}
        </span>
      ),
    });
  } else if (task.recurrence) {
    meta.push({
      key: "rep",
      node: (
        <span className="meta" title="重复任务">
          <RepeatIcon strokeWidth={1.6} />
        </span>
      ),
    });
  }
  if (task.reminderAt) {
    meta.push({
      key: "reminder",
      node: (
        <span className="meta" title="提醒">
          <BellIcon strokeWidth={1.6} />
          {dueDateLabel(dateToISO(new Date(task.reminderAt)))}
        </span>
      ),
    });
  }
  if (attachments > 0) {
    meta.push({
      key: "att",
      node: (
        <span className="meta" title={`${attachments} 个附件`}>
          <AttachIcon strokeWidth={1.6} />
          {attachments > 1 ? attachments : null}
        </span>
      ),
    });
  }
  if (hasNotes) {
    const notesOnly = meta.length === 0;
    meta.push({
      key: "notes",
      node: (
        <span className="meta" title="包含备注">
          <NoteIcon strokeWidth={1.6} />
          {notesOnly ? "备注" : null}
        </span>
      ),
    });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-row ${selected ? "selected" : ""} ${
        isDragging ? "dragging" : ""
      } ${overdueRecurring ? "overdue-recurring" : ""}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <div
        className="drag-handle"
        title="拖动排序"
        {...(dragHandleProps ?? {})}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ letterSpacing: -3, fontSize: 13 }}>⋮⋮</span>
      </div>
      <button
        className={`checkbox ${task.completed ? "checked" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={task.completed ? "标记为未完成" : "标记为完成"}
      >
        <CheckIcon />
      </button>
      <div className="task-main">
        <div className={`task-title ${task.completed ? "completed" : ""}`}>
          {task.title}
        </div>
        {meta.length > 0 ? (
          <div className="task-meta">
            {meta.map((item, idx) => (
              <Fragment key={item.key}>
                {idx > 0 ? (
                  <span className="meta-dot" aria-hidden>
                    ·
                  </span>
                ) : null}
                {item.node}
              </Fragment>
            ))}
          </div>
        ) : null}
      </div>
      <button
        className={`icon-btn row-star ${task.importance === "high" ? "on" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        aria-label="标记重要"
      >
        {task.importance === "high" ? (
          <StarFilledIcon size={18} />
        ) : (
          <StarOutlineIcon size={18} strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}
