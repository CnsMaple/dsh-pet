/**
 * 路由层的依赖契约：`apply` 在挂载时构造一次，各路由模块只读消费。
 *
 * 精简版：已移除 余额 / 对话 / 语音 / 附件 相关能力（对应路由模块一并删除）。
 * @module dsh-pet/src/host/routes/types
 */
import type { ConfigPaths } from '../config.ts';
import type { RouteResult } from '../http.ts';
import type { LockStore } from '../lock.ts';
import type { FileLogger } from '../log-file.ts';
import type { MenuRegistry } from '../menu.ts';
import type { PlaybackStore } from '../playback.ts';
import type { PoseStore } from '../pose.ts';
import type { SleepStore } from '../sleep.ts';
import type { PollStateStore } from '../state.ts';
import type { TodoStore } from '../todo/store.ts';
import type { WorkStatusStore } from '../work-status.ts';

/** 一次路由调用的输入：URL 已解析，`rest` 是去掉前缀并解码后的路径。 */
export interface RouteInput {
  /** 完整请求 URL（含查询串）。 */
  readonly url: URL;
  /** 去掉 `/dsh-pet-7340/` 前缀后的剩余路径（已解码）。 */
  readonly rest: string;
  /** HTTP 方法（大写）。 */
  readonly method: string;
  /** 请求体文本；只有 PUT/POST 才有值。 */
  readonly body?: string;
  /** 调用方断开信号：挂起等待的路由据此提前收尾。 */
  readonly signal?: AbortSignal;
}

/** 宠物定位结果：命中给出所在层与条目，未命中给出可直接返回的应答。 */
export type PetLookup =
  | { ok: true; petId: string; entry: string; conf: Record<string, unknown>; pet: Record<string, unknown> }
  | { ok: false; res: RouteResult };

/** 单个路由处理函数：未命中返回 undefined，命中返回应答。 */
export type RouteHandler = (deps: PetRouteDeps, input: RouteInput) => Promise<RouteResult | undefined>;

/**
 * 路由层需要的全部外部能力（精简版：配置/状态/锁/睡觉/待办/动画/菜单/播放/姿态/桌面）。
 */
export interface PetRouteDeps {
  readonly configPaths: ConfigPaths;
  readonly menuRegistry: MenuRegistry;
  readonly state: PollStateStore;
  readonly todos: TodoStore;
  readonly workStatus: WorkStatusStore;
  readonly EXTERNAL_WORK_SESSION: string;
  readonly surfaceBlocked: (
    cfg: Record<string, Record<string, unknown>>,
    petId: string,
    params: URLSearchParams,
  ) => RouteResult | null;
  readonly lockBlocked: (petId: string, params: URLSearchParams) => RouteResult | null;
  readonly userConfigPath: string;
  readonly requestRestart: () => Promise<void>;
  readonly requirePet: (
    params: URLSearchParams,
    cfg: () => Record<string, Record<string, unknown>>,
    opts?: { surface?: boolean },
  ) => PetLookup;
  readonly playback: PlaybackStore;
  readonly userRoot: string;
  readonly lock: LockStore;
  readonly sleep: SleepStore;
  readonly sleepBlocked: (petId: string, params: URLSearchParams) => RouteResult | null;
  readonly log: FileLogger;
  readonly ctx: { logger?: { warn?(message: string): void }; llm?: unknown };
  readonly petConfigDir: string;
  readonly publishWorkStatus: () => void;
  readonly nextExternalWorkSeq: () => number;
  readonly memeDirsFor: (assetRoot: string) => string[];
  readonly pose: PoseStore;
  readonly optionalService: (name: string) => unknown;
  readonly thumbUserRoot: string;
  readonly memesUserRoot: string;
  readonly userRootFor: (ext: string) => string;
  readonly assetRootFor: (ext: string) => string;
}
