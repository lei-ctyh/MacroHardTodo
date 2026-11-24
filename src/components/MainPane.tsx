import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
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
import { useStore } from "../store/useStore";
import { activeLists, activeTasks, DEFAULT_LIST_ID, type ListTheme, type Task } from "../lib/model";
import {
  headerInfo,
  searchTasks,
  sortTasks,
  tasksForView,
  viewKey,
} from "../lib/views";
import {
  resolveThemeBackground,
  smartTheme,
  themeFallback,
} from "../lib/themes";
import { QuickAdd } from "./QuickAdd";
import { TaskRow } from "./TaskRow";
import { ThemePicker, type ThemeTarget } from "./ThemePicker";
import { SuggestionPanel } from "./SuggestionPanel";
import { ViewMenu } from "./ViewMenu";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LightbulbIcon,
  MoreIcon,
} from "./icons";

export function MainPane() {
  const db = useStore((s) => s.db);
  const view = useStore((s) => s.view);
  const query = useStore((s) => s.query);
  const selectedTaskId = useStore((s) => s.selectedTaskId);
  const selectTask = useStore((s) => s.selectTask);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const toggleImportance = useStore((s) => s.toggleImportance);
  const reorderTasks = useStore((s) => s.reorderTasks);
  const ensureAttachment = useStore((s) => s.ensureAttachment);
  const focusQuickAdd = useStore((s) => s.focusQuickAdd);
  const setSort = useStore((s) => s.setSort);
  const renameList = useStore((s) => s.renameList);
  const deleteList = useStore((s) => s.deleteList);

  const [showCompleted, setShowCompleted] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | undefined>();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameCancelled = useRef(false);

  const listNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of activeLists(db)) map.set(list.id, list.name);
    return map;
  }, [db]);

  const sort = db.settings.sortBy?.[viewKey(view)] ?? "manual";
  const allForView = useMemo(() => tasksForView(db, view), [db, view]);
  const sorted = useMemo(() => sortTasks(allForView, sort), [allForView, sort]);
  const visible = useMemo(
    () => searchTasks(sorted, query),
    [sorted, query],
  );
  const info = headerInfo(db, view);
  const isMyDay = view.type === "smart" && view.id === "myday";

  const completedInList = useMemo(
    () =>
      view.type === "list"
        ? activeTasks(db)
            .filter((t) => t.listId === view.id && t.completed)
            .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        : [],
    [db, view],
  );

  const targetListId =
    view.type === "list" ? view.id : DEFAULT_LIST_ID;

  const sortable = view.type === "list" && !query.trim() && sort === "manual";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    if (!sortable || view.type !== "list") return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = visible.map((t) => t.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderTasks(view.id, next);
  };

  const subtitle = (() => {
    if (isMyDay) {
      const d = new Date();
      return `${d.getMonth() + 1}月${d.getDate()}日, 星期${
        "日一二三四五六"[d.getDay()]
      }`;
    }
    if (view.type === "smart" && view.id === "completed") {
      return `${visible.length} 项已完成`;
    }
    return `${visible.length} 项任务`;
  })();

  const rowProps = (task: Task) => ({
    task,
    selected: task.id === selectedTaskId,
    listName:
      view.type === "smart" && view.id !== "completed"
        ? listNames.get(task.listId)
        : undefined,
    onSelect: () => selectTask(task.id === selectedTaskId ? null : task.id),
    onToggle: () => toggleComplete(task.id),
    onToggleStar: () => toggleImportance(task.id),
  });

  const themeTarget: ThemeTarget | null = useMemo(() => {
    if (view.type === "list") {
      const list = db.lists.find((l) => l.id === view.id && !l.deletedAt);
      return list ? { type: "list", list } : null;
    }
    return { type: "smart", id: view.id };
  }, [db, view]);

  const theme: ListTheme | undefined =
    themeTarget?.type === "list"
      ? themeTarget.list.theme
      : themeTarget?.type === "smart"
        ? smartTheme(db, themeTarget.id)
        : undefined;
  const themeKey = JSON.stringify(theme ?? null);
  const hasBanner = Boolean(theme?.preset || theme?.image);

  useEffect(() => {
    let alive = true;
    if (!theme || !(theme.preset || theme.image)) {
      setBgUrl(undefined);
      return;
    }
    resolveThemeBackground(theme, ensureAttachment).then((url) => {
      if (alive) setBgUrl(url);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey, ensureAttachment]);

  useEffect(() => {
    setThemeOpen(false);
    setSuggestOpen(isMyDay);
    setMenuOpen(false);
    setRenaming(false);
  }, [view]);

  useEffect(() => {
    if (selectedTaskId) setSuggestOpen(false);
  }, [selectedTaskId]);

  const startRename = () => {
    if (view.type !== "list") return;
    renameCancelled.current = false;
    setRenameValue(info.title);
    setRenaming(true);
  };

  const cancelRename = () => {
    renameCancelled.current = true;
    setRenaming(false);
  };

  const commitRename = () => {
    setRenaming(false);
    if (renameCancelled.current) {
      renameCancelled.current = false;
      return;
    }
    if (view.type !== "list") return;
    const trimmed = renameValue.trim();
    if (trimmed) renameList(view.id, trimmed);
  };

  const actions = (
    <>
      {isMyDay ? (
        <button
          className={`icon-btn ${suggestOpen ? "active" : ""}`}
          onClick={() => {
            setSuggestOpen((open) => {
              if (!open) selectTask(null);
              return !open;
            });
          }}
          title="建议"
        >
          <LightbulbIcon />
        </button>
      ) : null}
      <div className="menu-wrap">
        <button
          className={`icon-btn ${menuOpen ? "active" : ""}`}
          title="更多操作"
          aria-label="更多操作"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreIcon />
        </button>
        {menuOpen ? (
          <ViewMenu
            view={view}
            list={themeTarget?.type === "list" ? themeTarget.list : undefined}
            sort={sort}
            canDelete={view.type === "list" && view.id !== DEFAULT_LIST_ID}
            fixed={view.type === "list" && view.id === DEFAULT_LIST_ID}
            onSort={(key) => {
              setSort(viewKey(view), key);
              setMenuOpen(false);
            }}
            onRename={() => {
              startRename();
              setMenuOpen(false);
            }}
            onTheme={() => {
              setThemeOpen(true);
              setMenuOpen(false);
            }}
            onDelete={() => {
              if (view.type === "list") deleteList(view.id);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null}
      </div>
    </>
  );

  const mainStyle = hasBanner
    ? bgUrl
      ? {
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,0) 150px), url("${bgUrl}")`,
        }
      : { background: themeFallback(theme) }
    : undefined;

  return (
    <>
    <main className={`main ${hasBanner ? "on-image" : ""}`} style={mainStyle}>
      <div className="main-header">
        <div className="header-text">
          <div
            className={`main-title ${
              renaming && view.type === "list" ? "renaming" : ""
            }`}
          >
            {theme?.emoji ? (
              <span className="header-emoji">{theme.emoji}</span>
            ) : null}
            {info.color ? (
              <span
                className="nav-list-dot"
                style={{
                  display: "inline-block",
                  background: info.color,
                  marginRight: 10,
                  verticalAlign: "middle",
                }}
              />
            ) : null}
            {renaming && view.type === "list" ? (
              <input
                className="title-input"
                autoFocus
                value={renameValue}
                aria-label="列表名称"
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === "Escape") {
                    e.stopPropagation();
                    cancelRename();
                  }
                }}
              />
            ) : (
              info.title
            )}
          </div>
          <div className="main-subtitle">{subtitle}</div>
        </div>
        <div className="header-actions">{actions}</div>
      </div>

      <div className="task-scroll">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={visible.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {visible.map((task) =>
              sortable ? (
                <SortableTaskRow key={task.id} {...rowProps(task)} />
              ) : (
                <TaskRow key={task.id} {...rowProps(task)} />
              ),
            )}
          </SortableContext>
        </DndContext>

        {isMyDay && visible.length === 0 && !query.trim() ? (
          <WelcomeCard onAdd={() => focusQuickAdd()} />
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="big">{emptyTitle(view.type === "smart" ? view.id : "list")}</div>
            <div>{emptyHint(view.type === "smart" ? view.id : "list")}</div>
          </div>
        ) : null}

        {completedInList.length > 0 ? (
          <div className="suggestion-block">
            <div
              className="suggestion-title"
              style={{ cursor: "pointer" }}
              onClick={() => setShowCompleted((v) => !v)}
            >
              {showCompleted ? <ChevronDownIcon /> : <ChevronRightIcon />}
              已完成 {completedInList.length}
            </div>
            {showCompleted
              ? completedInList.map((task) => (
                  <TaskRow key={task.id} {...rowProps(task)} />
                ))
              : null}
          </div>
        ) : null}
      </div>

      {!(view.type === "smart" && view.id === "completed") ? (
        <QuickAdd
          listId={targetListId}
          myDay={view.type === "smart" && view.id === "myday"}
          important={view.type === "smart" && view.id === "important"}
          dueToday={view.type === "smart" && view.id === "planned"}
        />
      ) : null}
    </main>

    {suggestOpen && isMyDay ? (
      <SuggestionPanel
        onClose={() => setSuggestOpen(false)}
        onOpenTask={(id) => {
          setSuggestOpen(false);
          selectTask(id);
        }}
      />
    ) : null}

    {themeOpen && themeTarget ? (
      <ThemePicker target={themeTarget} onClose={() => setThemeOpen(false)} />
    ) : null}
    </>
  );
}

function WelcomeCard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="welcome-wrap">
      <div className="welcome-card">
        <div className="welcome-art" aria-hidden>
          <svg width="96" height="84" viewBox="0 0 96 84">
            <rect x="14" y="18" width="56" height="56" rx="7" fill="#ffffff" />
            <path
              d="M14 25a7 7 0 0 1 7-7h42a7 7 0 0 1 7 7v11H14V25Z"
              fill="#3b82f6"
            />
            <rect x="26" y="10" width="6" height="14" rx="3" fill="#1d4ed8" />
            <rect x="52" y="10" width="6" height="14" rx="3" fill="#1d4ed8" />
            <rect x="24" y="44" width="36" height="4" rx="2" fill="#cbd5e1" />
            <rect x="24" y="54" width="26" height="4" rx="2" fill="#e2e8f0" />
            <circle cx="76" cy="20" r="12" fill="#facc15" />
            <g stroke="#facc15" strokeWidth={3} strokeLinecap="round">
              <path d="M76 2v-4M76 42v-4M58 20h-4M98 20h-4M63 7l-3-3M89 33l3 3M89 7l3-3M63 33l-3 3" />
            </g>
          </svg>
        </div>
        <div className="welcome-title">专注于你的一天</div>
        <div className="welcome-text">
          使用「我的一天」完成任务，这是一个每天都会刷新的列表。
        </div>
        <button className="welcome-btn" onClick={onAdd}>
          向「我的一天」添加任务
        </button>
      </div>
    </div>
  );
}

function SortableTaskRow(
  props: ComponentProps<typeof TaskRow>,
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.task.id });
  return (
    <TaskRow
      {...props}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

function emptyTitle(id: string): string {
  switch (id) {
    case "myday":
      return "今天还没有安排";
    case "important":
      return "没有重要任务";
    case "planned":
      return "还没有计划";
    case "completed":
      return "还没有已完成的任务";
    case "all":
      return "还没有任务";
    default:
      return "这个列表还是空的";
  }
}

function emptyHint(id: string): string {
  switch (id) {
    case "myday":
      return "从下面的建议中添加，或在任务详情里点击「我的一天」";
    case "important":
      return "在任务右侧点亮星标，它就会出现在这里";
    case "planned":
      return "给任务设置截止日期或提醒后，会按时间出现在这里";
    case "completed":
      return "完成的任务会保留在这里";
    default:
      return "在上方输入框里输入内容，按 Enter 即可添加";
  }
}
