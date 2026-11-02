/**
 * 说话 / 工作状态气泡（哑组件，仅文本）：余额、碎碎念配图与语音角标随功能删除。
 * 不发起请求，显隐与停留时长由 bubble-slots 控制。
 * @module dsh-pet/src/client/bubble
 */
import type { ReactNode } from 'react';
import type { jsx } from 'react/jsx-runtime';
import type { SessionBubble } from '../shared/types.ts';
/** 注入一次气泡样式（多个卡片共享同一份）。 */
export declare function injectBubbleCss(): void;
/** 制造文本气泡组件（工厂）；say 与 work 共用，仅文本。 */
export declare function makeTextBubble(rt: {
    h: typeof jsx;
}): (props: {
    text: string;
    on: boolean;
    small?: boolean;
}) => ReactNode;
/** 制造“会话状态气泡”组件：宠物上方向上堆叠，all=false 只显示最新一个。 */
export declare function makeSessionBubbles(rt: {
    h: typeof jsx;
}): (props: {
    items: SessionBubble[];
    all: boolean;
}) => ReactNode;
