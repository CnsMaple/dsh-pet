/**
 * 字体：font.family 自由文本 → CSS 字体栈，以及字号换算。
 *
 * 默认 family 为空 = 跟随 DSH 的字体（渲染端用 --dsw-font-family 继承，取不到再走系统栈）。
 * 不再有内置预设白名单：用户想用什么字体就填什么字体名（可写多个，逗号分隔）。
 * @module dsh-pet/src/shared/fonts
 */
import type { FontConfig } from './types.ts';

/** 字号合法区间（px，含端点）：与宿主半侧 fontValid 同一口径。 */
export const FONT_SIZE_MIN = 4;
export const FONT_SIZE_MAX = 200;

/** family 为空时使用的字体栈：优先继承 DSH 的字体变量，取不到再退系统 UI 栈。 */
export const DEFAULT_FONT_STACK =
  'var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif)';

/** font 段默认值：空 family = 跟随 DSH 字体；21px；字号不随宠物大小缩放。 */
export const DEFAULT_FONT: FontConfig = {
  family: '',
  size: 21,
  followPet: false,
};

/** 把自由文本 family 转成 CSS 字体栈：空 = 默认栈；非空原样使用（用户自行写全字体栈）。 */
export function fontStackOf(family: string | undefined): string {
  const value = (family ?? '').trim();
  return value === '' ? DEFAULT_FONT_STACK : value;
}

/** 基准宠物宽度（px）：字号换算的锚点。 */
export const FONT_REF_SIZE = 462;

/** 基准宽度下的气泡正文字号（px）＝ 0.0455 × 462 ≈ 21.02。 */
export const BUBBLE_FONT_BASE_PX = 0.0455 * FONT_REF_SIZE;

/** 基准宽度下的悬浮提示字号（px）＝ 0.026 × 462 ≈ 12.01。 */
export const TIP_FONT_BASE_PX = 0.026 * FONT_REF_SIZE;

/** 气泡与悬浮提示的最终字号（px），两端共用同一份换算以免漂移。 */
export function resolveFontPx(font: FontConfig | undefined, size: number): { bubble: number; tip: number } {
  const own = Number(font?.size);
  const ratio = Number.isFinite(own) && own > 0 ? own / DEFAULT_FONT.size : 1;
  const w = Number(size);
  const follow = font?.followPet === true;
  const scale = follow && Number.isFinite(w) && w > 0 ? w / FONT_REF_SIZE : 1;
  return {
    bubble: BUBBLE_FONT_BASE_PX * ratio * scale,
    tip: TIP_FONT_BASE_PX * ratio * scale,
  };
}

/** 气泡底边探出宠物盒顶边的比例（对应气泡 CSS 的 bottom: calc(100% - size×0.108)）。 */
export const BUBBLE_OVERLAP_RATIO = 0.108;

/** 气泡布局度量（em，基准 = 气泡正文最终字号 --f）。 */
export const BUBBLE_METRICS = {
  lineHeight: 1.6,
  padY: 0.4835,
  subScale: 0.7692,
  imgWidth: 7.4725,
  imgMargin: 0.3736,
  imgMaxRatio: 1,
} as const;

/** 气泡最大高度（px）。 */
export function bubbleMaxHeightPx(font: FontConfig | undefined, size: number): number {
  const f = resolveFontPx(font, size).bubble;
  const m = BUBBLE_METRICS;
  return (
    m.padY * 2 * f + m.lineHeight * f + m.lineHeight * m.subScale * f + m.imgWidth * m.imgMaxRatio * f + m.imgMargin * f
  );
}

/** 桌面窗口的最小上边距（px）。 */
export function bubbleTopMarginPx(font: FontConfig | undefined, size: number): number {
  const overlap = (Number(size) || 0) * BUBBLE_OVERLAP_RATIO;
  return Math.max(0, Math.ceil(bubbleMaxHeightPx(font, size) - overlap));
}
