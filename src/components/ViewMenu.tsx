import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import {
  DEFAULT_LIST_ID,
  THEME_COLORS,
  type ListTheme,
  type SortKey,
  type TaskList,
} from "../lib/model";
import { SORT_OPTIONS, type View } from "../lib/views";
import {
  THEME_PRESETS,
  presetUrl,
  smartTheme,
  smartThemeKey,
  themeFallback,
} from "../lib/themes";
import { useStore } from "../store/useStore";
import {
  CalendarIcon,
  CalendarPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
  GripVerticalIcon,
  PlusIcon,
  SortIcon,
  StarOutlineIcon,
  TrashIcon,
} from "./icons";

const SORT_ICONS = {
  importance: StarOutlineIcon,
  due: CalendarIcon,
  added: CalendarPlusIcon,
  alpha: SortIcon,
  manual: GripVerticalIcon,
} as const;

export function ViewMenu({
  view,
  list,
  sort,
  canDelete,
  fixed = false,
  bgUrl,
  onSort,
  onRename,
  onDelete,
  onClose,
}: {
  view: View;
  list?: TaskList;
  sort: SortKey;
  canDelete: boolean;
  fixed?: boolean;
  bgUrl?: string;
  onSort: (sort: SortKey) => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const db = useStore((s) => s.db);
  const setListTheme = useStore((s) => s.setListTheme);
  const setShared = useStore((s) => s.setShared);
  const [sortOpen, setSortOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const isList = view.type === "list";
  const showListActions = isList && !fixed;
  const fixedIcon =
    view.type === "smart" || (isList && list?.id === DEFAULT_LIST_ID);
  const theme = isList ? list?.theme : smartTheme(db, view.id);

  const applyTheme = (next: ListTheme | undefined) => {
    const normalized =
      next && fixedIcon ? { ...next, emoji: undefined } : next;
    const cleaned =
      normalized &&
      (normalized.preset ||
        normalized.image ||
        normalized.emoji ||
        normalized.color)
        ? normalized
        : undefined;
    if (isList && list) setListTheme(list.id, cleaned);
    else if (view.type === "smart") {
      setShared(smartThemeKey(view.id), cleaned ?? null);
    }
  };

  const pickImage = async () => {
    setUploadError(null);
    setUploading(true);
    try {
      const path = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "图片",
            extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"],
          },
        ],
      });
      if (typeof path !== "string") return;
      const info = await api.attachmentAdd(path);
      applyTheme({
        ...theme,
        preset: undefined,
        color: undefined,
        image: {
          relPath: info.relPath,
          mime: info.mime,
          name: info.name,
          size: info.size,
        },
      });
      if (info.size > 12 * 1024 * 1024) {
        setUploadError("图片超过 12 MB，加载和同步会比较慢，建议先压缩。");
      }
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
    }
  };

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
      className="main-menu"
      ref={ref}
      role="menu"
      aria-label={list ? `${list.name} 菜单` : "视图菜单"}
      onMouseLeave={() => setSortOpen(false)}
    >
      <div className="menu main-menu-panel">
        <button
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={sortOpen}
          onMouseEnter={() => setSortOpen(true)}
          onFocus={() => setSortOpen(true)}
          onClick={() => setSortOpen(true)}
        >
          <SortIcon /> 排序依据
          <span className="menu-caret">
            {sortOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
        </button>

        <div className="menu-theme-section">
          <div className="menu-section-title">主题</div>
          <div className="theme-grid menu-theme-grid">
            <button
              type="button"
              className={`theme-tile none ${
                !theme?.preset && !theme?.image && !theme?.color
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                applyTheme({
                  ...theme,
                  preset: undefined,
                  image: undefined,
                  color: undefined,
                })
              }
            >
              无
            </button>
            {THEME_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`theme-tile ${
                  theme?.color === color.value ? "active" : ""
                }`}
                style={{ background: color.value }}
                title={color.name}
                aria-label={`渐变主题 ${color.name}`}
                onClick={() =>
                  applyTheme({
                    ...theme,
                    color: color.value,
                    preset: undefined,
                    image: undefined,
                  })
                }
              />
            ))}
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`theme-tile ${
                  theme?.preset === preset.id ? "active" : ""
                }`}
                style={{ backgroundImage: `url("${presetUrl(preset.id)}")` }}
                title={preset.name}
                aria-label={preset.name}
                onClick={() =>
                  applyTheme({
                    ...theme,
                    preset: preset.id,
                    image: undefined,
                    color: undefined,
                  })
                }
              />
            ))}
            {theme?.image ? (
              <div className="theme-tile-wrap">
                <button
                  type="button"
                  className="theme-tile active"
                  style={{
                    background: bgUrl
                      ? `url("${bgUrl}") center/cover`
                      : themeFallback(theme),
                  }}
                  title={theme.image.name}
                  aria-label={theme.image.name}
                  onClick={() => applyTheme(theme)}
                />
                <button
                  type="button"
                  className="theme-tile-delete"
                  title="删除背景"
                  aria-label="删除背景"
                  onClick={(event) => {
                    event.stopPropagation();
                    applyTheme({
                      ...theme,
                      preset: undefined,
                      image: undefined,
                      color: undefined,
                    });
                  }}
                >
                  <CloseIcon />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="theme-tile add"
              title="上传背景图片"
              aria-label="上传背景图片"
              disabled={uploading}
              onClick={pickImage}
            >
              {uploading ? <span className="spinner" /> : <PlusIcon />}
            </button>
          </div>
          {uploadError ? (
            <div className="menu-theme-error">{uploadError}</div>
          ) : null}
        </div>

        {showListActions ? (
          <>
            <div className="sep" />
            <button role="menuitem" onClick={onRename}>
              <EditIcon /> 重命名
            </button>
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

      {sortOpen ? (
        <div className="menu sort-flyout" role="menu" aria-label="排序依据">
          {SORT_OPTIONS.map((option) => {
            const Icon = SORT_ICONS[option.key];
            const active = sort === option.key;
            return (
              <button
                key={option.key}
                role="menuitemradio"
                aria-checked={active}
                className={active ? "active" : ""}
                onClick={() => onSort(option.key)}
              >
                <Icon />
                <span>{option.label}</span>
                {active ? <CheckIcon className="sort-check" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
