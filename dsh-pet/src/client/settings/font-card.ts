/**
 * 外观与字体卡（全局默认）：字体名（自由文本）、字号、字号是否随宠物大小缩放。
 * family 为空 = 跟随 DSH 字体；只改本地状态，随「保存」整包写入。
 * @module dsh-pet/src/client/settings/font-card
 */
import type { ChangeEvent, FunctionComponent } from 'react';
import type { FontConfig } from '../../shared/types.ts';
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '../../shared/fonts.ts';
import type { SettingsRuntime } from './runtime.ts';
import { INPUT_CLASS, makeUiKit, numberInputProps } from './ui.ts';

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
export function makeFontCard(rt: SettingsRuntime): FunctionComponent<FontCardProps> {
  const { h, t } = rt;
  const { cardHead, field, toggleCell } = makeUiKit({ h, t });

  return function FontCard(props: FontCardProps) {
    const { busy, font } = props;
    return h('div', {
      className: 'dsh-pet-cfg__card',
      children: [
        cardHead(t('fontTitle'), t('fontHint')),
        h('div', {
          className: 'dsh-pet-cfg__grid2',
          children: [
            field(
              t('fontFamilyLabel'),
              h('input', {
                type: 'text',
                className: INPUT_CLASS,
                value: String(font.family ?? ''),
                disabled: busy,
                maxLength: 200,
                onChange: (e: ChangeEvent<HTMLInputElement>) => props.onChange({ family: e.target.value }),
              }),
              t('fontFamilyHint'),
            ),
            field(
              t('fontSizeLabel'),
              h(
                'input',
                numberInputProps(font.size, (v) => props.onChange({ size: v }), {
                  step: '1',
                  min: String(FONT_SIZE_MIN),
                  max: String(FONT_SIZE_MAX),
                  disabled: busy,
                }),
              ),
              t('fontSizeHint'),
            ),
          ],
        }),
        h('div', {
          className: 'dsh-pet-cfg__grid2',
          children: [toggleCell('fontFollowToggle', font.followPet, busy, (v) => props.onChange({ followPet: v }))],
        }),
      ],
    });
  };
}
