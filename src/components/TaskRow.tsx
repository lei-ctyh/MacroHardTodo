import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import type { Task } from "../lib/model";
import { dueLabel, isOverdue } from "../lib/dates";
import { stepProgress } from "../lib/views";
import {
  AttachIcon,
  CalendarIcon,
  CheckIcon,
  CheckSmallIcon,
  ListIcon,
  RepeatIcon,
  StarFilledIcon,
  StarOutlineIcon,
  SunIcon,
} from "./icons";

export interface TaskRowProps {
  task: Task;
  selected: boolean;
  listName?: string;
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
  onSelect,
  onToggle,
  onToggleStar,
  onContextMenu,
  setNodeRef,
  style,
  isDragging,
  dragHandleProps,
}: TaskRowProps) {
  const { done, total } = stepProgress(task);
  const partial = total > 0 && done > 0 && done < total;
  const overdue = !task.completed && isOverdue(task.dueDate, task.dueTime);
  const attachments = (task.attachments ?? []).filter((a) => !a.deletedAt).length;

  const meta: ReactNode[] = [];
  if (task.dueDate) {
    meta.push(
      <span key="due" className={`meta ${overdue ? "overdue" : ""}`}>
        <CalendarIcon />
        {dueLabel(task.dueDate, task.dueTime)}
      </span>,
    );
  }
  if (total > 0) {
    meta.push(
      <span key="steps" className="meta">
        <ListIcon />
        {done}/{total}
      </span>,
    );
  }
  if (attachments > 0) {
    meta.push(
      <span key="att" className="meta">
        <AttachIcon />
        {attachments}
      </span>,
    );
  }
  if (task.recurrence) {
    meta.push(
      <span key="rep" className="meta" title="重复任务">
        <RepeatIcon />
      </span>,
    );
  }
  if (task.myDay) {
    meta.push(
      <span key="myday" className="meta" title="我的一天">
        <SunIcon />
        我的一天
      </span>,
    );
  }
  if (listName) {
    meta.push(
      <span key="list" className="meta">
        {listName}
      </span>,
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-row ${selected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
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
        className={`checkbox ${task.completed ? "checked" : ""} ${
          partial && !task.completed ? "partial" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={task.completed ? "标记为未完成" : "标记为完成"}
      >
        {partial && !task.completed ? <CheckSmallIcon /> : <CheckIcon />}
      </button>
      <div className="task-main">
        <div className={`task-title ${task.completed ? "completed" : ""}`}>
          {task.title}
        </div>
        {meta.length > 0 ? <div className="task-meta">{meta}</div> : null}
        {task.notes ? <div className="task-notes-preview">{task.notes}</div> : null}
      </div>
      <button
        className={`icon-btn row-star ${task.importance === "high" ? "on" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        aria-label="标记重要"
      >
        {task.importance === "high" ? <StarFilledIcon /> : <StarOutlineIcon />}
      </button>
    </div>
  );
}
