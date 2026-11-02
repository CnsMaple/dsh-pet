/**
 * 全局开关卡：通知（含回合完成三档/审批/问题/提示音）、点击音效、锁定屏幕与系统托盘。
 * 切换只改本地状态，随「保存」整包写入；通知权限申请由外壳处理。
 * @module dsh-pet/src/client/settings/global-card
 */
import type { ChangeEvent } from 'react';
import type { FunctionComponent } from 'react';
import type { SettingsRuntime } from './runtime.ts';
import { INPUT_CLASS, makeUiKit } from './ui.ts';

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

/** 布尔开关的展示顺序与文案键。 */
const TOGGLES: Array<{ key: GlobalFlagKey; label: string }> = [
  { key: 'notificationsEnabled', label: 'notifyToggle' },
  { key: 'clickSoundEnabled', label: 'clickSoundToggle' },
  { key: 'confineToScreen', label: 'confineToggle' },
  { key: 'trayEnabled', label: 'trayToggle' },
];

/** 回合完成三档选项（值 + 文案键）。 */
const TURN_END_OPTIONS: Array<{ value: NotifyBehavior['notificationTurnEnd']; label: string }> = [
  { value: 'never', label: 'notifyTurnEndNever' },
  { value: 'unfocused', label: 'notifyTurnEndUnfocused' },
  { value: 'always', label: 'notifyTurnEndAlways' },
];

/** 提示音选项。 */
const SOUND_OPTIONS: Array<{ value: NotifyBehavior['notificationSound']; label: string }> = [
  { value: 'default', label: 'notifySoundDefault' },
  { value: 'classic', label: 'notifySoundClassic' },
  { value: 'none', label: 'notifySoundNone' },
];

/**
 * 造全局开关卡。
 * @param rt - 注入的 react 能力与翻译函数。
 * @returns 卡片组件。
 */
export function makeGlobalCard(rt: SettingsRuntime): FunctionComponent<GlobalCardProps> {
  const { h, t } = rt;
  const { cardHead, field, toggleCell } = makeUiKit({ h, t });

  return function GlobalCard(props: GlobalCardProps) {
    const { behavior } = props;
    const select = (
      labelKey: string,
      value: string,
      options: Array<{ value: string; label: string }>,
      onPick: (value: string) => void,
    ) =>
      field(
        t(labelKey),
        h('select', {
          className: INPUT_CLASS,
          value,
          disabled: props.busy,
          onChange: (e: ChangeEvent<HTMLSelectElement>) => onPick(e.target.value),
          children: options.map((o) => h('option', { key: o.value, value: o.value, children: t(o.label) })),
        }),
        t(labelKey + 'Hint'),
      );

    return h('div', {
      className: 'dsh-pet-cfg__card',
      children: [
        cardHead(t('globalTitle'), t('globalHint')),
        h('div', {
          className: 'dsh-pet-cfg__grid4',
          children: TOGGLES.map((toggle) =>
            toggleCell(toggle.label, props.values[toggle.key], props.busy, (value) =>
              props.onChange(toggle.key, value),
            ),
          ),
        }),
        h('p', { key: 'bh', className: 'dsh-pet-cfg__cardTitle', children: t('notifyBehaviorTitle') }),
        select('notifyTurnEndLabel', behavior.notificationTurnEnd, TURN_END_OPTIONS, (value) =>
          props.onBehaviorChange({ notificationTurnEnd: value as NotifyBehavior['notificationTurnEnd'] }),
        ),
        h('div', {
          key: 'bq',
          className: 'dsh-pet-cfg__grid2',
          children: [
            toggleCell('notifyApprovalToggle', behavior.notificationApproval, props.busy, (value) =>
              props.onBehaviorChange({ notificationApproval: value }),
            ),
            toggleCell('notifyQuestionToggle', behavior.notificationQuestion, props.busy, (value) =>
              props.onBehaviorChange({ notificationQuestion: value }),
            ),
          ],
        }),
        select('notifySoundLabel', behavior.notificationSound, SOUND_OPTIONS, (value) =>
          props.onBehaviorChange({ notificationSound: value as NotifyBehavior['notificationSound'] }),
        ),
      ],
    });
  };
}
