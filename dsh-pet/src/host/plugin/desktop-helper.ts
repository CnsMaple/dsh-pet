/**
 * 桌面 Helper 的组合根：把宠物列表、进程拉起、重启串行化三块拼成对外能力。
 *
 * 只做装配，不含逻辑；三块的分工见 ./desktop/ 下各自模块头。
 * 必须始终成立：requestRestart 是唯一的重启入口，内部串行且不重叠。
 * @module dsh-pet/src/host/plugin/desktop-helper
 */
import { createDesktopPets } from './desktop/pets.ts';
import { createDesktopSpawn } from './desktop/spawn.ts';
import { createDesktopSync } from './desktop/sync.ts';
import { readFileSync } from 'node:fs';
import { createRemoteDesktopHelper } from './desktop/remote-helper.ts';
import type { DesktopHelperDeps } from './desktop/types.ts';

export type { DesktopHelperDeps };

/** 是否运行在 WSL：内核版本带 microsoft 或存在 WSL_DISTRO_NAME。 */
function isWslHost(): boolean {
  if (process.platform !== 'linux') return false;
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    return /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
}

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
export function createDesktopHelper(deps: DesktopHelperDeps) {
  const useRemote = process.env.DSH_PET_REMOTE === '1' || (process.env.DSH_PET_REMOTE !== '0' && isWslHost());
  if (useRemote) return createRemoteDesktopHelper(deps);
  const pets = createDesktopPets(deps);
  const spawn = createDesktopSpawn({ ...deps, ...pets });
  const sync = createDesktopSync({ ...deps, ...pets, ...spawn });
  return {
    startHelper: spawn.startHelper,
    stopHelper: spawn.stopHelper,
    requestRestart: sync.requestRestart,
    assetRootFor: spawn.assetRootFor,
    userRootFor: spawn.userRootFor,
    markDisposed: spawn.markDisposed,
  };
}

/** 桌面 Helper 生命周期的产出（供下游工厂按需 Pick）。 */
export type DesktopHelper = ReturnType<typeof createDesktopHelper>;
