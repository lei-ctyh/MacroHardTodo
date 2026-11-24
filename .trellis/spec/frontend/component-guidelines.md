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
- Sidebar layout follows Microsoft To Do: brand → always-visible search → smart views → ungrouped lists → group sections → inline new-list input; the footer pairs `新建列表` with an icon-only `创建新组` button, while 同步/设置 live in the account dropdown opened from the brand.
- The sidebar is resizable via `.sidebar-resizer` (clamped 200–420px, persisted in `settings.sidebarWidth`, double-click resets to 240). Selected nav rows use an inset `::before` highlight (2px vertical, 3px radius) with the accent bar in `::after` (3×16px, `--nav-accent`).
- Sidebar counts use `.sidebar .nav-count` badges (20px circle/pill, radius 10px, `--nav-badge` / `--nav-badge-text`); the suggestion panel's count stays plain text.
- The app theme effect also calls `api.setTitleBarTheme(dark)` so the native Windows caption color (`#F3F3F3` / `#252423`) stays in sync with the sidebar.
- Group headers are `GroupRow`: chevron collapse, name (double-click or menu → inline rename), hover `MoreIcon` menu (重命名 / 删除组). Group actions never live on individual list rows.
- Deleting a group only removes the group; its lists return to the ungrouped section and keep their tasks.
- One `DndContext` wraps the whole list area. Each section (ungrouped + every group) has its own `SortableContext`; group headers and the ungrouped drop zone are `group:<id>` / `group:ungrouped` droppables. Group headers themselves are not draggable — group order is creation order.
- Section building and drag resolution are pure helpers (`listSections`, `moveList` in `views.ts`); keep components free of that logic.
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
