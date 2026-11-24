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
