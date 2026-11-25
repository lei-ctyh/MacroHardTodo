# Design — Align UI layout with Microsoft To Do

## Boundaries

Frontend-only change. No Rust commands, no storage format changes beyond an optional local setting. Files touched:

- `src/lib/model.ts` — sort types + default setting
- `src/lib/views.ts` — sort helpers
- `src/store/useStore.ts` — `setSort` action
- `src/components/Sidebar.tsx` — sidebar search, remove per-list menu, new-list trigger
- `src/components/MainPane.tsx` — header actions, menu, inline rename, sort application
- `src/components/ViewMenu.tsx` — new top-right menu component
- `src/components/ViewMenu.tsx` — inline theme grid/upload/gradient colors
- `src/styles.css` — sidebar search, menu/rename styles, dead-rule cleanup
- `tests/sort.test.ts` — new sort unit tests

## Data Contracts

```ts
// model.ts
export type SortKey = "manual" | "importance" | "due" | "added" | "alpha";

export interface Settings {
  // existing fields…
  sortBy?: Record<string, SortKey>; // key: `list:<id>` | `smart:<id>`
}

export const DEFAULT_SETTINGS: Settings = {
  // existing fields…
  sortBy: {},
};
```

```ts
// views.ts
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "importance", label: "重要" },
  { key: "due", label: "截止日期" },
  { key: "added", label: "已添加" },
  { key: "alpha", label: "字母顺序" },
  { key: "manual", label: "我的顺序" },
];

export function viewKey(view: View): string;
export function sortTasks(tasks: Task[], sort: SortKey): Task[];
```

`sortTasks` is stable and returns a new array; ties fall back to the incoming index (the view's base order from `tasksForView`).

| Sort | Comparator |
|---|---|
| `manual` | unchanged (base order) |
| `importance` | `importance === "high"` first |
| `due` | `dueDate` asc, empty last; then `dueTime` asc, empty last |
| `added` | `createdAt` asc (oldest first) |
| `alpha` | `title.localeCompare(title, "zh-CN", { sensitivity: "base", numeric: true })` |

Store action:

```ts
setSort: (key: string, sort: SortKey) => void;
// updateSettings({ sortBy: { ...db.settings.sortBy, [key]: sort } })
```

Settings are local-only in `mergeDB` (`settings: local.settings`), so sort choice never syncs or conflicts across devices.

Theme targets generalize to every view:

```ts
export type ThemeTarget =
  | { type: "list"; list: TaskList }
  | { type: "smart"; id: SmartViewId };

// themes.ts
export function smartThemeKey(id: SmartViewId): string; // "mydayTheme" for myday, else `theme:${id}`
export function smartTheme(db: DB, id: SmartViewId): ListTheme | undefined;
```

- List themes stay on `list.theme`.
- Smart-view themes live in `db.shared[smartThemeKey(id)]` (`mydayTheme` is kept for the existing My Day theme; others use `theme:<id>`).
- `MainPane.themeTarget` is non-null for every view, so the menu always offers 主题.
- `ViewMenu` applies list/custom image/emoji the same way; gradients are background themes, not a separate list-color field.

## Data Flow

1. `MainPane` reads `view`, computes `sort = db.settings.sortBy?.[viewKey(view)] ?? "manual"`.
2. `allForView = tasksForView(db, view)` (existing base order).
3. `sorted = sortTasks(allForView, sort)`.
4. `visible = searchTasks(sorted, query)`.
5. Drag is enabled only when `view.type === "list" && !query.trim() && sort === "manual"`.
6. Sort selection calls `setSort(viewKey(view), key)`, which updates settings and saves immediately.

## Component Design

### Sidebar

- New `.sidebar-search` block directly under `.brand`: `SearchIcon` + input bound to `query` / `setQuery`; always rendered.
- Escape clears the query and blurs; an empty query shows all tasks in the view.
- Remove the `+` from the "列表" section header (section becomes a plain label).
- Add a "新建列表" action at the bottom of the sidebar (above 同步/设置). It sets the existing `adding` state; the inline name input stays at the end of the list section and scrolls into view when opened.
- Delete `SortableListRow`'s `...` menu, menu state, rename and delete handlers. Keep drag-and-drop and the emoji/list-glyph icon.
- `THEME_COLORS` import moves to `ViewMenu` as the gradient background palette.

### MainPane header

- Remove `searchOpen` state, the search icon/box, and the palette icon.
- Header actions:
  - My Day: suggestion (lightbulb) button + menu button.
  - Other views: menu button only.
- Menu button uses `MoreIcon` inside a `position: relative` wrapper; opens `ViewMenu` anchored below/right.

### ViewMenu (new component)

Props: `view`, `list` (when list view), `sort`, `canDelete`, `fixed`, callbacks `onSort`, `onRename`, `onTheme`, `onDelete`, `onClose`.

```
Wide popover, anchored at the More button:
┌ main panel (380px) ─────────────┐  ┌ sort flyout (224px) ──────────┐
│ ⇅ 排序依据                    › │  │ ☆ 重要                        │
│ 主题                            │  │ 🗓 截止日期                    │
│ [无] [14 colors] [8 presets]   │  │ 🗓+ 已添加                     │
│ [custom image] [+]              │  │ ⇅ 字母顺序                    │
│ ─────────────────────────────── │  │ ⠿ 我的顺序                 ✓  │
│ 重命名 / 删除列表 (custom only)  │  └───────────────────────────────┘
└─────────────────────────────────┘
```

- Main panel: 排序依据 row with a chevron, then the 主题 section (5-column grid: 无 + 14 Microsoft-matched gradient colors + 8 presets + upload tile, 44px tall tiles). There is no separate 列表颜色 row. The panel is 280px wide with 9px theme-grid gaps, giving ~45×44px tiles — matching Microsoft's ~43px swatches at the same display scale.
- Theme grid extras: a dashed `+` tile uploads a local image (Tauri `open` dialog → `api.attachmentAdd` → `applyTheme({ image })`); while uploading it shows a spinner. If `theme.image` exists, a custom tile renders before the `+` using the MainPane's resolved `bgUrl` (fallback `themeFallback(theme)`), marked active. On hover/focus the custom tile shows a top-right `.theme-tile-delete` (CloseIcon) that clears `preset`/`image` without touching the custom list's emoji or color. Preset/无 tiles never render the delete button.
- The custom tile is wrapped in `.theme-tile-wrap` so the delete can be a sibling button (no nested buttons); both keep the 46px tile height and the delete is 18px in the top-right.
- Sort flyout opens as an **independent floating layer** anchored to the 排序依据 row via Floating UI `useFloating` (`placement: left-start` with `right-start` fallback, `offset(12)`, `flip`, `shift`), rendered as an absolutely positioned `.sort-flyout` inside the menu root. The primary panel is a fixed 380px block; the submenu is not in its layout flow, so opening/closing it never moves the primary or flips sides repeatedly. The 12px offset clears the primary panel's 6px padding + border so the left-start flyout leaves a visible gap instead of overlapping the panel edge.
- Hover is managed by Floating UI `useHover` + `safePolygon()`: the pointer can travel from the 排序依据 row across the 4px gap into the flyout without triggering a close/reopen loop; `useClick`/`useFocus` cover click and keyboard. The old `.main-menu` `onMouseLeave` close was removed. Leaving the row/flyout, Escape, outside click, or selecting a sort closes it.
- Animations: the **outer** `.main-menu` and `.sort-flyout` keep a transform-free fade (the flyout's floating position is governed by Floating UI's transform), while the **inner** `.main-menu-panel` (via `.menu`'s `popIn`) and `.sort-flyout-inner` (`sortIn`: opacity + scale(0.97), origin right/top) provide the Microsoft-style scale/fade. Never scale the floating `.sort-flyout` itself: a transformed containing block makes Floating UI's first-frame coordinates land on the scaled box and the submenu briefly overlaps until repaint.
- Theme application calls the store directly (`setListTheme` / `setShared`) and keeps the menu open; `fixedIcon` targets drop the emoji. All theme editing is inline in this menu; there is no separate ThemePicker modal or 更多主题… entry.
- List actions remain 重命名 / 删除列表 on custom lists; smart views and the fixed 任务 have no list actions. The MS-only print/email/pin items are not implemented.
- Close on: outside `mousedown`, Escape, selecting a sort option, rename, delete, or the pointer leaving the menu. Theme tile/color/upload/delete interactions keep the popover open.
- Reuse `.menu` for both panels; `.main-menu` is the flex anchor; `.main-menu-panel` is 380px, `.sort-flyout` 224px, both are static flex children of the anchor.

### Rename

- `MainPane` keeps `renaming` state. On "重命名", replace the title text with an autofocused input.
- Enter or blur commits via `renameList(id, value)`; Escape or an empty value cancels.
- No modal, no sidebar involvement.

### Theme

- All theme editing is in the `ViewMenu` main panel: the 5-column grid (无 + 14 gradients + 8 presets + upload), the custom-image delete. The standalone `ThemePicker` modal and 更多主题… entry were removed.
- Smart/default targets store their theme in `list.theme` / `db.shared` (`mydayTheme`, `theme:<smartId>`); the menu's `fixedIcon` drops `theme.emoji`, so their sun/star/calendar/infinity/check/house icons never change, while gradient/image/upload backgrounds still apply.
- The former list-color palette is now the `THEME_COLORS` / `ListTheme.color` gradient background set: each entry is `{ name, value: "linear-gradient(135deg, …)", light? }`; the first 7 are mid tones (blue/purple/rose/red/green/teal/gray) with the white on-image title, the last 7 are light (light blue/lavender/pink/peach/mint/cyan/gray) with `light: true`. Each gradient is a subtle MS-style wash: the stops sit close to the base (blue `#7d97dd → #6c8cd5 → #5f7dc6`) rather than spanning a wide light-to-dark range. The tile and the page use the same gradient. `TaskList.color`, `setListColor`, the sidebar tint, and the title dot are removed. Custom lists show their existing theme emoji or the accent list glyph; an existing emoji stays display-only.
- `MainPane` derives `themeLight` from the matched `THEME_COLORS` entry and adds `.on-light` to `.main`; CSS `.main.on-image.on-light` switches the title, subtitle, header actions, empty state, suggestion title, and scrollbar to dark text/controls. The 7 mid colors keep the white title treatment.
- `themePhoto` is true for `theme.preset` / `theme.image` (not color themes); `.main` adds `.on-photo`. Empty states keep their illustration/title/hint directly on color gradients; with `.on-photo`, `.empty-state` and `.welcome-card` get a dark blurred translucent box (`rgba(0,0,0,.32)`, `backdrop-filter: blur(12px)`).
- Empty illustrations: My Day keeps the WelcomeCard art. The other system empty states (Important/Planned/All/Completed/Tasks) and custom lists render `EmptyIllustration`: a tilted white `.empty-paper` with an accent header bar + two gray lines, a floating white `.empty-badge` circle containing the view icon (sun/star/calendar/infinity/check/house/list), and two accent `.empty-spark` dots. `.empty-state` fills the task area (`min-height:100%`) and centers a `.empty-inner` block, matching the My Day `.welcome-wrap` vertical placement. The frosted `on-photo` background lives on `.empty-inner`, so it wraps only the illustration/title/hint instead of stretching to the full-height centering container. Color themes keep the illustration directly on the background (white or dark text by `on-light`); image themes render the compact frosted box around the inner content.

### Styles

- `.sidebar-search`: margin around the existing `.search-box` look; white input on the gray sidebar.
- `.main-menu` / `.menu-wrap`: relative anchor; menu right-aligned.
- `.main-title input`: title-sized inline input.
- Remove `.nav-more` rules if no longer referenced. Keep `.palette` (used by the ViewMenu theme section).

## List Groups

### Data Model

```ts
// model.ts
export interface TaskGroup {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number;
  sourceId?: string;
}

export interface TaskList {
  // existing fields…
  groupId?: string; // undefined = ungrouped
}

export interface DB {
  // existing fields…
  groups: TaskGroup[];
}

export const DEFAULT_SETTINGS: Settings = {
  // existing fields…
  collapsedGroups: string[], // local-only UI state
};

export function activeGroups(db: DB): TaskGroup[];
```

- `createDB` seeds `groups: []`.
- `normalizeDb` defaults missing `groups` to `[]` and keeps `groupId` as-is.
- `activeGroups` filters `deletedAt` and sorts by `order`, then `id`.

### Merge / Sync

- `mergeDB` merges groups with the existing generic `mergeEntities` + `purgeTombstones` + `sortByOrder`, exactly like lists.
- `fingerprint` includes groups sorted by id so sync change detection covers group edits.
- Deleting a group tombstones the group and, in the same commit, sets `groupId: undefined` on its non-deleted lists (touching `updatedAt`), appending them to the end of the ungrouped section in their previous group order.
- If a remote group tombstone arrives before the list updates, rendering treats a missing/deleted group as ungrouped.

### Store Actions

```ts
addGroup: (name?: string) => string;                 // default "未命名的组"
renameGroup: (id: string, name: string) => void;
deleteGroup: (id: string) => void;                   // keeps lists, clears groupId
reorganizeLists: (entries: { id: string; groupId?: string }[]) => void;
toggleGroupCollapsed: (id: string) => void;          // settings.collapsedGroups
```

- `reorganizeLists` assigns `order` sequentially across the flattened sidebar order and updates `groupId` in one commit; this is the single entry point for drag-and-drop moves.
- `addList` stays ungrouped for the bottom "新建列表" action.

### Sidebar Structure

```
brand
search
我的一天
任务                   (fixed default list, house icon)
重要 / 计划内 / 全部 / 已完成
divider
ungrouped custom lists (if any)
group header 1         (chevron + name + hover menu, droppable)
  list rows
group header 2
  list rows
inline new-list input
footer: [ + 新建列表 ][ □+ 创建新组 ]
```

- New component `GroupRow.tsx`: chevron toggles collapse, name double-click enters rename, hover `MoreIcon` opens a small menu (重命名 / 删除组).
- Creating a group calls `addGroup()`, expands it, and immediately enters inline rename with the default name selected; empty input keeps "未命名的组".
- Collapsed groups hide their list rows but remain droppable targets.
- Lists keep the existing `SortableListRow` rendering, indented under the group header.
- The bottom "新建列表" opens the existing inline input at the end of the ungrouped section.
- "创建新组" is an icon-only button (`SquarePlus` from lucide, added to `icons.tsx`) with tooltip.

### Drag and Drop

- One `DndContext` for the whole sidebar.
- Each section (ungrouped + every group) has its own `SortableContext`; sections also expose a droppable id `group:<id>` (ungrouped uses `group:ungrouped`) so empty/collapsed groups can receive drops.
- On drag end:
  - `over.id` is a list id → target group is that list's `groupId`, insert at that list's index.
  - `over.id` is `group:<id>` → target group is `<id>`, append.
  - Remove the active list from its source section, insert into the target section, flatten the sections, and call `reorganizeLists`.
- Group headers themselves are not draggable in this iteration (group order = creation order).
- Visual feedback: highlight the target section while dragging over it.

### Styles

- `.group-row`, `.group-caret`, `.group-name`, `.group-actions`, `.group-lists`, `.group-drop-target`.
- `.sidebar-new-row` for the footer pair; the new-list button flexes, the group button stays icon-sized.
- Reuse `.menu` for the group action menu.

### Tests

- Extend `tests/merge.test.ts` with group LWW, tombstone purge, and list `groupId` preservation.
- Add a pure helper test if grouping/flattening logic is extracted (e.g. `buildSections`).
- Manual checks: create/rename/collapse/delete group, drag list into/out of/between groups, restart persistence, WebDAV round-trip.

### Account Menu

- Wrap `.brand` in a `.brand-wrap` (position relative); the row is a `role="button"` div with hover styling. Clicking the row toggles the menu; the avatar is a nested `<button>` that stops propagation and opens the image picker.
- No chevron is rendered.
- Avatar: `Settings.avatar?: ThemeImage` (local-only). `pickAvatar` uses the Tauri dialog plugin, copies the file through `attachmentAdd`, and stores `{ relPath, mime, name, size }`; the sidebar resolves it via `attachmentRead` into a data URL and renders it with `object-fit: cover`. Missing files fall back to the app check icon.
- Clicking the avatar closes the menu before opening the picker; outside-click/Escape still close the menu.
- Menu content:
  - A non-interactive header with the local profile.
  - 同步 (CloudIcon): opens the existing sync dialog; shows `未配置` / `未同步` / last sync time / `正在同步` (spinner) / error text.
  - 设置 (SettingsIcon): opens the existing settings dialog.
- Remove the 同步/设置 rows from `.sidebar-footer`; the footer keeps only `.sidebar-new-row` (`新建列表` + `创建新组`).

## Resizable Sidebar

- Add `Settings.sidebarWidth?: number` (default 240) — a local-only device preference, like other settings.
- `App.tsx` renders a `.sidebar-resizer` between `Sidebar` and `MainPane`.
- The app-shell receives an inline `--sidebar-w: <width>px`; the sidebar keeps `flex: 0 0 var(--sidebar-w)`.
- On pointer down, record `startX`/`startWidth`; on pointer move, set the width to `clamp(200, 420, startWidth + delta)`; on pointer up, persist via `updateSettings({ sidebarWidth })` and restore cursor/user-select.
- Double-click resets to 240px and persists.
- `.sidebar-resizer` is a 5px wide column-resize hit area straddling the sidebar border, with a subtle hover/active line.

## Nav Highlight Metrics (Microsoft-matched)

- `.sidebar-scroll` horizontal padding 6px; highlight inset `2px 0` → 36px tall, 6px side gaps.
- Highlight radius 3px, selected `#E9E9E9`, hover `#ECECEC`.
- Accent bar: `left: 1px` inside the highlight, 3×16px, radius 2px, `#005FB8`.
- Nav content padding-left 12px → icons start ~18px from the sidebar edge.

## Native Title Bar (Windows DWM)

- Microsoft To Do extends its client area into the title bar; Tauri keeps the native frame, so use DWM instead.
- `src-tauri/src/lib.rs` declares `DwmSetWindowAttribute` from `dwmapi` and applies:
  - `DWMWA_CAPTION_COLOR` (35) = `0x00F3F3F3` (`#F3F3F3`) light / `0x00232425` (`#252423`) dark (COLORREF is `0x00BBGGRR`).
  - `DWMWA_TEXT_COLOR` (36) = `0x00202020` light / `0x00F1F2F1` dark.
- The `set_titlebar_theme(dark)` Tauri command is registered and called by the frontend theme effect; `setup` applies the light default immediately so the first paint is close.
- Non-Windows targets compile to a no-op. Native caption buttons, drag, snap, and accessibility remain untouched (unlike a custom title bar).

## Account Area Metrics (Microsoft-matched)

- Avatar 46px circle; row padding `18px 18px 12px`; avatar-to-text gap 12px.- Name 16px/600; subtitle 13px in `--text-secondary`; no chevron.
- Search box 36px tall, 6px radius, light border with a darker bottom underline and no shadow, 14px input, 18px horizontal page padding; search starts at 76px from the top.
- The footer has no vertical padding: the `新建列表` + `创建新组` row is exactly 40px, matching nav rows.
- Clicking the row opens the menu; clicking the avatar opens the image picker.

## Default List & Smart Views

- `DEFAULT_LIST_ID = "list_default"`; `createDB` seeds a list named `任务` with that id.
- `ensureDefaultList(db)` adds the list if missing and revives it if tombstoned; `normalizeDb` calls it on load/import.
- Sidebar order: 我的一天 → fixed 任务 default list → 重要 / 计划内 / 全部 / 已完成 → divider → custom lists/groups. There are no text section headings (`智能列表`/`列表` were removed); the divider separates the fixed entries from custom lists. The default list is excluded from `listSections`/drag-and-drop. The first two rows form the basic section; the four smart rows the smart-list section; custom lists/groups the third.
- The default 任务 row always renders `HomeIcon` (16px) in the sidebar and 24px in the content title, regardless of the stored theme emoji/color.
- `SMART_VIEWS` becomes `["myday","important","planned","all","completed"]`; the old `tasks` view maps to the new `all` (label 全部).
- `MainPane` QuickAdd target is `view.type === "list" ? view.id : DEFAULT_LIST_ID`.
- `ViewMenu` receives `fixed` for the default list and hides rename/delete; the store refuses to delete `DEFAULT_LIST_ID`.
- Custom lists (e.g. `AAA`) remain normal: creatable, renamable, groupable, deletable, and icon/color customizable.

## Smart List Icons

- Icons are 16px in the sidebar and 24px in the content title, with 1.5 stroke width (Fluent-like thin lines). My Day: `--accent` sun; 全部/已完成: `--smart-red` (`#C42B1C` light / `#FF6B5E` dark); 重要/计划内/任务: `--text-secondary`.
- These system icons are fixed: the sidebar and title always use them; a theme emoji stored in a smart view/default-list theme is ignored in both places, and the ViewMenu theme grid has no emoji picker for those targets. Custom lists keep any existing theme emoji display-only (the emoji picker was removed with the theme modal).
- Active rows keep the per-icon color (the inset highlight and accent bar indicate selection); 已完成 uses Lucide `CircleCheck`; the default 任务 uses the house in both places.

## Group Rows

- Group header: 20px group glyph on the left (rounded square + inner line), name (14px, weight 400, `--text`), and a collapse chevron on the right (up when expanded, down when collapsed). Icon/caret stay `--text-secondary`. Height 40px, hover uses `--nav-hover`. No `...` button.
- Right-clicking the header opens a fixed-position context menu at the cursor: 重命名组 / 新建列表, then a separator. Empty groups show 删除组 (danger, `Delete` hint); non-empty groups show 取消分组列表 (keeps lists, removes the group). `Delete` only triggers for empty groups while the menu is open.
- 新建列表 creates a custom list via `addList("无标题列表", groupId)`, expands the group, and selects the new list. Lists without an emoji render a 16px list-lines glyph tinted with `list.color` (accent default).
- The whole `group-section` is the `group:<id>` droppable, so empty groups can receive a drag anywhere in the section.
- Empty expanded groups render `.group-empty` at the list level (padding-left 38px, gap 17px, 2×20px line near the list icon + text between the list icon and name, `拖到此处来添加列表`).
- Group lists use `.group-lists .nav-item` padding-left 32px and gap 26px, so the icon sits 20px right of the group icon and the name 36px right of the group name; the active accent bar is at `left: 29px` (3px left of the list icon).

## Content Header Metrics (Microsoft-matched)

- `.main-header` padding `40px 32px 6px 44px` (same 40px top with `.main.on-image`); `.main-title` is 32px/40px, weight 600, letter-spacing -0.3px.
- The title starts with `.header-title-icon`: a 32×40px inline-flex slot + 8px gap. The icon starts at 44px and the title text at 84px from the content pane's left edge; Microsoft measures ≈45px and ≈85px.
- Icon precedence: smart views always use their fixed sidebar icon (My Day sun, 重要 star, 计划内 calendar, 全部 infinity, 已完成 circled check); the default 任务 always uses the house; custom lists use `theme.emoji` → list-lines glyph. The system icons use `currentColor`, so they turn white with the title on theme backgrounds.
- `.main-title .header-emoji` is 28px inside the slot; no extra margin. The slot stays rendered for every view, keeping the title x-position stable.
- `.task-scroll` padding `10px 56px 8px 64px`; `.quick-add` margin `16px 66px 16px 64px`. Task cards therefore start 20px right of the title text (64 vs 84), matching the reference.
- The count subtitle (`N 项任务` / `N 项已完成`) is removed for non-MyDay views; only My Day renders `.main-subtitle` with its date. `MainPane` composes `subtitle` as `""` otherwise and conditionally renders it.
- The Microsoft 计划内 task-group headers (先前 / 今天 / 稍后) are explicitly out of scope for this title pass.

## Smart-view Task Metadata

- `MainPane.rowProps` passes `listName` for every smart view (`view.type === "smart"`), including 已完成; list views leave it undefined because the list itself is already the context.
- A completed task therefore renders the same metadata line as 计划内 / 全部: its steps or due date followed by the source list name (for example `0/1 AAA` or `11月23日 周一 AAA`), instead of hiding the list name only on the completed page.

## Task Card Surface

- Every `.task-row` is a card, independent of the view theme:
  - `background: var(--task-card-bg)`, `border: 1px solid var(--task-card-border)`, `border-radius: 4px`, `margin-bottom: 2px`, `box-shadow: var(--task-card-shadow)`, `padding: 10px 8px`.
  - `:hover` uses `--task-card-hover`; `.selected` uses `--task-card-selected`.
- Light tokens: `#ffffff` / `#ececec` / `#f7f7f7` / `#eaf2ff` / `0 1px 2px rgba(0,0,0,0.1)`.
- Dark tokens: `#2b2b2b` / `#3b3a39` / `#333333` / `#26364f` / `0 1px 2px rgba(0,0,0,0.4)`.
- `.main.on-image` keeps only the page background, white header/title/actions, empty-state, suggestion, quick-add, and welcome treatments. It has no `.task-row`, `.task-title`, `.task-meta`, `.checkbox`, `.row-star`, `.drag-handle`, or `.task-scroll` overrides. A themed and a plain view therefore have identical task surfaces; the theme changes the backdrop, not the task cards.

## Task-list Overflow

- `.task-scroll` reserves a stable scrollbar gutter and renders a thin, always-visible scrollbar: `scrollbar-gutter: stable`, `scrollbar-width: thin`, `scrollbar-color: var(--scrollbar-thumb) transparent`, plus `::-webkit-scrollbar` / `-thumb` rules (6px thumb inside a 10–12px gutter, transparent track).
- Scrollbar tokens: light `#c8c6c4` / `#a8a6a4`; dark `#5c5a58` / `#777573`; on a theme background use `rgba(255,255,255,0.55)` / `0.75`.
- Bottom inset: `.task-scroll` padding-bottom is 8px (inside the scroll). The `.quick-add` has a 16px top margin outside the scroll, so a 16px page-background gap exists between the scroll viewport and the add bar at every scroll position — the previous 20px scroll-content padding was invisible until the end and let the last visible row press against the bar. At the end of the scroll the last task sits ~24px above the add bar.
- The `.quick-add` keeps the 64px left inset and uses `margin-right: 66px` (56px content padding + the 10px reserved scrollbar gutter), aligning its right edge with the task cards so the bottom row does not look narrower than the add bar.
- The add bar remains a flex footer, not an overlay: the list scrolls in its own viewport above the bar; the visible scrollbar communicates that a clipped row continues below the fold.

## QuickAdd States

- `QuickAdd.tsx` gains an `editing` state; the input is no longer always rendered.
- Normal: `.quick-add` contains a `.quick-add-trigger` button (plus + `.quick-add-label`), no input/hint. Label uses `var(--text)`, plus `var(--text-secondary)`. The bar keeps `var(--bg-sidebar)` (on image: `rgba(255,255,255,0.85)` + 10px blur). `.quick-add:hover:not(.editing)` uses `--quick-add-hover`: `#e8eceb` light / `#333333` dark; on image `#e8eceb`.
- Editing: `.quick-add.editing` uses the task-card surface (`--task-card-bg`, 1px `--task-card-border`, 4px radius, `--task-card-shadow`, `padding: 10px 8px`). It renders an empty `.checkbox.add-task-checkbox` (pointer-events none), the focused input (placeholder `添加任务`), and the `Enter 添加` hint. The old `.quick-add:focus-within` blue inset is removed; the card border supplies the focus affordance.
- Image-theme editing overrides reset the translucent bar and dark input colors (`background: var(--task-card-bg)`, no backdrop-filter, input/hint use `--text`/`--text-tertiary`).
- Interactions: trigger click / global quick-add nonce → `editing = true`, focus (and select on the shortcut); Enter calls the existing `addTask` and keeps editing; Escape clears and exits; blur with an empty value exits; blur with text keeps the draft in the editing card.

## Responsive Sidebar

- `App.tsx` tracks `matchMedia("(max-width: 760px)")` in `narrow` and an `sidebarOpen` state; it only closes automatically when the window becomes wide. The `app-shell` gets `.sidebar-open`; a `.sidebar-scrim` is rendered while `narrow && sidebarOpen`.
- `MainPane` receives `onOpenSidebar` + `narrow`; it renders `.mobile-sidebar-toggle` (MenuIcon, visible only at the breakpoint) before the header text. At ≤760px the header becomes a two-row grid: hamburger + actions on row 1, title/subtitle spanning row 2.
- CSS media query: `.sidebar` is `position: fixed; width: min(320px, 84vw); z-index: 90; transform: translateX(-100%)` with a 0.18s transition; `.sidebar-open .sidebar` slides in. `.sidebar-resizer` is hidden; `.sidebar-scrim` is a fixed dark overlay at z-index 89. The main loses its top-left radius.
- Drawer close: scrim click, Escape (App keydown), or the `view` effect in App (any navigation). My Day's suggestion is default-closed when `narrow`; below 1100px `.suggest-panel` and `.detail-panel` become fixed right overlays (`min(380px, 92vw)`, z-index 85) instead of flex columns, so the main is never squeezed by the sidebar + a 360px suggestion panel.
- `src-tauri/tauri.conf.json` minimum width changes from 880 to 520 so the breakpoint is reachable. A running dev window must be restarted to pick up the config change.

## Trade-offs

- Inline accordion for sorting instead of a flyout submenu: fewer positioning bugs, slightly taller menu. Acceptable for five options.
- Sort stored in local settings instead of a new synced entity: sort is a per-device presentation choice; avoids merge complexity.
- The separate list color was removed rather than kept as a second color system: the former palette now serves as theme backgrounds, so a list has one visual color (its background), matching Microsoft To Do. Custom list identity is the existing emoji or the accent list glyph.
- Removing the sidebar per-list menu reduces duplicated actions but makes the top-right menu the only list-management entry; the menu is present on every list view, so discoverability is preserved.
- Groups keep creation order in this iteration; drag-reordering groups would require a second nested sortable layer and is deferred.
- Collapse state lives in local settings (`settings.collapsedGroups`), not synced, because it is a per-device view preference.
- Deleting a group keeps its lists and tasks (explicit product decision), which is safer than Microsoft To Do's delete-with-lists behavior.

## Compatibility / Rollout

- No release tag exists; no migration is required. `normalizeDb` already spreads `DEFAULT_SETTINGS`, so old data without `sortBy` reads as `{}`.
- All other changes are presentation-only; existing task/list/theme data remains valid.
- Rollback: revert the frontend files; the only persisted addition is an optional `settings.sortBy` object that older code ignores.

## Manual Verification

1. Sidebar search filters the current view; Escape clears; switching views clears.
2. Every view has one menu; list menu shows rename/theme/sort/delete; My Day shows theme/sort plus the suggestion button; other smart views show sort only.
3. Each sort option reorders correctly; choice persists after switching views and restarting the app.
4. Drag works only under 我的顺序; it is disabled for other sorts and during search.
5. Rename commits/cancels correctly; delete switches lists; last list cannot be deleted.
6. Theme is reachable on every view and persists per view; gradients and images are both backgrounds; there is no separate list color.
7. My Day suggestions still open/close.
