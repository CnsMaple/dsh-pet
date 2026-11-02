import type { SessionNotify } from './session-notify.ts';
import type { WorkStatusBridge } from './work-status-bridge.ts';
import type { HostSetup } from './setup.ts';
import type { HostContext } from './context.ts';
/** 会话事件监听的输入。 */
export type SessionWatchInput = {
    /** 宿主上下文（apply 收到的那一个）。 */
    ctx: HostContext;
} & Pick<SessionNotify, 'cancelTerminalCleanup'> & Pick<SessionNotify, 'lastTodoText'> & Pick<SessionNotify, 'lastReplyText'> & Pick<SessionNotify, 'notifyActivityTimers'> & Pick<WorkStatusBridge, 'publishWorkStatus'> & Pick<SessionNotify, 'pushNotifyFrame'> & Pick<SessionNotify, 'scheduleCompletionNotify'> & Pick<SessionNotify, 'scheduleTerminalCleanup'> & Pick<SessionNotify, 'terminalTimers'> & Pick<SessionNotify, 'toolsInFlight'> & Pick<SessionNotify, 'turnFlags'> & Pick<HostSetup, 'workStatus'> & {
    /** 会话 id → 标题缓存（从 session 事件里抓，供 sessions 段用）。 */
    sessionTitles: Map<string, string>;
    /** 会话 id → 最后一次工具调用（名字 + 细节），供会话气泡展示。 */
    lastTools: Map<string, {
        name: string;
        detail: string;
    }>;
};
/** 注册会话事件监听；返回的清理函数由 ctx.effect 收集。 */
export declare function registerSessionWatch(deps: SessionWatchInput): void;
