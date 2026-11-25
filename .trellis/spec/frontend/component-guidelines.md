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
- Sidebar layout follows Microsoft To Do without text section headings: 我的一天 → 固定「任务」默认清单 → 重要 / 计划内 / 全部 / 已完成 → divider → custom lists/groups → inline new-list input. The first two rows are the basic section; the four smart rows the smart-list section; custom lists/groups the third. The footer pairs `新建列表` with an icon-only `创建新组` button; 同步/设置 live in the account dropdown opened from the brand.
- The fixed default list uses `DEFAULT_LIST_ID`: it is always present, is not draggable/groupable, cannot be renamed or deleted, and always uses the house icon in the sidebar and title. QuickAdd from smart views targets it; the list view itself targets that list. Its theme is background-only; a stored emoji/color is ignored.
- The account row uses a circular avatar + two-line identity (`本地用户` / `本地数据`) and no chevron; clicking the row opens the account menu, clicking the avatar opens the image picker. The search box below has the magnifier on the right and the placeholder `搜索`.
- The sidebar is resizable via `.sidebar-resizer` (clamped 200–420px, persisted in `settings.sidebarWidth`, double-click resets to 240). Selected nav rows use an inset `::before` highlight (2px vertical, 3px radius) with the accent bar in `::after` (3×16px, `--nav-accent`).
- Sidebar counts use `.sidebar .nav-count` badges (20px circle/pill, radius 10px, `--nav-badge` / `--nav-badge-text`); the suggestion panel's count stays plain text.
- Smart-list icons use 16px in the sidebar and 24px in the title, 1.5 stroke width; per-item colors: My Day `--accent`, 全部/已完成 `--smart-red`, 重要/计划内/任务 `--text-secondary`. These system icons are fixed: the sidebar and title never use a theme emoji for them; 已完成 uses a circled check and 任务 uses the house.
- The app theme effect also calls `api.setTitleBarTheme(dark)` so the native Windows caption color (`#F3F3F3` / `#252423`) stays in sync with the sidebar.
- Group headers are `GroupRow`: group icon left, name (14px, 400, `--text`), collapse chevron right (up when expanded, down when collapsed); there is no `...` button. Right-click opens a context menu: empty groups show 重命名组 / 新建列表 / 删除组 (Delete hint); non-empty groups show 重命名组 / 新建列表 / 取消分组列表. 新建列表 creates a custom list inside the group; 取消分组列表 keeps the lists and ungroups them. The whole group section is the drop target; empty groups show `.group-empty` at the list level (`padding-left: 38px`, gap 17px). Group lists use `.group-lists .nav-item` padding-left 32px, gap 26px, and the active accent bar at `left: 29px`.
- Custom lists without an emoji show a 16px `ListLinesIcon` tinted with `list.color` (accent by default), not a dot.
- One `DndContext` wraps the whole list area. Each section (ungrouped + every group) has its own `SortableContext`; group headers and the ungrouped drop zone are `group:<id>` / `group:ungrouped` droppables. Group headers themselves are not draggable — group order is creation order.
- Section building and drag resolution are pure helpers (`listSections`, `moveList` in `views.ts`); keep components free of that logic.
- The content header follows the Microsoft To Do metric grid: `.main-header` padding `40px 32px 6px 44px`; `.main-title` 32px/40px at weight 600; a 32×40px `.header-title-icon` slot + 8px gap (icon x=44px, title text x=84px); `.task-scroll` left 64px / right 56px; `.quick-add` margins `16px 66px 16px 64px`. Keep the title icon slot rendered on every view. Smart views and the default 任务 always use the fixed system icon (`SMART_TITLE_ICONS` / house in `MainPane.tsx`); only custom lists use theme emoji → color dot → list glyph. System icons use `currentColor` so they turn white on theme backgrounds.
- The content subtitle is My Day-only (its date). Other views deliberately have no `N 项任务` / `N 项已完成` line; counts live in the sidebar badges. Do not reintroduce the count subtitle when adding header actions.
- Smart-view task rows include the source list name in their meta, including the 已完成 view; list views omit it because the current list is already the context. Keep `MainPane.rowProps.listName` keyed on `view.type === "smart"`, not on individual smart ids.
- The content header has exactly one `ViewMenu` (`MoreIcon`) per view. My Day additionally keeps the suggestion (lightbulb) button; do not re-add header search or palette icons.
- `ViewMenu` is a wide two-panel popover: a 380px main panel (排序依据 row, 主题 grid, list actions) plus a 224px sort flyout on the right. The 排序依据 flyout opens on hover/focus/click and closes when the pointer leaves the `.main-menu`; it lists the five `SORT_OPTIONS` with icons and the active check. The theme grid is 5 columns (无 + 14 Microsoft-matched `THEME_COLORS` gradients + 8 presets + upload, 46px tiles) and is the same for every view; there is no separate 列表颜色 row. Theme tile/color clicks keep the menu open. Reuse `.menu` for both panels, with `.main-menu-panel` / `.sort-flyout` as static flex children. Do not add the Microsoft-only print/email/pin actions.
- The theme grid has a dashed `+` tile for uploading a local background image (Tauri dialog + `attachmentAdd`); a stored custom image renders as an extra active tile before the `+` and reveals a top-right delete button on hover/focus. Use the `.theme-tile-wrap` + sibling `.theme-tile-delete` pattern (never nest buttons); deleting clears only the preset/image/color, preserving a custom list's existing emoji.
- Every view can have a theme, and all theme editing lives in `ViewMenu` (no standalone theme dialog): themes are `ListTheme.preset` / `ListTheme.image` / `ListTheme.color` stored in `list.theme` or `db.shared` (`mydayTheme` for My Day, `theme:<smartId>` for the rest). `THEME_COLORS` entries carry an optional `light` flag; `MainPane` matches the active gradient and adds `.on-light`, where `.main.on-image.on-light` switches title/subtitle/header actions/empty/suggestion/scrollbar to dark controls. The ViewMenu `fixedIcon` drops stored/selected emoji for system entries, so the sun/star/calendar/infinity/check/house icons never change; an existing custom-list theme emoji remains display-only. There is no separate `TaskList.color`/`setListColor`/color dot; the former palette is the `THEME_COLORS` background set. List management lives in `ViewMenu`, not in sidebar rows.

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
- Use inline styles only for dynamic data: theme colors, computed widths, `backgroundImage` from a theme.
- Reuse existing classes (`.nav-item`, `.task-row`, `.detail-row`, `.quick-add`, `.suggest-row`, `.welcome-card`). Add a new class rather than one-off Tailwind strings.
- `.task-row` is a card in every view, independent of whether the view has a background theme: use the `--task-card-bg`, `--task-card-border`, `--task-card-hover`, `--task-card-selected`, and `--task-card-shadow` tokens (1px border, 4px radius, 2px gap). Do not add `.main.on-image .task-row` or task-text/checkbox/star overrides; `.main.on-image` is for the page backdrop, white header, empty-state, suggestion, quick-add, and welcome surfaces only.
- The task list is a scroll container with a stable, thin, always-visible scrollbar (`--scrollbar-thumb` tokens, white-alpha thumbs on image backgrounds) and 8px bottom padding. The QuickAdd sits outside the scroll with a 16px top margin, creating a persistent page-background gap between the scroll viewport and the add bar at every scroll position; a right margin of 66px (56px content inset + scrollbar gutter) aligns the bar with the task cards. When the list overflows, the last task must scroll fully above the add bar. Do not rely on scroll-content padding alone for this gap — it is only visible at the end of the scroll.
- QuickAdd has three states: a normal trigger button (＋ 添加任务 in `--text`, no hint), a hover `#e8eceb` light surface (`--quick-add-hover`), and an editing task-card row with an empty checkbox, focused input, and `Enter 添加` hint. Use `.quick-add.editing` + the `--task-card-*` tokens; do not restore the always-visible input or the old blue `:focus-within` inset. Escape/empty blur returns to the trigger; Enter keeps the editing row active.
- Other image/theme surfaces use `.main.on-image` modifiers for white header text and contrast-aware overlays.
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
