import { useEffect, useRef, useState } from "react";
import type { SortKey, TaskList } from "../lib/model";
import { SORT_OPTIONS, type View } from "../lib/views";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  PaletteIcon,
  SortIcon,
  TrashIcon,
} from "./icons";

export function ViewMenu({
  view,
  list,
  sort,
  canDelete,
  onSort,
  onRename,
  onTheme,
  onDelete,
  onClose,
}: {
  view: View;
  list?: TaskList;
  sort: SortKey;
  canDelete: boolean;
  onSort: (sort: SortKey) => void;
  onRename: () => void;
  onTheme: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [sortOpen, setSortOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isList = view.type === "list";

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="menu main-menu"
      ref={ref}
      role="menu"
      aria-label={list ? `${list.name} 菜单` : "视图菜单"}
    >
      {isList ? (
        <button role="menuitem" onClick={onRename}>
          <EditIcon /> 重命名
        </button>
      ) : null}
      <button role="menuitem" onClick={onTheme}>
        <PaletteIcon /> 主题
      </button>
      <div className="sep" />
      <button
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={sortOpen}
        onClick={() => setSortOpen((open) => !open)}
      >
        <SortIcon /> 排序依据
        <span className="menu-caret">
          {sortOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </button>
      {sortOpen ? (
        <div className="menu-sub" role="group" aria-label="排序依据">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              role="menuitemradio"
              aria-checked={sort === option.key}
              className={sort === option.key ? "active" : ""}
              onClick={() => onSort(option.key)}
            >
              <span className="menu-check">
                {sort === option.key ? <CheckIcon /> : null}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {isList ? (
        <>
          <div className="sep" />
          <button
            role="menuitem"
            className="danger"
            disabled={!canDelete}
            onClick={onDelete}
          >
            <TrashIcon /> 删除列表
          </button>
        </>
      ) : null}
    </div>
  );
}
