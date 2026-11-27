import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  profileDisplay,
  type TaskGroup,
  type TaskList,
} from "../lib/model";
import {
  isSmartViewVisible,
  listCounts,
  listSections,
  moveList,
  smartCounts,
  UNGROUPED_SECTION_KEY,
} from "../lib/views";
import { splitLeadingEmoji } from "../lib/emoji";
import { useStore } from "../store/useStore";
import { useAvatar } from "./useAvatar";
import {
  AllIcon,
  CalendarIcon,
  CheckSmallIcon,
  ChevronRightIcon,
  CloudIcon,
  CompletedIcon,
  EditIcon,
  FolderIcon,
  GroupIcon,
  HomeIcon,
  ListLinesIcon,
  NewGroupIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StarOutlineIcon,
  SunIcon,
  TrashIcon,
  UngroupIcon,
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
  const openSettings = useStore((s) => s.openSettings);
  const openDialog = useStore((s) => s.openDialog);
  const confirmDelete = useStore((s) => s.confirmDelete);
  const sync = useStore((s) => s.sync);
  const addList = useStore((s) => s.addList);
  const renameList = useStore((s) => s.renameList);
  const deleteList = useStore((s) => s.deleteList);
  const addGroup = useStore((s) => s.addGroup);
  const renameGroup = useStore((s) => s.renameGroup);
  const deleteGroup = useStore((s) => s.deleteGroup);
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed);
  const reorganizeLists = useStore((s) => s.reorganizeLists);
  const { avatarUrl, pickAvatar: pickAvatarFile } = useAvatar();
  const profile = profileDisplay(db.settings);

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

  const pickAvatar = async () => {
    setAccountOpen(false);
    await pickAvatarFile();
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

  // Enter 与失焦都提交；空白名称视为取消
  const commitNewList = () => {
    const name = newName.trim();
    setAdding(false);
    setNewName("");
    if (!name) return;
    const id = addList(name);
    if (id) setView({ type: "list", id });
  };

  const moveListToGroup = (listId: string, groupId?: string) => {
    if (groupId && collapsedGroups.includes(groupId)) {
      toggleGroupCollapsed(groupId);
    }
    const moved = moveList(
      listSections(lists, groups),
      listId,
      `group:${groupId ?? UNGROUPED_SECTION_KEY}`,
    );
    if (!moved) return;
    const entries = moved.flatMap((section) =>
      section.ids.map((id) => ({ id, groupId: section.groupId })),
    );
    reorganizeLists(entries);
  };

  const listRow = (list: TaskList) => (
    <SortableListRow
      key={list.id}
      list={list}
      count={perList[list.id] ?? 0}
      active={view.type === "list" && view.id === list.id}
      groups={groups}
      onRename={(name) => renameList(list.id, name)}
      onDelete={() =>
        confirmDelete({
          title: "删除列表",
          message: `将删除列表“${list.name}”，其中的任务会保留并移至「任务」清单。`,
          confirmLabel: "删除",
          danger: true,
          onConfirm: () => deleteList(list.id),
        })
      }
      onMoveToGroup={(groupId) => moveListToGroup(list.id, groupId)}
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
            <div className="brand-name">{profile.name}</div>
            {profile.subtitle ? (
              <div className="brand-sub">{profile.subtitle}</div>
            ) : null}
          </div>
        </div>
        {accountOpen ? (
          <div className="menu account-menu" role="menu">
            <div className="account-head">
              <div className="account-title">{profile.name}</div>
              {profile.subtitle ? (
                <div className="account-sub">{profile.subtitle}</div>
              ) : null}
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
                openSettings();
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

        <div
          className={`nav-item ${
            view.type === "list" && view.id === DEFAULT_LIST_ID ? "active" : ""
          }`}
          onClick={() => setView({ type: "list", id: DEFAULT_LIST_ID })}
        >
          <span className="nav-icon">
            <HomeIcon size={16} strokeWidth={1.5} />
          </span>
          <span className="nav-label">{defaultList?.name ?? "任务"}</span>
          {(perList[DEFAULT_LIST_ID] ?? 0) > 0 ? (
            <span className="nav-count">{perList[DEFAULT_LIST_ID]}</span>
          ) : null}
        </div>

        {SMART_ITEMS.filter(({ id }) =>
          isSmartViewVisible(db, id, counts, view),
        ).map(({ id, label, Icon, color }) => {
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
                onDelete={() => {
                  if (groupLists.length === 0) {
                    confirmDelete({
                      title: "删除组",
                      message: `将删除空分组“${group.name}”？`,
                      confirmLabel: "删除",
                      danger: true,
                      onConfirm: () => deleteGroup(group.id),
                    });
                  } else {
                    deleteGroup(group.id);
                  }
                }}
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
                  className="nav-list-glyph"
                  style={{ color: "var(--accent)" }}
                >
                  <ListLinesIcon size={16} strokeWidth={1.5} />
                </span>
              </span>
              <input
                autoFocus
                className="step-input"
                placeholder="列表名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitNewList();
                  } else if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                  }
                }}
                onBlur={commitNewList}
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
  groups,
  onSelect,
  onRename,
  onDelete,
  onMoveToGroup,
}: {
  list: TaskList;
  count: number;
  active: boolean;
  groups: TaskGroup[];
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMoveToGroup: (groupId?: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id });
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  useEffect(() => {
    if (!menuPos) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuPos(null);
        setMoveOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuPos(null);
        setMoveOpen(false);
      } else if (event.key === "Delete") {
        setMenuPos(null);
        setMoveOpen(false);
        onDelete();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuPos, onDelete]);

  const closeMenu = () => {
    setMenuPos(null);
    setMoveOpen(false);
  };

  const startRename = () => {
    setDraft(list.name);
    setEditing(true);
    closeMenu();
  };

  const finishRename = (commit: boolean) => {
    setEditing(false);
    if (!commit) return;
    const value = draft.trim();
    if (value && value !== list.name) onRename(value);
  };

  const display = splitLeadingEmoji(list.name);
  const iconEmoji = display.emoji ?? list.theme?.emoji;
  const label = display.emoji ? display.text || display.emoji : list.name;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`nav-item ${active ? "active" : ""}`}
        onClick={onSelect}
        onContextMenu={(event) => {
          event.preventDefault();
          const width = 240;
          const height = 200;
          setMoveOpen(false);
          setMenuPos({
            x: Math.min(event.clientX, window.innerWidth - width),
            y: Math.min(event.clientY, window.innerHeight - height),
          });
        }}
        {...attributes}
        {...listeners}
      >
        <span className="nav-icon">
          {iconEmoji ? (
            <span className="nav-emoji">{iconEmoji}</span>
          ) : (
            <span
              className="nav-list-glyph"
              style={{ color: "var(--accent)" }}
            >
              <ListLinesIcon size={16} strokeWidth={1.5} />
            </span>
          )}
        </span>
        {editing ? (
          <input
            className="nav-rename-input"
            autoFocus
            value={draft}
            aria-label="列表名称"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => finishRename(true)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                finishRename(true);
              } else if (e.key === "Escape") {
                e.stopPropagation();
                finishRename(false);
              }
            }}
          />
        ) : (
          <span className="nav-label">{label}</span>
        )}
        {count > 0 ? <span className="nav-count">{count}</span> : null}
      </div>

      {menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="menu list-menu"
              role="menu"
              aria-label={`${list.name} 菜单`}
              style={{ position: "fixed", left: menuPos.x, top: menuPos.y }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <button role="menuitem" onClick={startRename}>
                <EditIcon /> 重命名列表
              </button>
              {groups.length > 0 ? (
                <div
                  className="list-menu-flyout"
                  onMouseEnter={() => setMoveOpen(true)}
                  onMouseLeave={() => setMoveOpen(false)}
                >
                  <button
                    role="menuitem"
                    aria-haspopup="menu"
                    aria-expanded={moveOpen}
                    onClick={() => setMoveOpen((open) => !open)}
                  >
                    <FolderIcon /> 将列表移动到…
                    <span className="menu-caret">
                      <ChevronRightIcon size={16} strokeWidth={1.5} />
                    </span>
                  </button>
                  {moveOpen ? (
                    <div
                      className="menu list-submenu"
                      role="menu"
                      aria-label="移动到分组"
                    >
                      {groups.map((group) => {
                        const current = list.groupId === group.id;
                        return (
                          <button
                            key={group.id}
                            role="menuitemradio"
                            aria-checked={current}
                            onClick={() => {
                              closeMenu();
                              if (!current) onMoveToGroup(group.id);
                            }}
                          >
                            <GroupIcon />
                            <span>{group.name}</span>
                            {current ? (
                              <span className="menu-check">
                                <CheckSmallIcon size={14} strokeWidth={2} />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                      {list.groupId ? (
                        <button
                          role="menuitem"
                          onClick={() => {
                            closeMenu();
                            onMoveToGroup(undefined);
                          }}
                        >
                          <UngroupIcon /> 移出分组
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="sep" />
              <button
                role="menuitem"
                className="danger"
                onClick={() => {
                  closeMenu();
                  onDelete();
                }}
              >
                <TrashIcon /> 删除列表
                <span className="menu-hint">Delete</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
