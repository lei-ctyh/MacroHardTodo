# Settings Page Redesign

## Goal

Replace the current floating `SettingsDialog` modal with a dedicated full-window Settings page modeled after Microsoft To Do (`← 设置` top bar, centered single-column layout, profile header, Fluent-style toggle switches and vertical radio controls), while adding practical local-first General and Smart List preferences and fixing the stuck `数据目录（读取中）` display.

## Confirmed Facts

- Current settings render inside a `<Modal>` (`src/components/SettingsDialog.tsx`) triggered by `useStore.openDialog("settings")` from `src/components/Sidebar.tsx`.
- `Settings` in `src/lib/model.ts` is local-only (not synced via WebDAV) and normalized against `DEFAULT_SETTINGS` in `normalizeDb()` (`src/store/useStore.ts:115-132`).
- `SyncDialog` (`src/components/SyncDialog.tsx`) and `MigrationWizard` (`src/components/MigrationWizard.tsx`) are modal dialogs controlled by `useStore.dialog`.
- `SettingsDialog.tsx:33-37,224` falls back to `""` when `api.dataDir()` rejects or returns empty, leaving the UI permanently stuck on `（读取中）`.
- `DateTimePicker.tsx:172` currently hardcodes `weekStartsOn={1}`.
- `Sidebar.tsx:54-74,407-450` renders `myday`, fixed default list `任务`, and four smart lists (`important`, `planned`, `all`, `completed`), and handles local avatar selection (`settings.avatar`).
- `useStore.ts:479-496` appends new tasks at `max(order) + 1`; `toggleImportance` (`634-640`) does not reorder tasks; `toggleComplete` (`502-548`) plays no sound; `deleteTask` / `deleteList` / `deleteGroup` delete immediately without confirmation.
- `src/lib/views.ts:89-92,276-279,295,387-397,434-455` defines My Day membership solely via `task.myDay === todayISO()`.
- Project conventions (`.trellis/spec/frontend/`): Simplified Chinese UI copy, zero Microsoft brand assets/trademarks, all styles in `src/styles.css`, all icons via `src/components/icons.tsx`, pure logic in `src/lib/`.

## Requirements

### R1. Full-Window Dedicated Settings Page
- Clicking「设置」in the account menu opens a full-window `SettingsPage` covering the app window (replacing Sidebar, resizer, MainPane, and TaskDetail).
- Sticky top bar displays a `←` back button and `设置` heading; clicking back or pressing `Escape` (when no sub-modal is open) returns to the previous view without losing navigation state.
- Triggering global quick-add (`Ctrl + Alt + T` or `Ctrl + N`) while on Settings closes Settings and focuses QuickAdd in the main workspace.
- Opening WebDAV Sync (`SyncDialog`) or Microsoft To Do Migration (`MigrationWizard`) from Settings displays the modal on top of `SettingsPage`; closing the modal returns to `SettingsPage`.
- Centered single-column content layout (`max-width: 580px`), full-page vertical scroll, subtle section dividers, responsive on narrow windows (`≤760px`), and full light/dark theme parity.

### R2. Profile Header
- Top of the centered column displays a 64px circular avatar (using `settings.avatar`, fallback `/logo.png`), identity text (`本地用户` and `本地数据` or configured WebDAV username), and action button(s) to change or reset the avatar.
- Clicking the avatar opens the image picker and updates both `SettingsPage` and `Sidebar`.

### R3. Fluent-Style Controls & Section Structure
- Toggle controls use pill switches (`role="switch"`, `aria-checked`) paired with `开` / `关` text labels.
- Theme selection uses a vertical radio group (`role="radiogroup"`) with circular radio indicators: `浅色主题` / `深色主题` / `使用我的 Windows 主题`.
- Sections follow a clear visual hierarchy: **常规** → **主题** → **智能列表** → **通知** → **同步与迁移** → **数据** → **关于**.

### R4. General Preferences (Default: ON for the 5 behavioral toggles)
- **在顶部添加新任务** (`addTasksOnTop`, default `true`): when enabled, newly added tasks insert at the top of their target list (`min(order) - 1`); when disabled, they append to the bottom (`max(order) + 1`).
- **将带有星标的任务移至顶部** (`moveStarredToTop`, default `true`): when enabled, marking a task as important (`normal` → `high`) moves it to the top of its list (`min(order) - 1`).
- **播放完成提示音** (`playCompletionSound`, default `true`): when enabled, marking an incomplete task as completed plays a gentle synthesized chime via Web Audio API (no external audio assets; silent no-op if audio API unavailable).
- **在删除前确认** (`confirmBeforeDelete`, default `true`): when enabled, destructive delete actions (delete task, delete custom list, delete empty group) prompt a narrow confirmation modal before executing; when disabled, they execute immediately. Non-destructive「取消分组列表」does not prompt.
- **使用 Windows 启动自动启动应用**: toggle backed by `@tauri-apps/plugin-autostart` (existing behavior, restyled as toggle switch).
- **一周的开始** (`weekStartsOn`, default `1` 周一; options: 周一 / 周日): drives `DateTimePicker`'s calendar `weekStartsOn`.

### R5. Smart List Preferences
- Independent visibility toggles for `重要` (`important`), `计划内` (`planned`), `已完成` (`completed`), and `全部` (`all`), rendered with their sidebar icons and colors; all 4 default to `true`. (`我的一天` and default `任务` list remain always visible.)
- **自动隐藏空的智能列表** (`autoHideEmptySmartLists`, default `false`): hides toggleable smart lists whose count is `0` in the sidebar (keeping the currently active smart view visible until navigated away).
- If a user disables the currently active smart view in Settings, active `view` switches to `{ type: "smart", id: "myday" }`.
- **在“我的一天”中显示“今天截止”的任务** (`showDueTodayInMyDay`, default `true`): when enabled, tasks with `dueDate === todayISO()` are included in My Day (`tasksForView`, `completedTasksForView`, `smartCounts`) and excluded from My Day suggestions so they are not duplicated.

### R6. Notifications, Sync & Migration, Data, About
- **通知**：`提醒` toggle bound to `settings.reminderEnabled`.
- **同步与迁移**：WebDAV sync status summary + primary blue「同步」button (runs `syncNow()` if configured, or opens `SyncDialog` if unconfigured) +「配置同步」button (`SyncDialog`), plus「从微软 To Do 迁移」entry (`MigrationWizard`).
- **数据**：
  - Fix stuck `（读取中）` bug (`SettingsDialog.tsx:33-37,224`): distinguish loading (`null`) vs resolved path (with one-click copy path) vs unavailable/browser preview (`浏览器本地存储`).
  - Auto-purge completed tasks (`autoPurgeCompletedDays`) and JSON/CSV import & export buttons (preserving existing functionality and status feedback).
- **关于**：App name, version (`MacroHard Todo 0.1.0`), MIT license, and concise local-first independence note (no Microsoft branding).

## Out of Scope

- Microsoft account sign-in / sign-out / account management
- Planner,「已分配给我」, and「已共享列表活动」
- Pin to taskbar and Windows taskbar badge count (OS shell integration)
- Social media links (Twitter / Facebook) and telemetry / diagnostic data toggles

## Acceptance Criteria

- [ ] Clicking「设置」from the account menu opens a full-window Settings page with sticky `← 设置` bar and centered single-column layout; clicking `←` or pressing `Escape` returns to the previous view.
- [ ] Opening WebDAV Sync or Migration Wizard from Settings displays the modal above Settings, and closing it returns to Settings.
- [ ] Profile header shows avatar (changeable & resettable) and updates in sync with `Sidebar`.
- [ ] All switches use Fluent pill toggle styling with `开`/`关` labels; theme selection uses vertical radio buttons; light and dark themes both look clean and readable.
- [ ] `addTasksOnTop`: adding a task inserts at top when ON and bottom when OFF (covered by unit test).
- [ ] `moveStarredToTop`: starring a task moves it to top of its list when ON and leaves order unchanged when OFF (covered by unit test).
- [ ] `playCompletionSound`: completing a task triggers Web Audio chime only when ON and transitioning from incomplete → complete.
- [ ] `confirmBeforeDelete`: deleting a task, custom list, or empty group prompts confirmation modal when ON and deletes directly when OFF.
- [ ] `weekStartsOn`: changing between 周一 and 周日 updates `DateTimePicker` calendar week start.
- [ ] Smart list toggles & `autoHideEmptySmartLists` filter `Sidebar` smart items accurately, switching away to `myday` if the active smart view is disabled (covered by unit test).
- [ ] `showDueTodayInMyDay`: tasks due today appear in My Day (and not duplicated in suggestions) when ON, and stay manual-only when OFF (covered by unit test).
- [ ] `数据目录` never gets stuck on `（读取中）` when Tauri API is unavailable or fails.
- [ ] Old `todo-data.json` files without the new `Settings` fields load cleanly with expected defaults via `normalizeDb()`.
- [ ] `tsc --noEmit`, `vitest run`, and `vite build` all pass with zero errors.
