import { api } from "./api";
import { fingerprint, mergeDB } from "./merge";
import type { DB } from "./model";

export interface SyncConfig {
  url: string;
  user: string;
  password: string;
  encrypt: boolean;
  passphrase?: string;
}

export interface SyncOutcome {
  db: DB;
  uploaded: boolean;
  message: string;
}

/** 允许用户填目录（自动补文件名）或直接填完整文件地址 */
export function resolveDataUrl(folderOrFile: string): string {
  const trimmed = folderOrFile.trim();
  if (/\.json$/i.test(trimmed)) return trimmed;
  const base = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return `${base}MacroHardTodo/data.json`;
}

async function decodeRemote(
  body: string,
  cfg: SyncConfig,
): Promise<DB> {
  let text = body.trim();
  try {
    return JSON.parse(text) as DB;
  } catch {
    // 可能是加密数据；解密后再解析
    if (!cfg.passphrase) {
      throw new Error("远端数据不是明文，请先在同步设置里填写加密口令");
    }
    text = await api.cryptoDecrypt(cfg.passphrase, text);
    try {
      return JSON.parse(text) as DB;
    } catch {
      throw new Error("远端数据解密后仍不是有效的 Todo 文档");
    }
  }
}

function validateDB(value: unknown): DB {
  const db = value as DB;
  if (!db || typeof db !== "object" || !Array.isArray(db.lists) || !Array.isArray(db.tasks)) {
    throw new Error("远端文件不是 MacroHard Todo 的数据格式");
  }
  return db;
}

export async function doSync(local: DB, cfg: SyncConfig): Promise<SyncOutcome> {
  const url = resolveDataUrl(cfg.url);
  const folderUrl = url.replace(/data\.json$/, "");

  // 确保远端目录存在（已存在时服务器返回 405，忽略即可）
  try {
    await api.webdavMkcol(folderUrl, cfg.user, cfg.password);
    await api.webdavMkcol(`${folderUrl}attachments`, cfg.user, cfg.password);
  } catch {
    /* 目录可能已存在或服务器不支持 MKCOL */
  }

  const download = await api.webdavDownload(url, cfg.user, cfg.password);

  let remote: DB | null = null;
  if (download?.body) {
    remote = validateDB(await decodeRemote(download.body, cfg));
  }

  let merged = remote ? mergeDB(local, remote).db : local;
  const remoteFingerprint = remote ? fingerprint(remote) : "";

  const needsUpload = !remote || fingerprint(merged) !== remoteFingerprint;
  if (!needsUpload) {
    return {
      db: merged,
      uploaded: false,
      message: remote ? "已是最新，无需上传" : "已上传",
    };
  }

  const upload = async (ifMatch: string | null | undefined) => {
    const payload = JSON.stringify(merged);
    const body = cfg.encrypt
      ? await api.cryptoEncrypt(cfg.passphrase ?? "", payload)
      : payload;
    return api.webdavUpload(url, cfg.user, cfg.password, body, ifMatch);
  };

  let result = await upload(download?.etag);
  if (result.precondition) {
    // 其他设备刚好写入：重新下载、合并、再上传一次
    const again = await api.webdavDownload(url, cfg.user, cfg.password);
    if (again?.body) {
      const latest = validateDB(await decodeRemote(again.body, cfg));
      merged = mergeDB(merged, latest).db;
    }
    result = await upload(null);
    if (result.precondition) {
      throw new Error("同步冲突未能自动解决，请稍后重试");
    }
  }

  return {
    db: merged,
    uploaded: true,
    message: remote ? "已合并并上传" : "已创建远端数据并上传",
  };
}
