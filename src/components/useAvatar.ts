import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";

export function useAvatar() {
  const avatar = useStore((s) => s.db.settings.avatar);
  const updateSettings = useStore((s) => s.updateSettings);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    setAvatarUrl(undefined);
    if (!avatar?.relPath) return;
    api
      .attachmentRead(avatar.relPath)
      .then((base64) => {
        if (alive) {
          setAvatarUrl(
            `data:${avatar.mime || "image/png"};base64,${base64}`,
          );
        }
      })
      .catch(() => {
        /* 文件缺失时回退到应用图标 */
      });
    return () => {
      alive = false;
    };
  }, [avatar?.relPath, avatar?.mime]);

  const pickAvatar = async () => {
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
      updateSettings({
        avatar: {
          relPath: info.relPath,
          mime: info.mime,
          name: info.name,
          size: info.size,
        },
      });
    } catch {
      /* 取消或读取失败 */
    }
  };

  const clearAvatar = () => {
    updateSettings({ avatar: undefined });
  };

  return {
    avatarUrl,
    hasCustomAvatar: Boolean(avatar?.relPath),
    pickAvatar,
    clearAvatar,
  };
}
