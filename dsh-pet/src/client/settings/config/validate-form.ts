/**
 * 设置页表单校验：保存前把「宿主一定会 400 的组合」先就地拦下并给红字提示。
 * 规则与宿主一一对应（非法组合宿主回 400，等同于把错误推到一次网络往返之后才发现）。
 * 纯函数：只看传入的值，返回第一个不合格项的文案键，顺序即提示优先级。
 * @module dsh-pet/src/client/settings/config/validate-form
 */
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '../../../shared/fonts.ts';
import { isValidSizePercent } from '../../../shared/pet-size.ts';
import type { FontConfig, Pet } from '../../../shared/types.ts';

/** 校验失败时返回的文案键。 */
export type InvalidKey = 'invalid' | 'invalidFont';

/** 保存前要校验的全部表单值。 */
export interface FormValues {
  pets: readonly Pet[];
  font: FontConfig;
}

/** 宠物：宽度必须为正数、百分比缺省或是不小于 1 的数字、两个偏移必须是有限数（负数合法，宠物可以压出屏外）。 */
const petValid = (pet: Pet): boolean =>
  Number.isFinite(pet.size) &&
  pet.size > 0 &&
  (pet.sizePercent === undefined || isValidSizePercent(pet.sizePercent)) &&
  Number.isFinite(pet.position.marginX) &&
  Number.isFinite(pet.position.marginY);

/** 字体：种类必须在预设白名单内，字号在闭区间内。 */
const fontValid = (font: FontConfig): boolean =>
  typeof font.family === 'string' &&
  font.family.length <= 200 &&
  Number.isFinite(font.size) &&
  font.size >= FONT_SIZE_MIN &&
  font.size <= FONT_SIZE_MAX;

/**
 * 校验整张表单。
 *
 * @param values - 保存前要提交的全部值。
 * @returns 第一个不合格项的文案键；全部合格返回 `null`。
 */
export function validateForm(values: FormValues): InvalidKey | null {
  if (!values.pets.every(petValid)) return 'invalid';
  if (!fontValid(values.font)) return 'invalidFont';
  return null;
}
