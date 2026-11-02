/**
 * 右键菜单与悬浮提示入口（精简版）：已移除 对话弹窗 / 截图 / 按住说话 / 配图。
 * 菜单叶子交给 menu-actions 派发；浮层句柄只在本模块持有，卸载时统一关闭。
 * @module dsh-pet/src/client/pet/card/entry
 */
import { displayOfHotkey } from '../../../shared/display-hotkey.ts';
import { SLEEP_HOTKEY_HINT, isSleepHotkey } from '../../../shared/sleep-hotkey.ts';
import { TODO_HOTKEY_HINT, isTodoHotkey } from '../../../shared/todo/hotkey.ts';
import type { PetDisplay } from '../../../shared/types.ts';
import {
  buildMenuTree,
  buildMoreBranch,
  displayMenuBranch,
  mountContextMenu,
  type MenuNode,
} from '../../../shared/menu.ts';
import { TOOLTIP_GAP_RATIO, tooltipPlacement } from '../../../shared/tooltip.ts';
import type { MenuMoreItem } from '../../../shared/menu.ts';
import type { CardLive } from './live.ts';
import type { CardMotion } from './motion.ts';
import type { CardStateApi } from './state.ts';
import type { Drag } from '../motion/drag.ts';
import type { MenuActions } from '../menu-actions.ts';
import type { RuntimePet } from '../types.ts';
import type * as ReactNS from 'react';

/** 注入的 react 能力。 */
export interface CardEntryRuntime {
  useEffect: (effect: ReactNS.EffectCallback, deps?: ReactNS.DependencyList) => void;
  useRef: <T>(initial: T) => ReactNS.MutableRefObject<T>;
}

/** 浮层入口的输入。 */
export interface CardEntryInput {
  card: CardStateApi;
  cfgRef: ReactNS.MutableRefObject<RuntimePet>;
  live: ReactNS.MutableRefObject<CardLive>;
  motion: CardMotion;
  drag: Drag;
  menuItemsRef: ReactNS.MutableRefObject<MenuMoreItem[]>;
  runMenuAction: MenuActions['run'];
  showTodo: () => void;
  toggleTodo: () => void;
  tipRef: ReactNS.MutableRefObject<HTMLDivElement | null>;
}

/** 浮层入口对外的读写面。 */
export interface CardEntry {
  placeTip: (clientX: number, clientY: number) => void;
  handleContextMenu: (e: ReactNS.MouseEvent<HTMLDivElement>) => void;
  openTodo: () => void;
  onPointerEnter: (e: ReactNS.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
}

/**
 * 造浮层入口的 hook。
 * @param rt - 注入的 react 能力。
 * @returns 菜单与提示的入口。
 */
export function createCardEntry(rt: CardEntryRuntime) {
  const { useEffect, useRef } = rt;

  return function useCardEntry(input: CardEntryInput): CardEntry {
    const { card, cfgRef, drag, live, menuItemsRef, motion, runMenuAction, showTodo, tipRef, toggleTodo } = input;
    const menuRef = useRef<{ close: () => void } | null>(null);

    const placeTip = (clientX: number, clientY: number): void => {
      const tipEl = tipRef.current;
      if (!tipEl) return;
      const viewport = document.documentElement;
      const p = tooltipPlacement(
        { x: clientX, y: clientY },
        { w: tipEl.offsetWidth, h: tipEl.offsetHeight },
        { x: 0, y: 0, w: viewport.clientWidth, h: viewport.clientHeight },
        motion.metrics().size * TOOLTIP_GAP_RATIO,
      );
      tipEl.style.left = p.x + 'px';
      tipEl.style.top = p.y + 'px';
    };

    useEffect(
      () => () => {
        if (menuRef.current) {
          menuRef.current.close();
          menuRef.current = null;
        }
      },
      [],
    );

    const openTodo = (): void => showTodo();

    const hoverRef = useRef(false);
    const toggleTodoRef = useRef(toggleTodo);
    toggleTodoRef.current = toggleTodo;
    const toggleSleepRef = useRef<() => void>(() => {});
    toggleSleepRef.current = () => {
      const asleep = live.current.flow?.sleeping() ?? false;
      runMenuAction(asleep ? { label: '起来', action: 'wake' } : { label: '睡觉', action: 'sleep' });
    };
    const switchDisplayRef = useRef<(display: PetDisplay) => void>(() => {});
    switchDisplayRef.current = (display) => {
      runMenuAction({ label: '显示位置', action: 'set-display', display });
    };

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent): void => {
        if (!hoverRef.current) return;
        const display = displayOfHotkey(e);
        if (display !== undefined) {
          e.preventDefault();
          switchDisplayRef.current(display);
          return;
        }
        if (isSleepHotkey(e)) {
          e.preventDefault();
          toggleSleepRef.current();
          return;
        }
        if (!isTodoHotkey(e)) return;
        e.preventDefault();
        toggleTodoRef.current();
      };
      document.addEventListener('keydown', onKeyDown, true);
      return () => document.removeEventListener('keydown', onKeyDown, true);
    }, []);

    live.current.placeTip = placeTip;
    live.current.tipOn = () => card.state.tipOn;

    const handleContextMenu = (e: ReactNS.MouseEvent<HTMLDivElement>): void => {
      const more = buildMoreBranch(menuItemsRef.current);
      const asleep = live.current.flow?.sleeping() ?? false;
      const canSleep = (cfgRef.current.animations.sleep ?? []).length > 0;
      const sleepItem: MenuNode = asleep
        ? { label: '起来', action: 'wake', hint: SLEEP_HOTKEY_HINT }
        : { label: '睡觉', action: 'sleep', hint: SLEEP_HOTKEY_HINT };
      const tools: MenuNode[] = [
        { label: '待办事项', action: 'todo', hint: TODO_HOTKEY_HINT },
        ...(canSleep ? [sleepItem] : []),
      ];
      const tail: MenuNode[] = [displayMenuBranch(), { label: '回到初始位置', action: 'home' }];
      const tree: MenuNode[] = [
        ...tools,
        ...buildMenuTree(cfgRef.current.animations),
        ...tail,
        ...(more ? [more] : []),
      ];
      if (!tree.length) return;
      e.preventDefault();
      e.stopPropagation();
      if (drag.isActive() || drag.justDragged()) return;
      motion.stopMove();
      if (menuRef.current) menuRef.current.close();
      menuRef.current = mountContextMenu({
        tree,
        x: e.clientX,
        y: e.clientY,
        onAction: runMenuAction,
        onClose: () => {
          if (menuRef.current) menuRef.current = null;
        },
      });
    };

    return {
      handleContextMenu,
      onPointerEnter: (e) => {
        hoverRef.current = true;
        placeTip(e.clientX, e.clientY);
        card.actions.setTipOn(true);
      },
      onPointerLeave: () => {
        hoverRef.current = false;
        card.actions.setTipOn(false);
      },
      openTodo,
      placeTip,
    };
  };
}
