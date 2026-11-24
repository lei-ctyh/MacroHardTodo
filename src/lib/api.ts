import { invoke } from "@tauri-apps/api/core";
import type { Attachment, DB } from "./model";

export interface LoadResult {
  db: DB | null;
  path: string;
  warning?: string | null;
}

export interface WebdavDownloadResult {
  body: string;
  etag?: string | null;
}

export interface WebdavUploadResult {
  status: number;
  precondition: boolean;
  etag?: string | null;
}

export interface WebdavTestResult {
  status: number;
  server?: string;
}

export interface GraphDeviceInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface GraphTokenResult {
  status: "ok" | "pending" | "slow_down" | "expired" | "declined" | "error";
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresIn?: number | null;
  message?: string;
}

export interface GraphListRawLite {
  id: string;
  displayName?: string;
  wellknownListName?: string;
}

export interface GraphPage<T> {
  items: T[];
  nextLink: string | null;
}

export const api = {
  loadDb: () => invoke<LoadResult>("load_db"),
  saveDb: (db: DB) => invoke<void>("save_db", { db }),
  dataDir: () => invoke<string>("data_dir_path"),
  setTitleBarTheme: (dark: boolean) =>
    invoke<void>("set_titlebar_theme", { dark }),
  exportData: (path: string, content: string) =>
    invoke<void>("export_data", { path, content }),
  importData: (path: string) => invoke<string>("import_data", { path }),

  attachmentAdd: (srcPath: string) =>
    invoke<Attachment>("attachment_add", { srcPath }),
  attachmentRead: (relPath: string) =>
    invoke<string>("attachment_read", { relPath }),
  attachmentSave: (relPath: string, base64: string) =>
    invoke<void>("attachment_save", { relPath, base64 }),
  attachmentExists: (relPath: string) =>
    invoke<boolean>("attachment_exists", { relPath }),
  attachmentDelete: (relPath: string) =>
    invoke<void>("attachment_delete", { relPath }),
  attachmentReveal: (relPath: string) =>
    invoke<void>("attachment_reveal", { relPath }),

  secretSet: (key: string, value: string) =>
    invoke<void>("secret_set", { key, value }),
  secretGet: (key: string) => invoke<string | null>("secret_get", { key }),
  secretDelete: (key: string) => invoke<void>("secret_delete", { key }),

  cryptoEncrypt: (passphrase: string, plaintext: string) =>
    invoke<string>("crypto_encrypt", { passphrase, plaintext }),
  cryptoDecrypt: (passphrase: string, payload: string) =>
    invoke<string>("crypto_decrypt", { passphrase, payload }),

  webdavTest: (url: string, username: string, password: string) =>
    invoke<WebdavTestResult>("webdav_test", { url, username, password }),
  webdavDownload: (url: string, username: string, password: string) =>
    invoke<WebdavDownloadResult | null>("webdav_download", {
      url,
      username,
      password,
    }),
  webdavUpload: (
    url: string,
    username: string,
    password: string,
    body: string,
    ifMatch?: string | null,
  ) =>
    invoke<WebdavUploadResult>("webdav_upload", {
      url,
      username,
      password,
      body,
      ifMatch: ifMatch ?? null,
    }),
  webdavMkcol: (url: string, username: string, password: string) =>
    invoke<{ status: number }>("webdav_mkcol", { url, username, password }),
  webdavUploadBinary: (
    url: string,
    username: string,
    password: string,
    base64: string,
  ) =>
    invoke<{ status: number }>("webdav_upload_binary", {
      url,
      username,
      password,
      base64,
    }),
  webdavDownloadBinary: (url: string, username: string, password: string) =>
    invoke<string | null>("webdav_download_binary", {
      url,
      username,
      password,
    }),

  graphDeviceStart: (clientId: string) =>
    invoke<GraphDeviceInfo>("graph_device_start", { clientId }),
  graphPollToken: (clientId: string, deviceCode: string) =>
    invoke<GraphTokenResult>("graph_poll_token", { clientId, deviceCode }),
  graphRefresh: (clientId: string, refreshToken: string) =>
    invoke<{
      accessToken?: string | null;
      refreshToken?: string | null;
      expiresIn?: number | null;
    }>("graph_refresh", { clientId, refreshToken }),
  graphListLists: (token: string, nextLink?: string | null) =>
    invoke<GraphPage<GraphListRawLite>>("graph_list_lists", {
      token,
      nextLink: nextLink ?? null,
    }),
  graphListTasks: (token: string, listId: string, nextLink?: string | null) =>
    invoke<GraphPage<Record<string, unknown>>>("graph_list_tasks", {
      token,
      listId,
      nextLink: nextLink ?? null,
    }),
};
