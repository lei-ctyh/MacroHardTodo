import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  activeGroups,
  activeLists,
  type TaskList,
} from "../lib/model";
import { listCounts, listSections, moveList, smartCounts, UNGROUPED_SECTION_KEY } from "../lib/views";
import { useStore } from "../store/useStore";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CloudIcon,
  CompletedIcon,
  HomeIcon,
  NewGroupIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StarOutlineIcon,
  SunIcon,
} from "./icons";
import { GroupRow } from "./GroupRow";

const SMART_ITEMS = [
  { id: "myday", label: "我的一天", Icon: SunIcon },
  { id: "important", label: "重要", Icon: StarOutlineIcon },
  { id: "planned", label: "计划中", Icon: CalendarIcon },
  { id: "tasks", label: "任务", Icon: HomeIcon },
  { id: "completed", label: "已完成", Icon: CompletedIcon },
] as const;

const UNGROUPED_KEY = UNGROUPED_SECTION_KEY;

export function Sidebar() {
  const db = useStore((s) => s.db);
  const view = useStore((s) => s.view);
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const setView = useStore((s) => s.setView);
  const openDialog = useStore((s) => s.openDialog);
  const sync = useStore((s) => s.sync);
  const addList = useStore((s) => s.addList);
  const addGroup = useStore((s) => s.addGroup);
  const renameGroup = useStore((s) => s.renameGroup);
  const deleteGroup = useStore((s) => s.deleteGroup);
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed);
  const reorganizeLists = useStore((s) => s.reorganizeLists);

  const lists = useMemo(() => activeLists(db), [db]);
  const groups = useMemo(() => activeGroups(db), [db]);
  const collapsedGroups = db.settings.collapsedGroups ?? [];
  const counts = useMemo(() => smartCounts(db), [db]);
  const perList = useMemo(() => listCounts(db), [db]);

  const sections = useMemo(() => {
    const listMap = new Map(lists.map((list) => [list.id, list]));
    const toLists = (ids: string[]): TaskList[] => {
      const out: TaskList[] = [];
      for (const id of ids) {
        const list = listMap.get(id);
        if (list) out.push(list);
      }
      return out;
    };
    const built = listSections(lists, groups);
    const byGroup = new Map<string, TaskList[]>();
    for (const section of built) {
      if (section.groupId) byGroup.set(section.groupId, toLists(section.ids));
    }
    const ungrouped = built.find((section) => section.key === UNGROUPED_KEY);
    return { ungrouped: toLists(ungrouped?.ids ?? []), byGroup };
  }, [lists, groups]);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [autoRenameId, setAutoRenameId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const addRowRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adding) addRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [adding]);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const groupKeyFor = (id: string): string | null => {
    if (id.startsWith("group:")) return id.slice("group:".length);
    const list = lists.find((l) => l.id === id);
    if (!list) return null;
    return list.groupId && groups.some((g) => g.id === list.groupId)
      ? list.groupId
      : UNGROUPED_KEY;
  };

  const onDragStart = () => setDragging(true);

  const onDragOver = (event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null;
    setDragOverGroup(overId ? groupKeyFor(overId) : null);
  };

  const onDragCancel = () => {
    setDragging(false);
    setDragOverGroup(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(false);
    setDragOverGroup(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const moved = moveList(listSections(lists, groups), activeId, overId);
    if (!moved) return;
    const entries = moved.flatMap((section) =>
      section.ids.map((id) => ({ id, groupId: section.groupId })),
    );
    reorganizeLists(entries);
  };

  const createGroup = () => {
    const id = addGroup();
    setAutoRenameId(id);
  };

  const syncClass = sync.running
    ? "busy"
    : sync.error
      ? "err"
      : sync.message
        ? "ok"
        : "";

  const syncStatusText = sync.running
    ? "正在同步"
    : sync.error
      ? "同步失败"
      : db.settings.webdavUrl
        ? db.settings.lastSyncAt
          ? new Date(db.settings.lastSyncAt).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "未同步"
        : "未配置";

  const listRow = (list: TaskList) => (
    <SortableListRow
      key={list.id}
      list={list}
      count={perList[list.id] ?? 0}
      active={view.type === "list" && view.id === list.id}
      onSelect={() => setView({ type: "list", id: list.id })}
    />
  );

  return (
    <aside className={`sidebar ${dragging ? "drag-active" : ""}`}>
      <div className="brand-wrap" ref={accountRef}>
        <button
          className="brand"
          onClick={() => setAccountOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={accountOpen}
        >
          <div className="brand-logo">
            <CheckIcon />
          </div>
          <div className="brand-name">MacroHard Todo</div>
          <span
            className={`brand-sync ${syncClass}`}
            title={sync.message ?? sync.error ?? "未同步"}
          />
          <ChevronDownIcon className="brand-caret" />
        </button>
        {accountOpen ? (
          <div className="menu account-menu" role="menu">
            <div className="account-head">
              <div className="account-title">MacroHard Todo</div>
              <div className="account-sub">本地数据</div>
            </div>
            <div className="sep" />
            <button
              role="menuitem"
              onClick={() => {
                setAccountOpen(false);
                openDialog("sync");
              }}
            >
              <CloudIcon />
              <span>同步</span>
              <span className="account-status">{syncStatusText}</span>
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setAccountOpen(false);
                openDialog("settings");
              }}
            >
              <SettingsIcon />
              <span>设置</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="sidebar-search">
        <div className="search-box">
          <SearchIcon />
          <input
            value={query}
            placeholder="搜索任务"
            aria-label="搜索任务"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
          />
        </div>
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
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="group-section ungrouped">
            <SectionDropZone
              id={`group:${UNGROUPED_KEY}`}
              visible={dragging}
              active={dragOverGroup === UNGROUPED_KEY}
            />
            <SortableContext
              items={sections.ungrouped.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {sections.ungrouped.map(listRow)}
            </SortableContext>
          </div>

          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              collapsed={collapsedGroups.includes(group.id)}
              dropTarget={dragOverGroup === group.id}
              autoRename={autoRenameId === group.id}
              onRenameHandled={() => setAutoRenameId(null)}
              onToggle={() => toggleGroupCollapsed(group.id)}
              onRename={(name) => renameGroup(group.id, name)}
              onDelete={() => deleteGroup(group.id)}
            >
              <SortableContext
                items={(sections.byGroup.get(group.id) ?? []).map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                {(sections.byGroup.get(group.id) ?? []).map(listRow)}
              </SortableContext>
            </GroupRow>
          ))}

          {adding ? (
            <div ref={addRowRef} className="nav-item" style={{ background: "var(--hover)" }}>
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
                    setNewName("");
                    if (id) setView({ type: "list", id });
                  } else if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                  }
                }}
                onBlur={() => {
                  if (!newName.trim()) setAdding(false);
                }}
              />
            </div>
          ) : null}
        </DndContext>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-new-row">
          <button
            className="sidebar-action"
            onClick={() => {
              setNewName("");
              setAdding(true);
            }}
          >
            <PlusIcon />
            <span>新建列表</span>
          </button>
          <button
            className="sidebar-action icon-only"
            title="创建新组"
            aria-label="创建新组"
            onClick={createGroup}
          >
            <NewGroupIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SectionDropZone({
  id,
  visible,
  active,
}: {
  id: string;
  visible: boolean;
  active: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`group-drop-zone ${visible ? "can-drop" : ""} ${active ? "over" : ""}`}
      aria-hidden
    />
  );
}

function SortableListRow({
  list,
  count,
  active,
  onSelect,
}: {
  list: TaskList;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
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
      <span className="nav-label">{list.name}</span>
      {count > 0 ? <span className="nav-count">{count}</span> : null}
    </div>
  );
}
