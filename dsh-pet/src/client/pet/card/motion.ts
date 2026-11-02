/**
 * 一张宠物卡的运动装配（精简版）：包围盒、几何、自主走位与位置跟随。
 * 已删除 抛掷飞行 / Q 弹挤压 / 宠物碰撞 / 物理引擎（拖拽为纯跟手）。
 * @module dsh-pet/src/client/pet/card/motion
 */
import { createPositionFollow, type PositionFollow } from '../motion/position-follow.ts';
import { createWalk, type Walk } from '../motion/walk.ts';
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
  center: () => { x: number; y: number };
  box: () => { x: number; y: number } | null;
  setBox: (box: { x: number; y: number }) => void;
  stopMove: () => void;
  walk: Walk;
  posFollow: PositionFollow;
}

/**
 * 造运动装配的 hook。
 * @param rt - 注入的 react 能力。
 * @returns 接收装配输入的 hook，返回本卡的运动驱动面。
 */
export function createCardMotion(rt: CardMotionRuntime) {
  const { useRef } = rt;

  return function useCardMotion(input: CardMotionInput): CardMotion {
    const { card, cfgRef, live, metrics, moves, root, setAnim, setOnce, setCustomPos } = input;

    const motionRef = useRef<MotionMetrics>(metrics);
    motionRef.current = metrics;
    const movesRef = useRef<MovesConfig>(moves);
    movesRef.current = moves;

    const boxRef = useRef<{ x: number; y: number } | null>(null);

    const currentCenterX = (): number => {
      const cp = card.customPosRef.current;
      if (cp) return cp.rx * window.innerWidth;
      const rootEl = root();
      if (rootEl) return rootEl.getBoundingClientRect().left + motionRef.current.halfW;
      return window.innerWidth - 24 - motionRef.current.halfW;
    };
    const currentCenterY = (): number => {
      const cp = card.customPosRef.current;
      if (cp) return cp.ry * window.innerHeight;
      const rootEl = root();
      if (rootEl) return rootEl.getBoundingClientRect().top + motionRef.current.halfH;
      return window.innerHeight - 20 - motionRef.current.halfH;
    };

    const posFollowRef = useRef<PositionFollow | null>(null);
    posFollowRef.current ??= createPositionFollow({
      root,
      box: () => boxRef.current,
      setBox: (box) => {
        boxRef.current = box;
      },
      commit: setCustomPos,
      viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
      half: () => ({ w: motionRef.current.halfW, h: motionRef.current.halfH }),
      spring: () => cfgRef.current.physics.throwPower,
      isDragging: () => live.current.drag.isActive(),
      takeOver: () => {
        walkRef.current?.stop();
        posFollowRef.current?.stop();
      },
    });
    const posFollow = posFollowRef.current;

    const walkRef = useRef<Walk | null>(null);
    walkRef.current ??= createWalk({
      root,
      center: () => ({ x: currentCenterX(), y: currentCenterY() }),
      metrics: () => motionRef.current,
      moves: () => movesRef.current,
      facing: () => card.facingRef.current,
      viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
      isFlying: () => false,
      play: (name) => {
        setOnce(true);
        setAnim(name);
      },
      setBox: (box) => {
        boxRef.current = box;
      },
      commit: setCustomPos,
    });
    const walk = walkRef.current;

    const stopMove = (): void => {
      walkRef.current?.stop();
      posFollowRef.current?.stop();
    };

    const center = (): { x: number; y: number } => ({ x: currentCenterX(), y: currentCenterY() });

    live.current.walk = walk;
    live.current.posFollow = posFollow;
    live.current.center = center;
    live.current.stopMove = stopMove;

    return {
      box: () => boxRef.current,
      center,
      metrics: () => motionRef.current,
      posFollow,
      setBox: (box) => {
        boxRef.current = box;
      },
      stopMove,
      walk,
    };
  };
}
