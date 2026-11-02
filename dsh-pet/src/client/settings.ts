/**
 * 「桌宠配置」设置页（settings.section 插槽）：精简版——只编辑单只宠物的基础外观 + 全局开关 + 字体。
 * 本文件是装配根：持有表单状态、串起加载与写盘、把卡片拼成一页。
 * 精简说明：已移除 种类/宠物列表 tab、语音、对话与模型、移动端、物理、人设等设置项（对应功能后续从后端删除）。
 * @module dsh-pet/src/client/settings
 */
import { DEFAULT_FONT } from '../shared/fonts.ts';
import { DEFAULT_PHYSICS } from '../shared/physics.ts';
import type { FontConfig, ModelSelection, PhysicsParams } from '../shared/types.ts';
import type { FunctionComponent } from 'react';
import { requestNotificationPermission } from './notify.ts';
import { injectSettingsCss } from './settings/css.ts';
import { type Feedback, makeActions } from './settings/actions.ts';
import { petBridge } from './settings/bridge.ts';
import { type MergedConfig, readConfigEntries, readMainConfig } from './settings/config/index.ts';
import { type DialogState, makeDialog } from './settings/dialog.ts';
import { makeFontCard } from './settings/font-card.ts';
import { makeGlobalCard, type GlobalFlagKey, type GlobalFlags } from './settings/global-card.ts';
import { makeLoadStatus } from './settings/load-status.ts';
import { runNotificationTest } from './settings/notify-test.ts';
import { makePathsCards } from './settings/paths-cards.ts';
import { makePetCard } from './settings/pet-card.ts';
import { createWriteFlow } from './settings/config/index.ts';
import { makeShortcutsCard } from './settings/shortcuts-card.ts';
import { attachTipLayer } from './settings/tip-layer.ts';
import type { SettingsRuntime } from './settings/runtime.ts';
import { useConfigLoad } from './settings/config/index.ts';
import { usePetList } from './settings/use-pet-list.ts';
import { useRemoteData } from './settings/use-remote-data.ts';
import { makeUiKit } from './settings/ui.ts';

export { dicts, NS } from './settings/locales/index.ts';
export type { Key } from './settings/locales/index.ts';
export { petBridge };

/**
 * 制造「桌宠配置」设置页组件。
 * @param rt - 运行时注入的依赖：`h`、hooks 与翻译函数 `t`。
 * @returns 设置页组件。
 */
export function makePetConfigSection(rt: SettingsRuntime): FunctionComponent<{ close?: () => void }> {
  const { h, useState, useEffect, useRef, useCallback, t } = rt;

  injectSettingsCss();
  const { q } = makeUiKit({ h, t });

  const PetCard = makePetCard(rt);
  const GlobalCard = makeGlobalCard(rt);
  const FontCard = makeFontCard(rt);
  const ShortcutsCard = makeShortcutsCard(rt);
  const Actions = makeActions(rt);
  const { ConfigMetaCard, StorageCard } = makePathsCards(rt);
  const SettingsDialog = makeDialog(rt);
  const LoadStatus = makeLoadStatus({ h, t });

  return function PetConfigSection() {
    const [saving, setBusy] = useState(false);
    const [msg, setMsg] = useState<Feedback>({ kind: '', text: '' });
    const [permMsg, setPermMsg] = useState<Feedback>({ kind: '', text: '' });
    const rootRef = useRef<HTMLElement | null>(null);
    const [dialog, setDialog] = useState<DialogState>(null);
    const { pets, mainPets, selId, update, remove, replace, packWrites } = usePetList(rt, setDialog);
    const { paths } = useRemoteData(rt);

    useEffect(() => attachTipLayer(), []);

    // 全局开关（随「保存」整包写入）。
    const [notifyEnabled, setNotifyEnabled] = useState(true);
    const [clickSound, setClickSound] = useState(true);
    const [confineScreen, setConfineScreen] = useState(false);
    const [trayEnabled, setTrayEnabled] = useState(true);
    // 以下字段保留在写盘载荷里（配置 schema 尚未裁剪），但设置页已无对应控件，默认值随加载覆盖。
    const [whisperImage, setWhisperImage] = useState(false);
    const [chatImage, setChatImage] = useState(false);
    const [chatAnimation, setChatAnimation] = useState(true);
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [voiceName, setVoiceName] = useState('zh-CN-XiaoyiNeural');
    const [voiceVolume, setVoiceVolume] = useState(1);
    const [voiceWhisperEnabled, setVoiceWhisperEnabled] = useState(false);
    const [voiceTodoEnabled, setVoiceTodoEnabled] = useState(false);
    const [physics, setPhysics] = useState<PhysicsParams>({ ...DEFAULT_PHYSICS });
    const [font, setFont] = useState<FontConfig>({ ...DEFAULT_FONT });
    const [whisperModel, setWhisperModel] = useState<ModelSelection>({ provider: '', model: '' });
    const [chatModel, setChatModel] = useState<ModelSelection>({ provider: '', model: '' });
    const [chatMemory, setChatMemory] = useState(10);
    const [chatImageLimit, setChatImageLimit] = useState(20);
    const [notificationTurnEnd, setNotificationTurnEnd] = useState<'never' | 'unfocused' | 'always'>('unfocused');
    const [notificationApproval, setNotificationApproval] = useState(true);
    const [notificationQuestion, setNotificationQuestion] = useState(true);
    const [notificationSound, setNotificationSound] = useState<'default' | 'classic' | 'none'>('default');

    const applyConfig = useCallback(
      (merged: MergedConfig) => {
        const entries = readConfigEntries(merged);
        const patch = readMainConfig(merged);
        if (entries === null || patch === null) throw new Error('Invalid config response');
        replace(entries);
        if (patch.notificationsEnabled !== undefined) setNotifyEnabled(patch.notificationsEnabled);
        if (patch.clickSoundEnabled !== undefined) setClickSound(patch.clickSoundEnabled);
        if (patch.whisperImageEnabled !== undefined) setWhisperImage(patch.whisperImageEnabled);
        if (patch.chatImageEnabled !== undefined) setChatImage(patch.chatImageEnabled);
        if (patch.chatAnimationEnabled !== undefined) setChatAnimation(patch.chatAnimationEnabled);
        if (patch.confineToScreen !== undefined) setConfineScreen(patch.confineToScreen);
        if (patch.trayEnabled !== undefined) setTrayEnabled(patch.trayEnabled);
        if (patch.voiceEnabled !== undefined) setVoiceEnabled(patch.voiceEnabled);
        if (patch.voiceName !== undefined) setVoiceName(patch.voiceName);
        if (patch.voiceVolume !== undefined) setVoiceVolume(patch.voiceVolume);
        if (patch.voiceWhisperEnabled !== undefined) setVoiceWhisperEnabled(patch.voiceWhisperEnabled);
        if (patch.voiceTodoEnabled !== undefined) setVoiceTodoEnabled(patch.voiceTodoEnabled);
        if (patch.physics !== undefined) setPhysics(patch.physics);
        if (patch.font !== undefined) setFont(patch.font);
        if (patch.whisperModel !== undefined) setWhisperModel(patch.whisperModel);
        if (patch.chatModel !== undefined) setChatModel(patch.chatModel);
        if (patch.chatMemoryRounds !== undefined) setChatMemory(patch.chatMemoryRounds);
        if (patch.chatImageLimit !== undefined) setChatImageLimit(patch.chatImageLimit);
        if (patch.notificationTurnEnd !== undefined) setNotificationTurnEnd(patch.notificationTurnEnd);
        if (patch.notificationApproval !== undefined) setNotificationApproval(patch.notificationApproval);
        if (patch.notificationQuestion !== undefined) setNotificationQuestion(patch.notificationQuestion);
        if (patch.notificationSound !== undefined) setNotificationSound(patch.notificationSound);
      },
      [replace],
    );

    const { loadState, retry } = useConfigLoad(rt, applyConfig);
    const busy = saving || loadState !== 'ready';

    const toggleNotify = async (v: boolean) => {
      setNotifyEnabled(v);
      if (v) await requestNotificationPermission();
    };
    const testNotification = () => void runNotificationTest({ t, report: setPermMsg });

    const cur = pets.find((p) => p.id === selId) ?? null;

    const globalFlags: GlobalFlags = {
      notificationsEnabled: notifyEnabled,
      clickSoundEnabled: clickSound,
      confineToScreen: confineScreen,
      trayEnabled,
    };
    const flagSetters: Record<GlobalFlagKey, (value: boolean) => void> = {
      notificationsEnabled: (value) => void toggleNotify(value),
      clickSoundEnabled: setClickSound,
      confineToScreen: setConfineScreen,
      trayEnabled: setTrayEnabled,
    };
    const setGlobalFlag = (key: GlobalFlagKey, value: boolean): void => flagSetters[key](value);

    const patchFont = (patch: Partial<FontConfig>): void => setFont((current) => ({ ...current, ...patch }));

    const write = createWriteFlow({
      fields: () => ({
        pets: mainPets,
        notificationsEnabled: notifyEnabled,
        clickSoundEnabled: clickSound,
        whisperImageEnabled: whisperImage,
        chatImageEnabled: chatImage,
        chatAnimationEnabled: chatAnimation,
        confineToScreen: confineScreen,
        trayEnabled,
        voiceEnabled,
        voiceName,
        voiceVolume,
        voiceWhisperEnabled,
        voiceTodoEnabled,
        physics,
        whisperModel,
        chatModel,
        chatMemoryRounds: chatMemory,
        chatImageLimit,
        font,
        notificationTurnEnd,
        notificationApproval,
        notificationQuestion,
        notificationSound,
      }),
      busy: () => busy,
      setBusy,
      setMsg,
      setDialog,
      dialog: () => dialog,
      applyConfig,
      packWrites,
      userFile: () => paths?.user ?? '',
      t,
      onRemove: remove,
    });

    const saveRef = useRef<() => void>(() => {});
    useEffect(() => {
      saveRef.current = () => void write.save();
    });

    useEffect(() => {
      const onKey = (e: KeyboardEvent): void => {
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
        if (e.key.toLowerCase() !== 's') return;
        const root = rootRef.current;
        if (!root || !root.isConnected || root.getClientRects().length === 0) return;
        e.preventDefault();
        saveRef.current();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, []);

    return h('section', {
      ref: rootRef,
      className: 'dsh-pet-cfg',
      style: { maxWidth: '720px' },
      children: [
        h('h2', {
          className: 'dsh-pet-cfg__title',
          children: [t('nav'), q(t('intro'))],
        }),

        h(LoadStatus, { loadState, onRetry: retry }),

        h(PetCard, {
          pet: cur,
          busy,
          msg,
          onChange: update,
          onSave: () => void write.save(),
        }),
        h(GlobalCard, { busy, values: globalFlags, onChange: setGlobalFlag }),
        h(FontCard, { busy, font, onChange: patchFont }),
        h(Actions, {
          busy,
          msg,
          permMsg,
          onSave: () => void write.save(),
          onSync: write.requestSync,
          onTestNotification: testNotification,
        }),

        h(ShortcutsCard, {}),
        paths ? h(ConfigMetaCard, { paths }) : null,
        paths ? h(StorageCard, { paths }) : null,

        dialog
          ? h(SettingsDialog, { dialog, selId, onDismiss: () => setDialog(null), onConfirm: write.confirmDialog })
          : null,
      ],
    });
  };
}
