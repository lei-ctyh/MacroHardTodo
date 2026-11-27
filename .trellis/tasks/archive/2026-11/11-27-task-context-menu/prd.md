# Task Row Right-Click Context Menu and Shortcuts

## Goal

Add a Microsoft To Do-style right-click context menu on task rows across all views (flat, grouped, and completed sections) plus working keyboard shortcuts (`Ctrl+T`, `Ctrl+D`, `Delete`) for the selected task.

## Confirmed Facts

- `src/components/TaskRow.tsx` renders all task rows across `MainPane.tsx` (flat list, grouped `planned`/`all`/`completed` sections, and bottom completed area).
- `src/components/DateTimePicker.tsx` already provides a custom calendar picker (`withTime={false}`) used by `TaskDetail` and `RepeatDialog`.
- `src/store/useStore.ts` already exposes `setMyDay`, `toggleImportance`, `toggleComplete`, `updateTask`, `moveTask`, `deleteTask`, and `confirmDelete`.
- Project spec (`.trellis/spec/frontend/component-guidelines.md`) mandates rendering `position: fixed` context menus via `createPortal(..., document.body)` at `z-index: 100` so transformed ancestors (such as `SortableTaskRow` or the mobile sidebar drawer) never offset fixed positioning.
- `App.tsx` already suppresses the default WebView2 browser context menu outside editable inputs and text selections.

## Requirements

### R1. Task Right-Click Context Menu (`TaskContextMenu.tsx`)
- Right-clicking any `TaskRow` in `MainPane` opens a single portaled context menu (`z-index: 100`, clamped inside viewport bounds) with the following items:
  1. `添加到“我的一天”` / `从“我的一天”中删除` (`SunIcon`, hint `Ctrl+T`)
  2. `标记为重要` / `删除重要标记` (`StarOutlineIcon`)
  3. `标记为已完成` / `标记为未完成` (`CompletedIcon`, hint `Ctrl+D`)
  4. Separator
  5. `今天到期` (`CalendarDaysIcon`)
  6. `明天到期` (`CalendarArrowUpIcon`)
  7. `选择日期` (`CalendarIcon`) — closes menu and opens a portaled `DateTimePicker` (`withTime={false}`) clamped to viewport, updating `dueDate` on save
  8. `删除截止日期` (`CalendarIcon`, shown only when `task.dueDate` is present)
  9. Separator
  10. `将任务移动到… ›` (`FolderIcon`) — hover/click flyout submenu (auto-flips left if near right viewport edge) listing active lists in sidebar order (default `任务` list with `HomeIcon` + custom lists with emoji/list icon, active check on current `task.listId`)
  11. Separator
  12. `删除任务` (`.danger`, `TrashIcon`, hint `Delete`) — routes through `useStore.confirmDelete`
- Clicking outside, pressing `Escape`, changing view, or scrolling the task list closes the menu cleanly. Right-clicking inside the open menu does not reposition it.

### R2. Task Keyboard Shortcuts (`App.tsx`)
- When `selectedTaskId` refers to an active task, Settings is closed, no modal/confirm dialog is open, and keyboard focus is not inside `input`, `textarea`, `select`, or `[contenteditable="true"]`:
  - `Ctrl+T` / `Cmd+T` (`preventDefault`): toggle My Day for the selected task (`todayISO()` / `null`).
  - `Ctrl+D` / `Cmd+D` (`preventDefault`): toggle completion (`toggleComplete`).
  - `Delete`: request deletion via `confirmDelete`.
- When `TaskContextMenu` is open, pressing `Delete` triggers delete for the menu's target task (matching `GroupRow` and `SortableListRow`).

### R3. Visual & Theme Consistency
- Reuse `.menu` / `.list-submenu` / `.menu-hint` / `.date-picker-portal` patterns in `src/styles.css`, with full light and dark theme support.

## Out of Scope

- Multi-select bulk task operations
- Customizing/remapping keyboard shortcuts

## Acceptance Criteria

- [ ] Right-clicking any task row (in list, My Day, Important, Planned, All, Completed, or bottom completed section) opens the portaled context menu accurately at the cursor without transform drift.
- [ ] All menu actions (`我的一天`, `重要`, `已完成`, `今天到期`, `明天到期`, `选择日期`, `删除截止日期`, `将任务移动到…`, `删除任务`) update the task accurately.
- [ ] `删除截止日期` appears only when the task has a `dueDate`; `将任务移动到…` shows a checkmark on the task's current list and flips left when opened near the right edge of the window.
- [ ] `删除任务` respects `settings.confirmBeforeDelete` via `confirmDelete`.
- [ ] `Ctrl+T`, `Ctrl+D`, and `Delete` act on the selected task when focus is outside editable fields, and do not hijack typing inside inputs/textareas.
- [ ] `tsc --noEmit`, `vitest run`, and `vite build` pass with zero errors.
