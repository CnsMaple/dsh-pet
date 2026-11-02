import type { DesktopHelperDeps } from './desktop/types.ts';
export type { DesktopHelperDeps };
/**
 * 创建桌面 Helper 的全部能力。
 *
 * 走哪条桌面路径：
 *   · WSL 默认走远程显示模式（宿主开 RPC 服务、拉起 Windows 显示层）——WSL 无可用窗口，
 *     这样插件在 WSL 也能把宠物显示到 Windows 桌面上；
 *   · 其它平台（Windows/macOS/原生 Linux）走本机 spawn Electron 的原路径。
 * 显式开关：DSH_PET_REMOTE=1 强制远程；DSH_PET_REMOTE=0 强制本地（WSL + WSLg 想本地跑时用）。
 * 两条路径对外接口同形，下游无感。
 * @param deps - 装配期对象与桌面侧需要的动作函数。
 * @returns 启动、停止、请求重启与素材根解析。
 */
export declare function createDesktopHelper(deps: DesktopHelperDeps): {
    startHelper: () => void;
    stopHelper: (reason?: string) => void;
    stopHelperAndWait: (reason: string) => Promise<void>;
    requestRestart: () => Promise<void>;
    assetRootFor: (ext: string) => string;
    userRootFor: (ext: string) => string;
    markDisposed: () => void;
} | {
    startHelper: () => void;
    stopHelper: (reason?: string) => void;
    requestRestart: () => Promise<void>;
    assetRootFor: (ext: string) => string;
    userRootFor: (ext: string) => string;
    markDisposed: () => void;
};
/** 桌面 Helper 生命周期的产出（供下游工厂按需 Pick）。 */
export type DesktopHelper = ReturnType<typeof createDesktopHelper>;
