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
export declare function decideBubbleSlot(input: BubbleSlotInput): BubbleSlot;
/** 文本气泡组件。 */
export type TextBubbleComponent = (props: {
    text: string;
    on: boolean;
    small?: boolean;
}) => ReactNode;
/** 待办面板气泡组件。 */
export type TodoBubbleComponent = (props: {
    on: boolean;
    onClose: () => void;
}) => ReactNode;
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
    showWhisper(text: string, parts: {
        image?: string;
        url?: string;
    }, duration?: number): void;
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
export declare function createBubbleSlots(rt: BubbleSlotsRuntime, components: BubbleComponents): (input: BubbleSlotsInput) => BubbleSlots;
