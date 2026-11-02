/**
 * 快捷键卡（精简版）：只列宠物自身可用的悬停键（待办 / 睡觉 / 显示位置）。
 * 对话相关快捷键与全局（可改绑）快捷键随对话功能一并移除。
 * @module dsh-pet/src/client/settings/shortcuts-card
 */
import type { FunctionComponent } from 'react';
import type { SettingsRuntime } from './runtime.ts';
/**
 * 造快捷键卡。
 * @param rt - 注入的 react 能力与翻译函数。
 * @returns 卡片组件。
 */
export declare function makeShortcutsCard(rt: SettingsRuntime): FunctionComponent;
