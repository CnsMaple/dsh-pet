/**
 * 浏览器半侧装配层（精简版）：宠物 overlay 与设置页；已去掉对话面板/命令选择框/命令图标/聊天快捷键。
 * @module dsh-pet/src/client/app
 */
import { makePetUI } from './pet.ts';
import { readPose } from './pose.ts';
import { readProgress } from './progress.ts';
import { takeMenuEvents } from './menu-service.ts';
import { getStateSnapshot } from './state-service.ts';
import { dicts, makePetConfigSection, NS } from './settings.ts';
import { initNotify } from './notify.ts';
import { installSectionNavIcon } from './nav-icon.ts';
import { registerPetCardShortcuts } from './pet/card/shortcut.ts';
import type * as ReactNS from 'react';
import type * as PrimitivesNS from '@deepseek-ai/dsh-client-ui-primitives';

/** 创建 DSH 插件 factory。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeFactory(): (require: (mod: string) => any) => any {
  return (require) => {
    const module = { exports: {} };
    const react: typeof ReactNS = require('react');
    const { useEffect, useRef, useState, useCallback } = react;
    const { jsx: h } = require('react/jsx-runtime');
    let primitives: typeof PrimitivesNS | undefined;
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    } catch (error) {
      console.warn('[dsh-pet] 图标模块不可用：' + (error instanceof Error ? error.message : String(error)));
    }
    let renderIconSvg: ((icon: ReactNS.ComponentType<PrimitivesNS.IconProps>) => string) | undefined;
    try {
      const { createRoot } = require('react-dom/client');
      const { flushSync } = require('react-dom');
      renderIconSvg = (icon) => {
        const holder = document.createElement('div');
        const root = createRoot(holder);
        try {
          flushSync(() => root.render(h(icon, { size: 16 })));
          return holder.innerHTML;
        } finally {
          root.unmount();
        }
      };
    } catch (error) {
      console.warn('[dsh-pet] 图标渲染器不可用：' + (error instanceof Error ? error.message : String(error)));
    }
    const PetMulti = makePetUI({ h, useState, useEffect, useRef });
    const name = 'pet';
    const inject = ['slots', 'locale', 'connection'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function apply(ctx: any) {
      ctx.effect(() => ctx.locale.register(NS, dicts), 'dsh-pet: dictionaries');
      const t = ctx.locale.bind(NS);
      ctx.provide('petApi7340', {
        getState: getStateSnapshot,
        menuEvents: takeMenuEvents,
        pose: readPose,
        progress: readProgress,
      });
      ctx.effect(
        () =>
          initNotify({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            openSession: (sessionId: string) => (ctx as any).get?.('uiWorkspace')?.openSession?.(sessionId),
            sessionTitle: (sessionId: string) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const row = (ctx as any).get?.('sessions')?.list?.getSnapshot?.()?.byId?.[sessionId];
              const title = typeof row?.title === 'string' ? row.title.trim() : '';
              return title || undefined;
            },
          }),
        'dsh-pet: notifications',
      );
      ctx.effect(() => {
        const renderIcon = renderIconSvg;
        const icon = primitives?.IconSlidersTwoOutlineMedium;
        if (renderIcon === undefined || icon === undefined) {
          console.warn('[dsh-pet] 设置页导航图标不可用');
          return () => {};
        }
        return installSectionNavIcon({ label: () => t('nav'), renderSvg: () => renderIcon(icon) });
      }, 'dsh-pet: settings nav icon');
      ctx.slots.inject('shell.overlay', function* () {
        yield ctx.slots.register({ name: 'shell.overlay', id: 'pet', order: 1000 }, () => h(PetMulti, {}));
      });
      const PetConfigSection = makePetConfigSection({ h, useState, useEffect, useRef, useCallback, t });
      ctx.slots.inject('settings.section', function* () {
        yield ctx.slots.register(
          { name: 'settings.section', id: 'pet-config', order: 30, label: () => t('nav'), inject: () => ({ t }) },
          PetConfigSection,
        );
      });
      ctx.effect(() => {
        const card = registerPetCardShortcuts(ctx, (key) => t(key));
        return () => card.dispose();
      }, 'dsh-pet: shortcuts');
    }
    module.exports = { apply, inject, name };
    return module.exports;
  };
}
