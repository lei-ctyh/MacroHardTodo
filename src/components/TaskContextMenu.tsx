import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_LIST_ID,
  activeGroups,
  activeLists,
  type Task,
  type TaskList,
} from "../lib/model";
import { addDaysISO, todayISO } from "../lib/dates";
import { splitLeadingEmoji } from "../lib/emoji";
import { listSections } from "../lib/views";
import { useStore } from "../store/useStore";
import {
  CalendarArrowUpIcon,
  CalendarDaysIcon,
  CalendarTodayIcon,
  CheckSmallIcon,
  ChevronRightIcon,
  CircleIcon,
  CompletedIcon,
  HomeIcon,
  ListLinesIcon,
  MoveToListIcon,
  StarOffIcon,
  StarOutlineIcon,
  SunIcon,
  TrashIcon,
} from "./icons";

export function TaskContextMenu({
  task,
  x,
  y,
  onClose,
  onPickDate,
}: {
  task: Task;
  x: number;
  y: number;
  onClose: () => void;
  onPickDate: (task: Task, x: number, y: number) => void;
}) {
  const db = useStore((s) => s.db);
  const setMyDay = useStore((s) => s.setMyDay);
  const toggleImportance = useStore((s) => s.toggleImportance);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const updateTask = useStore((s) => s.updateTask);
  const moveTask = useStore((s) => s.moveTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const confirmDelete = useStore((s) => s.confirmDelete);

  const [moveOpen, setMoveOpen] = useState(false);
  const [submenuTop, setSubmenuTop] = useState(-4);
  const menuRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  const orderedLists = useMemo(() => {
    const all = activeLists(db);
    const defaultList = all.find((l) => l.id === DEFAULT_LIST_ID);
    const custom = all.filter((l) => l.id !== DEFAULT_LIST_ID);
    const byId = new Map(custom.map((l) => [l.id, l]));
    const sections = listSections(custom, activeGroups(db));
    const orderedCustom: TaskList[] = [];
    for (const section of sections) {
      for (const id of section.ids) {
        const list = byId.get(id);
        if (list) orderedCustom.push(list);
      }
    }
    return defaultList ? [defaultList, ...orderedCustom] : orderedCustom;
  }, [db]);

  useLayoutEffect(() => {
    if (!moveOpen || !flyoutRef.current || !submenuRef.current) return;
    const flyRect = flyoutRef.current.getBoundingClientRect();
    const subHeight = submenuRef.current.offsetHeight;
    const margin = 8;
    const desiredTop = flyRect.top - 4;
    const clampedTop = Math.max(
      margin,
      Math.min(desiredTop, window.innerHeight - subHeight - margin),
    );
    setSubmenuTop(clampedTop - flyRect.top);
  }, [moveOpen, orderedLists.length]);

  const requestDelete = () => {
    confirmDelete({
      title: "删除任务",
      message: `将永久删除任务“${task.title}”？`,
      confirmLabel: "删除",
      danger: true,
      onConfirm: () => deleteTask(task.id),
    });
  };

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      } else if (event.key === "Delete") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        requestDelete();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, task.id, task.title]);

  const menuWidth = 264;
  const estHeight = task.dueDate ? 430 : 392;
  const left = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - estHeight - 8));
  const flipLeft = left + menuWidth + 216 > window.innerWidth;

  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const inMyDay = task.myDay === today;
  const isImportant = task.importance === "high";

  return createPortal(
    <div
      ref={menuRef}
      className="menu task-context-menu"
      role="menu"
      aria-label="任务菜单"
      style={{ position: "fixed", left, top }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        role="menuitem"
        onClick={() => {
          setMyDay(task.id, inMyDay ? null : today);
          onClose();
        }}
      >
        <SunIcon size={18} strokeWidth={1.4} />
        <span>{inMyDay ? "从“我的一天”中删除" : "添加到“我的一天”"}</span>
        <span className="menu-hint">Ctrl+T</span>
      </button>

      <button
        role="menuitem"
        onClick={() => {
          toggleImportance(task.id);
          onClose();
        }}
      >
        {isImportant ? (
          <StarOffIcon size={18} strokeWidth={1.4} />
        ) : (
          <StarOutlineIcon size={18} strokeWidth={1.4} />
        )}
        <span>{isImportant ? "删除重要标记" : "标记为重要"}</span>
      </button>

      <button
        role="menuitem"
        onClick={() => {
          toggleComplete(task.id);
          onClose();
        }}
      >
        {task.completed ? (
          <CircleIcon size={18} strokeWidth={1.4} />
        ) : (
          <CompletedIcon size={18} strokeWidth={1.4} />
        )}
        <span>{task.completed ? "标记为未完成" : "标记为已完成"}</span>
        {!task.completed ? <span className="menu-hint">Ctrl+D</span> : null}
      </button>

      <div className="sep" />

      <button
        role="menuitem"
        onClick={() => {
          updateTask(task.id, { dueDate: today, dueTime: undefined });
          onClose();
        }}
      >
        <CalendarTodayIcon size={18} strokeWidth={1.4} />
        <span>今天到期</span>
      </button>

      <button
        role="menuitem"
        onClick={() => {
          updateTask(task.id, { dueDate: tomorrow, dueTime: undefined });
          onClose();
        }}
      >
        <CalendarArrowUpIcon size={18} strokeWidth={1.4} />
        <span>明天到期</span>
      </button>

      <button
        role="menuitem"
        onClick={() => {
          onClose();
          onPickDate(task, left, top);
        }}
      >
        <CalendarDaysIcon size={18} strokeWidth={1.4} />
        <span>选择日期</span>
      </button>

      {task.dueDate ? (
        <button
          role="menuitem"
          onClick={() => {
            updateTask(task.id, { dueDate: undefined, dueTime: undefined });
            onClose();
          }}
        >
          <CalendarDaysIcon size={18} strokeWidth={1.4} />
          <span>删除截止日期</span>
        </button>
      ) : null}

      <div className="sep" />

      <div
        ref={flyoutRef}
        className={`list-menu-flyout ${flipLeft ? "flip-left" : ""}`}
        onMouseEnter={() => setMoveOpen(true)}
        onMouseLeave={() => setMoveOpen(false)}
      >
        <button
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={moveOpen}
          onClick={() => setMoveOpen((open) => !open)}
        >
          <MoveToListIcon size={18} strokeWidth={1.4} />
          <span>将任务移动到...</span>
          <span className="menu-caret">
            <ChevronRightIcon size={15} strokeWidth={1.4} />
          </span>
        </button>
        {moveOpen ? (
          <div
            ref={submenuRef}
            className={`menu list-submenu task-submenu ${
              flipLeft ? "flip-left" : ""
            }`}
            style={{ top: submenuTop }}
            role="menu"
            aria-label="移动到列表"
          >
            {orderedLists.map((list) => {
              const current = task.listId === list.id;
              const isDefault = list.id === DEFAULT_LIST_ID;
              const display = isDefault ? null : splitLeadingEmoji(list.name);
              const emoji = isDefault
                ? undefined
                : display?.emoji ?? list.theme?.emoji;
              const label =
                display?.emoji && display.text ? display.text : list.name;
              return (
                <button
                  key={list.id}
                  role="menuitemradio"
                  aria-checked={current}
                  onClick={() => {
                    onClose();
                    if (!current) moveTask(task.id, list.id);
                  }}
                >
                  {isDefault ? (
                    <HomeIcon size={16} strokeWidth={1.4} />
                  ) : emoji ? (
                    <span className="task-submenu-emoji">{emoji}</span>
                  ) : (
                    <ListLinesIcon size={16} strokeWidth={1.4} />
                  )}
                  <span className="task-submenu-label">{label}</span>
                  {current ? (
                    <span className="menu-check">
                      <CheckSmallIcon size={14} strokeWidth={2} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="sep" />

      <button
        role="menuitem"
        className="danger"
        onClick={() => {
          onClose();
          requestDelete();
        }}
      >
        <TrashIcon size={18} strokeWidth={1.4} />
        <span>删除任务</span>
        <span className="menu-hint">Delete</span>
      </button>
    </div>,
    document.body,
  );
}
