import type { FunctionComponent } from 'react';
import { petBridge } from './settings/bridge.ts';
import type { ShortcutHost } from './app-shortcut.ts';
import type { SettingsRuntime } from './settings/runtime.ts';
export { dicts, NS } from './settings/locales/index.ts';
export type { Key } from './settings/locales/index.ts';
export { petBridge };
/**
 * 制造「桌宠配置」设置页组件。
 * @param rt - 运行时注入的依赖：`h`、hooks 与翻译函数 `t`。
 * @param ctx - 客户端上下文：只用于读用户改绑后的快捷键键位。
 * @returns 设置页组件。
 */
export declare function makePetConfigSection(rt: SettingsRuntime, ctx: ShortcutHost): FunctionComponent<{
    close?: () => void;
}>;
