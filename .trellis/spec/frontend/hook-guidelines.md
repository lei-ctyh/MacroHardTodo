# Hook Guidelines

> How hooks and effects are used in this project.

---

## Overview

There are no custom `useXxx` hooks yet. Stateful logic currently lives in `src/store/useStore.ts`; components use `useState`/`useMemo`/`useEffect` inline. Introduce a custom hook only when the same multi-component effect is repeated.

---

## Selector Pattern

Read one slice per call; actions are stable references:

```tsx
const db = useStore((s) => s.db);
const view = useStore((s) => s.view);
const selectTask = useStore((s) => s.selectTask);
```

Inside event handlers and timers, read the latest snapshot with `useStore.getState()` instead of closing over `db`.

---

## Effects: What Belongs Here

Effects are only for **external synchronisation**:

- `App.tsx`: apply theme (`document.documentElement.dataset.theme`), notification permission/reminder polling, global shortcut listener (`listen("global-quick-add")`), auto-sync interval, keyboard shortcuts.
- `MainPane.tsx`: load the theme image (`resolveThemeBackground`), reset panels when the view or selected task changes.
- `QuickAdd.tsx`: focus when `quickAddNonce` changes.
- `TaskDetail.tsx`: reset editors when the selected task changes; auto-size the title textarea.

Derived data is **not** an effect — use `useMemo` (`visible`, `themeTarget`, `listNames`, `completedInList`).

---

## Async Effects

Use an `alive` flag and clean up:

```tsx
useEffect(() => {
  let alive = true;
  resolveThemeBackground(theme, ensureAttachment).then((url) => {
    if (alive) setBgUrl(url);
  });
  return () => { alive = false; };
}, [themeKey, ensureAttachment]);
```

- Depend on a stable key (`themeKey = JSON.stringify(theme)`) instead of an object identity that changes on every DB commit.
- Timers/intervals must be cleared in cleanup (reminders, auto-sync, copied-toast).
- Event listeners (`listen`, `window.addEventListener`) return/unlisten in cleanup.

---

## Data Fetching

All I/O goes through `src/lib/api.ts` (Tauri commands) or `syncClient.ts`:

- WebDAV: `api.webdavDownload/Upload` → merge in `syncClient.doSync`.
- Graph: `api.graphDeviceStart/PollToken/ListLists/ListTasks`.
- Attachments/theme images: `api.attachmentAdd/Read`, `ensureAttachment` for lazy download.

Components never call `invoke` directly and never hold credentials; WebDAV/Graph secrets live in Windows Credential Manager via `secret.rs`.

---

## Common Mistakes

- Writing to the store from an effect on every `db` change → persist loops. Persistence is debounced inside `useStore.commit`, not in effects.
- Using `useEffect` to compute filtered lists instead of `useMemo`.
- Forgetting cleanup on intervals/listeners after switching views.
- Reading `get().db` in a component render path; use selectors.
