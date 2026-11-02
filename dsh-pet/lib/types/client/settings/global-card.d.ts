import type { FunctionComponent } from 'react';
import type { SettingsRuntime } from './runtime.ts';
/** 布尔全局开关键名。 */
export type GlobalFlagKey = 'notificationsEnabled' | 'clickSoundEnabled' | 'confineToScreen' | 'trayEnabled';
/** 布尔全局开关的当前值。 */
export type GlobalFlags = Record<GlobalFlagKey, boolean>;
/** 通知行为（4 项）的当前值。 */
export interface NotifyBehavior {
    notificationTurnEnd: 'never' | 'unfocused' | 'always';
    notificationApproval: boolean;
    notificationQuestion: boolean;
    notificationSound: 'default' | 'classic' | 'none';
}
/** 全局开关卡的输入。 */
export interface GlobalCardProps {
    /** 保存中或配置未就绪时禁用全部控件。 */
    busy: boolean;
    /** 布尔开关当前值。 */
    values: GlobalFlags;
    /** 通知行为当前值。 */
    behavior: NotifyBehavior;
    /** 布尔开关切换；通知开关的权限申请由外壳处理。 */
    onChange: (key: GlobalFlagKey, value: boolean) => void;
    /** 通知行为改动。 */
    onBehaviorChange: (patch: Partial<NotifyBehavior>) => void;
}
/**
 * 造全局开关卡。
 * @param rt - 注入的 react 能力与翻译函数。
 * @returns 卡片组件。
 */
export declare function makeGlobalCard(rt: SettingsRuntime): FunctionComponent<GlobalCardProps>;
