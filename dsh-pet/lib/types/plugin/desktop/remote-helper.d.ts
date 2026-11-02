import type { DesktopHelperDeps } from './types.ts';
/**
 * 创建远程显示模式下的桌面 Helper。
 *
 * @param deps - 装配期依赖（与本地模式同一份）。
 * @returns 与本地模式同形的 startHelper/stopHelper/requestRestart/素材根等能力。
 */
export declare function createRemoteDesktopHelper(deps: DesktopHelperDeps): {
    startHelper: () => void;
    stopHelper: (reason?: string) => void;
    stopHelperAndWait: (reason: string) => Promise<void>;
    requestRestart: () => Promise<void>;
    assetRootFor: (ext: string) => string;
    userRootFor: (ext: string) => string;
    markDisposed: () => void;
};
