/** 插件行 id（与 cordis.patch.yml 一致） */
export declare const name = "pet";
/** 需要的宿主服务：webServer（路由）+ connection（桌面 Helper「打开网站」用的已鉴权地址）。 */
export declare const inject: string[];
/** 宿主插件主体。 */
export declare function apply(ctx: any): void;
