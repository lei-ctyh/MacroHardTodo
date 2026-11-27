import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
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
import { activeLists, DEFAULT_LIST_ID, THEME_COLORS, type ListTheme, type Task } from "../lib/model";
import {
  completedTasksForView,
  defaultCollapsedSections,
  headerInfo,
  searchTasks,
  sectionsForView,
  sortTasks,
  tasksForView,
  viewKey,
  type View,
} from "../lib/views";
import {
  resolveThemeBackground,
  smartTheme,
  themeAccent,
  themeFallback,
} from "../lib/themes";
import { splitLeadingEmoji } from "../lib/emoji";
import { QuickAdd } from "./QuickAdd";
import { SectionHeader } from "./SectionHeader";
import { TaskRow } from "./TaskRow";
import { TaskContextMenu } from "./TaskContextMenu";
import { DateTimePicker } from "./DateTimePicker";
import { SuggestionPanel } from "./SuggestionPanel";
import { ViewMenu } from "./ViewMenu";
import {
  AllIcon,
  CalendarIcon,
  CompletedIcon,
  HomeIcon,
  LightbulbIcon,
  ListLinesIcon,
  MenuIcon,
  MoreIcon,
  StarOutlineIcon,
  SunIcon,
} from "./icons";

const SMART_TITLE_ICONS = {
  myday: SunIcon,
  important: StarOutlineIcon,
  planned: CalendarIcon,
  all: AllIcon,
  completed: CompletedIcon,
} as const;

export function MainPane({
  onOpenSidebar,
  narrow,
}: {
  onOpenSidebar?: () => void;
  narrow?: boolean;
}) {
  const db = useStore((s) => s.db);
  const view = useStore((s) => s.view);
  const query = useStore((s) => s.query);
  const selectedTaskId = useStore((s) => s.selectedTaskId);
  const selectTask = useStore((s) => s.selectTask);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const toggleImportance = useStore((s) => s.toggleImportance);
  const updateTask = useStore((s) => s.updateTask);
  const reorderTasks = useStore((s) => s.reorderTasks);
  const ensureAttachment = useStore((s) => s.ensureAttachment);
  const focusQuickAdd = useStore((s) => s.focusQuickAdd);
  const setSort = useStore((s) => s.setSort);
  const renameList = useStore((s) => s.renameList);
  const deleteList = useStore((s) => s.deleteList);
  const confirmDelete = useStore((s) => s.confirmDelete);
  const toggleSection = useStore((s) => s.toggleSection);

  const [bgUrl, setBgUrl] = useState<string | undefined>();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [skipSuggestAnim, setSkipSuggestAnim] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [taskMenu, setTaskMenu] = useState<{
    taskId: string;
    x: number;
    y: number;
  } | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<{
    taskId: string;
    x: number;
    y: number;
  } | null>(null);
  const renameCancelled = useRef(false);

  const listNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of activeLists(db)) {
      const display = splitLeadingEmoji(list.name);
      map.set(
        list.id,
        display.emoji
          ? display.text
            ? `${display.emoji} ${display.text}`
            : display.emoji
          : list.name,
      );
    }
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
  const SmartTitleIcon =
    view.type === "smart" ? SMART_TITLE_ICONS[view.id] : null;

  const groupedView =
    view.type === "smart" &&
    (view.id === "all" || view.id === "completed" || view.id === "planned");
  const sectionCount =
    view.type === "smart" && (view.id === "all" || view.id === "planned");
  const sectionListName = view.type === "smart" && view.id === "planned";
  const collapsed =
    db.settings.collapsedSections?.[viewKey(view)] ??
    defaultCollapsedSections(viewKey(view));

  const sections = useMemo(
    () => (groupedView ? sectionsForView(db, view, visible) : []),
    [db, view, visible, groupedView],
  );

  const completedTasks = useMemo(
    () => searchTasks(completedTasksForView(db, view), query),
    [db, view, query],
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
    return "";
  })();

  const rowProps = (task: Task, withListName = view.type === "smart") => ({
    task,
    selected: task.id === selectedTaskId,
    listName: withListName ? listNames.get(task.listId) : undefined,
    hideMyDay: isMyDay,
    onSelect: () => {
      setSkipSuggestAnim(false);
      setSuggestOpen(false);
      selectTask(task.id === selectedTaskId ? null : task.id);
    },
    onToggle: () => toggleComplete(task.id),
    onToggleStar: () => toggleImportance(task.id),
    onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDatePickerTarget(null);
      setTaskMenu({ taskId: task.id, x: event.clientX, y: event.clientY });
    },
  });

  const listForTheme = useMemo(
    () =>
      view.type === "list"
        ? db.lists.find((l) => l.id === view.id && !l.deletedAt)
        : undefined,
    [db, view],
  );

  const theme: ListTheme | undefined =
    view.type === "list" ? listForTheme?.theme : smartTheme(db, view.id);
  // 自定义列表：名称开头的 emoji 作为标题图标，其余作为标题文字
  const listNameDisplay =
    view.type === "list" ? splitLeadingEmoji(info.title) : null;
  const titleEmoji =
    view.type === "list" && view.id !== DEFAULT_LIST_ID
      ? listNameDisplay?.emoji ?? theme?.emoji
      : undefined;
  const titleText =
    listNameDisplay?.emoji && listNameDisplay.text
      ? listNameDisplay.text
      : info.title;
  const themeKey = JSON.stringify(theme ?? null);
  const hasBanner = Boolean(theme?.preset || theme?.image || theme?.color);
  const themePhoto = Boolean(theme?.preset || theme?.image);
  const themeLight = theme?.color
    ? (THEME_COLORS.find((c) => c.value === theme.color)?.light ?? false)
    : false;

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
    setSkipSuggestAnim(false);
    setSuggestOpen(isMyDay && !narrow);
    setMenuOpen(false);
    setRenaming(false);
    setTaskMenu(null);
    setDatePickerTarget(null);
  }, [view, isMyDay, narrow]);

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

  const suggestVisible = suggestOpen && isMyDay && !selectedTaskId;

  const actions = (
    <>
      {isMyDay ? (
        <button
          className={`icon-btn ${suggestVisible ? "active" : ""}`}
          onClick={() => {
            setSkipSuggestAnim(false);
            if (suggestVisible) {
              setSuggestOpen(false);
            } else {
              selectTask(null);
              setSuggestOpen(true);
            }
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
            list={listForTheme}
            sort={sort}
            canDelete={view.type === "list" && view.id !== DEFAULT_LIST_ID}
            fixed={view.type === "list" && view.id === DEFAULT_LIST_ID}
            bgUrl={bgUrl}
            onSort={(key) => {
              setSort(viewKey(view), key);
              setMenuOpen(false);
            }}
            onRename={() => {
              startRename();
              setMenuOpen(false);
            }}
            onDelete={() => {
              setMenuOpen(false);
              if (view.type !== "list") return;
              const listId = view.id;
              const listName = listForTheme?.name ?? info.title;
              confirmDelete({
                title: "删除列表",
                message: `将删除列表“${listName}”，其中的任务会保留并移至「任务」清单。`,
                confirmLabel: "删除",
                danger: true,
                onConfirm: () => deleteList(listId),
              });
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null}
      </div>
    </>
  );

  const mainStyle = hasBanner
    ? theme?.color
      ? { background: theme.color }
      : bgUrl
        ? {
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,0) 150px), url("${bgUrl}")`,
          }
        : { background: themeFallback(theme) }
    : undefined;

  const accent = themeAccent(theme);
  const accentStyle = accent
    ? ({
        "--theme-accent": accent.base,
        "--theme-accent-hover": accent.hover,
      } as CSSProperties)
    : undefined;
  const paneStyle =
    mainStyle || accentStyle
      ? { ...(mainStyle ?? {}), ...(accentStyle ?? {}) }
      : undefined;

  return (
    <>
    <main
      className={`main ${hasBanner ? "on-image" : ""} ${
        themePhoto ? "on-photo" : ""
      } ${themeLight ? "on-light" : ""}`}
      style={paneStyle}
    >
      <div className="main-header">
        {onOpenSidebar ? (
          <button
            type="button"
            className="mobile-sidebar-toggle"
            aria-label="打开侧边栏"
            onClick={onOpenSidebar}
          >
            <MenuIcon size={20} strokeWidth={1.5} />
          </button>
        ) : null}
        <div className="header-text">
          <div
            className={`main-title ${
              renaming && view.type === "list" ? "renaming" : ""
            }`}
          >
            <span className="header-title-icon">
              {view.type === "smart" ? (
                SmartTitleIcon ? (
                  <SmartTitleIcon size={24} strokeWidth={1.5} />
                ) : null
              ) : view.id === DEFAULT_LIST_ID ? (
                <HomeIcon size={24} strokeWidth={1.5} />
              ) : titleEmoji ? (
                <span className="header-emoji">{titleEmoji}</span>
              ) : (
                <ListLinesIcon size={24} strokeWidth={1.5} />
              )}
            </span>
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
              titleText
            )}
          </div>
          {subtitle ? <div className="main-subtitle">{subtitle}</div> : null}
        </div>
        <div className="header-actions">{actions}</div>
      </div>

      <div
        className="task-scroll"
        onScroll={() => {
          if (taskMenu) setTaskMenu(null);
        }}
      >
        {groupedView ? (
          sections.map((section) => {
            const isCollapsed = collapsed.includes(section.key);
            return (
              <div key={section.key} className="section-block">
                <SectionHeader
                  title={section.title}
                  count={sectionCount ? section.tasks.length : undefined}
                  collapsed={isCollapsed}
                  onToggle={() => toggleSection(viewKey(view), section.key)}
                />
                {!isCollapsed
                  ? section.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        {...rowProps(task, sectionListName)}
                      />
                    ))
                  : null}
              </div>
            );
          })
        ) : (
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
        )}

        {isMyDay && visible.length === 0 && !query.trim() ? (
          <WelcomeCard onAdd={() => focusQuickAdd()} />
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-inner">
              <div className="empty-art" aria-hidden>
                <EmptyIllustration view={view} />
              </div>
              <div className="big">{emptyTitle(view.type === "smart" ? view.id : "list")}</div>
              <div>{emptyHint(view.type === "smart" ? view.id : "list")}</div>
            </div>
          </div>
        ) : null}

        {completedTasks.length > 0 ? (
          <div className="section-block">
            <SectionHeader
              title="已完成"
              count={completedTasks.length}
              collapsed={collapsed.includes("completed")}
              onToggle={() => toggleSection(viewKey(view), "completed")}
            />
            {!collapsed.includes("completed")
              ? completedTasks.map((task) => (
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

    {suggestVisible ? (
      <SuggestionPanel
        noAnim={skipSuggestAnim}
        onClose={() => {
          setSkipSuggestAnim(false);
          setSuggestOpen(false);
        }}
        onOpenTask={(id) => {
          setSkipSuggestAnim(true);
          selectTask(id);
        }}
      />
    ) : null}

    {(() => {
      if (!taskMenu) return null;
      const target = db.tasks.find(
        (t) => t.id === taskMenu.taskId && !t.deletedAt,
      );
      if (!target) return null;
      return (
        <TaskContextMenu
          task={target}
          x={taskMenu.x}
          y={taskMenu.y}
          onClose={() => setTaskMenu(null)}
          onPickDate={(t, px, py) =>
            setDatePickerTarget({ taskId: t.id, x: px, y: py })
          }
        />
      );
    })()}

    {(() => {
      if (!datePickerTarget) return null;
      const target = db.tasks.find(
        (t) => t.id === datePickerTarget.taskId && !t.deletedAt,
      );
      if (!target) return null;
      const left = Math.max(
        8,
        Math.min(datePickerTarget.x, window.innerWidth - 300),
      );
      const top = Math.max(
        8,
        Math.min(datePickerTarget.y, window.innerHeight - 360),
      );
      return createPortal(
        <div className="date-picker-portal" style={{ left, top }}>
          <DateTimePicker
            initialDate={target.dueDate}
            withTime={false}
            onCancel={() => setDatePickerTarget(null)}
            onSave={(date) => {
              updateTask(target.id, { dueDate: date, dueTime: undefined });
              setDatePickerTarget(null);
            }}
          />
        </div>,
        document.body,
      );
    })()}

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

function EmptyIllustration({ view }: { view: View }) {
  const Icon =
    view.type === "smart"
      ? SMART_TITLE_ICONS[view.id]
      : view.id === DEFAULT_LIST_ID
        ? HomeIcon
        : ListLinesIcon;
  const accent =
    view.type === "smart"
      ? view.id === "myday"
        ? "var(--accent)"
        : view.id === "all" || view.id === "completed"
          ? "var(--smart-red)"
          : "var(--text-secondary)"
      : view.id === DEFAULT_LIST_ID
        ? "var(--text-secondary)"
        : "var(--accent)";
  return (
    <div className="empty-illustration">
      <div className="empty-paper">
        <div className="empty-paper-bar" style={{ background: accent }} />
        <div className="empty-paper-line" />
        <div className="empty-paper-line short" />
      </div>
      <div className="empty-badge" style={{ color: accent }}>
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <span className="empty-spark spark-a" style={{ background: accent }} />
      <span className="empty-spark spark-b" style={{ background: accent }} />
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
      return "尝试为一些任务加星标，以便在此处查看它们。";
    case "planned":
      return "此处显示带有截止日期或提醒的任务。";
    case "completed":
      return "完成的任务会保留在这里";
    case "all":
      return "所有未完成的任务都会显示在此处。";
    default:
      return "在上方输入框里输入内容，按 Enter 即可添加";
  }
}
