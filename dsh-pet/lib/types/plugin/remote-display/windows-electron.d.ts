/**
 * Windows 显示层的宿主侧启动器：定位/下载 Windows 版 Electron、把 Helper 运行时铺到 Windows 可见目录、
 * 写连接文件并 spawn 它。
 *
 * 只在 WSL（能通过 /mnt 互操作执行 Windows 程序的 Linux）里工作；非互操作环境返回结构化失败，
 * 由调用方降级为「不自动拉起、打印手动启动说明」。不负责 RPC 服务本身（归 ./server）。
 * @module dsh-pet/src/host/plugin/remote-display/windows-electron
 */
import { type ChildProcess } from 'node:child_process';
/** 远程显示层启动所需的日志出口。 */
export interface LauncherLog {
    info(message: string): void;
    warn(message: string): void;
}
/** 启动 Windows 显示层的输入。 */
export interface LaunchInput {
    /** 插件包根（runtime/electron-helper 与 assets/logo.png 的相对基准）。 */
    readonly packageRoot: string;
    /** 显示层要连的 RPC 基址，形如 `http://<ip>:<port>`。 */
    readonly rpcUrl: string;
    /** 远程令牌。 */
    readonly token: string;
    /** 日志出口。 */
    readonly log: LauncherLog;
}
/** 启动结果：成功给出子进程与路径，失败给出可读原因。 */
export type LaunchResult = {
    readonly ok: true;
    readonly child: ChildProcess;
    readonly exeWsl: string;
} | {
    readonly ok: false;
    readonly reason: string;
};
/** WSL 互操作是否可用：/mnt/c 与 cmd.exe 都在。 */
export declare function hasWindowsInterop(): boolean;
/** 把 Windows 绝对路径转成 WSL 路径（wslpath -u）；失败返回 undefined。 */
export declare function toWslPath(windowsPath: string): string | undefined;
/** 把 WSL 路径转成 Windows 绝对路径（wslpath -w）；失败返回 undefined。 */
export declare function toWindowsPath(wslPath: string): string | undefined;
/** 解析 %LOCALAPPDATA% 行的尾部（cmd 可能带警告前缀，只取最后一行非空）。 */
export declare function parseLocalAppData(output: string): string | undefined;
/** Windows 用户 %LOCALAPPDATA% 对应的 WSL 路径；取不到返回 undefined。 */
export declare function windowsLocalAppDataWsl(): string | undefined;
/** 本插件在 Windows 侧的落地根 %LOCALAPPDATA%\\dsh-pet 的 WSL 路径；取不到返回 undefined。 */
export declare function windowsDshPetBaseWsl(): string | undefined;
/**
 * 确保 Windows 版 Electron 就绪：已存在直接用；否则按 win32-x64 下载并解压到 %LOCALAPPDATA%\\dsh-pet\\electron-win。
 *
 * @param winBase - %LOCALAPPDATA%\\dsh-pet 的 WSL 路径。
 * @param log - 日志出口。
 * @returns 可执行文件的 WSL 路径；失败返回 undefined。
 */
export declare function ensureWindowsElectron(winBase: string, log: LauncherLog): Promise<string | undefined>;
/**
 * 写连接文件（含令牌）到 Windows 可见目录，返回其 WSL 路径；令牌只落这个本机文件，不进日志。
 *
 * @param stageBaseDir - 显示层运行时落地目录的 WSL 路径（%LOCALAPPDATA%\\dsh-pet\\display-runtime）。
 * @param rpcUrl - 宿主 RPC 基址。
 * @param token - 远程令牌。
 * @returns 连接文件的 WSL 绝对路径。
 */
export declare function writeConnectionFile(stageBaseDir: string, rpcUrl: string, token: string): string;
/**
 * 启动 Windows 显示层进程。
 *
 * @param input - 包根、RPC 基址、令牌与日志。
 * @returns 成功给出子进程；失败给出原因（互操作缺失 / 无 Windows Electron 等）。
 */
export declare function launchWindowsDisplayLayer(input: LaunchInput): Promise<LaunchResult>;
/** 尽力结束显示层进程（跨 WSL↔Windows 边界，Linux 侧 child.kill 未必触及 Windows 进程树）。 */
export declare function stopWindowsDisplayLayer(child: ChildProcess | undefined): void;
/**
 * 用显示层启动时写下的 Windows PID 精确结束整棵进程树（taskkill /T /F）。
 *
 * Linux 侧对互操作子进程的 kill 不保证传到 Windows 进程，跨边界收尾必须靠这个；
 * 找不到 pid 文件或执行失败都静默（还有显示层自身的探活自退兜底）。
 *
 * @param winBase - %LOCALAPPDATA%\\dsh-pet 的 WSL 路径。
 */
export declare function killWindowsDisplayLayerByPidFile(winBase: string | undefined): void;
