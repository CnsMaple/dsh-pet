/**
 * 身体包围盒换算（HIT_BOX 命中框比例 → 视口像素）。碰撞求解已随物理引擎删除，仅保留几何。
 * @module dsh-pet/src/shared/physics/collide
 */
import { HIT_BOX } from '../constants.ts';

/** 身体包围盒（HIT_BOX 命中框比例换算到视口像素）。
 *  box = 宠物包围盒左上角；bottomPad = 舞台脚底垫高。 */
export const bodyPixelBox = (o: {
  x: number;
  y: number;
  size: number;
  bottomPad: number;
}): { left: number; top: number; right: number; bottom: number } => {
  const h = (o.size * 9) / 16;
  return {
    left: o.x + (HIT_BOX.x0 / 640) * o.size,
    top: o.y + o.bottomPad + (HIT_BOX.y0 / 360) * h,
    right: o.x + (HIT_BOX.x1 / 640) * o.size,
    bottom: o.y + o.bottomPad + (HIT_BOX.y1 / 360) * h,
  };
};
