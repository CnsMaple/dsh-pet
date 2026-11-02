/**
 * 选中宠物的配置卡（精简版）：名字 / 大小 / 显示位置、角落与偏移、工作状态联动开关。
 * 只编辑 main 条目的实例字段；文件宠物永不进这张卡。
 * @module dsh-pet/src/client/settings/pet-card
 */
import type { FunctionComponent } from 'react';
import type { Pet } from '../../shared/types.ts';
import type { SettingsRuntime } from './runtime.ts';
/** 宠物字段补丁：`position` 只带要改的子字段，其余字段走顶层。 */
export type PetPatch = Partial<Omit<Pet, 'position'>> & {
    position?: Partial<Pet['position']>;
};
/** 宠物卡的全部输入。 */
export interface PetCardProps {
    /** 当前选中的宠物；`null` 表示列表为空。 */
    pet: Pet | null;
    /** 表单是否禁用（保存中或配置还没加载好）。 */
    busy: boolean;
    /** 保存反馈，就近显示在卡片右上角。 */
    msg: {
        kind: 'ok' | 'err' | '';
        text: string;
    };
    /** 改选中宠物的字段。 */
    onChange: (patch: PetPatch) => void;
    /** 就近保存。 */
    onSave: () => void;
}
/**
 * 造宠物配置卡。
 *
 * @param rt - 注入的 react 能力与翻译函数。
 * @returns 卡片组件。
 */
export declare function makePetCard(rt: SettingsRuntime): FunctionComponent<PetCardProps>;
