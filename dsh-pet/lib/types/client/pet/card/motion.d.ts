/**
 * 一张宠物卡的运动装配（精简版）：包围盒、几何、自主走位与位置跟随。
 * 已删除 抛掷飞行 / Q 弹挤压 / 宠物碰撞 / 物理引擎（拖拽为纯跟手）。
 * @module dsh-pet/src/client/pet/card/motion
 */
import { type PositionFollow } from '../motion/position-follow.ts';
import { type Walk } from '../motion/walk.ts';
import type { CardLive } from './live.ts';
import type { CardStateApi } from './state.ts';
import type { MovesConfig } from '../../../shared/types.ts';
import type { RuntimePet } from '../types.ts';
import type * as ReactNS from 'react';
/** 运动用的当帧几何（由配置尺寸推出）。 */
export interface MotionMetrics {
    size: number;
    halfW: number;
    halfH: number;
    bottomPad: number;
    sideAllow: number;
}
/** 注入的 react 能力。 */
export interface CardMotionRuntime {
    useEffect: (effect: ReactNS.EffectCallback, deps?: ReactNS.DependencyList) => void;
    useRef: <T>(initial: T) => ReactNS.MutableRefObject<T>;
}
/** 运动装配的输入。 */
export interface CardMotionInput {
    card: CardStateApi;
    cfgRef: ReactNS.MutableRefObject<RuntimePet>;
    live: ReactNS.MutableRefObject<CardLive>;
    metrics: MotionMetrics;
    moves: MovesConfig;
    petId: string;
    root: () => HTMLDivElement | null;
    setCustomPos: CardStateApi['actions']['setCustomPos'];
    setOnce: (on: boolean) => void;
    setAnim: (anim: string) => void;
}
/** 运动装配的产物。 */
export interface CardMotion {
    metrics: () => MotionMetrics;
    center: () => {
        x: number;
        y: number;
    };
    box: () => {
        x: number;
        y: number;
    } | null;
    setBox: (box: {
        x: number;
        y: number;
    }) => void;
    stopMove: () => void;
    walk: Walk;
    posFollow: PositionFollow;
}
/**
 * 造运动装配的 hook。
 * @param rt - 注入的 react 能力。
 * @returns 接收装配输入的 hook，返回本卡的运动驱动面。
 */
export declare function createCardMotion(rt: CardMotionRuntime): (input: CardMotionInput) => CardMotion;
