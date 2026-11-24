import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { TaskGroup } from "../lib/model";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  MoreIcon,
  TrashIcon,
} from "./icons";

export function GroupRow({
  group,
  collapsed,
  dropTarget = false,
  autoRename = false,
  onToggle,
  onRename,
  onDelete,
  onRenameHandled,
  children,
}: {
  group: TaskGroup;
  collapsed: boolean;
  dropTarget?: boolean;
  autoRename?: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onRenameHandled?: () => void;
  children?: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `group:${group.id}` });
  const [editing, setEditing] = useState(autoRename);
  const [draft, setDraft] = useState(group.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoRename) {
      setDraft(group.name);
      setEditing(true);
    }
    // 仅在进入自动重命名时执行，之后由用户输入控制
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRename]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const startRename = () => {
    setDraft(group.name);
    setEditing(true);
    setMenuOpen(false);
  };

  const finishRename = (commit: boolean) => {
    setEditing(false);
    if (commit) {
      const value = draft.trim() || "未命名的组";
      if (value !== group.name) onRename(value);
    }
    onRenameHandled?.();
  };

  return (
    <div className="group-section">
      <div
        ref={setNodeRef}
        className={`group-row ${dropTarget ? "group-drop-target" : ""}`}
        onDoubleClick={startRename}
      >
        <button
          className="group-caret"
          title={collapsed ? "展开分组" : "折叠分组"}
          aria-label={collapsed ? "展开分组" : "折叠分组"}
          aria-expanded={!collapsed}
          onClick={onToggle}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        </button>
        {editing ? (
          <input
            className="group-name-input"
            autoFocus
            value={draft}
            aria-label="分组名称"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => finishRename(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                finishRename(true);
              } else if (e.key === "Escape") {
                e.stopPropagation();
                finishRename(false);
              }
            }}
          />
        ) : (
          <span className="group-name" title={group.name}>
            {group.name}
          </span>
        )}
        <div
          ref={menuRef}
          className={`menu-wrap group-actions ${menuOpen ? "open" : ""}`}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            className="icon-btn group-more"
            title="分组操作"
            aria-label="分组操作"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <MoreIcon />
          </button>
          {menuOpen ? (
            <div
              className="menu group-menu"
              role="menu"
              aria-label={`${group.name} 菜单`}
            >
              <button role="menuitem" onClick={startRename}>
                <EditIcon /> 重命名
              </button>
              <button
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <TrashIcon /> 删除组
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {!collapsed ? <div className="group-lists">{children}</div> : null}
    </div>
  );
}
