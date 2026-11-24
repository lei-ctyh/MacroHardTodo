import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import type { ListTheme, TaskList } from "../lib/model";
import {
  MYDAY_THEME_KEY,
  THEME_EMOJIS,
  THEME_PRESETS,
  myDayTheme,
  presetUrl,
} from "../lib/themes";
import { useStore } from "../store/useStore";
import { Modal } from "./Modal";
import { ImageIcon, InfoIcon, TrashIcon } from "./icons";

export type ThemeTarget = { type: "list"; list: TaskList } | { type: "myday" };

export function ThemePicker({
  target,
  onClose,
}: {
  target: ThemeTarget;
  onClose: () => void;
}) {
  const db = useStore((s) => s.db);
  const setListTheme = useStore((s) => s.setListTheme);
  const setShared = useStore((s) => s.setShared);

  const initial =
    target.type === "list" ? target.list.theme : myDayTheme(db);
  const [theme, setTheme] = useState<ListTheme | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = target.type === "list" ? `「${target.list.name}」的主题` : "我的一天的主题";

  const apply = (next: ListTheme | undefined) => {
    const cleaned =
      next && (next.preset || next.image || next.emoji) ? next : undefined;
    setTheme(cleaned);
    if (target.type === "list") setListTheme(target.list.id, cleaned);
    else setShared(MYDAY_THEME_KEY, cleaned ?? null);
  };

  const pickImage = async () => {
    setError(null);
    setBusy(true);
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
      if (info.size > 12 * 1024 * 1024) {
        setError("图片超过 12 MB，加载和同步会比较慢，建议先压缩。");
      }
      apply({
        ...theme,
        preset: undefined,
        image: {
          relPath: info.relPath,
          mime: info.mime,
          name: info.name,
          size: info.size,
        },
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          {theme ? (
            <button
              className="btn danger"
              onClick={() => apply(undefined)}
              disabled={busy}
            >
              <TrashIcon /> 移除主题
            </button>
          ) : null}
          <span className="spacer" />
          <button className="btn primary" onClick={onClose}>
            完成
          </button>
        </>
      }
    >
      {error ? <div className="status-line error">{error}</div> : null}

      <div className="form-row">
        <label>图标（emoji）</label>
        <div className="emoji-grid">
          <button
            className={`emoji-btn ${!theme?.emoji ? "active" : ""}`}
            style={{ fontSize: 12, width: "auto", padding: "0 10px" }}
            onClick={() => apply({ ...theme, emoji: undefined })}
          >
            无
          </button>
          {THEME_EMOJIS.map((e) => (
            <button
              key={e}
              className={`emoji-btn ${theme?.emoji === e ? "active" : ""}`}
              onClick={() =>
                apply({ ...theme, emoji: theme?.emoji === e ? undefined : e })
              }
            >
              {e}
            </button>
          ))}
        </div>
        <div className="hint">图标会显示在列表名称旁边和背景标题里。</div>
      </div>

      <div className="form-row">
        <label>背景</label>
        <div className="theme-grid">
          <button
            className={`theme-tile none ${!theme?.preset && !theme?.image ? "active" : ""}`}
            onClick={() =>
              apply({ ...theme, preset: undefined, image: undefined })
            }
          >
            无背景
          </button>
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`theme-tile ${
                theme?.preset === preset.id ? "active" : ""
              }`}
              style={{ backgroundImage: `url("${presetUrl(preset.id)}")` }}
              onClick={() =>
                apply({
                  ...theme,
                  preset: preset.id,
                  image: undefined,
                })
              }
              title={preset.name}
            >
              <span className="tile-name">{preset.name}</span>
            </button>
          ))}
          <button
            className={`theme-tile none ${theme?.image ? "active" : ""}`}
            onClick={pickImage}
            disabled={busy}
            title="选择本地图片"
          >
            {busy ? (
              <span className="spinner" />
            ) : (
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <ImageIcon />
                本地图片
              </span>
            )}
          </button>
        </div>
        {theme?.image ? (
          <div className="hint">当前图片：{theme.image.name}</div>
        ) : null}
      </div>

      <div className="status-line info">
        <InfoIcon />
        <span>
          自定义图片会复制到应用数据目录，并在启用 WebDAV 同步时与其他设备共享；预设背景为内置矢量插画，不占空间。
        </span>
      </div>
    </Modal>
  );
}
