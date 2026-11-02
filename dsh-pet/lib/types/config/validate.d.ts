/** font 段校验：family ∈ 预设白名单、size 为区间内的有限数字、followPet 为布尔。
 *  与 physics 同口径：整段校验——任一子键缺失/非法即整段非法（告警 + 取默认），
 *  不做「缺子键逐个补默认」；对象字段一律整段替换。 */
export declare function fontValid(value: unknown): boolean;
/** 顶层标量字段的合法性（非法与缺失同处理：取默认值 + 告警） */
export declare function topFieldValid(key: string, value: unknown): boolean;
