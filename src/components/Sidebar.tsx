import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { activeLists, LIST_COLORS, type TaskList } from "../lib/model";
import { listCounts, smartCounts } from "../lib/views";
import { useStore } from "../store/useStore";
import {
  CalendarIcon,
  CheckIcon,
  CloudIcon,
  CompletedIcon,
  HomeIcon,
  MoreIcon,
  PlusIcon,
  SettingsIcon,
  StarOutlineIcon,
  SunIcon,
  SyncIcon,
  EditIcon,
  TrashIcon,
} from "./icons";

const SMART_ITEMS = [
  { id: "myday", label: "我的一天", Icon: SunIcon },
  { id: "important", label: "重要", Icon: StarOutlineIcon },
  { id: "planned", label: "计划中", Icon: CalendarIcon },
  { id: "tasks", label: "任务", Icon: HomeIcon },
  { id: "completed", label: "已完成", Icon: CompletedIcon },
] as const;

export function Sidebar() {
  const db = useStore((s) => s.db);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const openDialog = useStore((s) => s.openDialog);
  const sync = useStore((s) => s.sync);
  const addList = useStore((s) => s.addList);
  const renameList = useStore((s) => s.renameList);
  const deleteList = useStore((s) => s.deleteList);
  const setListColor = useStore((s) => s.setListColor);
  const reorderLists = useStore((s) => s.reorderLists);

  const lists = useMemo(() => activeLists(db), [db]);
  const counts = useMemo(() => smartCounts(db), [db]);
  const perList = useMemo(() => listCounts(db), [db]);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = lists.map((l) => l.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderLists(next);
  };

  const syncClass = sync.running
    ? "busy"
    : sync.error
      ? "err"
      : sync.message
        ? "ok"
        : "";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <CheckIcon />
        </div>
        <div className="brand-name">MacroHard Todo</div>
        <span className={`brand-sync ${syncClass}`} title={sync.message ?? sync.error ?? "未同步"} />
      </div>

      <div className="sidebar-scroll">
        {SMART_ITEMS.map(({ id, label, Icon }) => {
          const active = view.type === "smart" && view.id === id;
          const count = counts[id];
          return (
            <div
              key={id}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => setView({ type: "smart", id })}
            >
              <span className="nav-icon">
                <Icon />
              </span>
              <span className="nav-label">{label}</span>
              {id !== "myday" && count > 0 ? (
                <span className="nav-count">{count}</span>
              ) : null}
            </div>
          );
        })}

        <div className="section-head">
          <span>列表</span>
          <button
            title="新建列表"
            onClick={() => {
              setAdding(true);
              setNewName("");
            }}
          >
            <PlusIcon />
          </button>
        </div>

        {adding ? (
          <div className="nav-item" style={{ background: "var(--hover)" }}>
            <span className="nav-icon">
              <span
                className="nav-list-dot"
                style={{ background: "var(--accent)" }}
              />
            </span>
            <input
              autoFocus
              className="step-input"
              placeholder="列表名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const id = addList(newName);
                  setAdding(false);
                  if (id) setView({ type: "list", id });
                } else if (e.key === "Escape") {
                  setAdding(false);
                }
              }}
              onBlur={() => {
                if (!newName.trim()) setAdding(false);
              }}
            />
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={lists.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {lists.map((list) => (
              <SortableListRow
                key={list.id}
                list={list}
                count={perList[list.id] ?? 0}
                active={view.type === "list" && view.id === list.id}
                editing={editingId === list.id}
                editingName={editingName}
                onEditingName={setEditingName}
                onCommitRename={() => {
                  renameList(list.id, editingName);
                  setEditingId(null);
                }}
                onCancelRename={() => setEditingId(null)}
                onSelect={() => setView({ type: "list", id: list.id })}
                onStartRename={() => {
                  setEditingId(list.id);
                  setEditingName(list.name);
                  setMenuFor(null);
                }}
                menuOpen={menuFor === list.id}
                onToggleMenu={() =>
                  setMenuFor((cur) => (cur === list.id ? null : list.id))
                }
                onDelete={() => {
                  deleteList(list.id);
                  setMenuFor(null);
                }}
                onColor={(color) => {
                  setListColor(list.id, color);
                  setMenuFor(null);
                }}
                canDelete={lists.length > 1}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-action" onClick={() => openDialog("sync")}>
          <CloudIcon />
          <span style={{ flex: 1, textAlign: "left" }}>同步</span>
          {sync.running ? (
            <span className="spinner" />
          ) : (
            <span className="nav-count">
              {db.settings.webdavUrl
                ? db.settings.lastSyncAt
                  ? new Date(db.settings.lastSyncAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "未同步"
                : "未配置"}
            </span>
          )}
        </button>
        <button className="sidebar-action" onClick={() => openDialog("settings")}>
          <SettingsIcon />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}

function SortableListRow({
  list,
  count,
  active,
  editing,
  editingName,
  onEditingName,
  onCommitRename,
  onCancelRename,
  onSelect,
  onStartRename,
  menuOpen,
  onToggleMenu,
  onDelete,
  onColor,
  canDelete,
}: {
  list: TaskList;
  count: number;
  active: boolean;
  editing: boolean;
  editingName: string;
  onEditingName: (name: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onSelect: () => void;
  onStartRename: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onDelete: () => void;
  onColor: (color: string) => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={setNodeRef}
        style={style}
        className={`nav-item ${active ? "active" : ""}`}
        onClick={onSelect}
        {...attributes}
        {...listeners}
      >
        <span className="nav-icon">
          {list.theme?.emoji ? (
            <span className="nav-emoji">{list.theme.emoji}</span>
          ) : (
            <span
              className="nav-list-dot"
              style={{ background: list.color ?? "var(--text-tertiary)" }}
            />
          )}
        </span>
        {editing ? (
          <input
            autoFocus
            className="step-input"
            value={editingName}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onEditingName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCancelRename();
            }}
            onBlur={onCommitRename}
          />
        ) : (
          <span className="nav-label">{list.name}</span>
        )}
        {count > 0 && !editing ? <span className="nav-count">{count}</span> : null}
        <button
          className="nav-more"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="列表菜单"
        >
          <MoreIcon />
        </button>
      </div>

      {menuOpen ? (
        <div
          className="menu"
          style={{ top: 38, right: 4 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="palette" style={{ padding: "4px 8px 8px" }}>
            {LIST_COLORS.map((color) => (
              <button
                key={color}
                className={list.color === color ? "active" : ""}
                style={{ background: color }}
                onClick={() => onColor(color)}
                aria-label={`颜色 ${color}`}
              />
            ))}
          </div>
          <div className="sep" />
          <button onClick={onStartRename}>
            <EditIcon /> 重命名
          </button>
          <button className="danger" disabled={!canDelete} onClick={onDelete}>
            <TrashIcon /> 删除列表
          </button>
        </div>
      ) : null}
    </div>
  );
}
