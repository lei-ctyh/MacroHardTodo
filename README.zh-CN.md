<div align="center">
  <img src="public/logo.png" alt="MacroHard Todo" width="84" height="84" />
  <h1>MacroHard Todo</h1>
  <p><strong>本地优先、轻快克制的桌面待办软件</strong> — 贴近 Microsoft To Do 的使用习惯，但数据 100% 掌握在你自己手里。</p>

  <p>
    <a href="README.md">English</a> · <strong>简体中文</strong>
  </p>

  <p>
    <a href="https://github.com/lei-ctyh/MacroHardTodo/releases"><img src="https://img.shields.io/github/v/release/lei-ctyh/MacroHardTodo?include_prereleases&style=flat-square&color=2564cf" alt="Release" /></a>
    <a href="https://github.com/lei-ctyh/MacroHardTodo/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/lei-ctyh/MacroHardTodo/ci.yml?branch=master&style=flat-square&label=CI" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" /></a>
    <img src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square" alt="Tauri v2" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square" alt="React 18" />
  </p>
</div>

> 本项目为独立开源实现，与 Microsoft 无任何关联，不包含任何微软图标、图片或商标。应用图标与界面图标采用开源图标库 [Lucide](https://lucide.dev/)（ISC 许可），内置 14 张高清实景壁纸均源自 Openverse / Wikimedia Commons **CC0** 公共领域素材。

---

## 为什么做 MacroHard Todo

Microsoft To Do 是一款非常顺手的待办软件，我用了很多年，早已习惯了它清爽的「我的一天 / 计划内 / 列表分组 / 右侧详情」交互。

但用得越久，越有种它被微软逐渐「边缘化」的感觉：更新节奏极其缓慢，大家呼声很高的日历视图等功能迟迟不见踪影，甚至连非微软邮箱下完全用不上的「标记的电子邮件」智能列表都删不掉、关不掉；再加上近期传出的关停与迁移变动，与其被动等待、提心吊胆，不如**求人不如求己——干脆自己手搓一个**。

**MacroHard Todo** 基于 **Tauri v2 + React + Rust** 构建，目标很纯粹：保留原版最顺手的日常体验，把长期痛点一个个补齐，并让数据彻底回到你自己手里：

- **本地优先**：所有任务、附件、头像与背景图默认保存在本机磁盘，断网秒开、无账号门槛，谁停服都不受影响。
- **把控制权还给用户**：智能列表（重要 / 计划内 / 全部 / 已完成）想留就留、想藏就藏，没有删不掉的鸡肋入口；日历视图、专注计时、自然语言日期等呼声很高的能力也会持续迭代。
- **零门槛迁移**：内置 Microsoft Graph 设备码迁移向导，一键把原有微软 To Do 清单与任务迁到本地。
- **自主可控同步**：支持任意 WebDAV 网盘（坚果云 / Nextcloud / 群晖等）多端合并同步，可选 **AES-256-GCM 端到端加密**。

---

## 下载与安装

前往 [**GitHub Releases**](https://github.com/lei-ctyh/MacroHardTodo/releases) 下载对应平台产物：

| 平台 | 推荐安装包 | 备选产物 |
| --- | --- | --- |
| **Windows (x64)** | `*_x64-setup.exe`（NSIS 中文安装向导，无需管理员权限） | `*_windows_x64_portable.zip`（免安装压缩包） |
| **macOS (Apple Silicon)** | `*_aarch64.dmg` | — |
| **macOS (Intel)** | `*_x64.dmg` | — |
| **Linux (x64)** | `*.AppImage`（通用） | `*.deb`（Debian / Ubuntu） |

> **系统安全拦截提示**：开源项目暂未购买商业代码签名证书。
> - **Windows**：首次运行若弹出 SmartScreen「Windows 已保护你的电脑」，点击 **「更多信息」→「仍要运行」** 即可。
> - **macOS**：若提示「无法验证开发者」，请前往 **「系统设置 → 隐私与安全性」** 点击 **「仍要打开」**。
> - 所有正式版产物均由 GitHub Actions 公开源码自动构建，可在 Release 附件中查看 `SHA256SUMS.txt` 校验文件完整性。

---

## 核心功能

### 任务与清单管理
- **固定与自定义列表**：内置固定「任务」默认清单；支持无限自定义列表、列表分组（折叠/展开、拖拽跨组排序）、开头 emoji 自动作为图标展示。
- **智能视图**：我的一天、重要、计划内（按已逾期 / 今天 / 明天 / 接下来 5 天 / 以后分组）、全部（按列表分组）、已完成（独立归档，可随时恢复）；支持在设置中逐项开关与空列表自动隐藏。
- **任务完整属性**：标题、子步骤（勾选进度、支持将步骤「提升为任务」）、截止日期与时间、定时提醒（系统通知）、重要星标、重复规则（每天 / 工作日 / 每周 / 每月 / 每年 / 自定义间隔与截止日，逾期重复任务支持一键「跳转到当前任务」）、标签、本地附件与备注。
- **高频交互**：完整任务右键菜单（添加到我的一天、重要、完成、快捷改期、移动到列表子菜单、删除）、列表拖拽排序、实时全局搜索（覆盖标题/备注/标签/步骤）、底部常驻快速添加栏。
- **「我的一天」专属体验**：居中欢迎卡片 + 右侧可开合「建议」面板（按已逾期 / 今天 / 稍后 / 最近添加分组），从建议进入详情后关闭可无缝返回建议。

### 视觉与个性化
- **浅色 / 深色 / 跟随系统**：暗色模式深度适配——纯色主题自动切换为沉稳深灰底 + 主题前景强调色；壁纸主题搭配深灰半透明磨砂胶囊与中性强调色。
- **丰富主题背景**：每个列表与智能视图均支持独立配置 **14 套 CC0 高清实景壁纸** + **14 套渐变纯色主题** + 任意本地自定义图片（随 WebDAV 同步）。
- **个人资料与偏好设置**：独立全屏设置页，支持自定义昵称/副标题/头像、任务添加位置与星标置顶、完成提示音、删除二次确认、每周起始日、自动清理旧已完成任务、开机自启与关闭最小化到托盘。

### 数据安全与多端同步
- **自动保存与本地备份**：自动保留最近 21 天每日快照，支持 JSON / CSV 导入导出。
- **WebDAV 同步**：原生支持坚果云、Nextcloud、群晖等，按任务最后修改时间（`updatedAt` + 设备 ID 决胜）与删除墓碑合并，支持 `If-Match` 冲突重试、附件按需同步及可选 **AES-256-GCM + Argon2** 端到端加密。
- **Microsoft To Do 一键迁移**：基于 Microsoft Graph 设备码登录，支持多清单勾选预览、按 `sourceId` 去重重复运行，自动迁移列表、任务、步骤、日期、提醒、重要、重复与备注。

---

## 快捷键速查

| 快捷键 | 作用域 | 功能 |
| --- | --- | --- |
| `Ctrl + Alt + T` | 全局（最小化到托盘也生效） | 唤起窗口并聚焦底部快速添加栏 |
| `Ctrl + T` | 选中任务时 | 添加到 / 移出「我的一天」 |
| `Ctrl + D` | 选中任务时 | 标记已完成 / 未完成 |
| `Delete` | 选中任务或右键菜单中 | 删除任务（按设置触发确认） |
| `Enter` | 各类行内输入 | 提交新建或重命名 |
| `Esc` | 弹窗 / 详情 / 编辑态 | 依次关闭弹窗、详情面板或取消编辑 |

---

## 数据存储位置

应用完全使用本地文件存储（卸载或覆盖升级不会删除你的数据）：

| 平台 | 默认数据目录 |
| --- | --- |
| **Windows** | `%APPDATA%\com.macrohardtodo.app\` |
| **macOS** | `~/Library/Application Support/com.macrohardtodo.app/` |
| **Linux** | `~/.local/share/com.macrohardtodo.app/` |

目录内容：
- `todo-data.json`：主数据文件
- `backups/todo-YYYY-MM-DD.json`：最近 21 天的每日自动备份
- `attachments/`：本地附件、自定义头像与背景图

---

## WebDAV 同步配置（以坚果云为例）

1. 在坚果云中新建同步目录（例如 `MyTasks`）。
2. 登录坚果云网页版 → **账户信息 → 安全选项 → 添加应用密码**。
3. 在应用内打开 **设置 → 同步**，选择「坚果云」预设：
   - **地址**：`https://dav.jianguoyun.com/dav/MyTasks`
   - **用户名**：坚果云登录邮箱
   - **密码**：上一步生成的应用密码
4. 点击 **「测试连接」** 通过后点击 **「保存并同步」**（同步时会自动创建 `MacroHardTodo/data.json`）。

> 若启用了端到端加密，网盘中仅保存密文；**请务必妥善保管加密口令，遗忘后无法找回**。

---

## 从 Microsoft To Do 迁移

1. 登录 [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID → 应用注册 → 新注册**。
2. 名称随意；受支持的账户类型选 **「仅个人 Microsoft 账户」** 或 **「任何组织目录 + 个人账户」**，重定向 URI 留空，点击 **注册**。
3. 复制生成的 **应用程序（客户端）ID**。
4. 进入左侧 **身份验证** → 开启 **允许公共客户端流** → 保存。
5. 进入左侧 **API 权限** → 添加权限 → **Microsoft Graph → 委托的权限** → 勾选 `Tasks.Read` → 添加。
6. 回到应用内 **设置 → 从微软 To Do 迁移**，粘贴客户端 ID，按引导完成设备码登录与勾选导入。

> 受限于 Microsoft Graph 接口能力，「我的一天」历史安排与「已标记的电子邮件」暂不支持导入。

---

## 本地开发与构建

### 环境要求

- **Node.js** 20+
- **Rust** stable 工具链
- **Windows**：Visual Studio Build Tools（C++ 桌面开发工作负载 + Windows SDK）与 WebView2（Windows 11 已自带）
- **macOS**：Xcode Command Line Tools
- **Linux (Ubuntu/Debian)**：`libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libsecret-1-dev`

### 常用命令

```bash
# 安装依赖
npm install

# 启动本地开发（Vite HMR + Tauri 窗口）
npm run tauri dev

# 类型检查与单元测试
npx tsc --noEmit
npm test

# 构建桌面安装包（产物位于 src-tauri/target/release/bundle/）
npm run tauri build

# 统一升级版本号（同步 package.json / tauri.conf.json / Cargo.toml）
npm run bump 0.2.0
```

### 目录结构

```text
src/                 前端（React 18 + TypeScript + Zustand）
  components/        视图与交互组件
  lib/               数据模型、日期/重复规则、视图分组、同步与 Graph 映射
  store/             全局状态与持久化
src-tauri/           Rust 后端（本地存储、系统钥匙串、WebDAV、Graph、AES-GCM 加密、托盘）
public/backgrounds/  14 套内置 CC0 实景壁纸
tests/               Vitest 单元测试
scripts/             版本同步等工程脚本
```

---

## 许可证与致谢

- 代码遵循 [MIT License](LICENSE) 开源。
- 界面图标：[Lucide](https://lucide.dev/)（ISC License）。
- 内置 14 张实景壁纸：精选自 Openverse 与 Wikimedia Commons **CC0** 公共领域摄影作品。
