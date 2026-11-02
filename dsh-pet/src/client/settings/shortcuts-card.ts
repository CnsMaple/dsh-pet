/**
 * 快捷键卡（精简版）：只列宠物自身可用的悬停键（待办 / 睡觉 / 显示位置）。
 * 对话相关快捷键与全局（可改绑）快捷键随对话功能一并移除。
 * @module dsh-pet/src/client/settings/shortcuts-card
 */
import type { FunctionComponent } from 'react';
import { DISPLAY_HOTKEY_HINTS } from '../../shared/display-hotkey.ts';
import { SLEEP_HOTKEY_HINT } from '../../shared/sleep-hotkey.ts';
import { TODO_HOTKEY_HINT } from '../../shared/todo/hotkey.ts';
import type { SettingsRuntime } from './runtime.ts';
import { makeUiKit } from './ui.ts';

/** 折叠正文的 id。 */
const BODY_ID = 'pet-cfg-shortcuts';

/**
 * 造快捷键卡。
 * @param rt - 注入的 react 能力与翻译函数。
 * @returns 卡片组件。
 */
export function makeShortcutsCard(rt: SettingsRuntime): FunctionComponent {
  const { h, t, useState } = rt;
  const { foldCard } = makeUiKit({ h, t });

  return function ShortcutsCard() {
    const [open, setOpen] = useState(false);
    const row = (label: string, keys: string) =>
      h('div', {
        className: 'dsh-pet-cfg__field',
        children: [
          h('span', { key: 'l', className: 'dsh-pet-cfg__flabel', children: t(label) }),
          h('span', { key: 'v', className: 'dsh-pet-cfg__note', children: keys }),
        ],
      });

    return foldCard({
      id: BODY_ID,
      title: t('shortcutCardTitle'),
      hint: t('shortcutCardHint'),
      body: [
        h('p', { key: 'petHint', className: 'dsh-pet-cfg__note', children: t('shortcutGroupPetHint') }),
        h('div', {
          key: 'petRows',
          className: 'dsh-pet-cfg__grid2',
          children: [
            row('shortcutRowTodo', TODO_HOTKEY_HINT),
            row('shortcutRowSleep', SLEEP_HOTKEY_HINT),
            row('shortcutRowDisplay', DISPLAY_HOTKEY_HINTS.join(' · ')),
          ],
        }),
      ],
      open,
      onToggle: () => setOpen(!open),
    });
  };
}
