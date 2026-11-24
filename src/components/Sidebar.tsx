import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
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
  DEFAULT_LIST_ID,
  activeGroups,
  activeLists,
  type TaskList,
} from "../lib/model";
import { listCounts, listSections, moveList, smartCounts, UNGROUPED_SECTION_KEY } from "../lib/views";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";
import {
  AllIcon,
  CalendarIcon,
  CloudIcon,
  CompletedIcon,
  HomeIcon,
  ListLinesIcon,
  NewGroupIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StarOutlineIcon,
  SunIcon,
} from "./icons";
import { GroupRow } from "./GroupRow";

const SMART_ITEMS = [
  {
    id: "important",
    label: "重要",
    Icon: StarOutlineIcon,
    color: "var(--text-secondary)",
  },
  {
    id: "planned",
    label: "计划内",
    Icon: CalendarIcon,
    color: "var(--text-secondary)",
  },
  { id: "all", label: "全部", Icon: AllIcon, color: "var(--smart-red)" },
  {
    id: "completed",
    label: "已完成",
    Icon: CompletedIcon,
    color: "var(--smart-red)",
  },
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
  const updateSettings = useStore((s) => s.updateSettings);

  const allLists = useMemo(() => activeLists(db), [db]);
  const lists = useMemo(
    () => allLists.filter((l) => l.id !== DEFAULT_LIST_ID),
    [allLists],
  );
  const defaultList = useMemo(
    () => allLists.find((l) => l.id === DEFAULT_LIST_ID),
    [allLists],
  );
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

  const avatar = db.settings.avatar;
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    setAvatarUrl(undefined);
    if (!avatar?.relPath) return;
    api
      .attachmentRead(avatar.relPath)
      .then((base64) => {
        if (alive) {
          setAvatarUrl(
            `data:${avatar.mime || "image/png"};base64,${base64}`,
          );
        }
      })
      .catch(() => {
        /* 文件缺失时回退到应用图标 */
      });
    return () => {
      alive = false;
    };
  }, [avatar?.relPath, avatar?.mime]);

  const pickAvatar = async () => {
    setAccountOpen(false);
    try {
      const path = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "图片",
            extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
          },
        ],
      });
      if (typeof path !== "string") return;
      const info = await api.attachmentAdd(path);
      updateSettings({
        avatar: {
          relPath: info.relPath,
          mime: info.mime,
          name: info.name,
          size: info.size,
        },
      });
    } catch {
      /* 取消或读取失败 */
    }
  };

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

  const addListToGroup = (groupId: string) => {
    if (collapsedGroups.includes(groupId)) toggleGroupCollapsed(groupId);
    const id = addList("无标题列表", groupId);
    if (id) setView({ type: "list", id });
  };

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
        <div
          className="brand"
          role="button"
          tabIndex={0}
          onClick={() => setAccountOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setAccountOpen((open) => !open);
            }
          }}
          aria-haspopup="menu"
          aria-expanded={accountOpen}
        >
          <button
            type="button"
            className={`brand-logo brand-avatar ${
              avatarUrl ? "has-photo" : "has-logo"
            }`}
            title="更换头像"
            onClick={(event) => {
              event.stopPropagation();
              void pickAvatar();
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <img src="/logo.png" alt="" />
            )}
          </button>
          <div className="brand-text">
            <div className="brand-name">本地用户</div>
            <div className="brand-sub">本地数据</div>
          </div>
        </div>
        {accountOpen ? (
          <div className="menu account-menu" role="menu">
            <div className="account-head">
              <div className="account-title">本地用户</div>
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
          <input
            value={query}
            placeholder="搜索"
            aria-label="搜索"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
          />
          <SearchIcon />
        </div>
      </div>

      <div className="sidebar-scroll">
        <div
          className={`nav-item ${
            view.type === "smart" && view.id === "myday" ? "active" : ""
          }`}
          onClick={() => setView({ type: "smart", id: "myday" })}
        >
          <span className="nav-icon" style={{ color: "var(--accent)" }}>
            <SunIcon size={16} strokeWidth={1.5} />
          </span>
          <span className="nav-label">我的一天</span>
        </div>

        {SMART_ITEMS.map(({ id, label, Icon, color }) => {
          const active = view.type === "smart" && view.id === id;
          const count = counts[id];
          return (
            <div
              key={id}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => setView({ type: "smart", id })}
            >
              <span className="nav-icon" style={{ color }}>
                <Icon size={16} strokeWidth={1.5} />
              </span>
              <span className="nav-label">{label}</span>
              {count > 0 ? <span className="nav-count">{count}</span> : null}
            </div>
          );
        })}

        <div
          className={`nav-item ${
            view.type === "list" && view.id === DEFAULT_LIST_ID ? "active" : ""
          }`}
          onClick={() => setView({ type: "list", id: DEFAULT_LIST_ID })}
        >
          <span className="nav-icon">
            {defaultList?.theme?.emoji ? (
              <span className="nav-emoji">{defaultList.theme.emoji}</span>
            ) : (
              <HomeIcon size={16} strokeWidth={1.5} />
            )}
          </span>
          <span className="nav-label">{defaultList?.name ?? "任务"}</span>
          {(perList[DEFAULT_LIST_ID] ?? 0) > 0 ? (
            <span className="nav-count">{perList[DEFAULT_LIST_ID]}</span>
          ) : null}
        </div>

        <div className="sidebar-divider" />

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

          {groups.map((group) => {
            const groupLists = sections.byGroup.get(group.id) ?? [];
            return (
              <GroupRow
                key={group.id}
                group={group}
                collapsed={collapsedGroups.includes(group.id)}
                empty={groupLists.length === 0}
                dropTarget={dragOverGroup === group.id}
                autoRename={autoRenameId === group.id}
                onRenameHandled={() => setAutoRenameId(null)}
                onToggle={() => toggleGroupCollapsed(group.id)}
                onRename={(name) => renameGroup(group.id, name)}
                onDelete={() => deleteGroup(group.id)}
                onAddList={() => addListToGroup(group.id)}
              >
                <SortableContext
                  items={groupLists.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {groupLists.map(listRow)}
                </SortableContext>
              </GroupRow>
            );
          })}

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
            <NewGroupIcon strokeWidth={1.5} />
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
            className="nav-list-glyph"
            style={{ color: list.color ?? "var(--accent)" }}
          >
            <ListLinesIcon size={16} strokeWidth={1.5} />
          </span>
        )}
      </span>
      <span className="nav-label">{list.name}</span>
      {count > 0 ? <span className="nav-count">{count}</span> : null}
    </div>
  );
}
