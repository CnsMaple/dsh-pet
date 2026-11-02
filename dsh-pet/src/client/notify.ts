/**
 * 系统通知引擎（浏览器半侧）：消费宿主生成的通知帧，按「聚焦不弹」发系统级 toast。
 * 这是独立于宠物的能力，只随 DSH 网页端走——桌面模式不做宠物无关的功能。
 * 不负责产生帧：宿主监听 DSH 事件并写进 `/state`，容器统一轮询发现 counter 变化后调 `notifyFromFrame`；
 * 中断 / 活动门等过滤也已在宿主侧完成。
 * 依赖 shared/notify.ts 的帧到文案映射、成品配置的 `main.notificationsEnabled` 总开关，
 * 以及 app.ts 注入的会话跳转与命名服务（取不到时只降级，不影响弹窗）。
 * @module dsh-pet/src/client/notify
 */

import { frameToToast, truncate, NOTIFY_ICONS as ICON_NAMES, type NotifyFrame } from '../shared/notify.ts';
import { ROUTE_PATH } from '../shared/constants.ts';

let pageVisible = typeof document !== 'undefined' && !document.hidden;
let pageFocused = typeof document !== 'undefined' && document.hasFocus();

function refreshVisible(): void {
  pageVisible = !document.hidden;
}
function refreshFocused(): void {
  pageFocused = document.hasFocus();
}

/** 注册聚焦与可见性监听，返回解绑函数。 */
function initFocusTracking(): () => void {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', refreshVisible);
  window.addEventListener('focus', refreshFocused);
  window.addEventListener('blur', refreshFocused);
  return () => {
    document.removeEventListener('visibilitychange', refreshVisible);
    window.removeEventListener('focus', refreshFocused);
    window.removeEventListener('blur', refreshFocused);
  };
}

/** 用户是否在看本页（页面可见且持有焦点）；是则跳过通知。 */
function isPageActive(): boolean {
  return pageVisible && pageFocused;
}

/** 图标 URL；pic 路由由宿主提供（`assets/pic` → `/dsh-pet-7340/pic/<file>`）。 */
const PIC = (name: string): string => `${ROUTE_PATH}/pic/${name}.png`;

/** 图标 URL 表；文件名以 shared 为单一来源，设置页的测试通知也用它。 */
export const NOTIFY_ICONS = {
  done: PIC(ICON_NAMES.done),
  error: PIC(ICON_NAMES.error),
  truncated: PIC(ICON_NAMES.truncated),
  approval: PIC(ICON_NAMES.approval),
  question: PIC(ICON_NAMES.question),
  test: PIC(ICON_NAMES.test),
} as const;

/** 通知行为配置（总开关 + 回合完成三档 + 审批/问题开关 + 提示音）；运行中由 reloadNotifications 更新。 */
interface NotifySettings {
  enabled: boolean;
  turnEnd: 'never' | 'unfocused' | 'always';
  approval: boolean;
  question: boolean;
  sound: 'default' | 'classic' | 'none';
}
let settings: NotifySettings = {
  enabled: true,
  turnEnd: 'always',
  approval: true,
  question: true,
  sound: 'default',
};

/** 会话跳转与命名：由 app.ts 注入，取不到服务时退化为不跳会话、不认会话名。 */
export interface SessionNavigator {
  openSession(sessionId: string): void;
  /** 该会话的显示名（通知标题用）；没有名字、会话不在列表里或取不到时返回 undefined。 */
  sessionTitle?(sessionId: string): string | undefined;
}

/** 当前生效的会话跳转器（app.ts 注入；旧版 DSH 没有 uiWorkspace 时为 undefined）。 */
let sessionNavigator: SessionNavigator | undefined;

/**
 * 取某条会话的显示名（通知标题用）。
 *
 * @param navigator - app.ts 注入的会话服务；旧版 DSH 可能整个缺失。
 * @param sessionId - 帧携带的会话 id；缺失时连查询都不做。
 * @returns 会话名；没有注入器、服务没有该能力或查询抛错时返回 undefined，调用方回落固定文案。
 */
export function sessionTitleFrom(
  navigator: SessionNavigator | undefined,
  sessionId: string | undefined,
): string | undefined {
  if (sessionId === undefined) return undefined;
  try {
    return navigator?.sessionTitle?.(sessionId);
  } catch {
    // 宿主 store 的 getSnapshot 在首屏列表仍 pending 时可能抛；取不到名字只回落标题，绝不能连累弹窗。
    return undefined;
  }
}

/**
 * 点通知：先页内切到那条会话，再聚焦页面，最后请桌面壳把主窗口叫回前台。
 * 先切会话再叫窗口，用户看到窗口的那一刻就是目标会话；`dsh://open` 只在 Electron 宿主里发，
 * 浏览器里导航该协议会弹拦截框。`sessionId` 缺失时只跳过切换，其余照旧。
 */
export function wireNotificationClick(n: Notification, sessionId?: string): void {
  n.onclick = () => {
    n.close();
    if (sessionId !== undefined) {
      // 跳转失败（会话已删 / 旧版没有该服务）绝不能连累「把窗口叫回来」那条腿。
      try {
        sessionNavigator?.openSession(sessionId);
      } catch {
        /* 不跳会话而已，继续叫窗口。 */
      }
    }
    window.focus();
    if (!/electron/i.test(navigator.userAgent)) return;
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = 'dsh://open';
    document.body.append(frame);
    setTimeout(() => frame.remove(), 1000);
  };
}

/** 发一条系统通知；总开关关闭、环境不支持、未授权或本页正在看时静默跳过。
 * 日志只在门之后记录：被拦下的触发不产生「弹窗」日志。 */
function playNotifySound(): void {
  if (settings.sound === 'none') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = settings.sound === 'classic' ? 880 : 640;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => void ctx.close();
  } catch {
    /* 音频不可用：静默 */
  }
}

function toast(title: string, body?: string, icon?: string, sessionId?: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  console.log('[dsh-pet] 【弹窗】' + title + (body ? '：' + body : ''));
  playNotifySound();
  try {
    const opts: NotificationOptions = {};
    if (body) opts.body = truncate(body);
    if (icon) opts.icon = icon;
    // 点击行为与真实事件通知共用 wireNotificationClick；图标加载失败只降级为无图标，不会关闭弹窗。
    const n = new Notification(title, opts);
    wireNotificationClick(n, sessionId);
  } catch {
    /* 个别桌面壳在构造时抛错：忽略，不打断业务。 */
  }
}

/**
 * 帧 → toast 并发出；未知帧静默跳过，帧里的 sessionId 一并透传给点击行为。
 * 标题优先用会话名：同一个宿主上可以并行跑多条会话，通知里必须能认出是哪一条回来了。
 */
function shouldNotify(frame: NotifyFrame): boolean {
  if (!settings.enabled) return false;
  // 测试通知：桌面宠物窗口（Electron）弹原生即可，网页端不重复弹 Web 通知。
  if (frame.type === 'host/test') return false;
  if (frame.type === 'approval/requested') return settings.approval;
  if (frame.type === 'question/requested') return settings.question;
  if (frame.type === 'host/agent-error') return true;
  if (frame.type === 'session/event') {
    const ev = (frame.event ?? {}) as { type?: string };
    if (ev.type !== 'turn/end') return false;
    if (settings.turnEnd === 'never') return false;
    // 失焦模式：本页正在看（可见且聚焦）就跳过；「总是」模式则照弹。
    if (settings.turnEnd === 'unfocused' && isPageActive()) return false;
    return true;
  }
  return false;
}

/** 网页端通知总开关：彻底关闭（桌面 Electron 宠物窗口负责原生通知，网页不再弹 Web 通知/提示音）。 */
const WEB_NOTIFY_DISABLED = true;

function toastFrame(frame: NotifyFrame): void {
  if (WEB_NOTIFY_DISABLED) return;
  if (!shouldNotify(frame)) return;
  const sessionId = typeof frame.sessionId === 'string' ? frame.sessionId : undefined;
  const t = frameToToast(frame, sessionTitleFrom(sessionNavigator, sessionId));
  if (!t) return;
  toast(t.title, t.body, PIC(t.icon), sessionId);
}

/** 申请通知权限的结果；失败时带原因与可选文案，供设置页红字展示。 */
export type PermissionResult =
  { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'rejected' | 'error'; message?: string };

/**
 * 申请浏览器通知权限，必须在用户手势（点击）下调用，否则可能被静默压制。
 * 失败原因：`unsupported` 无 Notification、`denied` 已被阻止、`rejected` 询问时选了阻止、`error` 申请异常。
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (typeof Notification === 'undefined') return { ok: false, reason: 'unsupported' };
  if (Notification.permission === 'granted') return { ok: true };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  try {
    const p = await Notification.requestPermission();
    if (p === 'granted') return { ok: true };
    if (p === 'denied') return { ok: false, reason: 'rejected' };
    // 弹窗被直接关掉 / 未选择：浏览器仍是 default。
    return { ok: false, reason: 'error', message: '权限未授予（' + p + '）' };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** 读通知行为配置（成品配置 main 条目）；拉取或解析失败时沿用默认（开启 + 失焦弹 + 提示音 default）。 */
async function readSettings(): Promise<void> {
  try {
    const r = await fetch(ROUTE_PATH + '/config');
    if (!r.ok) return;
    const d = (await r.json().catch(() => null)) as { main?: Record<string, unknown> } | null;
    const m = d && d.main;
    if (!m) return;
    settings = {
      enabled: typeof m.notificationsEnabled === 'boolean' ? m.notificationsEnabled : true,
      turnEnd:
        m.notificationTurnEnd === 'never' || m.notificationTurnEnd === 'always'
          ? (m.notificationTurnEnd as 'never' | 'always')
          : 'always',
      approval: typeof m.notificationApproval === 'boolean' ? m.notificationApproval : true,
      question: typeof m.notificationQuestion === 'boolean' ? m.notificationQuestion : true,
      sound:
        m.notificationSound === 'none' || m.notificationSound === 'classic'
          ? (m.notificationSound as 'none' | 'classic')
          : 'default',
    };
  } catch {
    /* 读不到按默认 */
  }
}

/** 重读总开关（设置页保存开关后调用）；之后新触发的通知按新值执行，无需刷新页面。 */
export async function reloadNotifications(): Promise<void> {
  await readSettings();
}

/** 一帧通知 → toast；由容器统一轮询 `/state` 发现 `sections.notify` 变化后调用。 */
export function notifyFromFrame(frame: unknown): void {
  toastFrame(frame as NotifyFrame);
}

/**
 * 初始化通知引擎：记住会话跳转器、读总开关、兜底申请权限并跟踪页面聚焦；不做轮询。
 * @param navigator - 会话跳转与命名服务；不传时点击只叫窗口、标题回落固定文案。
 * @returns 释放函数，摘掉聚焦监听。
 */
export function initNotify(navigator?: SessionNavigator): () => void {
  sessionNavigator = navigator;
  // 行为配置读成品配置（拉取失败不阻塞，沿用默认）；之后由设置页保存后 reloadNotifications 重读。
  void readSettings().then(() => {
    if (typeof Notification !== 'undefined' && settings.enabled && Notification.permission === 'default') {
      // 兜底申请；无手势时浏览器可能压制，真正的申请在设置页开关或按钮点击处。
      void requestNotificationPermission();
    }
  });
  return initFocusTracking();
}
