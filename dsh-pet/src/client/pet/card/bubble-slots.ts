/**
 * 气泡单槽（精简版）：说话、工作状态、待办三种。余额与碎碎念语音随功能删除。
 * 不变量：同一时刻只渲染一个气泡，优先级依次为 待办面板、终态任务、说话、非终态任务。
 * @module dsh-pet/src/client/pet/card/bubble-slots
 */
import { BUBBLE_DURATION_MS } from '../timings.ts';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type * as ReactNS from 'react';
import type { jsx } from 'react/jsx-runtime';

/** 当前该挂哪个气泡；none 表示都不成立。 */
export type BubbleSlot = 'todo' | 'work-terminal' | 'say' | 'work' | 'none';

/** 优先级判定的输入。 */
export interface BubbleSlotInput {
  todoOn: boolean;
  workTerminal: boolean;
  workOn: boolean;
  workText: string | null;
  workStatusEnabled: boolean;
  sayOn: boolean;
  sayText: string | null;
  /** 有会话气泡时让位：不显示工作状态气泡。 */
  suppressWork: boolean;
}

/** 决定当前挂哪个气泡。 */
export function decideBubbleSlot(input: BubbleSlotInput): BubbleSlot {
  if (input.todoOn) return 'todo';
  // 工作状态气泡只保留「完成/失败」终态那个（庆祝用），非终态不再弹工作气泡（交给会话气泡）。
  if (!input.suppressWork) {
    if (input.workTerminal && input.workOn && input.workText && input.workStatusEnabled) return 'work-terminal';
  }
  if (input.sayOn && input.sayText) return 'say';
  return 'none';
}

/** 文本气泡组件。 */
export type TextBubbleComponent = (props: { text: string; on: boolean; small?: boolean }) => ReactNode;
/** 待办面板气泡组件。 */
export type TodoBubbleComponent = (props: { on: boolean; onClose: () => void }) => ReactNode;

/** 注入的 react 能力。 */
export interface BubbleSlotsRuntime {
  h: typeof jsx;
  useState: <T>(init: T) => [T, Dispatch<SetStateAction<T>>];
  useRef: <T>(initial: T) => ReactNS.MutableRefObject<T>;
  useEffect: (effect: ReactNS.EffectCallback, deps?: ReactNS.DependencyList) => void;
}

/** 气泡组件集。 */
export interface BubbleComponents {
  textBubble: TextBubbleComponent;
  todoBubble: TodoBubbleComponent;
}

/** 每次渲染由 PetCard 提供的视图输入。 */
export interface BubbleSlotsInput {
  workStatusEnabled: boolean;
  workTerminal: boolean;
  /** 有会话气泡时让位：不显示工作状态气泡。 */
  suppressWork: boolean;
}

/** 气泡单槽对外的读写面。 */
export interface BubbleSlots {
  showWhisper(text: string, parts: { image?: string; url?: string }, duration?: number): void;
  clearWhisper(): void;
  updateWorkText(text: string | null): void;
  lightWork(terminal: boolean): void;
  hideWork(): void;
  resetWork(): void;
  showTodo(): void;
  hideTodo(): void;
  toggleTodo(): void;
  node(): ReactNode;
}

/**
 * 制造气泡单槽的 hook。
 * @param rt - 注入的 react 能力。
 * @param components - 文本气泡与待办气泡组件。
 * @returns 接收视图输入的 hook。
 */
export function createBubbleSlots(rt: BubbleSlotsRuntime, components: BubbleComponents) {
  const { h, useState, useRef, useEffect } = rt;
  const TextBubble = components.textBubble;
  const TodoBubble = components.todoBubble;

  return function useBubbleSlots(input: BubbleSlotsInput): BubbleSlots {
    const [sayOn, setSayOn] = useState(false);
    const [sayText, setSayText] = useState<string | null>(null);
    const sayTimerRef = useRef<number | null>(null);
    const [todoOn, setTodoOn] = useState(false);
    const [workOn, setWorkOn] = useState(false);
    const [workText, setWorkText] = useState<string | null>(null);
    const workTimerRef = useRef<number | null>(null);

    useEffect(
      () => () => {
        if (sayTimerRef.current !== null) window.clearTimeout(sayTimerRef.current);
        if (workTimerRef.current !== null) window.clearTimeout(workTimerRef.current);
      },
      [],
    );

    const armSayTimeout = (duration: number) => {
      if (sayTimerRef.current !== null) window.clearTimeout(sayTimerRef.current);
      sayTimerRef.current = window.setTimeout(() => setSayOn(false), duration);
    };
    const showWhisper = (text: string, _parts: { image?: string; url?: string }, duration?: number): void => {
      // duration 为 0：字面意思「不显示」，不改动当前气泡。
      if (duration === 0) return;
      setSayText(text);
      setSayOn(true);
      armSayTimeout(duration ?? BUBBLE_DURATION_MS);
    };
    const clearWhisper = (): void => {
      if (sayTimerRef.current !== null) window.clearTimeout(sayTimerRef.current);
      setSayOn(false);
      setSayText(null);
    };

    const armWorkTimeout = () => {
      if (workTimerRef.current !== null) window.clearTimeout(workTimerRef.current);
      workTimerRef.current = window.setTimeout(() => setWorkOn(false), BUBBLE_DURATION_MS);
    };
    const lightWork = (terminal: boolean): void => {
      setWorkOn(true);
      if (terminal) armWorkTimeout();
      else if (workTimerRef.current !== null) {
        window.clearTimeout(workTimerRef.current);
        workTimerRef.current = null;
      }
    };
    const hideWork = (): void => setWorkOn(false);
    const resetWork = (): void => {
      setWorkOn(false);
      setWorkText(null);
    };

    const showTodo = (): void => setTodoOn(true);
    const hideTodo = (): void => setTodoOn(false);
    const toggleTodo = (): void => setTodoOn((v) => !v);

    const node = (): ReactNode => {
      const slot = decideBubbleSlot({
        todoOn,
        workTerminal: input.workTerminal,
        workOn,
        workText,
        workStatusEnabled: input.workStatusEnabled,
        sayOn,
        sayText,
        suppressWork: input.suppressWork,
      });
      if (slot === 'todo') return h(TodoBubble, { on: todoOn, onClose: hideTodo });
      if (slot === 'say') return sayText === null ? null : h(TextBubble, { text: sayText, on: sayOn });
      if (slot === 'work' || slot === 'work-terminal') {
        // 完成/失败气泡用普通字号（small:false），不再比其它气泡小。
        return workText === null ? null : h(TextBubble, { text: workText, on: workOn, small: false });
      }
      return null;
    };

    return {
      clearWhisper,
      hideTodo,
      hideWork,
      lightWork,
      node,
      resetWork,
      showTodo,
      showWhisper,
      toggleTodo,
      updateWorkText: setWorkText,
    };
  };
}
