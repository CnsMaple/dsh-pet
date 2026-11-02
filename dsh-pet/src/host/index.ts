/**
 * 插件入口（精简版）：配置、路由、工作状态联动、系统通知、待办、桌面 Helper 装配到 ctx。
 * 已删除 余额 / 碎碎念 / 对话 / 语音 / 模型 等能力及其命令与循环。
 * 装配顺序不能改：getHandlePetRoute 惰性取用，startHelper 最后调用。
 * @module dsh-pet/src/host/index
 */
import { createHostSetup } from './plugin/setup.ts';
import { flattenPetList, readAllConfig } from './config.ts';
import { createHttpRoute, registerHttpRoute } from './plugin/http-route.ts';
import { registerLifecycle } from './plugin/lifecycle.ts';
import { registerSessionWatch } from './plugin/session-watch.ts';
import { createDesktopHelper } from './plugin/desktop-helper.ts';
import { createSessionNotify } from './plugin/session-notify.ts';
import { createPetLookup } from './plugin/pet-lookup.ts';
import { createDownloadReport } from './plugin/download-report.ts';
import { createWorkStatusBridge } from './plugin/work-status-bridge.ts';
import { registerTodoReminders } from './plugin/todo-reminders.ts';
import { TODO_FILE_NAME, TodoStore } from './todo/store.ts';
import { join } from 'node:path';
import type { PetRouteDeps } from './routes/types.ts';

/** 插件行 id（与 cordis.patch.yml 一致） */
export const name = 'pet';
/** 需要的宿主服务：webServer（路由）+ connection（桌面 Helper「打开网站」用的已鉴权地址）。 */
export const inject = ['webServer', 'connection'];

/** 宿主插件主体。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- DSH 注入的 ctx 无静态类型
export function apply(ctx: any): void {
  const setup = createHostSetup(ctx);
  const {
    userRoot,
    log,
    configPaths,
    thumbUserRoot,
    state,
    playback,
    workStatus,
    EXTERNAL_WORK_SESSION,
    nextExternalWorkSeq,
  } = setup;

  /** 现读的宠物实例列表（main + 文件宠物，已完成条目级字段拍平）。 */
  const effectivePetList = (): Array<Record<string, unknown>> => flattenPetList(readAllConfig(configPaths));

  const workStatusBridge = createWorkStatusBridge({ state, workStatus });
  const { publishWorkStatus, stopWorkStatusFlush } = workStatusBridge;
  const downloadReport = createDownloadReport({
    EXTERNAL_WORK_SESSION,
    nextExternalWorkSeq,
    publishWorkStatus,
    workStatus,
  });
  const { reportDownload, stopDownloadSlotTimer } = downloadReport;
  const petLookup = createPetLookup({ state, configPaths });
  const { lock, sleep } = petLookup;
  const sessionNotify = createSessionNotify({ ctx, publishWorkStatus, state, workStatus });
  const {
    pushNotifyFrame,
    turnFlags,
    terminalTimers,
    lastTodoText,
    lastReplyText,
    toolsInFlight,
    cancelTerminalCleanup,
    scheduleTerminalCleanup,
    notifyActivityTimers,
    scheduleCompletionNotify,
  } = sessionNotify;

  /** 取会话标题：DSH sessions 服务；取不到退回「会话 · id末4位」。 */
  const sessionTitleOf = (id: string): string => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DSH 注入 ctx 无静态类型
      const svc: any = typeof ctx?.get === 'function' ? ctx.get('sessions') : undefined;
      const meta = svc?.list?.getSnapshot?.()?.byId?.[id] ?? svc?.byId?.[id];
      const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
      return title || '会话 · ' + id.slice(-4);
    } catch {
      return '会话 · ' + id.slice(-4);
    }
  };

  /** 写 sections.sessions：所有进行中的会话（thinking/working/result/waiting）及在途工具细节。 */
  const publishSessions = (): void => {
    const rows: Array<{ id: string; title: string; state: string; tools: string[]; seq: number }> = [];
    for (const e of workStatus.entries()) {
      if (e.state === 'success' || e.state === 'error') continue;
      const bucket = toolsInFlight.get(e.sessionId);
      const tools = bucket ? Array.from(bucket.values()).slice(0, 3) : [];
      rows.push({ id: e.sessionId, title: sessionTitleOf(e.sessionId), state: e.state, tools, seq: e.seq });
    }
    rows.sort((a, b) => b.seq - a.seq);
    state.writeSection(
      'sessions',
      rows.map((r) => ({ id: r.id, title: r.title, state: r.state, tools: r.tools })),
    );
  };

  /** 一次工作状态写入 = 同时刷新 workStatus 与 sessions 两段（在途工具变化也走这里）。 */
  const publishWorkStatusAll = (): void => {
    publishWorkStatus();
    publishSessions();
  };

  const todos = new TodoStore({ file: join(userRoot, TODO_FILE_NAME), log });

  const desktopHelper = createDesktopHelper({
    ctx,
    configPaths,
    effectivePetList,
    log,
    reportDownload,
    thumbUserRoot,
    getHandlePetRoute: () => httpRoute.handlePetRoute,
  });
  const { startHelper, stopHelper, markDisposed } = desktopHelper;

  const deps: PetRouteDeps = {
    ...setup,
    ...petLookup,
    ...workStatusBridge,
    ...desktopHelper,
    ctx,
    todos,
  };
  const httpRoute = createHttpRoute(deps);
  registerHttpRoute(ctx, httpRoute.handlePetRoute);

  registerSessionWatch({
    ctx,
    cancelTerminalCleanup,
    lastTodoText,
    lastReplyText,
    notifyActivityTimers,
    publishWorkStatus: publishWorkStatusAll,
    pushNotifyFrame,
    scheduleCompletionNotify,
    scheduleTerminalCleanup,
    terminalTimers,
    toolsInFlight,
    turnFlags,
    workStatus,
  });

  registerTodoReminders({
    ctx,
    effectivePetList,
    isVoiceTodoEnabled: () => false,
    lock,
    log,
    sleep,
    state,
    todos,
    waiterCount: () => state.waiterCount(),
  });

  registerLifecycle({
    ctx,
    lock,
    markDisposed,
    playback,
    state,
    stopDownloadSlotTimer,
    stopHelper,
    stopWorkStatusFlush,
  });

  startHelper();
}
