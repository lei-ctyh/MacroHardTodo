import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useDroppable } from "@dnd-kit/core";
import type { TaskGroup } from "../lib/model";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  GroupIcon,
  PlusIcon,
  TrashIcon,
  UngroupIcon,
} from "./icons";

interface MenuPos {
  x: number;
  y: number;
}

export function GroupRow({
  group,
  collapsed,
  empty = false,
  dropTarget = false,
  autoRename = false,
  onToggle,
  onRename,
  onDelete,
  onAddList,
  onRenameHandled,
  children,
}: {
  group: TaskGroup;
  collapsed: boolean;
  empty?: boolean;
  dropTarget?: boolean;
  autoRename?: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddList: () => void;
  onRenameHandled?: () => void;
  children?: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `group:${group.id}` });
  const [editing, setEditing] = useState(autoRename);
  const [draft, setDraft] = useState(group.name);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
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
    if (!menuPos) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuPos(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuPos(null);
      } else if (event.key === "Delete" && empty) {
        setMenuPos(null);
        onDelete();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuPos, onDelete, empty]);

  const startRename = () => {
    setDraft(group.name);
    setEditing(true);
    setMenuPos(null);
  };

  const finishRename = (commit: boolean) => {
    setEditing(false);
    if (commit) {
      const value = draft.trim() || "未命名的组";
      if (value !== group.name) onRename(value);
    }
    onRenameHandled?.();
  };

  const openGroupMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const width = 210;
    const height = 150;
    setMenuPos({
      x: Math.min(event.clientX, window.innerWidth - width),
      y: Math.min(event.clientY, window.innerHeight - height),
    });
  };

  return (
    <div className="group-section" ref={setNodeRef}>
      <div
        className={`group-row ${dropTarget ? "group-drop-target" : ""}`}
        onDoubleClick={startRename}
        onContextMenu={openGroupMenu}
      >
        <span className="group-icon">
          <GroupIcon strokeWidth={1.5} />
        </span>
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
        <button
          className="group-caret"
          title={collapsed ? "展开分组" : "折叠分组"}
          aria-label={collapsed ? "展开分组" : "折叠分组"}
          aria-expanded={!collapsed}
          onClick={onToggle}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {collapsed ? (
            <ChevronDownIcon size={16} strokeWidth={1.5} />
          ) : (
            <ChevronUpIcon size={16} strokeWidth={1.5} />
          )}
        </button>
      </div>

      {menuPos ? (
        <div
          ref={menuRef}
          className="menu group-menu"
          role="menu"
          aria-label={`${group.name} 菜单`}
          style={{ position: "fixed", left: menuPos.x, top: menuPos.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button role="menuitem" onClick={startRename}>
            <EditIcon /> 重命名组
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setMenuPos(null);
              onAddList();
            }}
          >
            <PlusIcon /> 新建列表
          </button>
          <div className="sep" />
          {empty ? (
            <button
              role="menuitem"
              className="danger"
              onClick={() => {
                setMenuPos(null);
                onDelete();
              }}
            >
              <TrashIcon /> 删除组
              <span className="menu-hint">Delete</span>
            </button>
          ) : (
            <button
              role="menuitem"
              onClick={() => {
                setMenuPos(null);
                onDelete();
              }}
            >
              <UngroupIcon strokeWidth={1.5} /> 取消分组列表
            </button>
          )}
        </div>
      ) : null}

      {!collapsed ? (
        <div className="group-lists">
          {empty ? (
            <div className="group-empty">
              <span className="group-empty-line" />
              拖到此处来添加列表
            </div>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
