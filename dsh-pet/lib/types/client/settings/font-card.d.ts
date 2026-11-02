/**
 * 外观与字体卡（全局默认）：字体名（自由文本）、字号、字号是否随宠物大小缩放。
 * family 为空 = 跟随 DSH 字体；只改本地状态，随「保存」整包写入。
 * @module dsh-pet/src/client/settings/font-card
 */
import type { FunctionComponent } from 'react';
import type { FontConfig } from '../../shared/types.ts';
import type { SettingsRuntime } from './runtime.ts';
/** 字体卡的输入。 */
export interface FontCardProps {
    /** 保存中或配置未就绪时禁用全部控件。 */
    busy: boolean;
    /** 当前字体配置。 */
    font: FontConfig;
    /** 改字体配置的若干字段。 */
    onChange: (patch: Partial<FontConfig>) => void;
}
/**
 * 造外观与字体卡。
 *
 * @param rt - 注入的 react 能力与翻译函数。
 * @returns 卡片组件。
 */
export declare function makeFontCard(rt: SettingsRuntime): FunctionComponent<FontCardProps>;
