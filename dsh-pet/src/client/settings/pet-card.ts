/**
 * 选中宠物的配置卡（精简版）：名字 / 大小 / 显示位置、角落与偏移、工作状态联动开关。
 * 只编辑 main 条目的实例字段；文件宠物永不进这张卡。
 * @module dsh-pet/src/client/settings/pet-card
 */
import type { ChangeEvent, FunctionComponent } from 'react';
import type { Corner, Pet, PetDisplay } from '../../shared/types.ts';
import { PET_DISPLAYS } from '../../shared/config.ts';
import type { SettingsRuntime } from './runtime.ts';
import { INPUT_CLASS, makeUiKit, numberInputProps } from './ui.ts';
import { makeSelect } from './panel/select.ts';

/** 宠物字段补丁：`position` 只带要改的子字段，其余字段走顶层。 */
export type PetPatch = Partial<Omit<Pet, 'position'>> & { position?: Partial<Pet['position']> };

/** 宠物卡的全部输入。 */
export interface PetCardProps {
  /** 当前选中的宠物；`null` 表示列表为空。 */
  pet: Pet | null;
  /** 表单是否禁用（保存中或配置还没加载好）。 */
  busy: boolean;
  /** 保存反馈，就近显示在卡片右上角。 */
  msg: { kind: 'ok' | 'err' | ''; text: string };
  /** 改选中宠物的字段。 */
  onChange: (patch: PetPatch) => void;
  /** 就近保存。 */
  onSave: () => void;
}

/** 四个角落的固定顺序；文案走 `corner.<corner>`。 */
const CORNERS: Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/**
 * 造宠物配置卡。
 *
 * @param rt - 注入的 react 能力与翻译函数。
 * @returns 卡片组件。
 */
export function makePetCard(rt: SettingsRuntime): FunctionComponent<PetCardProps> {
  const { h, t } = rt;
  const { tip, q, field, toggleCell } = makeUiKit({ h, t });
  const Select = makeSelect(rt);

  const numInput = (
    key: 'size' | 'marginX' | 'marginY',
    value: number,
    disabled: boolean,
    setter: (v: number) => void,
  ) =>
    h(
      'input',
      numberInputProps(value, setter, {
        step: key === 'size' ? '10' : '1',
        min: key === 'size' ? '120' : '',
        disabled,
      }),
    );

  return function PetCard(props: PetCardProps) {
    const { pet, busy, msg } = props;
    if (pet === null) return h('p', { className: 'dsh-pet-cfg__note', children: t('emptyPets') });
    return h('div', {
      className: 'dsh-pet-cfg__card',
      children: [
        h('div', {
          className: 'dsh-pet-cfg__cardHead',
          children: [
            h('span', { key: 't', className: 'dsh-pet-cfg__cardTitle', children: t('petCardTitle') }),
            q(t('petCardHint')),
            h('div', {
              key: 'acts',
              style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' },
              children: [
                msg.text
                  ? h('span', {
                      key: 'msg',
                      className: 'dsh-pet-cfg__msg' + (msg.kind === 'err' ? ' is-err' : ''),
                      children: msg.text,
                    })
                  : null,
                h('button', {
                  key: 'sv',
                  type: 'button',
                  onClick: props.onSave,
                  disabled: busy,
                  className: 'dsh-pet-cfg__btn is-primary is-sm',
                  ...tip(t('saveHotkey')),
                  children: t('save'),
                }),
              ],
            }),
          ],
        }),

        h('div', {
          className: 'dsh-pet-cfg__grid3',
          children: [
            field(
              t('nameLabel'),
              h('input', {
                type: 'text',
                className: INPUT_CLASS,
                value: String(pet.name ?? ''),
                disabled: busy,
                maxLength: 50,
                onChange: (e: ChangeEvent<HTMLInputElement>) => props.onChange({ name: e.target.value }),
              }),
              t('nameHint'),
            ),
            field(
              t('sizeLabel'),
              numInput('size', pet.size, busy, (v) => props.onChange({ size: v })),
              t('sizeHint'),
            ),
            field(
              t('displayLabel'),
              h(Select, {
                label: t('displayLabel'),
                value: pet.display,
                options: PET_DISPLAYS.map((d) => ({ id: d, label: t('display.' + d) })),
                disabled: busy,
                onChange: (id: string) => props.onChange({ display: id as PetDisplay }),
              }),
              t('displayHint'),
            ),
          ],
        }),

        h('div', {
          className: 'dsh-pet-cfg__grid3',
          children: [
            field(
              t('cornerLabel'),
              h(Select, {
                label: t('cornerLabel'),
                value: pet.position.corner,
                options: CORNERS.map((c) => ({ id: c, label: t('corner.' + c) })),
                disabled: busy,
                onChange: (id: string) => props.onChange({ position: { corner: id as Corner } }),
              }),
              t('cornerHint'),
            ),
            field(
              t('marginX'),
              numInput('marginX', pet.position.marginX, busy, (v) => props.onChange({ position: { marginX: v } })),
              t('marginXHint'),
            ),
            field(
              t('marginY'),
              numInput('marginY', pet.position.marginY, busy, (v) => props.onChange({ position: { marginY: v } })),
              t('marginYHint'),
            ),
          ],
        }),

        h('div', {
          className: 'dsh-pet-cfg__grid2',
          children: [
            toggleCell('workStatusEnabled', !!pet.workStatusEnabled, busy, (v) =>
              props.onChange({ workStatusEnabled: v }),
            ),
          ],
        }),
      ],
    });
  };
}
