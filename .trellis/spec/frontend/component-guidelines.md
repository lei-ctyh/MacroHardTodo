# Component Guidelines

> How components are built in this project.

---

## Component Structure

- Function components only. Hooks at the top, before any early return.
- `TaskDetail` is the reference for conditional data: it calls all hooks, then `if (!task) return null`.
- One component per file; helpers used by only one component stay at the bottom of that file (`WelcomeCard`, `SortableTaskRow`).
- Components read store state through individual selectors:

```tsx
const db = useStore((s) => s.db);
const setMyDay = useStore((s) => s.setMyDay);
```

- Do not subscribe to the whole store object and destructure; it re-renders on every keystroke.
- Sidebar layout follows Microsoft To Do without text section headings: 我的一天 → 重要 / 计划内 / 全部 / 已完成 → 固定「任务」默认清单 → divider → custom lists/groups → inline new-list input. The footer pairs `新建列表` with an icon-only `创建新组` button; 同步/设置 live in the account dropdown opened from the brand.
- The fixed default list uses `DEFAULT_LIST_ID`: it is always present, is not draggable/groupable, and cannot be renamed or deleted. QuickAdd from smart views targets it; the list view itself targets that list.
- The account row uses a circular avatar + two-line identity (`本地用户` / `本地数据`) and no chevron; clicking the row opens the account menu, clicking the avatar opens the image picker. The search box below has the magnifier on the right and the placeholder `搜索`.
- The sidebar is resizable via `.sidebar-resizer` (clamped 200–420px, persisted in `settings.sidebarWidth`, double-click resets to 240). Selected nav rows use an inset `::before` highlight (2px vertical, 3px radius) with the accent bar in `::after` (3×16px, `--nav-accent`).
- Sidebar counts use `.sidebar .nav-count` badges (20px circle/pill, radius 10px, `--nav-badge` / `--nav-badge-text`); the suggestion panel's count stays plain text.
- Smart-list icons use 16px, 1.5 stroke width; per-item colors: My Day `--accent`, 全部/已完成 `--smart-red`, 重要/计划内/任务 `--text-secondary`. Active rows do not override icon colors; 已完成 uses a circled check.
- The app theme effect also calls `api.setTitleBarTheme(dark)` so the native Windows caption color (`#F3F3F3` / `#252423`) stays in sync with the sidebar.
- Group headers are `GroupRow`: group icon left, name (14px, 400, `--text`), collapse chevron right (up when expanded, down when collapsed); there is no `...` button. Right-click opens a context menu: empty groups show 重命名组 / 新建列表 / 删除组 (Delete hint); non-empty groups show 重命名组 / 新建列表 / 取消分组列表. 新建列表 creates a custom list inside the group; 取消分组列表 keeps the lists and ungroups them. The whole group section is the drop target; empty groups show `.group-empty` at the list level (`padding-left: 38px`, gap 17px). Group lists use `.group-lists .nav-item` padding-left 32px, gap 26px, and the active accent bar at `left: 29px`.
- Custom lists without an emoji show a 16px `ListLinesIcon` tinted with `list.color` (accent by default), not a dot.
- One `DndContext` wraps the whole list area. Each section (ungrouped + every group) has its own `SortableContext`; group headers and the ungrouped drop zone are `group:<id>` / `group:ungrouped` droppables. Group headers themselves are not draggable — group order is creation order.
- Section building and drag resolution are pure helpers (`listSections`, `moveList` in `views.ts`); keep components free of that logic.
- The content header follows the Microsoft To Do metric grid: `.main-header` padding `40px 32px 6px 44px`; `.main-title` 32px/40px at weight 600; a 32×40px `.header-title-icon` slot + 8px gap (icon x=44px, title text x=84px); `.task-scroll` left 64px / right 56px; `.quick-add` margins `0 56px 16px 64px`. Keep the title icon slot rendered on every view: theme emoji first, then list color dot/list glyph, or the smart-view icon (`SMART_TITLE_ICONS` in `MainPane.tsx`), using `currentColor` so it turns white on theme backgrounds.
- The content subtitle is My Day-only (its date). Other views deliberately have no `N 项任务` / `N 项已完成` line; counts live in the sidebar badges. Do not reintroduce the count subtitle when adding header actions.
- The content header has exactly one `ViewMenu` (`MoreIcon`) per view. My Day additionally keeps the suggestion (lightbulb) button; do not re-add header search or palette icons.
- Every view has a theme (emoji/background; lists also have a color): lists store `list.theme`, smart views store theirs in `db.shared` (`mydayTheme` for My Day, `theme:<smartId>` for the rest); all of it is edited in `ThemePicker`, opened from `ViewMenu`. List identity is edited there too; list management lives in `ViewMenu`, not in sidebar rows.

---

## Props Conventions

- Type props inline for local components; export an interface only when reused (`TaskRowProps`).
- Reuse domain types from `src/lib/model.ts` instead of re-typing shapes.
- Pass callbacks, not store actions, into presentational components (`TaskRow` receives `onToggle`, `onSelect`).
- Optional props use `?`; prefer explicit `undefined` over `null` in new code (legacy `myDay` uses `string | null`).

```tsx
export interface TaskRowProps {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}
```

---

## Styling Patterns

- All styling lives in `src/styles.css` with CSS variables (`--accent`, `--bg-main`, `--text-secondary`, …). Dark mode is `:root[data-theme="dark"]`.
- Use inline styles only for dynamic data: list colors, computed widths, `backgroundImage` from a theme.
- Reuse existing classes (`.nav-item`, `.task-row`, `.detail-row`, `.quick-add`, `.suggest-row`, `.welcome-card`). Add a new class rather than one-off Tailwind strings.
- Image/theme surfaces use `.main.on-image` modifiers for white cards and white header text.
- Transitions are 120–200 ms ease; respect `prefers-reduced-motion` (already handled globally).

---

## Icons

- Import icons only from `src/components/icons.tsx`.
- That file is the single place to alias lucide names (`Add20Regular` style aliases were replaced by lucide). Swapping an icon library later means editing one file.
- Icon buttons must have `title` and/or `aria-label`.

---

## Accessibility

- Checkbox-like buttons: `aria-label` describing the action (“标记为完成”, “加入我的一天”).
- Modal shell (`Modal.tsx`) handles Escape and overlay click; do not reimplement.
- Inputs submit on Enter; Escape closes inline editors where implemented.
- Keep focus visible: global `:focus-visible` outline; remove it only on inputs already wrapped by a styled container (`.quick-add input`, `.step-input`).

---

## Common Mistakes

- Declaring hooks after `if (!task) return null` — breaks hook order. Call hooks first.
- Using `React.ComponentProps` without importing `React` — import `type ComponentProps` from `react`.
- Importing `lucide-react` directly in a component instead of `./icons`.
- Storing derived values (counts, filtered lists) in state — compute with `useMemo` from `db`.
- Adding a second global add bar or moving authoring controls; the fixed bottom `QuickAdd` is the single entry point.
- Using Microsoft assets or the Microsoft To Do name/logo — prohibited; see quality guidelines.
