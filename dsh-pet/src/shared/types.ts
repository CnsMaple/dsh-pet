/**
 * 与 config.jsonc 同构的类型模型：animations / animationWeights / pets 只此一份定义。
 * 运行时（浏览器半侧、桌面 Helper、设置页）直接使用这套结构，不额外造转换后的类型。
 * 纯类型与常量，无 React / DOM 依赖。
 * @module dsh-pet/src/shared/types
 */

/** 支持的角落。 */
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** 轴对齐矩形（左上角 + 宽高）：显示器工作区、窗口内容区、可视夹取区共用同一形状。 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 显示位置：决定宠物在浏览器半侧与桌面中的可见性。 */
export type PetDisplay = 'web' | 'desktop' | 'both' | 'none';

/** 移动动作：动作名 + 可选覆盖参数（未写字段取 moves.default）。 */
export interface MoveSpec {
  name: string;
  params?: Record<string, number>;
}

/** 移动池。 */
export interface MovesConfig {
  default: Record<string, number>;
  actions: MoveSpec[];
}

/** 随机动作分类（带文字、镜像会颠倒，facing=right 时跳过）。 */
export interface Category {
  id: string;
  weight: number;
  noMirror?: boolean;
  actions: string[];
}

/** 事件档位槽位：单个动画名（固定播放）或候选数组（触发时档内随机抽 1）。 */
export type EventSlot = string | string[];

/** 事件动画：事件名 → 档位槽位数组（数组顺序即档位顺序；不进随机链，只由代码显式触发）。 */
export type Events = Record<string, EventSlot[]>;

/** 一套睡觉动作：入睡 → 循环 → 醒来。
 *  三段各是候选数组（进入该段时随机抽一个）；整套由 animations.sleep 的外层数组随机挑选，
 *  三段必须来自同一套，否则会出现「蹲着入睡、趴着醒来」。 */
export interface SleepSet {
  start: string[];
  loop: string[];
  end: string[];
}

/** 动画权重。 */
export interface Weights {
  idle: number;
  turn: number;
  move: number;
}

/** config.jsonc 的 animations 段。 */
export interface Animations {
  idle: string[];
  turn: string[];
  drag: string[];
  clicks: string[];
  moves: MovesConfig;
  categories: Category[];
  events: Events;
  /** 睡觉动作套（可选）：没写 = 该条目没有睡觉功能，右键菜单不出现「睡觉」。
   *  写了就「整套随机 → 段内随机」取，结构见 {@link SleepSet}。 */
  sleep?: SleepSet[];
}

/** 一只宠物（与 config.jsonc 的 pets[i] 同形，position 嵌套）。
 *  可选段是渲染期派生或文件宠物专用：条目级字段由合并器在拍平时吹进每只实例，多实例共享；
 *  extra 标记文件宠物（设置页不可编辑、保存时排除，永不出现在持久化配置里）；
 *  assetRoot 是素材根（= 配置文件前缀），多实例共享同一素材目录，所以素材 URL 用它而不是 id。 */
export interface Pet {
  /** 唯一标识（程序定位用：素材、记忆、端点参数都按它；绝不重叠，冲突即配置错误） */
  id: string;
  /** 显示名（可重复）：悬浮提示、AI 人设、命令行定位都用它。
   *  缺失或留空按该宠物 id 处理并告警。 */
  name: string;
  size: number;
  /** 人物占屏宽上限（%，默认 20，不设上限）：按本体占屏换算出画框宽，`size` 仍是画框上限。
   *  100 ≈ 不限制（宽窗口下与按 px 显示一致）；填 150 人物会宽于屏幕，但画框仍被 `size` 夹住。
   *  小于 1 或非数字回落到 20。只作用于浏览器半侧——桌面透明窗始终用 `size`。 */
  sizePercent?: number;
  /** 是否启用工作状态联动：true = 监听 DSH 会话事件，按 animations.events.workStatus 切档位动画与气泡。
   *  缺失默认 true。监听不调用模型，无 KV cache 风险。 */
  workStatusEnabled: boolean;
  /** 宠物固定：true = 随机链不抽转向与移动两档（权重按 0 算，份额并入原地小动作），只影响随机链——
   *  右键点播、/anim 接口、事件动画、点击回应与拖拽一律照常。缺失默认 false。 */
  fixedEnabled: boolean;
  /** 显示位置（必填）：缺失即配置错误，代码不做兜底 */
  display: PetDisplay;
  position: { corner: Corner; marginX: number; marginY: number };
  animations?: Animations;
  animationWeights?: Weights;
  extra?: boolean;
  assetRoot?: string;
  /** 全局默认：是否锁定在当前屏幕——抛掷与自主漫游都只在当前所在那块屏内活动 */
  confineToScreen?: boolean;
  /** 条目级：睡觉期间被手动打扰时弹的拒绝台词（非空字符串数组，随机挑一句）。 */
  sleepRefuseTexts?: string[];
  /** 条目级：入睡时弹的台词（播「开始」时随机挑一句）。 */
  sleepStartTexts?: string[];
  /** 条目级：醒来时弹的台词（播「起来」时随机挑一句）。 */
  sleepEndTexts?: string[];
  /** 条目级：工作状态气泡文案（外层索引 = 档位 0..5，内层每档可多句随机抽）。
   *  整字段缺失 = 不弹工作状态文本，只播动画。 */
  workStatusTexts?: string[][];
  /** 全局默认：字体（种类 / 字号 / 是否随宠物大小缩放） */
  font?: FontConfig;
  /** 条目级：表情包清单（名称 → 给模型看的描述），合并器吹进每只实例、多实例共享。
   *  顺序即配置书写顺序，也就是 chatImageLimit 截取「前 N 张」的依据。 */
  memes?: Record<string, string>;
}

/** 一处「服务商 + 模型」选择（config.jsonc 的 whisperModel / chatModel 段）。
 *  provider 与 model 要么都为空（= 跟随当前对话的模型），要么都非空，只填一半是配置错误。 */
export interface ModelSelection {
  /** 服务商路由 id（与 DSH 模型选择器同一命名空间） */
  provider: string;
  /** 该服务商下的模型 id */
  model: string;
}

/** config.jsonc 的 font 段：字体（全局一份，所有宠物共用）。
 *  默认值 = shared/fonts.ts 的 DEFAULT_FONT（family='' 跟随 DSH 字体 / 21 / false）。
 *  整段替换：写了就整段用自己的，缺的子键不会从内置默认补回来。 */
export interface FontConfig {
  /** 字体名（自由文本，可写多个用逗号分隔）：影响气泡、悬浮提示等文字；空 = 跟随 DSH 字体 */
  family: string;
  /** 字号 px：只影响气泡与悬浮提示 */
  size: number;
  /** 字号是否随宠物大小等比缩放：false（默认）= 恒为 size px */
  followPet: boolean;
}

/** config.jsonc 全集——运行时直接使用。 */
export interface ClientConfig {
  /** 系统通知总开关：true = 对话完成 / 生成失败 / 输出截断 / 权限申请 / 用户选择时弹出通知；缺失即配置错误 */
  notificationsEnabled: boolean;
  /** 回合完成通知的弹出时机：never=从不；unfocused=仅窗口失焦时；always=总是。 */
  notificationTurnEnd: 'never' | 'unfocused' | 'always';
  /** 权限审批申请是否弹通知。 */
  notificationApproval: boolean;
  /** 模型提问是否弹通知。 */
  notificationQuestion: boolean;
  /** 提示音：default / classic / none。 */
  notificationSound: 'default' | 'classic' | 'none';
  /** 点击音效开关：true = 点击宠物时播放内置 click-duck.wav（音量 0.5、100ms 内去重），false = 静音。
   *  内置默认 false（默认静音，不突袭既有用户）。只读 main 条目这一份，pet pack 不单独覆盖。 */
  clickSoundEnabled: boolean;
  /** 桌面模式系统托盘开关：true = 桌面端启动后在通知区域（macOS 为菜单栏）建托盘，列出配置里全部宠物
   *  （含 display 为 web/none 的），勾选即可切回桌面；false = 不建。
   *  缺失默认 true。关掉后「把不在桌面的宠物叫回桌面」在桌面侧没有入口，只能走设置页或网页端右键菜单。 */
  trayEnabled: boolean;
  /** 是否锁定在当前屏幕：true = 宠物只在当前所在那块屏内活动——甩出去只在该屏内弹（屏缝当墙），
   *  自主漫游也只在屏内走；false = 跨屏飞行与跨屏行走。根字段，不属于 physics——它不改手感，只改「被允许去哪」。
   *  条目级，必填，缺失即配置错误。 */
  confineToScreen: boolean;
  pets: Pet[];
  animations: Animations;
  animationWeights: Weights;
  /** 事件刷新周期（秒）：事件名 → 间隔；balance = 余额数据刷新与动画触发间隔 */
}

/** 会话状态气泡（sections.sessions 的条目）：标题 + 档位 + 在途工具细节。 */
export interface SessionBubble {
  /** 会话 id。 */
  id: string;
  /** 会话标题（取不到时由宿主回退成「会话 · id末4位」）。 */
  title: string;
  /** 工作档位（thinking/working/result/waiting 等）。 */
  state: string;
  /** 在途工具的单行细节文案（最多若干条）。 */
  tools: string[];
}
