/**
 * 说话 / 工作状态气泡（哑组件，仅文本）：余额、碎碎念配图与语音角标随功能删除。
 * 不发起请求，显隐与停留时长由 bubble-slots 控制。
 * @module dsh-pet/src/client/bubble
 */
import type { ReactNode } from 'react';
import type { jsx } from 'react/jsx-runtime';
import { ROUTE_PATH } from '../shared/constants.ts';
import type { SessionBubble } from '../shared/types.ts';

/** 气泡内联样式：白色半透明圆泡 + 底部小尾巴，盒子尺寸锚字号 --f。 */
const bubbleCss = [
  `@font-face{font-family:"ShangshouSoftCandy";src:url("${ROUTE_PATH}/font/上首软糖体.ttf") format("truetype");font-display:swap;font-weight:400}`,
  '.dsh-pet-bubble{position:absolute;left:50%;transform:translateX(-50%);' +
    'bottom:calc(100% - var(--dsh-pet-size)*0.108);' +
    'width:max-content;min-width:calc(var(--f)*5.7143);max-width:min(calc(var(--f)*16),100%);' +
    'box-sizing:content-box;' +
    'padding:calc(var(--f)*0.4835) calc(var(--f)*0.6593);' +
    'border-radius:calc(var(--f)*0.7692);' +
    'background:rgba(255,255,255,.92);' +
    '--f0:var(--dsh-pet-font-bubble,calc(var(--dsh-pet-size)*0.0455));--f:var(--f0);' +
    'color:#2b2b2b;font-family:var(--dsh-pet-font-family,"ShangshouSoftCandy","Yuanti SC","YouYuan","幼圆","Comic Sans MS","PingFang SC","Microsoft YaHei",sans-serif);' +
    'font-size:var(--f);line-height:1.6;z-index:3;pointer-events:none;' +
    'box-shadow:0 calc(var(--f)*0.1978) calc(var(--f)*0.7692) rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.08);' +
    'backdrop-filter:blur(6px);opacity:0;transition:opacity .25s ease;' +
    'white-space:normal;overflow-wrap:break-word}',
  '.dsh-pet-bubble::after{content:"";position:absolute;left:50%;bottom:calc(var(--f)*-0.3736);' +
    'transform:translateX(-50%);border:calc(var(--f)*0.3736) solid transparent;' +
    'border-top-color:rgba(255,255,255,.92);border-bottom:none}',
  '.dsh-pet-bubble.is-on{opacity:1}',
  '.dsh-pet-bubble.dsh-pet-whisper{font-size:calc(var(--f)*0.7473);' +
    'min-width:calc(var(--f)*2.1978);max-width:min(calc(var(--f)*10.989),100%)}',
  // 会话状态气泡：宠物上方向上堆叠多枚，最上面的最新。
  '.dsh-pet-sessions{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - var(--dsh-pet-size)*0.108);' +
    'display:flex;flex-direction:column;gap:calc(var(--f)*0.22);align-items:center;z-index:3;pointer-events:none;' +
    '--f0:var(--dsh-pet-font-bubble,calc(var(--dsh-pet-size)*0.0455));--f:var(--f0)}',
  '.dsh-pet-session-bubble{box-sizing:border-box;min-width:calc(var(--f)*9);max-width:min(calc(var(--f)*22),82vw);' +
    'padding:calc(var(--f)*0.42) calc(var(--f)*0.62);border-radius:calc(var(--f)*0.72);background:rgba(255,255,255,.92);' +
    'color:#2b2b2b;font-family:var(--dsh-pet-font-family,"ShangshouSoftCandy","Yuanti SC","PingFang SC","Microsoft YaHei",sans-serif);' +
    'font-size:var(--f);line-height:1.45;text-align:left;' +
    'box-shadow:0 calc(var(--f)*0.16) calc(var(--f)*0.6) rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.08);' +
    'backdrop-filter:blur(6px);white-space:normal;overflow-wrap:break-word}',
  '.dsh-pet-session-bubble .dst{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
  '.dsh-pet-session-bubble .dss{opacity:.6;font-size:calc(var(--f)*0.78)}',
  '.dsh-pet-session-bubble .dsk{font-size:calc(var(--f)*0.78);opacity:.82;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
];

/** 档位 → 中文状态词。 */
const STATE_WORD: Record<string, string> = {
  thinking: '思考中',
  working: '运行中',
  result: '出结果',
  waiting: '等待确认',
};

let cssInjected = false;
/** 注入一次气泡样式（多个卡片共享同一份）。 */
export function injectBubbleCss(): void {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-dsh-pet-bubble', '');
  style.textContent = bubbleCss.join('\n');
  document.head.appendChild(style);
}

/** 制造文本气泡组件（工厂）；say 与 work 共用，仅文本。 */
export function makeTextBubble(rt: { h: typeof jsx }): (props: { text: string; on: boolean }) => ReactNode {
  const { h } = rt;
  injectBubbleCss();
  return function TextBubble({ text, on }: { text: string; on: boolean }) {
    return h('div', { className: 'dsh-pet-bubble dsh-pet-whisper' + (on ? ' is-on' : ''), children: text });
  };
}

/** 制造“会话状态气泡”组件：宠物上方向上堆叠，all=false 只显示最新一个。 */
export function makeSessionBubbles(rt: {
  h: typeof jsx;
}): (props: { items: SessionBubble[]; all: boolean }) => ReactNode {
  const { h } = rt;
  injectBubbleCss();
  return function SessionBubbles({ items, all }: { items: SessionBubble[]; all: boolean }) {
    const shown = all ? items : items.slice(0, 1);
    if (shown.length === 0) return null;
    return h('div', {
      className: 'dsh-pet-sessions',
      children: shown.map((it) =>
        h('div', {
          key: it.id,
          className: 'dsh-pet-session-bubble',
          children: [
            h('div', { className: 'dst', children: it.title }),
            it.state ? h('div', { className: 'dss', children: STATE_WORD[it.state] ?? it.state }) : null,
            ...it.tools.map((tool, i) => h('div', { key: i, className: 'dsk', children: '· ' + tool })),
          ].filter((x) => x !== null),
        }),
      ),
    });
  };
}
