# 远程显示层（Windows 显示 + WSL 宿主）

> 返回 [README](README.md)

把桌面模式拆成两半：**业务层留在 WSL 的宿主插件里，显示层跑在 Windows 上**，两者用网络桥接。
效果与原生桌面模式一致（透明置顶小窗、点击穿透、拖拽甩抛、右键菜单、聊天/碎碎念、余额、待办、睡觉、托盘切换显示位置），因为业务代码只有一份、渲染与窗口逻辑也是同一份，只是把「宿主 ↔ 显示层」那根 stdout 管道换成了 HTTP RPC。

适合的场景：DSH 跑在 WSL（没有可用窗口），但想让它把宠物显示到 Windows 桌面上。

## 原理

```
        WSL                                                  Windows
┌───────────────────────────┐     HTTP RPC（带令牌）     ┌────────────────────────────┐
│ 宿主插件（DSH / standalone）│  ◀──── /rpc、/asset ────   │ 显示层（Electron helper）    │
│  · handlePetRoute（唯一业务）│                            │  · 透明置顶小窗 / 点击穿透    │
│  · 远程 RPC 服务（0.0.0.0）  │  ──── 素材流 / 状态 ───▶    │  · 轮询 /config 重建窗口      │
└───────────────────────────┘                            └────────────────────────────┘
```

- 宿主新增一个 RPC 服务，直接复用与本地模式同一个 `handlePetRoute`，所以两端行为天然一致。
- 显示层就是原来的 `runtime/electron-helper`，只是把 bridge 的传输从 stdout 换成向宿主 `/rpc` 发请求；素材改由 `/asset` 带 Range 流式拉取。
- 窗口列表不再由宿主通过环境变量注入，而是显示层轮询宿主 `/config` 自己算、并在变化时重建。
- 宿主消失（插件卸载 / WSL 停机）时，显示层连续拉取失败会自行退出，不留僵尸窗口。

## 启用

宿主侧设环境变量后重启 DSH（或重跑 standalone）：

```sh
export DSH_PET_REMOTE=1
# 重启 dsh web / 桌面应用；standalone 则：DSH_PET_REMOTE=1 node lib/standalone.js
```

启用后：

1. 宿主开一个 RPC 服务（默认端口 7341，占用则顺延），并把连接信息写入
   `%LOCALAPPDATA%\dsh-pet\display-runtime\remote-display.json`（含令牌，仅本机文件）。
2. 宿主通过 WSL 互操作，把 `runtime/electron-helper` 铺到
   `%LOCALAPPDATA%\dsh-pet\display-runtime\`，必要时下载 **win32-x64 版 Electron** 到
   `%LOCALAPPDATA%\dsh-pet\electron-win\`，然后拉起显示层。
3. Windows 桌面上出现透明置顶的宠物窗口；之后一切交互照常。

## 环境变量

| 变量                                                   | 作用                                                  | 默认                 |
| ------------------------------------------------------ | ----------------------------------------------------- | -------------------- |
| `DSH_PET_REMOTE`                                       | `1` = 启用远程显示（宿主不 spawn 本机 Electron）      | 关                   |
| `DSH_PET_REMOTE_PORT`                                  | RPC 服务端口偏好                                      | `7341`               |
| `DSH_PET_REMOTE_HOST`                                  | 写进连接文件、给显示层连的宿主地址（WSL IP）          | 第一块非回环 IPv4    |
| `DSH_PET_REMOTE_LAUNCH`                                | `0` = 只开 RPC 服务、不自动拉起显示层（调试/手动）    | 自动拉起             |
| `DSH_PET_WIN_ELECTRON_PATH`                            | 指定现成的 Windows `electron.exe`（WSL 或 /mnt 路径） | 自动下载             |
| `DSH_PET_ALLOW_WIN_ELECTRON_DOWNLOAD`                  | `0` = 禁止自动下载 Windows Electron                   | 允许                 |
| `DSH_PET_ELECTRON_VERSION` / `DSH_PET_ELECTRON_MIRROR` | 复用原有 Electron 版本/镜像配置                       | `43.3.0` / npmmirror |

## 前置条件与限制

- **必须能 WSL → Windows 互操作**：`/mnt/c` 与 `/mnt/c/Windows/System32/cmd.exe` 可用（默认 WSL 都满足）。不可用时自动拉起降级为「只开 RPC 服务 + 打印说明」。
- **宿主机要能跑 Windows 版 Electron**：首次会自动下载（约上百 MB，走 npmmirror，可换镜像），也可用 `DSH_PET_WIN_ELECTRON_PATH` 指向现成的。
- **网络**：显示层从 Windows 连回 WSL 的 RPC 地址（默认用 WSL 的 eth0 IP）。若你的环境走 WSL「镜像网络」，可设 `DSH_PET_REMOTE_HOST=127.0.0.1`。
- **安全**：RPC 服务只对带正确令牌的请求应答，令牌随机生成、只写进本机连接文件、不进日志；`GET /health` 无令牌只回存活信息。
- **不支持**：显示层与宿主跨机器（不在同一台 Windows/WSL 主机）时也理论上可用，但本功能只为「同机 WSL↔Windows」设计。

## 手动启动显示层（兜底）

宿主自动拉起失败时（例如没有互操作、或想单独调试），可在 Windows 侧手动启动：

```sh
# 在 Windows 上，Node 可用时：
node scripts/remote-display.mjs --config "%LOCALAPPDATA%\dsh-pet\display-runtime\remote-display.json"
```

连接文件由宿主在远程模式下生成；`--electron <path>` 可指定 Electron。也可以只让宿主开服务（`DSH_PET_REMOTE_LAUNCH=0`），再手动接上。

## 相关源码

| 文件                                                 | 职责                                                 |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `src/host/plugin/remote-display/server.ts`           | 宿主 RPC 服务（/rpc、/asset、/health，令牌与 Range） |
| `src/host/plugin/remote-display/windows-electron.ts` | Windows Electron 定位/下载、运行时铺设、spawn/停止   |
| `src/host/plugin/desktop/remote-helper.ts`           | 远程模式组合根（有桌面宠物才启动）                   |
| `runtime/electron-helper/main/bridge.js`             | 显示层 bridge：远程走 /rpc、素材带 Range 转发        |
| `runtime/electron-helper/main/remote.js`             | 显示层监督器：拉 /config、重建窗口、宿主消失自退     |
| `runtime/electron-helper/main/remote-config.js`      | 读 `--remote-config` 连接文件                        |
| `scripts/remote-display.mjs`                         | 手动启动显示层（兜底）                               |
