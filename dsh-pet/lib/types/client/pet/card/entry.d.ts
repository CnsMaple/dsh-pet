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
export declare function createCardEntry(rt: CardEntryRuntime): (input: CardEntryInput) => CardEntry;
