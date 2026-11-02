;(()=>{

//#region src/shared/constants.ts
const CANVAS_H = 360;
const FEET_Y = 330;
const HIT_BOX = {
	x0: 200,
	y0: 50,
	x1: 440,
	y1: 335
};
const DRAG_THRESHOLD = 5;
const SLINGSHOT_DOUBLE_MS = 200;
const PET_REF_WIDTH = 462;
const ROUTE_SEGMENT = "/dsh-pet-7340";
function mountPrefixOf(baseURI) {
	if (baseURI === void 0 || baseURI === "") return "";
	try {
		const url = new URL(baseURI);
		if (url.protocol !== "http:" && url.protocol !== "https:") return "";
		return url.pathname.replace(/\/+$/, "");
	} catch {
		return "";
	}
}
function routePathOf(baseURI) {
	return mountPrefixOf(baseURI) + ROUTE_SEGMENT;
}
const ROUTE_PATH = routePathOf(typeof document === "undefined" ? void 0 : document.baseURI);
const ANIMATION_EXT = ".webm";

//#endregion
//#region src/shared/hotkey.ts
function isTypingTarget(target) {
	const el = target;
	if (!el || typeof el.tagName !== "string") return false;
	const tag = el.tagName.toLowerCase();
	if (tag === "input" || tag === "textarea" || tag === "select") return true;
	return el.isContentEditable === true;
}
function isBareKey(e, key) {
	if (e.ctrlKey || e.metaKey || e.altKey) return false;
	if (String(e.key).toLowerCase() !== key) return false;
	return !isTypingTarget(e.target);
}

//#endregion
//#region src/shared/display-hotkey.ts
const DISPLAY_ORDER = [
	"web",
	"desktop",
	"both",
	"none"
];
const DISPLAY_HOTKEY_HINTS = DISPLAY_ORDER.map((_, index) => String(index + 1) + " 键");
function displayOfHotkey(e) {
	for (let index = 0; index < DISPLAY_ORDER.length; index += 1) if (isBareKey(e, String(index + 1))) return DISPLAY_ORDER[index];
	return void 0;
}

//#endregion
//#region src/shared/menu/tree.ts
/** 睡着时仍然放行的菜单动作：维护类、「叫醒它」本身，以及第三方菜单项。
*  第三方要做什么由它自己决定——真去驱动宠物时会带占用锁调接口，宿主闸门在那一层再判
*  （锁优先）。在渲染端先拦掉，等于让「更多」里的第三方入口在睡觉时整体失效。 */
const SLEEP_ALLOWED_ACTIONS = [
	"sleep",
	"wake",
	"home",
	"set-display",
	"reload",
	"third-party"
];
const isSleepAllowedAction = (action) => action !== void 0 && SLEEP_ALLOWED_ACTIONS.includes(action);
/** 四个显示位置的菜单文案；键是 {@link DISPLAY_ORDER} 的元素，顺序以那边为准。 */
const DISPLAY_LABELS = {
	web: "仅网页",
	desktop: "仅桌面",
	both: "两者",
	none: "都不"
};
const displayMenuBranch = () => ({
	label: "显示位置",
	children: DISPLAY_ORDER.map((display, index) => ({
		label: DISPLAY_LABELS[display],
		action: "set-display",
		display,
		hint: DISPLAY_HOTKEY_HINTS[index]
	}))
});
const MORE_MENU_LABEL = "更多";
function readMenuItems(data, surface) {
	if (!data || typeof data !== "object") return [];
	const items = data.items;
	if (!Array.isArray(items)) return [];
	const out = [];
	for (const item of items) {
		if (!item || typeof item !== "object") continue;
		const rec = item;
		const rawTarget = rec.target;
		const target = rawTarget === "web" || rawTarget === "desktop" || rawTarget === "both" ? rawTarget : "both";
		if (target !== "both" && target !== surface) continue;
		const owner = rec.owner;
		const label = rec.label;
		if (typeof owner === "string" && owner !== "" && typeof label === "string" && label !== "") out.push({
			owner,
			label
		});
	}
	return out;
}
function buildMoreBranch(items) {
	const groups = new Map();
	for (const item of items) {
		const list = groups.get(item.owner);
		if (list) list.push(item.label);
		else groups.set(item.owner, [item.label]);
	}
	const children = [];
	for (const [owner, labels$1] of groups) if (labels$1.length === 1) children.push({
		label: labels$1[0],
		action: "third-party",
		owner
	});
	else children.push({
		label: owner,
		children: labels$1.map((label) => ({
			label,
			action: "third-party",
			owner
		}))
	});
	return children.length > 0 ? {
		label: MORE_MENU_LABEL,
		children
	} : null;
}
/** 事件名 → 分类标签（无映射时用事件名本身）。 */
const EVENT_LABELS = {
	balance: "余额档位",
	whisper: "碎碎念",
	workStatus: "工作状态"
};
const leaf = (anim) => ({
	label: anim,
	anim
});
function buildMenuTree(animations) {
	const groups = [];
	const pools = [
		["待机", animations.idle],
		["转向", animations.turn],
		["拖拽", animations.drag],
		["点击回应", animations.clicks],
		["移动", animations.moves.actions.map((m) => m.name)]
	];
	for (const [label, pool] of pools) if (pool.length) groups.push({
		label,
		children: pool.map(leaf)
	});
	const cats = (animations.categories ?? []).filter((c) => c.actions.length > 0);
	for (const c of cats) groups.push({
		label: c.id,
		children: c.actions.map(leaf)
	});
	const events = animations.events ?? {};
	for (const key of Object.keys(events)) {
		const pool = events[key] ?? [];
		const names = [];
		for (const slot of pool) if (typeof slot === "string") names.push(slot);
		else names.push(...slot);
		if (names.length) groups.push({
			label: EVENT_LABELS[key] ?? key,
			children: names.map(leaf)
		});
	}
	if (!groups.length) return [];
	return [{
		label: "动作",
		children: groups
	}];
}
function isNoMirrorAnimation(categories, anim) {
	return (categories ?? []).some((c) => c.noMirror === true && c.actions.includes(anim));
}

//#endregion
//#region src/shared/menu/css.ts
const MENU_CSS = [
	".dsh-pet-menu{position:fixed;left:0;top:0;z-index:2147483000;color:#2b2b2b;font-size:13px;line-height:1.5;",
	"font-family:'Microsoft YaHei UI','Segoe UI','PingFang SC',sans-serif;user-select:none;pointer-events:auto}",
	".dsh-pet-menu,.dsh-pet-menu *{box-sizing:border-box}",
	".dsh-pet-menu-column{position:absolute;min-width:150px;max-width:300px;padding:4px;",
	"background:rgba(255,255,255,.98);border:1px solid rgba(0,0,0,.12);border-radius:8px;",
	"box-shadow:0 8px 28px rgba(0,0,0,.2);max-height:min(62vh,460px);overflow-y:auto;",
	"scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.22) transparent}",
	".dsh-pet-menu-column::-webkit-scrollbar{width:8px;height:8px}",
	".dsh-pet-menu-column::-webkit-scrollbar-track{background:transparent}",
	".dsh-pet-menu-column::-webkit-scrollbar-thumb{background:rgba(0,0,0,.16);border-radius:4px;",
	"border:2px solid transparent;background-clip:content-box}",
	".dsh-pet-menu-column::-webkit-scrollbar-thumb:hover{background:rgba(43,99,255,.4);",
	"border:2px solid transparent;background-clip:content-box}",
	".dsh-pet-menu-column::-webkit-scrollbar-corner{background:transparent}",
	".dsh-pet-menu-item{position:relative;display:flex;align-items:center;justify-content:space-between;",
	"gap:14px;padding:5px 12px;border-radius:6px;white-space:nowrap;cursor:default}",
	".dsh-pet-menu-item:hover{background:rgba(43,99,255,.14)}",
	".dsh-pet-menu-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}",
	".dsh-pet-menu-thumb{width:28px;height:28px;border-radius:4px;object-fit:cover;flex:none;",
	"background:rgba(0,0,0,.06)}",
	".dsh-pet-menu-item-pic{gap:8px}",
	".dsh-pet-menu-hint{color:#9aa0a6;font-size:12px;flex:none;white-space:nowrap}",
	".dsh-pet-menu-arrow{color:#9aa0a6;font-size:12px;flex:none}"
].join("");

//#endregion
//#region src/shared/menu/position.ts
/** 面板与边界、面板之间的间距（px）。 */
const PANEL_GAP = 4;
function pickPanelPosition(input) {
	const { panel, item, parent, others, clamp } = input;
	const minLeft = clamp.x + PANEL_GAP;
	const minTop = clamp.y + PANEL_GAP;
	const maxLeft = clamp.x + clamp.w - PANEL_GAP - panel.w;
	const maxTop = clamp.y + clamp.h - PANEL_GAP - panel.h;
	/** 夹进 clamp；面板比 clamp 还宽/高时贴左上角。 */
	const clampX = (v) => Math.max(minLeft, Math.min(v, Math.max(minLeft, maxLeft)));
	const clampY = (v) => Math.max(minTop, Math.min(v, Math.max(minTop, maxTop)));
	const hitsOther = (left, top) => others.some((b) => left < b.right && left + panel.w > b.left && top < b.bottom && top + panel.h > b.top);
	const fitsClamp = (left, top) => left >= minLeft - .5 && left <= maxLeft + .5 && top >= minTop - .5 && top <= maxTop + .5;
	const topAtItem = clampY(item.top);
	const topAtParent = clampY(parent.top);
	const cands = [
		{
			left: parent.right + PANEL_GAP,
			top: topAtItem
		},
		{
			left: parent.left - PANEL_GAP - panel.w,
			top: topAtItem
		},
		{
			left: parent.right + PANEL_GAP,
			top: topAtParent
		},
		{
			left: parent.left - PANEL_GAP - panel.w,
			top: topAtParent
		}
	];
	const ideal = cands.find((cd) => fitsClamp(cd.left, cd.top) && !hitsOther(cd.left, cd.top));
	if (ideal) return ideal;
	const fitted = cands.map((cd) => ({
		left: clampX(cd.left),
		top: clampY(cd.top)
	})).find((cd) => !hitsOther(cd.left, cd.top));
	if (fitted) return fitted;
	return {
		left: clampX(parent.right + PANEL_GAP),
		top: clampY(topAtItem)
	};
}

//#endregion
//#region src/shared/menu/mount.ts
function isBranchNode(n) {
	return "children" in n && Array.isArray(n.children);
}
function mountContextMenu(opts) {
	const { tree, x, y, onAction, onClose, clamp } = opts;
	const c = clamp && Number.isFinite(clamp.x + clamp.y + clamp.w + clamp.h) ? clamp : {
		x: 0,
		y: 0,
		w: window.innerWidth,
		h: window.innerHeight
	};
	const root = document.createElement("div");
	root.className = "dsh-pet-menu";
	root.style.left = "0px";
	root.style.top = "0px";
	root.addEventListener("contextmenu", (e) => e.preventDefault());
	let closed = false;
	/** 每个面板当前展开的子面板（无 = 未展开）；hideChain 会沿链清除 */
	const openChild = new Map();
	/** 指针整体离开菜单树的兜底关闭定时器（root mouseover 重新进入即取消） */
	let leaveTimer = null;
	/** 关闭某面板及其后代面板整条链（display:none + 清 openChild 链） */
	const hideChain = (panel) => {
		panel.style.display = "none";
		const child = openChild.get(panel);
		if (child) {
			openChild.delete(panel);
			hideChain(child);
		}
	};
	/** 把子面板摆到触发项旁边：优先父面板右侧，放不下翻到父面板左侧，
	*  且不与任何已展开面板重叠；贴边时夹进 clamp。 */
	const showPanel = (panel, item) => {
		const rect = item.getBoundingClientRect();
		panel.style.left = "";
		panel.style.top = "";
		panel.style.display = "block";
		const parentEl = item.parentElement;
		const pr = parentEl ? parentEl.getBoundingClientRect() : rect;
		const pick$1 = pickPanelPosition({
			panel: {
				w: panel.offsetWidth,
				h: panel.offsetHeight
			},
			item: {
				left: rect.left,
				right: rect.right,
				top: rect.top
			},
			parent: {
				left: pr.left,
				right: pr.right,
				top: pr.top
			},
			others: Array.from(root.querySelectorAll(".dsh-pet-menu-column")).filter((p) => p !== panel && p.style.display !== "none").map((p) => {
				const b = p.getBoundingClientRect();
				return {
					left: b.left,
					top: b.top,
					right: b.right,
					bottom: b.bottom
				};
			}),
			clamp: {
				x: c.x,
				y: c.y,
				w: c.w,
				h: c.h
			}
		});
		panel.style.left = pick$1.left + "px";
		panel.style.top = pick$1.top + "px";
	};
	/** 构建一层面板；分支项的子面板平级挂到 root 下、不嵌套。
	*  面板先入 DOM、子面板后入，层级越深绘制越靠上（子菜单盖在父菜单上层）。 */
	const buildPanel = (nodes) => {
		const panel = document.createElement("div");
		panel.className = "dsh-pet-menu-column";
		panel.style.display = "none";
		if (clamp) panel.style.maxHeight = Math.min(460, Math.max(120, c.h - 16)) + "px";
		root.appendChild(panel);
		for (const node of nodes) {
			const item = document.createElement("div");
			item.className = "dsh-pet-menu-item";
			if (isBranchNode(node)) {
				item.classList.add("dsh-pet-menu-branch");
				const label = document.createElement("span");
				label.className = "dsh-pet-menu-label";
				label.textContent = node.label;
				const arrow = document.createElement("span");
				arrow.className = "dsh-pet-menu-arrow";
				arrow.textContent = "▸";
				item.appendChild(label);
				item.appendChild(arrow);
				const childPanel = buildPanel(node.children);
				item.addEventListener("mouseenter", () => {
					const prev = openChild.get(panel);
					if (prev && prev !== childPanel) hideChain(prev);
					openChild.set(panel, childPanel);
					showPanel(childPanel, item);
				});
			} else {
				if (node.thumb) {
					const thumb = document.createElement("img");
					thumb.className = "dsh-pet-menu-thumb";
					thumb.src = node.thumb;
					thumb.alt = "";
					thumb.draggable = false;
					thumb.loading = "lazy";
					thumb.decoding = "async";
					item.appendChild(thumb);
					item.classList.add("dsh-pet-menu-item-pic");
				}
				const label = document.createElement("span");
				label.className = "dsh-pet-menu-label";
				label.textContent = node.label;
				item.appendChild(label);
				if (node.hint) {
					const hint = document.createElement("span");
					hint.className = "dsh-pet-menu-hint";
					hint.textContent = node.hint;
					item.appendChild(hint);
				}
				item.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					close();
					onAction(node);
				});
			}
			panel.appendChild(item);
		}
		return panel;
	};
	const rootPanel = buildPanel(tree);
	rootPanel.style.display = "block";
	document.body.appendChild(root);
	rootPanel.style.left = "";
	rootPanel.style.top = "";
	const rw = rootPanel.offsetWidth;
	const rh = rootPanel.offsetHeight;
	rootPanel.style.left = Math.max(c.x + 4, Math.min(x, c.x + c.w - rw - 4)) + "px";
	rootPanel.style.top = Math.max(c.y + 4, Math.min(y, c.y + c.h - rh - 4)) + "px";
	root.addEventListener("mouseleave", () => {
		if (leaveTimer !== null) window.clearTimeout(leaveTimer);
		leaveTimer = window.setTimeout(() => {
			leaveTimer = null;
			close();
		}, 200);
	});
	root.addEventListener("mouseover", () => {
		if (leaveTimer !== null) {
			window.clearTimeout(leaveTimer);
			leaveTimer = null;
		}
	});
	const onDocPointerDown = (e) => {
		if (closed) return;
		if (root.contains(e.target)) return;
		close();
	};
	const onDocKeyDown = (e) => {
		if (closed) return;
		if (e.key === "Escape") close();
	};
	document.addEventListener("mousedown", onDocPointerDown, true);
	document.addEventListener("keydown", onDocKeyDown, true);
	const close = () => {
		if (closed) return;
		closed = true;
		if (leaveTimer !== null) window.clearTimeout(leaveTimer);
		leaveTimer = null;
		document.removeEventListener("mousedown", onDocPointerDown, true);
		document.removeEventListener("keydown", onDocKeyDown, true);
		root.remove();
		if (onClose) onClose();
	};
	return {
		el: root,
		close
	};
}

//#endregion
//#region src/shared/tooltip.ts
const TOOLTIP_CLASS = "pet-tooltip";
const TOOLTIP_GAP_RATIO = .022;
function tooltipPlacement(cursor, tip, bounds, gap) {
	const clamp = (v, lo, hi) => hi < lo ? lo : Math.min(Math.max(v, lo), hi);
	const rightMax = bounds.x + bounds.w;
	const bottomMax = bounds.y + bounds.h;
	let x = cursor.x + gap;
	if (x + tip.w > rightMax) x = cursor.x - gap - tip.w;
	x = clamp(x, bounds.x, rightMax - tip.w);
	let y = cursor.y + gap;
	if (y + tip.h > bottomMax) y = cursor.y - gap - tip.h;
	y = clamp(y, bounds.y, bottomMax - tip.h);
	return {
		x,
		y
	};
}
const TOOLTIP_CSS = [
	".pet-tooltip{",
	"position:fixed;left:0;top:0;",
	"max-width:calc(var(--dsh-pet-size,var(--pet-size,462px))*0.8);",
	"padding:calc(var(--dsh-pet-size,var(--pet-size,462px))*0.010) calc(var(--dsh-pet-size,var(--pet-size,462px))*0.021);",
	"border-radius:calc(var(--dsh-pet-size,var(--pet-size,462px))*0.016);",
	"background:rgba(255,255,255,.96);color:#1f1f1f;",
	"border:1px solid rgba(0,0,0,.12);",
	"font-family:var(--dsh-pet-font-family,\"ShangshouSoftCandy\",\"Yuanti SC\",\"YouYuan\",\"幼圆\",\"Comic Sans MS\",\"PingFang SC\",\"Microsoft YaHei\",sans-serif);",
	"font-size:var(--dsh-pet-font-tip,calc(var(--dsh-pet-size,var(--pet-size,462px))*0.026));line-height:1.4;",
	"white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
	"box-shadow:0 calc(var(--dsh-pet-size,var(--pet-size,462px))*0.004) calc(var(--dsh-pet-size,var(--pet-size,462px))*0.013) rgba(0,0,0,.18);",
	"opacity:0;transition:opacity .12s ease;pointer-events:none;z-index:2}",
	".pet-tooltip.is-on{opacity:1}"
].join("");

//#endregion
//#region src/client/pet/css.ts
/** 宠物页面样式表。 */
const PET_CSS = [
	".dsh-pet-root{position:fixed;z-index:40;pointer-events:none;user-select:none}",
	".dsh-pet-root[data-corner=\"bottom-right\"]{right:var(--dsh-pet-mx,24px);bottom:var(--dsh-pet-my,0)}",
	".dsh-pet-root[data-corner=\"bottom-left\"]{left:var(--dsh-pet-mx,24px);bottom:var(--dsh-pet-my,0)}",
	".dsh-pet-root[data-corner=\"top-right\"]{right:var(--dsh-pet-mx,24px);top:var(--dsh-pet-my,0)}",
	".dsh-pet-root[data-corner=\"top-left\"]{left:var(--dsh-pet-mx,24px);top:var(--dsh-pet-my,0)}",
	".dsh-pet-stage{position:relative;width:var(--dsh-pet-size,462px);height:calc(var(--dsh-pet-size,462px)*9/16);pointer-events:none}",
	".dsh-pet-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;opacity:0;transition:opacity .18s ease;transform-origin:center}",
	".dsh-pet-video.is-front{opacity:1}",
	`.dsh-pet-hit{position:absolute;pointer-events:auto;cursor:url("${ROUTE_PATH}/pic/cursor-grab.png") 16 16, grab;z-index:1;touch-action:none;-webkit-user-select:none;-webkit-touch-callout:none}`,
	`.dsh-pet-hit.dragging{cursor:url("${ROUTE_PATH}/pic/cursor-grabbing.png") 16 16, grabbing}`,
	"@media (prefers-reduced-motion: reduce){.dsh-pet-video{transition:none}}",
	MENU_CSS,
	TOOLTIP_CSS
].join("\n");
/** 注入去重用的标记值，写在 `<style>` 的 `data-plugin-css` 上。 */
const cssTag = "dsh-pet/style.css";
function injectPetCss() {
	if (typeof document === "undefined") return;
	if (document.querySelector("style[data-plugin-css=\"" + cssTag + "\"]") !== null) return;
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-pet";
	tag.dataset.pluginCss = cssTag;
	tag.textContent = PET_CSS;
	document.head.appendChild(tag);
}

//#endregion
//#region src/shared/physics/constants.ts
const SPRING_K = 200;
const SPRING_C = 30;
const GRAVITY = 1400;
const RESTITUTION = .78;
const GROUND_FRICTION = 2.5;
const DEFAULT_PHYSICS = {
	gravity: GRAVITY,
	restitution: RESTITUTION,
	groundFriction: GROUND_FRICTION,
	ceilingBounce: true,
	throwPower: 1,
	petCollision: true,
	hapticEnabled: true,
	tiltGravity: true,
	shakeThrow: true
};
const DEFAULT_THROW_POWER = 1;

//#endregion
//#region src/shared/displays.ts
const rectRight = (r) => r.x + r.width;
const rectBottom = (r) => r.y + r.height;
const pointInRect = (r, x, y) => x >= r.x && x < rectRight(r) && y >= r.y && y < rectBottom(r);
const rectAtPoint = (rects, x, y) => {
	for (const r of rects) if (pointInRect(r, x, y)) return r;
	return null;
};

//#endregion
//#region src/shared/physics/spring.ts
const springStep = (v, x, target, dt, power = DEFAULT_THROW_POWER) => v + ((target - x) * SPRING_K - v * SPRING_C) * power * dt;

//#endregion
//#region src/shared/physics/collide.ts
const bodyPixelBox = (o) => {
	const h = o.size * 9 / 16;
	return {
		left: o.x + HIT_BOX.x0 / 640 * o.size,
		top: o.y + o.bottomPad + HIT_BOX.y0 / 360 * h,
		right: o.x + HIT_BOX.x1 / 640 * o.size,
		bottom: o.y + o.bottomPad + HIT_BOX.y1 / 360 * h
	};
};

//#endregion
//#region src/client/pet/motion/geometry.ts
function derivePetMetrics(size) {
	return {
		halfW: size / 2,
		halfH: size * 9 / 16 / 2,
		bottomPad: size * (9 / 16) * (CANVAS_H - FEET_Y) / CANVAS_H,
		sideAllow: HIT_BOX.x0 / 640 * size
	};
}
function centerToBox(center, viewport, half) {
	return {
		x: center.rx * viewport.width - half.w,
		y: center.ry * viewport.height - half.h
	};
}
function boxToRatio(box, viewport, half) {
	return {
		rx: (box.x + half.w) / viewport.width,
		ry: (box.y + half.h) / viewport.height
	};
}
const MIN_REACHABLE_PX = 24;
function clampReachableBox(box, viewport, body) {
	const inset = bodyPixelBox({
		x: 0,
		y: 0,
		size: body.size,
		bottomPad: body.bottomPad
	});
	const minX = MIN_REACHABLE_PX - inset.right;
	const maxX = viewport.width - inset.left - MIN_REACHABLE_PX;
	const minY = MIN_REACHABLE_PX - inset.bottom;
	const maxY = viewport.height - inset.top - MIN_REACHABLE_PX;
	const height = body.size * 9 / 16;
	return {
		x: clampAxis(box.x, minX, maxX, (viewport.width - body.size) / 2),
		y: clampAxis(box.y, minY, maxY, (viewport.height - height) / 2)
	};
}
/**
* 单轴夹取：视口与命中区加起来还容不下两倍下限时区间反向，改为居中，避免夹到错误的一侧。
*
* @param value - 待夹坐标（px）。
* @param lo - 允许下限（px）。
* @param hi - 允许上限（px）。
* @param centered - 区间反向时的居中坐标（px）。
* @returns 夹取后的坐标（px）。
*/
function clampAxis(value, lo, hi, centered) {
	return lo > hi ? centered : Math.min(Math.max(value, lo), hi);
}
function petStageStyle(dragging, bottomPad) {
	return dragging ? { transform: "none" } : { transform: "translateY(" + bottomPad + "px)" };
}
function petRootStyle(customPos, viewport, half) {
	if (!customPos) return {};
	return {
		left: customPos.rx * viewport.width - half.w + "px",
		top: customPos.ry * viewport.height - half.h + "px",
		right: "auto",
		bottom: "auto"
	};
}
const PET_HIT_STYLE = {
	left: HIT_BOX.x0 / 640 * 100 + "%",
	top: HIT_BOX.y0 / 360 * 100 + "%",
	width: (HIT_BOX.x1 - HIT_BOX.x0) / 640 * 100 + "%",
	height: (HIT_BOX.y1 - HIT_BOX.y0) / 360 * 100 + "%"
};

//#endregion
//#region src/client/pet/card/view.ts
/** 两路视频的共同属性：静音、内联播放并自动播放。 */
const VIDEO_PROPS = {
	muted: true,
	playsInline: true,
	autoPlay: true
};
function makeCardView(rt) {
	const { h } = rt;
	return function CardView(props) {
		return h("div", {
			ref: props.rootRef,
			className: "dsh-pet-root",
			"data-corner": props.corner,
			"data-facing": props.facing,
			style: Object.assign({
				"--dsh-pet-size": props.size + "px",
				"--dsh-pet-mx": props.marginX + "px",
				"--dsh-pet-my": props.marginY + "px",
				"--dsh-pet-font-bubble": props.fontBubblePx + "px",
				"--dsh-pet-font-tip": props.fontTipPx + "px"
			}, props.rootStyle),
			children: [
				props.bubble,
				h("div", {
					ref: props.stageRef,
					className: "dsh-pet-stage",
					style: props.stageStyle,
					children: [
						h("video", Object.assign({}, VIDEO_PROPS, {
							ref: props.videoARef,
							className: "dsh-pet-video is-front"
						})),
						h("video", Object.assign({}, VIDEO_PROPS, {
							ref: props.videoBRef,
							className: "dsh-pet-video"
						})),
						h("div", {
							className: "dsh-pet-hit",
							style: PET_HIT_STYLE,
							onClick: props.onClick,
							onPointerDown: props.onPointerDown,
							onPointerMove: props.onPointerMove,
							onPointerUp: props.onPointerUp,
							onPointerCancel: props.onPointerUp,
							onPointerEnter: props.onPointerEnter,
							onPointerLeave: props.onPointerLeave,
							onContextMenu: props.onContextMenu,
							"aria-label": props.name
						})
					]
				}),
				h("div", {
					ref: props.tipRef,
					className: TOOLTIP_CLASS + (props.tipOn ? " is-on" : ""),
					"aria-hidden": "true",
					children: props.name
				})
			]
		});
	};
}

//#endregion
//#region src/shared/pickers.ts
const pick = (pool, exclude) => {
	const entries = exclude ? pool.filter((n) => n !== exclude) : pool;
	const src = entries.length ? entries : pool;
	return src[Math.floor(Math.random() * src.length)];
};
const pickSlot = (slot, exclude) => {
	if (typeof slot === "string") return slot;
	const entries = exclude === void 0 ? slot : slot.filter((n) => n !== exclude);
	const src = entries.length ? entries : slot;
	return src[Math.floor(Math.random() * src.length)];
};
const slotIncludes = (slot, anim) => typeof slot === "string" ? slot === anim : slot.includes(anim);
const poolIncludes = (pool, anim) => pool.some((slot) => slotIncludes(slot, anim));
const isEventAnim = (events, anim) => events ? Object.values(events).some((pool) => poolIncludes(pool, anim)) : false;
const nextWorkStatusAnim = (pool, current$1) => {
	const idx = pool.findIndex((slot$1) => slotIncludes(slot$1, current$1));
	if (idx === -1) return null;
	const slot = pool[idx];
	if (!Array.isArray(slot) || slot.length <= 1) return null;
	return pickSlot(slot, current$1);
};
const randomBetween = (min, max) => Math.floor(min + Math.random() * (max - min));
const pickWeightedCategory = (categories, facing) => {
	const cats = categories.filter((c) => c.actions.length > 0);
	if (!cats.length) return null;
	const filtered = cats.filter((c) => !(c.noMirror && facing === "right"));
	const eligible = filtered.length ? filtered : cats;
	const totalW = eligible.reduce((s, c) => s + c.weight, 0) || 1;
	let t = Math.random() * totalW;
	for (const c of eligible) {
		t -= c.weight;
		if (t <= 0) return c;
	}
	return eligible[eligible.length - 1];
};
const rollKind = (roll, w, opts) => {
	const turn = opts?.fixed ? 0 : w.turn;
	const move = opts?.fixed ? 0 : w.move;
	const topEnd = (w.idle + turn + move) / 100;
	if (roll < w.idle / 100) return "idle";
	if (roll < (w.idle + turn) / 100) return "turn";
	if (roll < topEnd) return "move";
	return "action";
};
const pickCategoryAction = (categories, idlePool, facing, current$1) => {
	const cat = pickWeightedCategory(categories, facing);
	if (!cat) return {
		id: "FALLBACK",
		name: pick(idlePool, current$1)
	};
	return {
		id: cat.id,
		name: pick(cat.actions, current$1)
	};
};

//#endregion
//#region src/shared/work-status.ts
const WORK_STATUS_STATES = [
	"thinking",
	"working",
	"result",
	"waiting",
	"success",
	"error"
];
const WORK_STATUS_INDEX = {
	thinking: 0,
	working: 1,
	result: 2,
	waiting: 3,
	success: 4,
	error: 5
};
function toWorkStatus(raw) {
	if (!raw || typeof raw !== "object") return null;
	const r = raw;
	const state = r.state === null || typeof r.state === "string" && WORK_STATUS_STATES.includes(r.state) ? r.state : null;
	return {
		state,
		task: typeof r.task === "string" ? r.task : null
	};
}

//#endregion
//#region src/shared/state.ts
/** 叶子规范化：形状不对（非对象或 counter 非数字）→ null，不让脏数据进渲染层。 */
function normLeaf(value) {
	if (!value || typeof value !== "object") return null;
	const leaf$1 = value;
	if (typeof leaf$1.counter !== "number" || !Number.isFinite(leaf$1.counter)) return null;
	return {
		counter: leaf$1.counter,
		data: leaf$1.data ?? null
	};
}
async function fetchState(baseUrl = ROUTE_PATH + "/state", wait) {
	try {
		const url = wait ? `${baseUrl}?since=${wait.since}&timeout=${wait.timeoutMs}` : baseUrl;
		const res = await fetch(url, { cache: "no-store" });
		if (!res.ok) return null;
		const raw = await res.json().catch(() => null);
		if (!raw || typeof raw !== "object" || raw.ok === false) return null;
		const sections = {};
		const rawSections = raw.sections && typeof raw.sections === "object" ? raw.sections : {};
		for (const [name, value] of Object.entries(rawSections)) {
			const leaf$1 = normLeaf(value);
			if (leaf$1) sections[name] = leaf$1;
		}
		const pets = {};
		const rawPets = raw.pets && typeof raw.pets === "object" ? raw.pets : {};
		for (const [petId, entry] of Object.entries(rawPets)) {
			if (!entry || typeof entry !== "object") continue;
			const leaves = {};
			for (const [name, value] of Object.entries(entry)) {
				const leaf$1 = normLeaf(value);
				if (leaf$1) leaves[name] = leaf$1;
			}
			pets[petId] = leaves;
		}
		return {
			counter: typeof raw.counter === "number" && Number.isFinite(raw.counter) ? raw.counter : void 0,
			sections,
			pets
		};
	} catch {
		return null;
	}
}
/** 遍历 S 的所有叶子（sections 在前、pets 在后）。 */
function* walkLeaves(s) {
	for (const [name, leaf$1] of Object.entries(s.sections ?? {})) yield ["sections." + name, leaf$1];
	for (const [petId, leaves] of Object.entries(s.pets ?? {})) for (const [name, leaf$1] of Object.entries(leaves ?? {})) yield ["pets." + petId + "." + name, leaf$1];
}
function flattenCounters(s) {
	const out = {};
	for (const [path, leaf$1] of walkLeaves(s)) out[path] = leaf$1.counter;
	return out;
}
function takeChanged(s, baseline) {
	const out = [];
	for (const [path, leaf$1] of walkLeaves(s)) {
		if (baseline[path] === leaf$1.counter) continue;
		baseline[path] = leaf$1.counter;
		out.push({
			path,
			leaf: leaf$1
		});
	}
	return out;
}
/** 分段叶子名的全集；新增 section 叶子时与 {@link SectionLeafName} 一起改。 */
const SECTION_LEAF_NAMES = [
	"config",
	"workStatus",
	"notify",
	"menu"
];
/** 宠物叶子名的全集；新增宠物叶子时与 {@link PetLeafName} 一起改。 */
const PET_LEAF_NAMES = [
	"say",
	"anim",
	"position",
	"lock",
	"sleep"
];
/** 把字符串收窄成分段叶子名。 */
function isSectionLeafName(name) {
	return SECTION_LEAF_NAMES.includes(name);
}
/** 把字符串收窄成宠物叶子名。 */
function isPetLeafName(name) {
	return PET_LEAF_NAMES.includes(name);
}
function resolveLeafPath(path) {
	if (path.startsWith("sections.")) {
		const name$1 = path.slice(9);
		return isSectionLeafName(name$1) ? {
			where: "section",
			name: name$1
		} : null;
	}
	if (!path.startsWith("pets.")) return null;
	const rest = path.slice(5);
	const dot = rest.lastIndexOf(".");
	if (dot <= 0) return null;
	const name = rest.slice(dot + 1);
	return isPetLeafName(name) ? {
		where: "pet",
		name,
		petId: rest.slice(0, dot)
	} : null;
}
function readSay(leaf$1) {
	if (!leaf$1.data || typeof leaf$1.data !== "object") return null;
	const d = leaf$1.data;
	if (d.clear === true) return { kind: "clear" };
	if (typeof d.text !== "string" || !d.text) return null;
	return {
		kind: "say",
		text: d.text,
		image: typeof d.image === "string" ? d.image : void 0,
		url: typeof d.url === "string" ? d.url : void 0,
		duration: typeof d.duration === "number" && Number.isFinite(d.duration) && d.duration >= 0 ? d.duration : void 0,
		anim: typeof d.anim === "boolean" ? d.anim : void 0,
		voiceTo: d.voiceTo === "web" || d.voiceTo === "desktop" ? d.voiceTo : void 0
	};
}
function readWorkStatus(leaf$1) {
	return toWorkStatus(leaf$1.data);
}
function readAnim(leaf$1) {
	if (!leaf$1.data || typeof leaf$1.data !== "object") return null;
	const d = leaf$1.data;
	const name = typeof d.name === "string" && d.name ? d.name : void 0;
	const url = typeof d.url === "string" && d.url ? d.url : void 0;
	if (name === void 0 && url === void 0) return null;
	return {
		name,
		url,
		playbackId: typeof d.playbackId === "string" && d.playbackId ? d.playbackId : void 0,
		facing: d.facing === "left" || d.facing === "right" ? d.facing : void 0
	};
}
function readLock(leaf$1) {
	if (!leaf$1.data || typeof leaf$1.data !== "object") return null;
	const d = leaf$1.data;
	if (d.locked === false) return { locked: false };
	if (d.locked !== true) return null;
	if (typeof d.expiresAt !== "number" || !Number.isFinite(d.expiresAt)) return null;
	return {
		locked: true,
		expiresAt: d.expiresAt
	};
}
function readSleep(leaf$1) {
	if (!leaf$1.data || typeof leaf$1.data !== "object") return null;
	const d = leaf$1.data;
	if (d.sleeping === false) return { sleeping: false };
	if (d.sleeping !== true) return null;
	for (const name of [
		d.start,
		d.loop,
		d.end
	]) if (typeof name !== "string" || name === "") return null;
	return {
		sleeping: true,
		start: d.start,
		loop: d.loop,
		end: d.end
	};
}
function readPosition(leaf$1) {
	if (!leaf$1.data || typeof leaf$1.data !== "object") return null;
	const d = leaf$1.data;
	if (typeof d.x !== "number" || !Number.isFinite(d.x)) return null;
	if (typeof d.y !== "number" || !Number.isFinite(d.y)) return null;
	if (d.mode !== "instant" && d.mode !== "spring" && d.mode !== "line") return null;
	if (d.mode === "line") {
		if (typeof d.duration !== "number" || !Number.isFinite(d.duration) || d.duration < 0) return null;
		return {
			x: d.x,
			y: d.y,
			mode: "line",
			duration: d.duration
		};
	}
	return {
		x: d.x,
		y: d.y,
		mode: d.mode,
		duration: 0
	};
}
async function postAction(baseUrl, body) {
	try {
		const res = await fetch(baseUrl, {
			method: "POST",
			...body === void 0 ? {} : {
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			}
		});
		if (!res.ok) return false;
		const data = await res.json().catch(() => null);
		return data?.ok === true;
	} catch {
		return false;
	}
}

//#endregion
//#region src/shared/fonts.ts
const FONT_SIZE_MIN = 4;
const FONT_SIZE_MAX = 200;
const DEFAULT_FONT_STACK = "var(--dsw-font-family, system-ui, -apple-system, \"Segoe UI\", \"Microsoft YaHei\", \"PingFang SC\", sans-serif)";
const DEFAULT_FONT = {
	family: "",
	size: 21,
	followPet: false
};
function fontStackOf(family) {
	const value = (family ?? "").trim();
	return value === "" ? DEFAULT_FONT_STACK : value;
}
const FONT_REF_SIZE = 462;
const BUBBLE_FONT_BASE_PX = .0455 * FONT_REF_SIZE;
const TIP_FONT_BASE_PX = .026 * FONT_REF_SIZE;
function resolveFontPx(font, size) {
	const own = Number(font?.size);
	const ratio = Number.isFinite(own) && own > 0 ? own / DEFAULT_FONT.size : 1;
	const w = Number(size);
	const follow = font?.followPet === true;
	const scale = follow && Number.isFinite(w) && w > 0 ? w / FONT_REF_SIZE : 1;
	return {
		bubble: BUBBLE_FONT_BASE_PX * ratio * scale,
		tip: TIP_FONT_BASE_PX * ratio * scale
	};
}

//#endregion
//#region src/shared/pet-size.ts
/** 人物本体宽度占画框宽度的比例；由命中框反推（240/640），不在别处再写一份 0.375。 */
const BODY_WIDTH_RATIO = (HIT_BOX.x1 - HIT_BOX.x0) / 640;
const SIZE_PERCENT_MIN = 1;
const SIZE_PERCENT_DEFAULT = 20;
function isValidSizePercent(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= SIZE_PERCENT_MIN;
}
function resolvePetSizePx(sizePx, sizePercent, viewportWidthPx) {
	const percent = sizePercent ?? SIZE_PERCENT_DEFAULT;
	if (!isValidSizePercent(percent)) return sizePx;
	if (!Number.isFinite(viewportWidthPx) || viewportWidthPx <= 0) return sizePx;
	const bodyWidthPx = viewportWidthPx * percent / 100;
	return Math.min(sizePx, bodyWidthPx / BODY_WIDTH_RATIO);
}

//#endregion
//#region src/client/bubble.ts
/** 气泡内联样式：白色半透明圆泡 + 底部小尾巴，盒子尺寸锚字号 --f。 */
const bubbleCss = [
	`@font-face{font-family:"ShangshouSoftCandy";src:url("${ROUTE_PATH}/font/上首软糖体.ttf") format("truetype");font-display:swap;font-weight:400}`,
	".dsh-pet-bubble{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - var(--dsh-pet-size)*0.108);width:max-content;min-width:calc(var(--f)*5.7143);max-width:min(calc(var(--f)*16),100%);box-sizing:content-box;padding:calc(var(--f)*0.4835) calc(var(--f)*0.6593);border-radius:calc(var(--f)*0.7692);background:rgba(255,255,255,.92);--f0:var(--dsh-pet-font-bubble,calc(var(--dsh-pet-size)*0.0455));--f:var(--f0);color:#2b2b2b;font-family:var(--dsh-pet-font-family,\"ShangshouSoftCandy\",\"Yuanti SC\",\"YouYuan\",\"幼圆\",\"Comic Sans MS\",\"PingFang SC\",\"Microsoft YaHei\",sans-serif);font-size:var(--f);line-height:1.6;z-index:3;pointer-events:none;box-shadow:0 calc(var(--f)*0.1978) calc(var(--f)*0.7692) rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.08);backdrop-filter:blur(6px);opacity:0;transition:opacity .25s ease;white-space:normal;overflow-wrap:break-word}",
	".dsh-pet-bubble::after{content:\"\";position:absolute;left:50%;bottom:calc(var(--f)*-0.3736);transform:translateX(-50%);border:calc(var(--f)*0.3736) solid transparent;border-top-color:rgba(255,255,255,.92);border-bottom:none}",
	".dsh-pet-bubble.is-on{opacity:1}",
	".dsh-pet-bubble.dsh-pet-whisper{font-size:calc(var(--f)*0.7473);min-width:calc(var(--f)*2.1978);max-width:min(calc(var(--f)*10.989),100%)}"
];
let cssInjected = false;
function injectBubbleCss() {
	if (cssInjected || typeof document === "undefined") return;
	cssInjected = true;
	const style = document.createElement("style");
	style.setAttribute("data-dsh-pet-bubble", "");
	style.textContent = bubbleCss.join("\n");
	document.head.appendChild(style);
}
function makeTextBubble(rt) {
	const { h } = rt;
	injectBubbleCss();
	return function TextBubble({ text, on }) {
		return h("div", {
			className: "dsh-pet-bubble dsh-pet-whisper" + (on ? " is-on" : ""),
			children: text
		});
	};
}

//#endregion
//#region src/shared/todo/types.ts
/** 读一个数字，非法回落。 */
function numberOr(raw, fallback) {
	return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}
function parseTodoItem(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const record = raw;
	if (typeof record.id !== "string" || record.id === "") return null;
	if (typeof record.text !== "string") return null;
	const dueAt = record.dueAt === null || record.dueAt === void 0 ? null : typeof record.dueAt === "number" && Number.isFinite(record.dueAt) ? record.dueAt : void 0;
	if (dueAt === void 0) return null;
	return {
		id: record.id,
		text: record.text,
		dueAt,
		done: record.done === true,
		createdAt: numberOr(record.createdAt, 0),
		updatedAt: numberOr(record.updatedAt, 0),
		completedAt: typeof record.completedAt === "number" ? record.completedAt : null
	};
}
function parseTodoList(raw) {
	if (!Array.isArray(raw)) return [];
	const out = [];
	for (const item of raw) {
		const todo = parseTodoItem(item);
		if (todo !== null) out.push(todo);
	}
	return out;
}

//#endregion
//#region src/shared/todo/api.ts
const TODOS_PATH = ROUTE_PATH + "/todos";
/** 发一次请求并收窄最外层：协议失败、业务失败、非 JSON 都归成失败。 */
async function send(url, method, body) {
	try {
		const response = await fetch(url, {
			method,
			cache: "no-store",
			...body === void 0 ? {} : {
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			}
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok) return {
			failed: true,
			message: `请求失败（HTTP ${response.status}）`
		};
		if (payload === null) return {
			failed: true,
			message: "响应不是 JSON"
		};
		if (payload.ok === false) {
			const reason = typeof payload.message === "string" ? payload.message : payload.reason;
			return {
				failed: true,
				message: typeof reason === "string" && reason !== "" ? reason : "请求被拒绝"
			};
		}
		return {
			failed: false,
			body: payload
		};
	} catch (error) {
		return {
			failed: true,
			message: "连不上桌宠服务：" + (error instanceof Error ? error.message : String(error))
		};
	}
}
/** 单条响应 → 待办；形状不对时给出可展示的失败。 */
function readTodo(body) {
	const todo = parseTodoItem(body.todo);
	return todo === null ? {
		ok: false,
		message: "响应里没有有效的待办"
	} : {
		ok: true,
		value: todo
	};
}
async function loadTodos(baseUrl = TODOS_PATH) {
	const result = await send(baseUrl, "GET");
	if (result.failed) return {
		ok: false,
		message: result.message
	};
	return {
		ok: true,
		value: parseTodoList(result.body.todos)
	};
}
async function addTodo(text, dueAt, baseUrl = TODOS_PATH) {
	const result = await send(baseUrl, "POST", {
		text,
		dueAt
	});
	if (result.failed) return {
		ok: false,
		message: result.message
	};
	return readTodo(result.body);
}
async function patchTodo(id, patch, baseUrl = TODOS_PATH) {
	const result = await send(baseUrl + "/" + encodeURIComponent(id), "PATCH", patch);
	if (result.failed) return {
		ok: false,
		message: result.message
	};
	return readTodo(result.body);
}
async function removeTodo(id, baseUrl = TODOS_PATH) {
	const result = await send(baseUrl + "/" + encodeURIComponent(id), "DELETE");
	if (result.failed) return {
		ok: false,
		message: result.message
	};
	return {
		ok: true,
		value: typeof result.body.removed === "number" ? result.body.removed : 0
	};
}

//#endregion
//#region src/shared/todo/format.ts
const MINUTE_MS = 60 * 1e3;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** 星期名，索引与 Date.getDay() 对齐。 */
const WEEKDAYS = [
	"周日",
	"周一",
	"周二",
	"周三",
	"周四",
	"周五",
	"周六"
];
/** 两位补零。 */
function pad2$1(value) {
	return String(value).padStart(2, "0");
}
/** 当天零点的时间戳：跨日比较用它，避开夏令时造成的 23/25 小时日。 */
function startOfDay(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
/** 两个时刻相差几个自然日（按本地日历，向前为负）。 */
function dayDiff(target, base) {
	return Math.round((startOfDay(target) - startOfDay(base)) / DAY_MS);
}
function spanText(ms) {
	const minutes = Math.max(1, Math.round(Math.abs(ms) / MINUTE_MS));
	if (minutes < 60) return `${minutes}分钟`;
	const hours = Math.max(1, Math.round(minutes / 60));
	if (hours < 24) return `${hours}小时`;
	return `${Math.max(1, Math.round(hours / 24))}天`;
}
function dueLabel(dueAt, now) {
	if (dueAt === null) return "无期限";
	const due = new Date(dueAt);
	const clock = `${pad2$1(due.getHours())}:${pad2$1(due.getMinutes())}`;
	const days = dayDiff(due, new Date(now));
	if (days === 0) return `今天 ${clock}`;
	if (days === 1) return `明天 ${clock}`;
	if (days === 2) return `后天 ${clock}`;
	if (days > 2 && days < 7) return `${WEEKDAYS[due.getDay()]} ${clock}`;
	return `${due.getMonth() + 1}月${due.getDate()}日 ${clock}`;
}
function remainingLabel(dueAt, now) {
	if (dueAt === null) return "";
	if (dueAt <= now) return `已逾期${spanText(now - dueAt)}`;
	return `还剩${spanText(dueAt - now)}`;
}
function todoUrgency(dueAt, now) {
	if (dueAt === null) return "undated";
	const remaining = dueAt - now;
	if (remaining <= 0) return "overdue";
	if (remaining <= 6 * HOUR_MS) return "soon";
	if (remaining <= DAY_MS) return "today";
	return "later";
}
function metaLabel(todo, now) {
	if (todo.done) return todo.dueAt === null ? "已完成" : `已完成 · ${dueLabel(todo.dueAt, now)}`;
	if (todo.dueAt === null) return "无期限";
	const relative = remainingLabel(todo.dueAt, now);
	if (todo.dueAt <= now) return relative;
	return `${dueLabel(todo.dueAt, now)} · ${relative}`;
}
function formatDateTimeLocal(ms) {
	const date = new Date(ms);
	return `${date.getFullYear()}-${pad2$1(date.getMonth() + 1)}-${pad2$1(date.getDate())}T${pad2$1(date.getHours())}:${pad2$1(date.getMinutes())}`;
}
function parseDateTimeLocal(value) {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
	const date = new Date(year, month - 1, day, hour, minute, 0, 0);
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
	return date.getTime();
}

//#endregion
//#region src/shared/todo/calendar.ts
function monthCells(year, month) {
	const first = new Date(year, month, 1);
	const lead = (first.getDay() + 6) % 7;
	const days = new Date(year, month + 1, 0).getDate();
	const rows = Math.ceil((lead + days) / 7);
	const cells = [];
	for (let i = 0; i < rows * 7; i++) {
		const date = new Date(year, month, 1 - lead + i);
		cells.push({
			date,
			out: date.getMonth() !== month
		});
	}
	return cells;
}

//#endregion
//#region src/shared/todo/due-picker.ts
/** 周一为一周首日，与国内日历习惯一致。 */
const WEEK_HEAD = [
	"一",
	"二",
	"三",
	"四",
	"五",
	"六",
	"日"
];
/** 分钟档位：与提醒的最短间隔一致，避免选出提醒策略分辨不出的时刻。 */
const MINUTE_STEP = 5;
/** 未选日期时的默认时分：早上九点，比零点更像个「该做事了」的时刻。 */
const DEFAULT_HOUR = 9;
/** 两位补零。 */
function pad2(value) {
	return String(value).padStart(2, "0");
}
/** 造一个带 class 的元素。 */
function make(tag, className) {
	const node = document.createElement(tag);
	node.className = className;
	return node;
}
/** 造一个按钮：全部是 `type="button"`，否则在表单里会触发提交。 */
function makeButton(className, text) {
	const button = make("button", className);
	button.type = "button";
	if (text !== void 0) button.textContent = text;
	return button;
}
/** 建整个选择器的 DOM（尚未挂进文档）。 */
function buildPickerDom() {
	const el = makeButton("dsh-pet-todo-due", "无期限");
	el.setAttribute("aria-haspopup", "dialog");
	el.setAttribute("aria-expanded", "false");
	el.setAttribute("aria-label", "提醒时间（可选）");
	const calendar = make("div", "dsh-pet-todo-cal");
	calendar.setAttribute("role", "dialog");
	calendar.setAttribute("aria-label", "选择提醒时间");
	const head = make("div", "dsh-pet-todo-cal-head");
	const prev = makeButton("dsh-pet-todo-cal-nav", "‹");
	prev.dataset.act = "prev";
	prev.setAttribute("aria-label", "上个月");
	const title = make("span", "dsh-pet-todo-cal-title");
	const next = makeButton("dsh-pet-todo-cal-nav", "›");
	next.dataset.act = "next";
	next.setAttribute("aria-label", "下个月");
	head.append(prev, title, next);
	const week = make("div", "dsh-pet-todo-cal-week");
	for (const name of WEEK_HEAD) {
		const cell = make("span", "");
		cell.textContent = name;
		week.appendChild(cell);
	}
	const grid = make("div", "dsh-pet-todo-cal-grid");
	const foot = make("div", "dsh-pet-todo-cal-foot");
	const today = makeButton("dsh-pet-todo-cal-act", "今天");
	today.dataset.act = "today";
	const clear = makeButton("dsh-pet-todo-cal-act", "清除");
	clear.dataset.act = "clear";
	const grow = make("span", "dsh-pet-todo-cal-grow");
	const hourChip = makeButton("dsh-pet-todo-cal-chip", "09");
	hourChip.dataset.act = "hour";
	hourChip.setAttribute("aria-label", "选择小时");
	const colon = make("span", "dsh-pet-todo-cal-colon");
	colon.textContent = ":";
	const minuteChip = makeButton("dsh-pet-todo-cal-chip", "00");
	minuteChip.dataset.act = "minute";
	minuteChip.setAttribute("aria-label", "选择分钟");
	const done = makeButton("dsh-pet-todo-cal-act", "完成");
	done.dataset.act = "done";
	foot.append(today, clear, grow, hourChip, colon, minuteChip, done);
	calendar.append(head, week, grid, foot);
	return {
		el,
		calendar,
		prev,
		next,
		title,
		grid,
		hourChip,
		minuteChip
	};
}
/** 同一个自然日（忽略时分）。 */
function sameDay(a, b) {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** 选中日期 + 当前时分组成的时刻；未选日期为 null。 */
function dueMs(state) {
	if (state.picked === null) return null;
	const { picked } = state;
	return new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), state.hour, state.minute).getTime();
}
/** 造一个日历格：选中态同时写进 class 与 aria。 */
function cellButton(text, selected) {
	const button = makeButton("dsh-pet-todo-cal-cell", text);
	button.classList.toggle("is-sel", selected);
	button.setAttribute("aria-pressed", String(selected));
	return button;
}
/** 画日期网格。 */
function renderDays(dom, state) {
	const today = new Date();
	for (const cell of monthCells(state.view.getFullYear(), state.view.getMonth())) {
		const { date } = cell;
		const button = cellButton(String(date.getDate()), state.picked !== null && sameDay(state.picked, date));
		button.classList.toggle("is-out", cell.out);
		button.classList.toggle("is-today", sameDay(today, date));
		button.dataset.ts = String(date.getTime());
		button.setAttribute("aria-label", `${date.getMonth() + 1}月${date.getDate()}日`);
		dom.grid.appendChild(button);
	}
}
/** 画小时或分钟的网格：一格一个数，当前值高亮。 */
function renderNumbers(dom, state) {
	const isHour = state.mode === "hour";
	const count = isHour ? 24 : 60;
	const step = isHour ? 1 : MINUTE_STEP;
	for (let value = 0; value < count; value += step) {
		const button = cellButton(pad2(value), (isHour ? state.hour : state.minute) === value);
		button.dataset.num = String(value);
		button.setAttribute("aria-label", `${value} ${isHour ? "时" : "分"}`);
		dom.grid.appendChild(button);
	}
}
/** 同步按钮文案、时分标签与当前网格的标题。 */
function syncPicker(dom, state) {
	const ms = dueMs(state);
	dom.el.textContent = ms === null ? "无期限" : dueLabel(ms, Date.now());
	dom.el.classList.toggle("is-set", ms !== null);
	dom.hourChip.textContent = pad2(state.hour);
	dom.minuteChip.textContent = pad2(state.minute);
	dom.hourChip.classList.toggle("is-on", state.mode === "hour");
	dom.minuteChip.classList.toggle("is-on", state.mode === "minute");
}
/** 整块重画：标题、翻月按钮、网格与文案一次到位。 */
function renderPicker(dom, state) {
	const day = state.mode === "day";
	dom.title.textContent = day ? `${state.view.getFullYear()}年${state.view.getMonth() + 1}月` : state.mode === "hour" ? "选择小时" : "选择分钟";
	dom.prev.hidden = !day;
	dom.next.hidden = !day;
	dom.grid.className = "dsh-pet-todo-cal-grid is-" + state.mode;
	dom.grid.textContent = "";
	if (day) renderDays(dom, state);
	else renderNumbers(dom, state);
	syncPicker(dom, state);
}
/** 选中某一天：同步展示月份，并回到日期网格。 */
function pickDay(dom, state, date) {
	state.picked = date;
	state.view = new Date(date.getFullYear(), date.getMonth(), 1);
	state.mode = "day";
	renderPicker(dom, state);
}
/** 点日历里的按钮：翻月、切网格、今天、清除、完成，或选中某一天 / 某个数。 */
function onCalendarClick(dom, state, button, close) {
	const { ts, num, act } = button.dataset;
	if (ts !== void 0) {
		pickDay(dom, state, new Date(Number(ts)));
		return;
	}
	if (num !== void 0) {
		if (state.mode === "hour") state.hour = Number(num);
		else state.minute = Number(num);
		state.mode = "day";
		renderPicker(dom, state);
		return;
	}
	if (act === "prev" || act === "next") {
		state.view = new Date(state.view.getFullYear(), state.view.getMonth() + (act === "prev" ? -1 : 1), 1);
		renderPicker(dom, state);
		return;
	}
	if (act === "hour" || act === "minute") {
		state.mode = state.mode === act ? "day" : act;
		renderPicker(dom, state);
		return;
	}
	if (act === "today") {
		const now = new Date();
		pickDay(dom, state, new Date(now.getFullYear(), now.getMonth(), now.getDate()));
		return;
	}
	if (act === "clear") state.picked = null;
	renderPicker(dom, state);
	if (act === "clear" || act === "done") close();
}
function createDuePicker(options = {}) {
	const now = new Date();
	const state = {
		picked: null,
		hour: DEFAULT_HOUR,
		minute: 0,
		view: new Date(now.getFullYear(), now.getMonth(), 1),
		mode: "day",
		open: false
	};
	const dom = buildPickerDom();
	const setOpen = (open) => {
		if (state.open === open) return;
		state.open = open;
		dom.el.setAttribute("aria-expanded", String(open));
		options.onOpenChange?.(open);
	};
	dom.el.addEventListener("click", () => {
		if (!state.open) {
			const anchor = state.picked ?? new Date();
			state.view = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
			state.mode = "day";
			renderPicker(dom, state);
		}
		setOpen(!state.open);
	});
	dom.calendar.addEventListener("click", (event) => {
		const button = event.target.closest("button");
		if (button !== null) onCalendarClick(dom, state, button, () => setOpen(false));
	});
	const onDocMouseDown = (event) => {
		if (!state.open) return;
		const target = event.target;
		if (target !== null && (dom.el.contains(target) || dom.calendar.contains(target))) return;
		setOpen(false);
	};
	document.addEventListener("mousedown", onDocMouseDown, true);
	renderPicker(dom, state);
	return {
		el: dom.el,
		calendar: dom.calendar,
		value: () => {
			const ms = dueMs(state);
			return ms === null ? "" : formatDateTimeLocal(ms);
		},
		close: () => setOpen(false),
		reset: () => {
			state.picked = null;
			state.hour = DEFAULT_HOUR;
			state.minute = 0;
			state.mode = "day";
			renderPicker(dom, state);
			setOpen(false);
		},
		dispose: () => document.removeEventListener("mousedown", onDocMouseDown, true)
	};
}

//#endregion
//#region src/shared/todo/render.ts
/** 删除按钮的二次确认窗口（ms）：超时自动复原，避免「确认」态一直挂着。 */
const DELETE_ARM_MS = 2500;
/** 空态文案：加载中会临时替换它，重渲染时再写回来。 */
const EMPTY_TEXT = "还没有待办。记一件要做的事，到点我会提醒你～";
/** 清单最多露出几行，其余靠滚动。 */
const LIST_ROWS = 2;
/** 造一个带 class 的元素，避免每处都写 createElement + className。 */
function element(tag, className, text) {
	const node = document.createElement(tag);
	node.className = className;
	if (text !== void 0) node.textContent = text;
	return node;
}
/** 造一个可折叠区：高度靠 grid-template-rows 在 0fr 与 1fr 之间过渡，内容高度是 auto 也能动画。 */
function fold(className, children) {
	const outer = element("div", "dsh-pet-todo-fold " + className);
	const clip = element("div", "dsh-pet-todo-foldClip");
	clip.append(...children);
	outer.appendChild(clip);
	return outer;
}
function createTodoPanelParts() {
	const root = element("div", "dsh-pet-todo");
	root.setAttribute("role", "dialog");
	root.setAttribute("aria-label", "待办事项");
	const head = element("div", "dsh-pet-todo-head");
	const title = element("span", "dsh-pet-todo-title", "待办事项");
	const count = element("span", "dsh-pet-todo-count", "0 项未完成");
	count.setAttribute("aria-live", "polite");
	const closeButton = element("button", "dsh-pet-todo-close", "✕");
	closeButton.type = "button";
	closeButton.setAttribute("aria-label", "关闭待办面板");
	head.append(title, count, closeButton);
	const form = element("form", "dsh-pet-todo-form");
	const input = element("input", "dsh-pet-todo-input");
	input.type = "text";
	input.maxLength = 200;
	input.placeholder = "记一件要做的事…";
	input.autocomplete = "off";
	input.setAttribute("aria-label", "待办内容");
	const row = element("div", "dsh-pet-todo-row");
	const duePicker = createDuePicker({ onOpenChange: (open) => root.classList.toggle("is-picking", open) });
	const addButton = element("button", "dsh-pet-todo-add", "添加");
	addButton.type = "submit";
	row.append(duePicker.el, addButton);
	form.append(input, row);
	const error = element("div", "dsh-pet-todo-err");
	error.hidden = true;
	const empty = element("div", "dsh-pet-todo-empty", EMPTY_TEXT);
	empty.hidden = true;
	const list = element("ul", "dsh-pet-todo-list");
	const hint = element("div", "dsh-pet-todo-hint", "离到期越近，我会提醒得越勤快～");
	const lower = element("div", "dsh-pet-todo-lower");
	lower.append(fold("is-cal", [duePicker.calendar]), fold("is-list", [
		error,
		empty,
		list,
		hint
	]));
	root.append(head, form, lower);
	return {
		root,
		form,
		input,
		duePicker,
		addButton,
		list,
		empty,
		count,
		closeButton,
		error
	};
}
/**
* 把清单压到「两行」的高度，多出来的部分靠清单自己滚动。
*
* 行高随正文折行变化，写不成 CSS 常量，所以量一次首行再乘二；量不到（未挂载）就不设上限，
* 免得把清单压成 0 高。
*
* @param list - 清单容器。
*/
function capListHeight(list) {
	const first = list.firstElementChild;
	if (first === null) {
		list.style.maxHeight = "";
		return;
	}
	const rowHeight = first.getBoundingClientRect().height;
	if (rowHeight <= 0) return;
	const pad = parseFloat(getComputedStyle(list).paddingTop) || 0;
	list.style.maxHeight = rowHeight * LIST_ROWS + pad * 2 + "px";
}
function renderTodoList(parts, todos, handlers, now) {
	parts.list.textContent = "";
	const pending = todos.filter((todo) => !todo.done).length;
	parts.count.textContent = `${pending} 项未完成`;
	parts.empty.textContent = EMPTY_TEXT;
	parts.empty.hidden = todos.length > 0;
	for (const todo of todos) parts.list.appendChild(renderItem(todo, handlers, now));
	capListHeight(parts.list);
}
/** 渲染一条；未完成项带紧迫度，已完成项划线。 */
function renderItem(todo, handlers, now) {
	const item = element("li", "dsh-pet-todo-item" + (todo.done ? " is-done" : ""));
	if (!todo.done) item.dataset.urgency = todoUrgency(todo.dueAt, now);
	const check = element("input", "dsh-pet-todo-check");
	check.type = "checkbox";
	check.checked = todo.done;
	check.setAttribute("aria-label", (todo.done ? "标记未完成：" : "标记完成：") + todo.text);
	check.addEventListener("change", () => handlers.onToggle(todo, check.checked));
	const main = element("div", "dsh-pet-todo-main");
	const text = element("div", "dsh-pet-todo-text", todo.text);
	const meta = element("div", "dsh-pet-todo-meta", metaLabel(todo, now));
	main.append(text, meta);
	const remove = element("button", "dsh-pet-todo-del", "✕");
	remove.type = "button";
	remove.setAttribute("aria-label", "删除：" + todo.text);
	remove.addEventListener("click", () => {
		if (remove.dataset.armed !== "1") {
			remove.dataset.armed = "1";
			remove.classList.add("is-armed");
			remove.textContent = "确认";
			window.setTimeout(() => {
				if (!remove.isConnected) return;
				delete remove.dataset.armed;
				remove.classList.remove("is-armed");
				remove.textContent = "✕";
			}, DELETE_ARM_MS);
			return;
		}
		handlers.onDelete(todo);
	});
	item.append(check, main, remove);
	return item;
}
function setTodoError(parts, message) {
	parts.error.hidden = message === null;
	parts.error.textContent = message ?? "";
}
function setTodoBusy(parts, busy) {
	parts.input.disabled = busy;
	parts.duePicker.el.disabled = busy;
	parts.addButton.disabled = busy;
}

//#endregion
//#region src/shared/todo/styles.ts
const TODO_FONT_SCALE = .618;
const TODO_CSS = [
	".dsh-pet-bubble.dsh-pet-todo-bubble,.pet-bubble.dsh-pet-todo-bubble{padding:0;",
	"width:max(220px,calc(var(--f)*14.65));max-width:calc(100vw - 16px);pointer-events:auto;cursor:default}",
	".dsh-pet-todo{--t:calc(var(--f)*" + TODO_FONT_SCALE + ");display:flex;flex-direction:column;",
	"box-sizing:border-box;border-radius:inherit;overflow:hidden;color:#2b2b2b;font-size:var(--t);",
	"line-height:1.5;user-select:none;",
	"font-family:var(--dsh-pet-font-family,'ShangshouSoftCandy','Yuanti SC','YouYuan','幼圆','Comic Sans MS','PingFang SC','Microsoft YaHei',sans-serif);",
	"}",
	".dsh-pet-todo *{box-sizing:border-box}",
	".dsh-pet-todo-head{display:flex;align-items:center;gap:.615em;padding:.769em .923em .615em}",
	".dsh-pet-todo-title{flex:1;font-size:1.077em;font-weight:600}",
	".dsh-pet-todo-count{color:rgba(43,43,43,.55);font-size:.923em}",
	".dsh-pet-todo-close{border:none;background:transparent;color:rgba(43,43,43,.5);font-family:inherit;",
	"font-size:1em;line-height:1;padding:.308em .385em;border-radius:.462em;cursor:pointer}",
	".dsh-pet-todo-close:hover{background:rgba(0,0,0,.06);color:rgba(43,43,43,.9)}",
	".dsh-pet-todo-form{display:flex;flex-direction:column;gap:.462em;padding:0 .923em .769em;",
	"border-bottom:1px solid rgba(0,0,0,.07)}",
	".dsh-pet-todo-input{width:100%;border:1px solid rgba(0,0,0,.12);border-radius:.615em;",
	"background:rgba(255,255,255,.9);padding:.462em .615em;font-size:1em;line-height:1.4;color:#2b2b2b;",
	"font-family:inherit;outline:none}",
	".dsh-pet-todo-input:focus{border-color:rgba(64,128,255,.55);box-shadow:0 0 0 .154em rgba(64,128,255,.14)}",
	".dsh-pet-todo-input::placeholder{color:rgba(43,43,43,.42)}",
	".dsh-pet-todo-row{display:flex;align-items:center;gap:.462em}",
	".dsh-pet-todo-due{flex:1;min-width:0;text-align:left;border:1px solid rgba(0,0,0,.12);border-radius:.615em;",
	"background:rgba(255,255,255,.9);padding:.462em .615em;font-size:1em;line-height:1.4;font-family:inherit;",
	"color:rgba(43,43,43,.55);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
	".dsh-pet-todo-due:hover{border-color:rgba(64,128,255,.45)}",
	".dsh-pet-todo-due.is-set{color:#2b2b2b}",
	".dsh-pet-todo-due[aria-expanded=\"true\"]{border-color:rgba(64,128,255,.55);",
	"box-shadow:0 0 0 .154em rgba(64,128,255,.14)}",
	".dsh-pet-todo-add{border:none;border-radius:.615em;background:#4a7dff;color:#fff;font-size:1em;",
	"padding:.462em .923em;cursor:pointer;font-family:inherit;white-space:nowrap}",
	".dsh-pet-todo-add:hover{background:#3a6ce8}",
	".dsh-pet-todo-add:disabled,.dsh-pet-todo-input:disabled{opacity:.55;cursor:default}",
	".dsh-pet-todo-cal{display:flex;flex-direction:column;gap:.308em;",
	"padding:.462em .615em .615em;background:rgba(43,43,43,.025)}",
	".dsh-pet-todo-cal-head{display:flex;align-items:center;gap:.308em}",
	".dsh-pet-todo-cal-title{flex:1;text-align:center;font-size:1.077em;font-weight:600}",
	".dsh-pet-todo-cal-nav{border:none;background:transparent;color:rgba(43,43,43,.55);font-family:inherit;",
	"font-size:1.154em;line-height:1;padding:.154em .385em;border-radius:.462em;cursor:pointer}",
	".dsh-pet-todo-cal-nav:hover{background:rgba(0,0,0,.07);color:#2b2b2b}",
	".dsh-pet-todo-cal-week,.dsh-pet-todo-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:.154em}",
	".dsh-pet-todo-cal-grid{grid-auto-rows:1.862em}",
	".dsh-pet-todo-cal-grid.is-hour,.dsh-pet-todo-cal-grid.is-minute{grid-template-columns:repeat(6,1fr);",
	"grid-auto-rows:1.6em;align-content:center}",
	".dsh-pet-todo-cal-week{font-size:.846em;line-height:1.5;color:rgba(43,43,43,.45);text-align:center}",
	".dsh-pet-todo-cal-cell{border:none;background:transparent;font-family:inherit;font-size:1em;line-height:1.4;",
	"color:#2b2b2b;padding:.231em 0;border-radius:.462em;cursor:pointer;font-variant-numeric:tabular-nums}",
	".dsh-pet-todo-cal-cell:hover{background:rgba(0,0,0,.06)}",
	".dsh-pet-todo-cal-cell.is-out{color:rgba(43,43,43,.26)}",
	".dsh-pet-todo-cal-cell.is-today{box-shadow:inset 0 0 0 1px rgba(74,125,255,.55)}",
	".dsh-pet-todo-cal-cell.is-sel{background:#4a7dff;color:#fff;font-weight:600}",
	".dsh-pet-todo-cal-foot{display:flex;align-items:center;gap:.308em}",
	".dsh-pet-todo-cal-act{border:none;background:transparent;color:#4a7dff;font-family:inherit;font-size:.923em;",
	"line-height:1.5;padding:.231em .385em;border-radius:.462em;cursor:pointer}",
	".dsh-pet-todo-cal-act:hover{background:rgba(74,125,255,.1)}",
	".dsh-pet-todo-cal-grow{flex:1}",
	".dsh-pet-todo-cal-chip{border:1px solid rgba(0,0,0,.12);border-radius:.462em;background:rgba(255,255,255,.95);",
	"color:#2b2b2b;font-family:inherit;font-size:.923em;line-height:1.4;padding:.154em .385em;cursor:pointer;",
	"font-variant-numeric:tabular-nums}",
	".dsh-pet-todo-cal-chip.is-on{border-color:rgba(74,125,255,.55);color:#4a7dff;",
	"box-shadow:0 0 0 .154em rgba(74,125,255,.14)}",
	".dsh-pet-todo-cal-colon{color:rgba(43,43,43,.45)}",
	".dsh-pet-todo-lower{display:flex;flex-direction:column}",
	".dsh-pet-todo-fold{display:grid;grid-template-rows:0fr;visibility:hidden;",
	"transition:grid-template-rows .18s ease,visibility 0s .18s}",
	".dsh-pet-todo-fold>.dsh-pet-todo-foldClip{overflow:hidden;min-height:0}",
	".dsh-pet-todo-fold.is-list{grid-template-rows:1fr;visibility:visible;transition-delay:0s}",
	".dsh-pet-todo.is-picking .dsh-pet-todo-fold.is-cal{grid-template-rows:1fr;visibility:visible;",
	"transition-delay:0s}",
	".dsh-pet-todo.is-picking .dsh-pet-todo-fold.is-list{grid-template-rows:0fr;visibility:hidden;",
	"transition-delay:0s,.18s}",
	".dsh-pet-todo-list{list-style:none;margin:0;padding:.462em;overflow-y:auto;overscroll-behavior:contain;",
	"flex:0 1 auto;min-height:0;scrollbar-width:thin}",
	".dsh-pet-todo-item{display:flex;align-items:flex-start;gap:.615em;padding:.538em .462em;border-radius:.615em}",
	".dsh-pet-todo-item:hover{background:rgba(0,0,0,.045)}",
	".dsh-pet-todo-check{margin-top:.231em;width:1.154em;height:1.154em;flex:0 0 auto;cursor:pointer;",
	"accent-color:#4a7dff}",
	".dsh-pet-todo-main{flex:1;min-width:0}",
	".dsh-pet-todo-text{overflow-wrap:anywhere;white-space:pre-wrap}",
	".dsh-pet-todo-meta{margin-top:calc(var(--t)*0.154);font-size:.846em;color:rgba(43,43,43,.5)}",
	".dsh-pet-todo-item[data-urgency=\"overdue\"] .dsh-pet-todo-meta{color:#d94f3d}",
	".dsh-pet-todo-item[data-urgency=\"soon\"] .dsh-pet-todo-meta{color:#c9761b}",
	".dsh-pet-todo-item[data-urgency=\"today\"] .dsh-pet-todo-meta{color:#3f6fd8}",
	".dsh-pet-todo-item.is-done .dsh-pet-todo-text{text-decoration:line-through;color:#2e9e4f}",
	".dsh-pet-todo-del{border:none;background:transparent;color:rgba(43,43,43,.34);font-size:.923em;line-height:1;",
	"padding:calc(var(--t)*0.308) calc(var(--t)*0.385);border-radius:.462em;cursor:pointer;flex:0 0 auto;",
	"min-width:calc(var(--t)*1.692)}",
	".dsh-pet-todo-del:hover{background:rgba(0,0,0,.07);color:rgba(43,43,43,.8)}",
	".dsh-pet-todo-del.is-armed{background:rgba(217,79,61,.12);color:#d94f3d}",
	".dsh-pet-todo-empty{padding:calc(var(--t)*1.538) calc(var(--t)*0.923);text-align:center;",
	"color:rgba(43,43,43,.44);font-size:.923em}",
	".dsh-pet-todo-empty[hidden]{display:none}",
	".dsh-pet-todo-err{flex:0 0 auto;padding:0 calc(var(--t)*0.923) calc(var(--t)*0.615);color:#d94f3d;",
	"font-size:.923em;white-space:pre-wrap;overflow-wrap:anywhere}",
	".dsh-pet-todo-err[hidden]{display:none}",
	".dsh-pet-todo-hint{margin-top:auto;padding:calc(var(--t)*0.462) calc(var(--t)*0.923) calc(var(--t)*0.692);",
	"color:rgba(43,43,43,.4);font-size:.846em;text-align:center}"
].join("");
let todoCssInjected = false;
function injectTodoCss() {
	if (todoCssInjected || typeof document === "undefined") return;
	todoCssInjected = true;
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-pet";
	tag.dataset.pluginCss = "dsh-pet/todo";
	tag.textContent = TODO_CSS;
	document.head.appendChild(tag);
}

//#endregion
//#region src/shared/todo/panel.ts
function createTodoPanel(options = {}) {
	injectTodoCss();
	const parts = createTodoPanelParts();
	const baseUrl = options.baseUrl ?? TODOS_PATH;
	let disposed = false;
	let busy = false;
	let todos = [];
	const handlers = {
		onToggle: (todo, done) => void mutate(() => patchTodo(todo.id, { done }, baseUrl)),
		onDelete: (todo) => void mutate(() => removeTodo(todo.id, baseUrl))
	};
	/** 重新拉整张清单：修改一律以宿主返回为准，不在本地猜结果。 */
	async function reload() {
		const result = await loadTodos(baseUrl);
		if (disposed) return;
		if (!result.ok) {
			setTodoError(parts, result.message);
			parts.empty.textContent = "清单加载失败，关掉面板再开一次试试";
			parts.empty.hidden = false;
			return;
		}
		todos = result.value;
		setTodoError(parts, null);
		renderTodoList(parts, todos, handlers, Date.now());
	}
	/** 串行执行一次修改：请求在途时禁止再次提交，成功后统一重拉。 */
	async function mutate(task) {
		if (disposed || busy) return;
		busy = true;
		setTodoBusy(parts, true);
		setTodoError(parts, null);
		const result = await task();
		busy = false;
		if (disposed) return;
		setTodoBusy(parts, false);
		if (!result.ok) {
			setTodoError(parts, result.message);
			return;
		}
		await reload();
	}
	/** 提交新增：空正文直接回到输入框。 */
	const submitAdd = () => {
		const text = parts.input.value.trim();
		if (text === "") {
			parts.input.focus();
			return;
		}
		const dueText = parts.duePicker.value();
		const dueAt = dueText === "" ? null : parseDateTimeLocal(dueText);
		parts.duePicker.close();
		if (dueAt !== null && dueAt < Date.now()) {
			setTodoError(parts, "这个时间已经过去了，换一个吧");
			return;
		}
		mutate(async () => {
			const result = await addTodo(text, dueAt, baseUrl);
			if (result.ok) {
				parts.input.value = "";
				parts.duePicker.reset();
			}
			return result;
		});
	};
	parts.form.addEventListener("submit", (event) => {
		event.preventDefault();
		submitAdd();
	});
	const onDocMouseDown = (event) => {
		if (disposed) return;
		const target = event.target;
		if (target !== null && parts.root.contains(target)) return;
		if (options.keepOpenOn?.(event.target) === true) return;
		options.onClose?.();
	};
	document.addEventListener("mousedown", onDocMouseDown, true);
	parts.closeButton.addEventListener("click", () => options.onClose?.());
	parts.empty.textContent = "加载中…";
	parts.empty.hidden = false;
	reload();
	return {
		el: parts.root,
		dispose: () => {
			if (disposed) return;
			disposed = true;
			document.removeEventListener("mousedown", onDocMouseDown, true);
			parts.duePicker.dispose();
			parts.root.remove();
		}
	};
}

//#endregion
//#region src/client/todo-bubble.ts
function makeTodoBubble(rt) {
	const { h, useRef, useEffect } = rt;
	return function TodoBubble({ on, onClose }) {
		const hostRef = useRef(null);
		const closeRef = useRef(onClose);
		closeRef.current = onClose;
		useEffect(() => {
			const host = hostRef.current;
			if (host === null) return;
			const panel = createTodoPanel({
				onClose: () => closeRef.current(),
				keepOpenOn: (target) => target instanceof Element && target.closest(".dsh-pet-hit") !== null
			});
			host.appendChild(panel.el);
			return () => panel.dispose();
		}, []);
		return h("div", {
			ref: hostRef,
			className: "dsh-pet-bubble dsh-pet-todo-bubble" + (on ? " is-on" : "")
		});
	};
}

//#endregion
//#region src/shared/notify.ts
const NOTIFY_ICONS$1 = {
	done: "notify-done",
	error: "notify-error",
	truncated: "notify-truncated",
	approval: "notify-approval",
	question: "notify-question",
	test: "notify-test"
};
const MAX_BODY = 80;
/** 会话名在标题里的截断上限（字符）：名字只是认人用，太长会把事件类型挤出标题那一行。 */
const MAX_SESSION_NAME = 30;
function truncate(text) {
	return text.length > MAX_BODY ? text.slice(0, MAX_BODY) + "…" : text;
}
/** 会话名 → 能放进标题的名字：去掉首尾空白并截断；没有名字时返回 undefined。 */
function sessionNameOf(sessionTitle) {
	const name = sessionTitle?.trim();
	if (!name) return void 0;
	return name.length > MAX_SESSION_NAME ? name.slice(0, MAX_SESSION_NAME) + "…" : name;
}
/** 「会话名 · 事件」形式的标题；没有会话名时只留事件类型。 */
function composeTitle(sessionTitle, label) {
	const name = sessionNameOf(sessionTitle);
	return name ? name + " · " + label : label;
}
function frameToToast(frame, sessionTitle) {
	switch (frame.type) {
		case "session/event": {
			const ev = frame.event ?? {};
			if (ev.type !== "turn/end") return null;
			const kind = ev.data?.reason?.kind;
			if (kind === "completed") {
				const text = typeof ev.data?.text === "string" ? ev.data.text.trim() : "";
				return {
					title: sessionNameOf(sessionTitle) ?? "对话完成",
					body: text ? truncate(text) : "",
					icon: NOTIFY_ICONS$1.done
				};
			}
			if (kind === "error") return {
				title: composeTitle(sessionTitle, "生成失败"),
				body: ev.data?.reason?.error?.message ?? "",
				icon: NOTIFY_ICONS$1.error
			};
			if (kind === "max-tokens") return {
				title: composeTitle(sessionTitle, "输出被截断"),
				body: "已达到输出 token 上限",
				icon: NOTIFY_ICONS$1.truncated
			};
			return null;
		}
		case "approval/requested": {
			const toolName = typeof frame.toolName === "string" ? frame.toolName : "";
			const reason = typeof frame.reason === "string" && frame.reason ? frame.reason : "";
			return {
				title: composeTitle(sessionTitle, "正在申请权限"),
				body: (toolName ? "工具「" + toolName + "」" : "") + (reason ? "：" + reason : ""),
				icon: NOTIFY_ICONS$1.approval
			};
		}
		case "question/requested": {
			const q = Array.isArray(frame.questions) && frame.questions[0]?.question || "";
			return {
				title: composeTitle(sessionTitle, "模型在等你回答"),
				body: q,
				icon: NOTIFY_ICONS$1.question
			};
		}
		case "host/agent-error": return {
			title: "生成失败",
			body: typeof frame.message === "string" ? frame.message : "",
			icon: NOTIFY_ICONS$1.error
		};
		default: return null;
	}
}

//#endregion
//#region src/client/notify.ts
let pageVisible = typeof document !== "undefined" && !document.hidden;
let pageFocused = typeof document !== "undefined" && document.hasFocus();
function refreshVisible() {
	pageVisible = !document.hidden;
}
function refreshFocused() {
	pageFocused = document.hasFocus();
}
/** 注册聚焦与可见性监听，返回解绑函数。 */
function initFocusTracking() {
	if (typeof document === "undefined") return () => {};
	document.addEventListener("visibilitychange", refreshVisible);
	window.addEventListener("focus", refreshFocused);
	window.addEventListener("blur", refreshFocused);
	return () => {
		document.removeEventListener("visibilitychange", refreshVisible);
		window.removeEventListener("focus", refreshFocused);
		window.removeEventListener("blur", refreshFocused);
	};
}
/** 用户是否在看本页（页面可见且持有焦点）；是则跳过通知。 */
function isPageActive() {
	return pageVisible && pageFocused;
}
/** 图标 URL；pic 路由由宿主提供（`assets/pic` → `/dsh-pet-7340/pic/<file>`）。 */
const PIC = (name) => `${ROUTE_PATH}/pic/${name}.png`;
const NOTIFY_ICONS = {
	done: PIC(NOTIFY_ICONS$1.done),
	error: PIC(NOTIFY_ICONS$1.error),
	truncated: PIC(NOTIFY_ICONS$1.truncated),
	approval: PIC(NOTIFY_ICONS$1.approval),
	question: PIC(NOTIFY_ICONS$1.question),
	test: PIC(NOTIFY_ICONS$1.test)
};
let settings = {
	enabled: true,
	turnEnd: "unfocused",
	approval: true,
	question: true,
	sound: "default"
};
/** 当前生效的会话跳转器（app.ts 注入；旧版 DSH 没有 uiWorkspace 时为 undefined）。 */
let sessionNavigator;
function sessionTitleFrom(navigator$1, sessionId) {
	if (sessionId === void 0) return void 0;
	try {
		return navigator$1?.sessionTitle?.(sessionId);
	} catch {
		return void 0;
	}
}
function wireNotificationClick(n, sessionId) {
	n.onclick = () => {
		n.close();
		if (sessionId !== void 0) try {
			sessionNavigator?.openSession(sessionId);
		} catch {}
		window.focus();
		if (!/electron/i.test(navigator.userAgent)) return;
		const frame = document.createElement("iframe");
		frame.style.display = "none";
		frame.src = "dsh://open";
		document.body.append(frame);
		setTimeout(() => frame.remove(), 1e3);
	};
}
/** 发一条系统通知；总开关关闭、环境不支持、未授权或本页正在看时静默跳过。
* 日志只在门之后记录：被拦下的触发不产生「弹窗」日志。 */
function playNotifySound() {
	if (settings.sound === "none") return;
	try {
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return;
		const ctx = new AC();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.value = settings.sound === "classic" ? 880 : 640;
		gain.gain.value = .05;
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + .12);
		osc.onended = () => void ctx.close();
	} catch {}
}
function toast(title, body, icon, sessionId) {
	if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
	console.log("[dsh-pet] 【弹窗】" + title + (body ? "：" + body : ""));
	playNotifySound();
	try {
		const opts = {};
		if (body) opts.body = truncate(body);
		if (icon) opts.icon = icon;
		const n = new Notification(title, opts);
		wireNotificationClick(n, sessionId);
	} catch {}
}
/**
* 帧 → toast 并发出；未知帧静默跳过，帧里的 sessionId 一并透传给点击行为。
* 标题优先用会话名：同一个宿主上可以并行跑多条会话，通知里必须能认出是哪一条回来了。
*/
function shouldNotify(frame) {
	if (!settings.enabled) return false;
	if (frame.type === "approval/requested") return settings.approval;
	if (frame.type === "question/requested") return settings.question;
	if (frame.type === "host/agent-error") return true;
	if (frame.type === "session/event") {
		const ev = frame.event ?? {};
		if (ev.type !== "turn/end") return false;
		if (settings.turnEnd === "never") return false;
		if (settings.turnEnd === "unfocused" && isPageActive()) return false;
		return true;
	}
	return false;
}
function toastFrame(frame) {
	if (!shouldNotify(frame)) return;
	const sessionId = typeof frame.sessionId === "string" ? frame.sessionId : void 0;
	const t = frameToToast(frame, sessionTitleFrom(sessionNavigator, sessionId));
	if (!t) return;
	toast(t.title, t.body, PIC(t.icon), sessionId);
}
async function requestNotificationPermission() {
	if (typeof Notification === "undefined") return {
		ok: false,
		reason: "unsupported"
	};
	if (Notification.permission === "granted") return { ok: true };
	if (Notification.permission === "denied") return {
		ok: false,
		reason: "denied"
	};
	try {
		const p = await Notification.requestPermission();
		if (p === "granted") return { ok: true };
		if (p === "denied") return {
			ok: false,
			reason: "rejected"
		};
		return {
			ok: false,
			reason: "error",
			message: "权限未授予（" + p + "）"
		};
	} catch (e) {
		return {
			ok: false,
			reason: "error",
			message: e instanceof Error ? e.message : String(e)
		};
	}
}
/** 读通知行为配置（成品配置 main 条目）；拉取或解析失败时沿用默认（开启 + 失焦弹 + 提示音 default）。 */
async function readSettings() {
	try {
		const r = await fetch(ROUTE_PATH + "/config");
		if (!r.ok) return;
		const d = await r.json().catch(() => null);
		const m = d && d.main;
		if (!m) return;
		settings = {
			enabled: typeof m.notificationsEnabled === "boolean" ? m.notificationsEnabled : true,
			turnEnd: m.notificationTurnEnd === "never" || m.notificationTurnEnd === "always" ? m.notificationTurnEnd : "unfocused",
			approval: typeof m.notificationApproval === "boolean" ? m.notificationApproval : true,
			question: typeof m.notificationQuestion === "boolean" ? m.notificationQuestion : true,
			sound: m.notificationSound === "none" || m.notificationSound === "classic" ? m.notificationSound : "default"
		};
	} catch {}
}
async function reloadNotifications() {
	await readSettings();
}
function notifyFromFrame(frame) {
	toastFrame(frame);
}
function initNotify(navigator$1) {
	sessionNavigator = navigator$1;
	readSettings().then(() => {
		if (typeof Notification !== "undefined" && settings.enabled && Notification.permission === "default") requestNotificationPermission();
	});
	return initFocusTracking();
}

//#endregion
//#region src/client/settings/css.ts
/**
* 设置页样式表与注入入口：三族类名——`dsh-pet-mp__*`（AI 模型选择器）、`dsh-pet-sel__*`（通用单选下拉）与 `dsh-pet-cfg__*`（配置卡片）。
* 只放伪类、悬浮、过渡与容器查询这类内联 style 表达不了的东西，其余排版走组件内联 style。
* 颜色与圆角取 `--dsw-alias-*` / `--dsw-radius-*` token；填充按钮上的白字与阴影回退值是刻意例外。
* 注入按 `data-plugin-css` 去重，同一页面重复渲染设置页不会长第二份样式。
* @module dsh-pet/src/client/settings/css
*/
/** 设置页样式表；按类名族分段拼成单段文本，行内注释标出反直觉的那几条规则。 */
const SETTINGS_CSS = [
	".dsh-pet-mp{position:relative;min-width:0;display:flex;flex-direction:column;gap:4px}",
	".dsh-pet-mp__trigger{display:flex;align-items:center;gap:6px;width:100%;max-width:340px;height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;text-align:left;cursor:pointer;outline:none}",
	".dsh-pet-mp__trigger:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}",
	".dsh-pet-mp__trigger:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}",
	".dsh-pet-mp__trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
	".dsh-pet-mp__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
	".dsh-pet-mp__sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex-shrink:1000;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}",
	".dsh-pet-mp__chevron{flex:none;margin-left:auto;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));transition:transform .12s}",
	".dsh-pet-mp__chevron.is-open{transform:rotate(180deg)}",
	".dsh-pet-mp__panel{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:4px;padding:4px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 8px 30px rgba(0,0,0,.35));color:var(--dsw-alias-label-primary)}",
	".dsh-pet-mp__search{box-sizing:border-box;width:100%;height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;outline:none}",
	".dsh-pet-mp__search:focus{border-color:var(--dsw-alias-state-business-primary)}",
	".dsh-pet-mp__list{display:flex;flex-direction:column;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin}",
	".dsh-pet-mp__group{padding:6px 8px 2px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
	".dsh-pet-mp__item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}",
	".dsh-pet-mp__item:hover:not(:disabled),.dsh-pet-mp__item.is-active{background:var(--dsw-alias-interactive-bg-hover)}",
	".dsh-pet-mp__item[aria-checked=\"true\"]{color:var(--dsw-alias-state-business-primary)}",
	".dsh-pet-mp__item:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
	".dsh-pet-mp__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
	".dsh-pet-mp__check{flex:none;margin-left:auto}",
	".dsh-pet-mp__status{padding:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
	".dsh-pet-sel{position:relative;min-width:0}",
	".dsh-pet-sel__trigger{display:flex;align-items:center;gap:6px;text-align:left;cursor:pointer}",
	".dsh-pet-sel__trigger:disabled{cursor:default}",
	".dsh-pet-sel__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
	".dsh-pet-sel__chevron{flex:none;margin-left:auto;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;color:var(--dsw-alias-label-tertiary);transition:transform .12s}",
	".dsh-pet-sel__chevron.is-open{transform:rotate(180deg)}",
	".dsh-pet-sel__panel{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:2px;padding:4px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 8px 30px rgba(0,0,0,.35));color:var(--dsw-alias-label-primary)}",
	".dsh-pet-sel__list{display:flex;flex-direction:column;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin}",
	".dsh-pet-sel__item{display:flex;align-items:center;gap:8px;width:100%;padding:5px 8px;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}",
	".dsh-pet-sel__item:hover:not(:disabled),.dsh-pet-sel__item.is-active{background:var(--dsw-alias-interactive-bg-hover)}",
	".dsh-pet-sel__item[aria-selected=\"true\"]{color:var(--dsw-alias-state-business-primary)}",
	".dsh-pet-sel__item:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
	".dsh-pet-sel__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
	".dsh-pet-sel__check{flex:none;margin-left:auto}",
	".dsh-pet-cfg{container-type:inline-size;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}",
	".dsh-pet-cfg__title{display:flex;align-items:center;gap:6px;margin:0;font-size:16px;font-weight:500;line-height:24px}",
	".dsh-pet-cfg__card{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px}",
	".dsh-pet-cfg__cardHead{display:flex;align-items:center;gap:6px;min-height:20px}",
	".dsh-pet-cfg__cardTitle{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}",
	".dsh-pet-cfg__card.is-fold{gap:0}",
	".dsh-pet-cfg__foldToggle{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;min-height:20px;padding:0;border:none;border-radius:4px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;outline:none}",
	".dsh-pet-cfg__foldToggle:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}",
	".dsh-pet-cfg__chevron{flex:none;margin-left:auto;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;color:var(--dsw-alias-label-tertiary);transition:transform .12s}",
	".dsh-pet-cfg__chevron.is-open{transform:rotate(180deg)}",
	".dsh-pet-cfg__fold{display:grid;grid-template-rows:0fr;transition:grid-template-rows .12s ease}",
	".dsh-pet-cfg__card.is-open .dsh-pet-cfg__fold{grid-template-rows:1fr}",
	".dsh-pet-cfg__foldClip{min-height:0;overflow:hidden}",
	".dsh-pet-cfg__foldBody{display:flex;flex-direction:column;gap:10px;padding-top:10px}",
	".dsh-pet-cfg__grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 16px;align-items:end}",
	".dsh-pet-cfg__grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 16px;align-items:end}",
	".dsh-pet-cfg__grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;align-items:end}",
	"@container (max-width:600px){.dsh-pet-cfg__grid4{grid-template-columns:repeat(2,minmax(0,1fr))}}",
	"@container (max-width:400px){.dsh-pet-cfg__grid2,.dsh-pet-cfg__grid3,.dsh-pet-cfg__grid4{grid-template-columns:minmax(0,1fr)}}",
	".dsh-pet-cfg__field{display:flex;flex-direction:column;gap:4px;min-width:0}",
	".dsh-pet-cfg__flabel{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary)}",
	".dsh-pet-cfg__inp{box-sizing:border-box;width:100%;min-height:28px;padding:4px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}",
	".dsh-pet-cfg__inp:focus{border-color:var(--dsw-alias-state-business-primary)}",
	".dsh-pet-cfg__inp:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}",
	".dsh-pet-cfg__persona{display:flex;flex-direction:column;gap:2px;min-width:0}",
	".dsh-pet-cfg__area{min-height:66px;resize:vertical;line-height:18px}",
	".dsh-pet-cfg__count{font-size:11px;color:var(--dsw-alias-label-tertiary);text-align:right}",
	".dsh-pet-cfg__toggle{display:flex;align-items:center;gap:6px;min-width:0;font-size:13px;color:var(--dsw-alias-label-primary)}",
	".dsh-pet-cfg__toggle>label{display:inline-flex;align-items:center;gap:6px;cursor:pointer;min-width:0}",
	".dsh-pet-cfg__toggle>label>span{overflow-wrap:anywhere}",
	".dsh-pet-cfg__toggle input[type=checkbox]{flex:none;width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-state-business-primary);cursor:pointer}",
	".pet-cfg-tip{position:fixed;left:0;top:0;z-index:2147483000;max-width:320px;padding:6px 10px;border-radius:8px;background:var(--dsw-alias-tooltip-bg);color:var(--dsw-static-neutral-00);font-size:12px;font-style:normal;font-weight:400;line-height:18px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none;opacity:0;transition:opacity .12s ease;box-shadow:var(--dsw-elevation-prominent,0 6px 20px rgba(0,0,0,.22))}",
	".pet-cfg-tip.is-on{opacity:1}",
	".dsh-pet-cfg__q{display:inline-flex;align-items:center;justify-content:center;flex:none;width:14px;height:14px;border:1px solid var(--dsw-alias-label-tertiary);border-radius:50%;color:var(--dsw-alias-label-tertiary);font-size:10px;font-style:normal;line-height:1;cursor:help;user-select:none}",
	".dsh-pet-cfg__qWrap{display:inline-flex;flex:none;align-items:center}",
	".dsh-pet-cfg__btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 14px;font:inherit;font-size:12px;line-height:20px;cursor:pointer;white-space:nowrap}",
	".dsh-pet-cfg__btn:hover:not(:disabled):not(.is-primary){background:var(--dsw-alias-interactive-bg-hover)}",
	".dsh-pet-cfg__btn:disabled{opacity:.5;cursor:default}",
	".dsh-pet-cfg__btn.is-primary{border-color:var(--dsw-alias-button-info-fill);background:var(--dsw-alias-button-info-fill);color:#fff}",
	".dsh-pet-cfg__btn.is-primary:hover:not(:disabled){border-color:var(--dsw-alias-button-info-hover);background:var(--dsw-alias-button-info-hover)}",
	".dsh-pet-cfg__btn.is-danger{border-color:var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary)}",
	".dsh-pet-cfg__btn.is-sm{padding:2px 10px}",
	".dsh-pet-cfg__btn.is-ghost{border-style:dashed;color:var(--dsw-alias-label-secondary)}",
	".dsh-pet-cfg__tabs{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
	".dsh-pet-cfg__tabsLabel{font-size:12px;color:var(--dsw-alias-label-secondary)}",
	".dsh-pet-cfg__kinds{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}",
	".dsh-pet-cfg__tab{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}",
	".dsh-pet-cfg__tab:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
	".dsh-pet-cfg__tab:disabled{opacity:.5;cursor:default}",
	".dsh-pet-cfg__tab.is-active{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-active)}",
	".dsh-pet-cfg__tab.is-ghost{border-style:dashed;color:var(--dsw-alias-label-secondary)}",
	".dsh-pet-cfg__actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}",
	".dsh-pet-cfg__msg{margin-left:4px;font-size:12px;color:var(--dsw-alias-state-success-primary)}",
	".dsh-pet-cfg__msg.is-err{color:var(--dsw-alias-state-error-primary)}",
	".dsh-pet-cfg__note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
	".dsh-pet-cfg__path{font-size:12px;line-height:18px;word-break:break-all;user-select:text;color:var(--dsw-alias-label-secondary)}",
	".dsh-pet-cfg__path b{color:var(--dsw-alias-label-primary);font-weight:400}",
	".dsh-pet-cfg__cmd{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,\"Courier New\",monospace;font-size:12px;line-height:18px;word-break:break-all;user-select:text;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}"
].join("\n");
/** 注入去重用的标记值，写在 `<style>` 的 `data-plugin-css` 上。 */
const settingsCssTag = "dsh-pet/settings.css";
function injectSettingsCss() {
	if (typeof document === "undefined") return;
	if (document.querySelector("style[data-plugin-css=\"" + settingsCssTag + "\"]") !== null) return;
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-pet";
	tag.dataset.pluginCss = settingsCssTag;
	tag.textContent = SETTINGS_CSS;
	document.head.appendChild(tag);
}

//#endregion
//#region src/client/settings/ui.ts
const INPUT_CLASS = "dsh-pet-cfg__inp";
function numberInputProps(value, onCommit, extra = {}) {
	return {
		...extra,
		type: "number",
		className: INPUT_CLASS,
		defaultValue: String(value),
		key: String(value),
		onBlur: (e) => {
			const text = e.target.value.trim();
			const parsed = Number(text);
			const next = text !== "" && Number.isFinite(parsed) ? parsed : value;
			e.target.value = String(next);
			if (next !== value) onCommit(next);
		},
		onKeyDown: (e) => {
			if (e.key === "Enter") e.currentTarget.blur();
		}
	};
}
const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Courier New\", monospace";
function makeUiKit(rt) {
	const { h, t } = rt;
	/**
	* 悬浮说明的展开属性。
	*
	* @param text - 说明正文（已翻译）。
	*/
	const tip = (text) => ({ "data-tip": text });
	/** 问号：气泡的圆形触发元素。用 `<i>` 而不是 `<button>`——它只展示说明，点了不该有行为，也不该进 Tab 顺序。 */
	const q = (text) => h("i", {
		className: "dsh-pet-cfg__q",
		...tip(text),
		"aria-label": text,
		role: "img",
		children: "?"
	});
	return {
		tip,
		q,
		cardHead: (title, hint) => h("div", {
			className: "dsh-pet-cfg__cardHead",
			children: [h("span", {
				key: "t",
				className: "dsh-pet-cfg__cardTitle",
				children: title
			}), hint ? q(hint) : null]
		}),
		field: (label, control, hint) => h("div", {
			className: "dsh-pet-cfg__field",
			children: [h("span", {
				key: "l",
				className: "dsh-pet-cfg__flabel",
				children: hint ? [label, q(hint)] : label
			}), control]
		}),
		toggleCell: (label, value, disabled, onToggle) => h("div", {
			className: "dsh-pet-cfg__toggle",
			children: [h("label", {
				key: "l",
				children: [h("input", {
					key: "i",
					type: "checkbox",
					checked: value,
					disabled,
					onChange: (e) => onToggle(e.target.checked)
				}), h("span", {
					key: "t",
					children: t(label)
				})]
			}), q(t(label + "Hint"))]
		}),
		foldCard: (options) => h("div", {
			className: "dsh-pet-cfg__card is-fold" + (options.open ? " is-open" : ""),
			children: [h("button", {
				key: "head",
				type: "button",
				className: "dsh-pet-cfg__foldToggle",
				"aria-expanded": options.open,
				"aria-controls": options.id,
				onClick: options.onToggle,
				children: [
					h("span", {
						key: "t",
						className: "dsh-pet-cfg__cardTitle",
						children: options.title
					}),
					h("span", {
						key: "q",
						className: "dsh-pet-cfg__qWrap",
						onClick: (e) => e.stopPropagation(),
						children: q(options.hint)
					}),
					h("i", {
						key: "c",
						className: "dsh-pet-cfg__chevron" + (options.open ? " is-open" : ""),
						"aria-hidden": "true"
					})
				]
			}), h("div", {
				key: "body",
				id: options.id,
				className: "dsh-pet-cfg__fold",
				"aria-hidden": options.open ? void 0 : "true",
				children: h("div", {
					className: "dsh-pet-cfg__foldClip",
					children: h("div", {
						className: "dsh-pet-cfg__foldBody",
						children: options.body
					})
				})
			})]
		})
	};
}

//#endregion
//#region src/client/settings/actions.ts
function makeActions(rt) {
	const { h, t } = rt;
	const { tip, q } = makeUiKit({
		h,
		t
	});
	return function Actions(props) {
		const { busy, msg, permMsg } = props;
		return h("div", {
			className: "dsh-pet-cfg__actions",
			children: [
				h("button", {
					type: "button",
					disabled: busy,
					onClick: props.onSave,
					className: "dsh-pet-cfg__btn is-primary",
					...tip(t("saveHotkey")),
					children: t("save")
				}),
				h("button", {
					type: "button",
					disabled: busy,
					onClick: props.onSync,
					className: "dsh-pet-cfg__btn",
					children: t("sync")
				}),
				h("button", {
					type: "button",
					onClick: props.onTestNotification,
					className: "dsh-pet-cfg__btn",
					children: t("notifyTest")
				}),
				q(t("syncHint")),
				msg.text ? h("span", {
					className: "dsh-pet-cfg__msg" + (msg.kind === "err" ? " is-err" : ""),
					children: msg.text
				}) : null,
				permMsg.text ? h("span", {
					className: "dsh-pet-cfg__msg" + (permMsg.kind === "err" ? " is-err" : ""),
					children: permMsg.text
				}) : null
			]
		});
	};
}

//#endregion
//#region src/client/settings/bridge.ts
const petBridge = {
	current: [],
	reload: () => {},
	template: void 0
};

//#endregion
//#region src/client/settings/config/read.ts
/** 非负有限数才算合法；其余（`NaN`、负数、字符串）一律当作没写。 */
const nonNegative = (value) => {
	const n = Number(value);
	return Number.isFinite(n) && n >= 0 ? n : void 0;
};
/** 一对模型选择：两项都是字符串才算写全，只写一半视为没写（宿主会按非法拒绝）。 */
const readModel = (value) => {
	const model = value;
	if (!model || typeof model.provider !== "string" || typeof model.model !== "string") return void 0;
	return {
		provider: model.provider,
		model: model.model
	};
};
function readMainConfig(merged) {
	const main = merged.main;
	if (!main || !Array.isArray(main.pets)) return null;
	const pets = main.pets;
	const patch = { pets: pets.map((pet) => ({
		...pet,
		position: { ...pet.position }
	})) };
	if (typeof main.whisperPrompt === "string") patch.entryPrompt = main.whisperPrompt;
	if (typeof main.notificationsEnabled === "boolean") patch.notificationsEnabled = main.notificationsEnabled;
	if (typeof main.clickSoundEnabled === "boolean") patch.clickSoundEnabled = main.clickSoundEnabled;
	if (typeof main.whisperImageEnabled === "boolean") patch.whisperImageEnabled = main.whisperImageEnabled;
	if (typeof main.chatImageEnabled === "boolean") patch.chatImageEnabled = main.chatImageEnabled;
	if (typeof main.chatAnimationEnabled === "boolean") patch.chatAnimationEnabled = main.chatAnimationEnabled;
	if (typeof main.confineToScreen === "boolean") patch.confineToScreen = main.confineToScreen;
	if (typeof main.trayEnabled === "boolean") patch.trayEnabled = main.trayEnabled;
	if (typeof main.voiceEnabled === "boolean") patch.voiceEnabled = main.voiceEnabled;
	if (typeof main.voiceName === "string") patch.voiceName = main.voiceName;
	if (typeof main.voiceWhisperEnabled === "boolean") patch.voiceWhisperEnabled = main.voiceWhisperEnabled;
	if (typeof main.voiceTodoEnabled === "boolean") patch.voiceTodoEnabled = main.voiceTodoEnabled;
	if (main.physics && typeof main.physics === "object") patch.physics = {
		...DEFAULT_PHYSICS,
		...main.physics
	};
	if (main.font && typeof main.font === "object") patch.font = {
		...DEFAULT_FONT,
		...main.font
	};
	const whisperModel = readModel(main.whisperModel);
	if (whisperModel) patch.whisperModel = whisperModel;
	const chatModel = readModel(main.chatModel);
	if (chatModel) patch.chatModel = chatModel;
	const rounds = nonNegative(main.chatMemoryRounds);
	if (rounds !== void 0) patch.chatMemoryRounds = rounds;
	const limit = nonNegative(main.chatImageLimit);
	if (limit !== void 0) patch.chatImageLimit = limit;
	const volume = nonNegative(main.voiceVolume);
	if (volume !== void 0 && volume <= 1) patch.voiceVolume = volume;
	return patch;
}
function readConfigEntries(merged) {
	const main = merged.main;
	if (!main || !Array.isArray(main.pets)) return null;
	const out = [];
	for (const [key, conf] of Object.entries(merged)) {
		const pets = Array.isArray(conf?.pets) ? conf.pets : [];
		out.push({
			key,
			kind: key === "main" ? "main" : "pack",
			...typeof conf?.whisperPrompt === "string" ? { entryPrompt: conf.whisperPrompt } : {},
			pets: pets.map((pet) => ({
				...pet,
				position: { ...pet.position },
				assetRoot: key
			}))
		});
	}
	return out;
}

//#endregion
//#region src/client/settings/config/http.ts
function buildSaveBody(fields) {
	return {
		pets: fields.pets,
		notificationsEnabled: fields.notificationsEnabled,
		clickSoundEnabled: fields.clickSoundEnabled,
		whisperImageEnabled: fields.whisperImageEnabled,
		chatImageEnabled: fields.chatImageEnabled,
		chatAnimationEnabled: fields.chatAnimationEnabled,
		confineToScreen: fields.confineToScreen,
		trayEnabled: fields.trayEnabled,
		voiceEnabled: fields.voiceEnabled,
		voiceName: fields.voiceName,
		voiceVolume: fields.voiceVolume,
		voiceWhisperEnabled: fields.voiceWhisperEnabled,
		voiceTodoEnabled: fields.voiceTodoEnabled,
		physics: fields.physics,
		whisperModel: fields.whisperModel,
		chatModel: fields.chatModel,
		chatMemoryRounds: fields.chatMemoryRounds,
		chatImageLimit: fields.chatImageLimit,
		font: fields.font
	};
}
async function loadConfig(signal) {
	try {
		const response = await fetch(ROUTE_PATH + "/config", signal === void 0 ? {} : { signal });
		if (!response.ok) return null;
		const body = await response.json();
		if (body.ok === false) return null;
		return body;
	} catch {
		return null;
	}
}
async function loadMeta() {
	try {
		const response = await fetch(ROUTE_PATH + "/config/meta");
		if (!response.ok) return null;
		return await response.json();
	} catch {
		return null;
	}
}
async function loadModelCatalog() {
	try {
		const response = await fetch(ROUTE_PATH + "/models");
		if (!response.ok) return null;
		const body = await response.json();
		if (!body || !Array.isArray(body.providers)) return null;
		return body.providers;
	} catch {
		return null;
	}
}
async function saveConfig(body, force) {
	try {
		const response = await fetch(ROUTE_PATH + "/config" + (force === true ? "?force=1" : ""), {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		});
		const payload = await response.json().catch(() => null);
		if (payload && payload.ok === false) {
			if (payload.reason === "user-config-unparsable") return {
				kind: "corrupt",
				userFile: typeof payload.userFile === "string" ? payload.userFile : null
			};
			if (payload.reason === "bad-request" || payload.reason === "invalid-json") return { kind: "invalid" };
			return { kind: "error" };
		}
		if (!response.ok) return { kind: "error" };
		return {
			kind: "ok",
			merged: payload
		};
	} catch {
		return { kind: "error" };
	}
}
async function syncConfig() {
	try {
		const response = await fetch(ROUTE_PATH + "/config", { method: "POST" });
		if (!response.ok) return null;
		return await response.json();
	} catch {
		return null;
	}
}
async function savePetLayer(entry, pets) {
	try {
		const response = await fetch(ROUTE_PATH + "/pet-config", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				entry,
				pets
			})
		});
		const payload = await response.json().catch(() => null);
		if (payload && payload.ok === false) {
			if (payload.reason === "bad-request" || payload.reason === "unknown-entry") return {
				kind: "invalid",
				message: typeof payload.message === "string" ? payload.message : ""
			};
			return { kind: "error" };
		}
		if (!response.ok) return { kind: "error" };
		return {
			kind: "ok",
			merged: payload
		};
	} catch {
		return { kind: "error" };
	}
}

//#endregion
//#region src/client/settings/config/pack-writes.ts
/** 提交形状的指纹：只含会被宿主持久化的字段，位置逐子字段取。 */
function fingerprint(pet) {
	return JSON.stringify([
		pet.id,
		pet.name,
		pet.size,
		pet.sizePercent ?? "",
		pet.balanceEnabled,
		pet.whisperEnabled,
		pet.workStatusEnabled,
		pet.fixedEnabled,
		pet.display,
		pet.position.corner,
		pet.position.marginX,
		pet.position.marginY,
		pet.whisperPrompt ?? ""
	]);
}
function diffPackWrites(loaded, current$1) {
	const groups = new Map();
	for (const pet of current$1) {
		const entry = pet.assetRoot ?? "";
		if (entry === "" || entry === "main") continue;
		const list = groups.get(entry);
		if (list) list.push(pet);
		else groups.set(entry, [pet]);
	}
	const out = [];
	for (const [entry, pets] of groups) {
		const before = loaded.find((item) => item.key === entry)?.pets ?? [];
		const unchanged = before.length === pets.length && before.every((pet, i) => fingerprint(pet) === fingerprint(pets[i]));
		if (!unchanged) out.push({
			entry,
			pets
		});
	}
	return out;
}

//#endregion
//#region src/client/settings/config/persist.ts
async function persistSettings(fields, packWrites, force, fallbackUserFile) {
	const outcome = await saveConfig(buildSaveBody(fields), force);
	if (outcome.kind === "corrupt") return {
		kind: "corrupt",
		path: outcome.userFile ?? fallbackUserFile
	};
	if (outcome.kind !== "ok") return { kind: outcome.kind };
	let merged = outcome.merged;
	const failed = [];
	for (const write of packWrites) {
		const result = await savePetLayer(write.entry, write.pets);
		if (result.kind === "ok") merged = result.merged;
		else failed.push(write.entry);
	}
	petBridge.reload(merged);
	reloadNotifications();
	return failed.length > 0 ? {
		kind: "partial",
		failed
	} : { kind: "ok" };
}
async function syncSettings() {
	const merged = await syncConfig();
	if (merged === null) return null;
	petBridge.reload(merged);
	reloadNotifications();
	return merged;
}

//#endregion
//#region src/client/settings/config/validate-form.ts
const modelPairValid = (model) => model.provider.trim() === "" === (model.model.trim() === "");
/** 宠物：宽度必须为正数、百分比缺省或是不小于 1 的数字、两个偏移必须是有限数（负数合法，宠物可以压出屏外）。 */
const petValid = (pet) => Number.isFinite(pet.size) && pet.size > 0 && (pet.sizePercent === void 0 || isValidSizePercent(pet.sizePercent)) && Number.isFinite(pet.position.marginX) && Number.isFinite(pet.position.marginY);
/** 物理参数：与宿主 `physicsValid` 同名规则，客户端只覆盖数值字段（布尔项由宿主兜底）。 */
const physicsValid = (physics) => Number.isFinite(physics.gravity) && physics.gravity >= 0 && Number.isFinite(physics.restitution) && physics.restitution >= 0 && physics.restitution <= 1 && Number.isFinite(physics.groundFriction) && physics.groundFriction >= 0 && Number.isFinite(physics.throwPower) && physics.throwPower > 0;
/** 字体：种类必须在预设白名单内，字号在闭区间内。 */
const fontValid = (font) => typeof font.family === "string" && font.family.length <= 200 && Number.isFinite(font.size) && font.size >= FONT_SIZE_MIN && font.size <= FONT_SIZE_MAX;
function validateForm(values) {
	if (!values.pets.every(petValid)) return "invalid";
	if (!physicsValid(values.physics)) return "invalidPhysics";
	if (!modelPairValid(values.whisperModel) || !modelPairValid(values.chatModel)) return "invalidModel";
	if (!Number.isFinite(values.chatMemory) || values.chatMemory < 0) return "invalidChatMemory";
	if (!Number.isFinite(values.chatImageLimit) || values.chatImageLimit < 0) return "invalidChatImageLimit";
	if (!fontValid(values.font)) return "invalidFont";
	return null;
}

//#endregion
//#region src/client/settings/config/write-flow.ts
function createWriteFlow(deps) {
	const { setBusy, setMsg, setDialog, t } = deps;
	const save = async (force = false) => {
		if (deps.busy()) return;
		const fields = deps.fields();
		const invalid = validateForm({
			pets: fields.pets,
			physics: fields.physics,
			whisperModel: fields.whisperModel,
			chatModel: fields.chatModel,
			chatMemory: fields.chatMemoryRounds,
			chatImageLimit: fields.chatImageLimit,
			font: fields.font
		});
		if (invalid !== null) {
			setMsg({
				kind: "err",
				text: t(invalid)
			});
			return;
		}
		setBusy(true);
		setMsg({
			kind: "",
			text: ""
		});
		try {
			const result = await persistSettings(fields, deps.packWrites(), force, deps.userFile());
			if (result.kind === "ok") {
				setMsg({
					kind: "ok",
					text: t("saved")
				});
				return;
			}
			if (result.kind === "corrupt") {
				setDialog({
					kind: "corrupt",
					path: result.path
				});
				return;
			}
			if (result.kind === "partial") {
				setMsg({
					kind: "err",
					text: t("savePartial").replace("{names}", result.failed.join("、"))
				});
				return;
			}
			setMsg({
				kind: "err",
				text: t(result.kind === "invalid" ? "saveInvalid" : "saveError")
			});
		} finally {
			setBusy(false);
		}
	};
	const doSync = async () => {
		setBusy(true);
		setMsg({
			kind: "",
			text: ""
		});
		try {
			const merged = await syncSettings();
			if (merged === null) {
				setMsg({
					kind: "err",
					text: t("syncError")
				});
				return;
			}
			deps.applyConfig(merged);
			setMsg({
				kind: "ok",
				text: t("saved")
			});
		} finally {
			setBusy(false);
		}
	};
	return {
		save,
		requestSync: () => setDialog({ kind: "sync" }),
		confirmDialog: () => {
			const pending = deps.dialog();
			if (pending === null) return;
			setDialog(null);
			if (pending.kind === "remove") deps.onRemove();
			else if (pending.kind === "corrupt") save(true);
			else if (pending.kind === "sync") doSync();
		}
	};
}

//#endregion
//#region src/client/settings/config/use-config-load.ts
function useConfigLoad(rt, onMerged) {
	const { useState, useEffect } = rt;
	const [loadState, setLoadState] = useState("loading");
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let alive = true;
		const controller = new AbortController();
		loadConfig(controller.signal).then((merged) => {
			if (!alive) return;
			if (merged === null) {
				setLoadState("error");
				return;
			}
			onMerged(merged);
			setLoadState("ready");
		}).catch(() => {
			if (alive) setLoadState("error");
		});
		return () => {
			alive = false;
			controller.abort();
		};
	}, [onMerged, attempt]);
	const retry = () => {
		setLoadState("loading");
		setAttempt((value) => value + 1);
	};
	return {
		loadState,
		retry
	};
}

//#endregion
//#region src/client/settings/dialog.ts
/** 正文文案：每个场景一句，参数就地代入。 */
function bodyText(dialog, t, selId) {
	if (dialog.kind === "remove") return t("confirmRemove").replace("{id}", selId);
	if (dialog.kind === "lastOne") return t("atLeastOne");
	if (dialog.kind === "lastOfKind") return t("lastOfKind").replace("{entry}", dialog.entry);
	if (dialog.kind === "corrupt") return t("corruptBody").replace("{path}", dialog.path);
	return t("confirmSync");
}
/** 确认按钮文案：三个可确认场景各一句。 */
function confirmLabel(kind, t) {
	if (kind === "remove") return t("remove");
	if (kind === "corrupt") return t("corruptConfirm");
	return t("sync");
}
function makeDialog(rt) {
	const { h, t } = rt;
	return function SettingsDialog(props) {
		const { dialog } = props;
		const confirmable = dialog.kind === "lastOne" || dialog.kind === "lastOfKind" ? null : dialog;
		return h("div", {
			style: {
				position: "fixed",
				inset: 0,
				zIndex: 2147483647,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(0, 0, 0, 0.45)"
			},
			onClick: props.onDismiss,
			children: h("div", {
				style: {
					width: "340px",
					maxWidth: "calc(100vw - 40px)",
					background: "var(--dsw-alias-bg-layer-1)",
					border: "1px solid var(--dsw-alias-border-l2)",
					borderRadius: "12px",
					padding: "16px 18px",
					boxShadow: "0 8px 30px rgba(0, 0, 0, 0.35)",
					display: "flex",
					flexDirection: "column",
					gap: "12px"
				},
				onClick: (e) => e.stopPropagation(),
				children: [
					h("div", {
						style: {
							fontSize: "14px",
							fontWeight: 500,
							color: "var(--dsw-alias-label-primary)"
						},
						children: t(dialog.kind === "corrupt" ? "corruptTitle" : "confirmTitle")
					}),
					h("div", {
						style: {
							fontSize: "13px",
							lineHeight: "20px",
							color: "var(--dsw-alias-label-secondary)"
						},
						children: bodyText(dialog, t, props.selId)
					}),
					h("div", {
						style: {
							display: "flex",
							gap: "8px",
							justifyContent: "flex-end"
						},
						children: confirmable === null ? [h("button", {
							key: "ok",
							type: "button",
							onClick: props.onDismiss,
							className: "dsh-pet-cfg__btn is-primary",
							children: t("ok")
						})] : [h("button", {
							key: "cancel",
							type: "button",
							onClick: props.onDismiss,
							className: "dsh-pet-cfg__btn",
							children: t("cancel")
						}), h("button", {
							key: "confirm",
							type: "button",
							onClick: props.onConfirm,
							className: "dsh-pet-cfg__btn " + (confirmable.kind === "sync" ? "is-primary" : "is-danger"),
							children: confirmLabel(confirmable.kind, t)
						})]
					})
				]
			})
		});
	};
}

//#endregion
//#region src/client/settings/font-card.ts
function makeFontCard(rt) {
	const { h, t } = rt;
	const { cardHead, field, toggleCell } = makeUiKit({
		h,
		t
	});
	return function FontCard(props) {
		const { busy, font } = props;
		return h("div", {
			className: "dsh-pet-cfg__card",
			children: [
				cardHead(t("fontTitle"), t("fontHint")),
				h("div", {
					className: "dsh-pet-cfg__grid2",
					children: [field(t("fontFamilyLabel"), h("input", {
						type: "text",
						className: INPUT_CLASS,
						value: String(font.family ?? ""),
						disabled: busy,
						maxLength: 200,
						onChange: (e) => props.onChange({ family: e.target.value })
					}), t("fontFamilyHint")), field(t("fontSizeLabel"), h("input", numberInputProps(font.size, (v) => props.onChange({ size: v }), {
						step: "1",
						min: String(FONT_SIZE_MIN),
						max: String(FONT_SIZE_MAX),
						disabled: busy
					})), t("fontSizeHint"))]
				}),
				h("div", {
					className: "dsh-pet-cfg__grid2",
					children: [toggleCell("fontFollowToggle", font.followPet, busy, (v) => props.onChange({ followPet: v }))]
				})
			]
		});
	};
}

//#endregion
//#region src/client/settings/global-card.ts
/** 开关的展示顺序与文案键。 */
const TOGGLES = [
	{
		key: "notificationsEnabled",
		label: "notifyToggle"
	},
	{
		key: "clickSoundEnabled",
		label: "clickSoundToggle"
	},
	{
		key: "confineToScreen",
		label: "confineToggle"
	},
	{
		key: "trayEnabled",
		label: "trayToggle"
	}
];
function makeGlobalCard(rt) {
	const { h, t } = rt;
	const { cardHead, toggleCell } = makeUiKit({
		h,
		t
	});
	return function GlobalCard(props) {
		return h("div", {
			className: "dsh-pet-cfg__card",
			children: [cardHead(t("globalTitle"), t("globalHint")), h("div", {
				className: "dsh-pet-cfg__grid4",
				children: TOGGLES.map((toggle) => toggleCell(toggle.label, props.values[toggle.key], props.busy, (value) => props.onChange(toggle.key, value)))
			})]
		});
	};
}

//#endregion
//#region src/client/settings/load-status.ts
function makeLoadStatus(rt) {
	const { h, t } = rt;
	return function LoadStatus(props) {
		if (props.loadState === "ready") return null;
		const failed = props.loadState === "error";
		return h("div", {
			role: failed ? "alert" : "status",
			className: "dsh-pet-cfg__actions",
			children: [h("span", { children: t(failed ? "loadError" : "loading") }), failed ? h("button", {
				type: "button",
				className: "dsh-pet-cfg__btn",
				onClick: props.onRetry,
				children: t("retry")
			}) : null]
		});
	};
}

//#endregion
//#region src/client/settings/notify-test.ts
async function runNotificationTest(deps) {
	const { t, report } = deps;
	report({
		kind: "",
		text: ""
	});
	const result = await requestNotificationPermission();
	if (!result.ok) {
		const reason = result.reason === "unsupported" ? t("notifyDenyUnsupported") : result.reason === "denied" ? t("notifyDenyBlocked") : result.reason === "rejected" ? t("notifyDenyRejected") : t("notifyDenyError") + (result.message ? "：" + result.message : "");
		report({
			kind: "err",
			text: reason + (result.reason === "unsupported" ? "" : " " + t("notifyGuide"))
		});
		return;
	}
	try {
		wireNotificationClick(new Notification("测试通知", {
			body: "【dsh-pet】系统通知已就绪。",
			icon: NOTIFY_ICONS.test
		}));
	} catch {}
	report({
		kind: "ok",
		text: t("notifyTestOk")
	});
}

//#endregion
//#region src/client/settings/paths-cards.ts
/** 折叠正文的 id：与按钮的 `aria-controls` 成对，两张卡各一份。 */
const BODY_ID$1 = {
	meta: "pet-cfg-paths-meta",
	storage: "pet-cfg-paths-storage"
};
function makePathsCards(rt) {
	const { h, t, useState } = rt;
	const { foldCard } = makeUiKit({
		h,
		t
	});
	function ConfigMetaCard(props) {
		const { paths } = props;
		const [open, setOpen] = useState(false);
		const line = (key, value, suffix = "") => value === void 0 ? null : h("div", {
			key,
			className: "dsh-pet-cfg__path",
			children: t(key) + "：" + value + suffix
		});
		const body = [
			line("defaultConfig", paths.default),
			line("userConfig", paths.user),
			line("todosFile", paths.todos),
			line("animationDir", paths.animations),
			line("memesDir", paths.memes),
			line("logFile", paths.logs),
			paths.logs ? h("div", {
				key: "logNote",
				className: "dsh-pet-cfg__note",
				children: t("logFileNote")
			}) : null
		];
		return foldCard({
			id: BODY_ID$1.meta,
			title: t("configMeta"),
			hint: t("configMetaHint"),
			body,
			open,
			onToggle: () => setOpen(!open)
		});
	}
	function StorageCard(props) {
		const { paths } = props;
		const [open, setOpen] = useState(false);
		const storage = paths.storage ?? [];
		if (storage.length === 0) return null;
		const body = [
			...storage.map((entry) => h("div", {
				key: entry.key,
				className: "dsh-pet-cfg__path",
				children: [h("b", {
					key: "p",
					style: { fontFamily: MONO_STACK },
					children: entry.path
				}), h("span", {
					key: "d",
					children: " — " + t("storage." + entry.key) + (entry.exists === false ? t("storageMissing") : "")
				})]
			})),
			h("div", {
				key: "ut",
				className: "dsh-pet-cfg__cardTitle",
				style: { marginTop: "4px" },
				children: t("uninstallTitle")
			}),
			h("div", {
				key: "u1",
				className: "dsh-pet-cfg__note",
				children: t("uninstallStep1")
			}),
			h("div", {
				key: "u2",
				className: "dsh-pet-cfg__note",
				children: t("uninstallStep2")
			}),
			h("div", {
				key: "cmd",
				className: "dsh-pet-cfg__cmd",
				children: t("uninstallCmd").replace("{profile}", paths.profile || "<profile>")
			}),
			h("div", {
				key: "u3",
				className: "dsh-pet-cfg__note",
				children: t("uninstallStep3")
			})
		];
		return foldCard({
			id: BODY_ID$1.storage,
			title: t("storageTitle"),
			hint: t("storageHint"),
			body,
			open,
			onToggle: () => setOpen(!open)
		});
	}
	return {
		ConfigMetaCard,
		StorageCard
	};
}

//#endregion
//#region src/shared/config.ts
const PET_DISPLAYS = [
	"web",
	"desktop",
	"both",
	"none"
];
const isWebVisible = (display) => display === "web" || display === "both";
function flattenConfigPets(merged) {
	const out = [];
	for (const [entry, conf] of Object.entries(merged)) {
		const list = Array.isArray(conf?.pets) ? conf.pets : [];
		for (const p of list) out.push({
			...p,
			animations: conf.animations,
			animationWeights: conf.animationWeights,
			eventsRefreshSec: conf.eventsRefreshSec,
			physics: conf.physics,
			font: conf.font,
			confineToScreen: conf.confineToScreen,
			workStatusTexts: conf.workStatusTexts,
			sleepStartTexts: conf.sleepStartTexts,
			sleepEndTexts: conf.sleepEndTexts,
			sleepRefuseTexts: conf.sleepRefuseTexts,
			whisperModel: conf.whisperModel,
			chatModel: conf.chatModel,
			memes: conf.memes,
			chatImageEnabled: conf.chatImageEnabled,
			chatAnimationEnabled: conf.chatAnimationEnabled,
			chatImageLimit: conf.chatImageLimit,
			assetRoot: entry,
			extra: entry !== "main"
		});
	}
	return out;
}

//#endregion
//#region src/client/settings/panel/placement.ts
/**
* 设置页浮层的定位计算：把触发器的实测矩形与视口尺寸换算成浮层的 fixed 坐标。
* 下方放不下且上方更宽裕时翻到上方，左右钳制在视口内，并给出高度上限——浮层自身不进文档流。
* 纯函数，不读 `window`：矩形与视口由调用方传入，便于单测与将来的视口外定位。
* 模型选择器与通用单选下拉共用这一份算术，差异只经 {@link PlacementOptions} 传入，不在调用方各自复制。
* @module dsh-pet/src/client/settings/panel/placement
*/
/** 浮层与触发器、视口边缘之间的间距。 */
const PANEL_GAP_PX = 12;
/** 浮层离触发器的偏移，避免贴着触发器边框。 */
const PANEL_OFFSET_PX = 4;
/** 视口余量：浮层左右各留 8px，不贴死屏幕边。 */
const EDGE_MARGIN_PX = 8;
/** 视口更窄时浮层宽度的兜底余量。 */
const VIEWPORT_INSET_PX = 16;
/** 视口窄到连它都装不下时，仍按这个宽度渲染。 */
const MIN_AVAILABLE_WIDTH_PX = 200;
function computePanelPlacement(anchor, viewport, options = {}) {
	const minWidth = options.minWidthPx ?? 240;
	const maxWidth = options.maxWidthPx ?? 420;
	const maxHeight = options.maxHeightPx ?? 360;
	const flipThreshold = options.flipThresholdPx ?? 240;
	const below = viewport.height - anchor.bottom - PANEL_GAP_PX;
	const above = anchor.top - PANEL_GAP_PX;
	const available = Math.max(MIN_AVAILABLE_WIDTH_PX, Math.min(maxWidth, viewport.width - VIEWPORT_INSET_PX));
	const width = Math.min(Math.max(anchor.width, minWidth), available);
	const left = Math.max(EDGE_MARGIN_PX, Math.min(anchor.left, viewport.width - width - EDGE_MARGIN_PX));
	const openUp = below < flipThreshold && above > below;
	return openUp ? {
		left,
		bottom: viewport.height - anchor.top + PANEL_OFFSET_PX,
		width,
		maxHeight: Math.min(maxHeight, above)
	} : {
		left,
		top: anchor.bottom + PANEL_OFFSET_PX,
		width,
		maxHeight: Math.min(maxHeight, below)
	};
}

//#endregion
//#region src/client/settings/panel/select.ts
function makeSelect(rt) {
	const { h, useState, useEffect, useRef } = rt;
	return function Select(props) {
		const [open, setOpen] = useState(false);
		const [active, setActive] = useState(0);
		const [pos, setPos] = useState(null);
		const rootRef = useRef(null);
		const panelRef = useRef(null);
		const selectedAt = props.options.findIndex((option) => option.id === props.value);
		const currentLabel = selectedAt >= 0 ? props.options[selectedAt].label : "";
		/** 打开并把高亮停到当前选中项上。 */
		const openAt = (index) => {
			setActive(index >= 0 ? index : 0);
			setOpen(true);
		};
		const commit = (index) => {
			const option = props.options[index];
			setOpen(false);
			if (option !== void 0 && option.id !== props.value) props.onChange(option.id);
		};
		const step = (dir) => {
			const count = props.options.length;
			if (count === 0) return;
			const next = (Math.max(active, 0) + dir + count) % count;
			setActive(next);
			panelRef.current?.querySelector("[data-row=\"" + next + "\"]")?.scrollIntoView({ block: "nearest" });
		};
		useEffect(() => {
			if (!open) return;
			const root = rootRef.current;
			const place = () => {
				if (!root) return;
				setPos(computePanelPlacement(
					root.getBoundingClientRect(),
					{
						width: window.innerWidth,
						height: window.innerHeight
					},
					// 与触发器等宽：240 的下限是给「服务商 + 模型」两段文字留的，单行下拉不该继承。
					{ minWidthPx: 0 }
));
			};
			place();
			const onDown = (e) => {
				const target = e.target;
				if (target && (rootRef.current?.contains(target) === true || panelRef.current?.contains(target) === true)) return;
				setOpen(false);
			};
			const onKey = (e) => {
				if (e.key === "Escape") setOpen(false);
			};
			document.addEventListener("mousedown", onDown, true);
			document.addEventListener("keydown", onKey, true);
			window.addEventListener("scroll", place, true);
			window.addEventListener("resize", place);
			return () => {
				document.removeEventListener("mousedown", onDown, true);
				document.removeEventListener("keydown", onKey, true);
				window.removeEventListener("scroll", place, true);
				window.removeEventListener("resize", place);
			};
		}, [open]);
		useEffect(() => {
			if (props.disabled) setOpen(false);
		}, [props.disabled]);
		const toggle = () => {
			if (props.disabled) return;
			if (open) setOpen(false);
			else openAt(selectedAt);
		};
		const onTriggerKey = (e) => {
			const count = props.options.length;
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				if (open) step(e.key === "ArrowDown" ? 1 : -1);
				else openAt(selectedAt);
				return;
			}
			if (open && (e.key === "Home" || e.key === "End")) {
				e.preventDefault();
				setActive(e.key === "Home" || count === 0 ? 0 : count - 1);
				return;
			}
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				if (open) commit(active);
				else openAt(selectedAt);
			}
		};
		const panel = open && pos ? h("div", {
			ref: panelRef,
			className: "dsh-pet-sel__panel",
			role: "listbox",
			"aria-label": props.label,
			style: {
				left: pos.left + "px",
				top: pos.top === void 0 ? void 0 : pos.top + "px",
				bottom: pos.bottom === void 0 ? void 0 : pos.bottom + "px",
				width: pos.width + "px",
				maxHeight: pos.maxHeight + "px"
			},
			children: h("div", {
				className: "dsh-pet-sel__list",
				children: props.options.map((option, index) => h("button", {
					key: option.id,
					type: "button",
					role: "option",
					"aria-selected": option.id === props.value,
					"data-row": index,
					className: "dsh-pet-sel__item" + (index === active ? " is-active" : ""),
					onMouseMove: () => setActive(index),
					onClick: () => commit(index),
					children: [h("span", {
						key: "n",
						className: "dsh-pet-sel__name",
						children: option.label
					}), h("span", {
						key: "c",
						className: "dsh-pet-sel__check",
						children: option.id === props.value ? "✓" : ""
					})]
				}))
			})
		}) : null;
		return h("div", {
			ref: rootRef,
			className: "dsh-pet-sel",
			children: [h("button", {
				key: "trigger",
				type: "button",
				className: INPUT_CLASS + " dsh-pet-sel__trigger",
				disabled: props.disabled,
				"aria-haspopup": "listbox",
				"aria-expanded": open,
				"aria-label": props.label,
				onClick: toggle,
				onKeyDown: onTriggerKey,
				children: [h("span", {
					key: "l",
					className: "dsh-pet-sel__label",
					children: currentLabel
				}), h("span", {
					key: "c",
					className: "dsh-pet-sel__chevron" + (open ? " is-open" : "")
				})]
			}), panel]
		});
	};
}

//#endregion
//#region src/client/settings/pet-card.ts
/** 四个角落的固定顺序；文案走 `corner.<corner>`。 */
const CORNERS = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right"
];
function makePetCard(rt) {
	const { h, t } = rt;
	const { tip, q, field, toggleCell } = makeUiKit({
		h,
		t
	});
	const Select = makeSelect(rt);
	const numInput = (key, value, disabled, setter) => h("input", numberInputProps(value, setter, {
		step: key === "size" ? "10" : "1",
		min: key === "size" ? "120" : "",
		disabled
	}));
	return function PetCard(props) {
		const { pet, busy, msg } = props;
		if (pet === null) return h("p", {
			className: "dsh-pet-cfg__note",
			children: t("emptyPets")
		});
		return h("div", {
			className: "dsh-pet-cfg__card",
			children: [
				h("div", {
					className: "dsh-pet-cfg__cardHead",
					children: [
						h("span", {
							key: "t",
							className: "dsh-pet-cfg__cardTitle",
							children: t("petCardTitle")
						}),
						q(t("petCardHint")),
						h("div", {
							key: "acts",
							style: {
								marginLeft: "auto",
								display: "flex",
								alignItems: "center",
								gap: "6px"
							},
							children: [msg.text ? h("span", {
								key: "msg",
								className: "dsh-pet-cfg__msg" + (msg.kind === "err" ? " is-err" : ""),
								children: msg.text
							}) : null, h("button", {
								key: "sv",
								type: "button",
								onClick: props.onSave,
								disabled: busy,
								className: "dsh-pet-cfg__btn is-primary is-sm",
								...tip(t("saveHotkey")),
								children: t("save")
							})]
						})
					]
				}),
				h("div", {
					className: "dsh-pet-cfg__grid3",
					children: [
						field(t("nameLabel"), h("input", {
							type: "text",
							className: INPUT_CLASS,
							value: String(pet.name ?? ""),
							disabled: busy,
							maxLength: 50,
							onChange: (e) => props.onChange({ name: e.target.value })
						}), t("nameHint")),
						field(t("sizeLabel"), numInput("size", pet.size, busy, (v) => props.onChange({ size: v })), t("sizeHint")),
						field(t("displayLabel"), h(Select, {
							label: t("displayLabel"),
							value: pet.display,
							options: PET_DISPLAYS.map((d) => ({
								id: d,
								label: t("display." + d)
							})),
							disabled: busy,
							onChange: (id) => props.onChange({ display: id })
						}), t("displayHint"))
					]
				}),
				h("div", {
					className: "dsh-pet-cfg__grid3",
					children: [
						field(t("cornerLabel"), h(Select, {
							label: t("cornerLabel"),
							value: pet.position.corner,
							options: CORNERS.map((c) => ({
								id: c,
								label: t("corner." + c)
							})),
							disabled: busy,
							onChange: (id) => props.onChange({ position: { corner: id } })
						}), t("cornerHint")),
						field(t("marginX"), numInput("marginX", pet.position.marginX, busy, (v) => props.onChange({ position: { marginX: v } })), t("marginXHint")),
						field(t("marginY"), numInput("marginY", pet.position.marginY, busy, (v) => props.onChange({ position: { marginY: v } })), t("marginYHint"))
					]
				}),
				h("div", {
					className: "dsh-pet-cfg__grid2",
					children: [toggleCell("workStatusEnabled", !!pet.workStatusEnabled, busy, (v) => props.onChange({ workStatusEnabled: v }))]
				})
			]
		});
	};
}

//#endregion
//#region src/shared/sleep-hotkey.ts
const SLEEP_HOTKEY_HINT = "Z 键";
function isSleepHotkey(e) {
	return isBareKey(e, "z");
}

//#endregion
//#region src/shared/todo/hotkey.ts
const TODO_HOTKEY_HINT = "D 键";
function isTodoHotkey(e) {
	return isBareKey(e, "d");
}

//#endregion
//#region src/client/settings/shortcuts-card.ts
/** 折叠正文的 id。 */
const BODY_ID = "pet-cfg-shortcuts";
function makeShortcutsCard(rt) {
	const { h, t, useState } = rt;
	const { foldCard } = makeUiKit({
		h,
		t
	});
	return function ShortcutsCard() {
		const [open, setOpen] = useState(false);
		const row = (label, keys) => h("div", {
			className: "dsh-pet-cfg__field",
			children: [h("span", {
				key: "l",
				className: "dsh-pet-cfg__flabel",
				children: t(label)
			}), h("span", {
				key: "v",
				className: "dsh-pet-cfg__note",
				children: keys
			})]
		});
		return foldCard({
			id: BODY_ID,
			title: t("shortcutCardTitle"),
			hint: t("shortcutCardHint"),
			body: [h("p", {
				key: "petHint",
				className: "dsh-pet-cfg__note",
				children: t("shortcutGroupPetHint")
			}), h("div", {
				key: "petRows",
				className: "dsh-pet-cfg__grid2",
				children: [
					row("shortcutRowTodo", TODO_HOTKEY_HINT),
					row("shortcutRowSleep", SLEEP_HOTKEY_HINT),
					row("shortcutRowDisplay", DISPLAY_HOTKEY_HINTS.join(" · "))
				]
			})],
			open,
			onToggle: () => setOpen(!open)
		});
	};
}

//#endregion
//#region src/client/settings/tip-layer.ts
/** 气泡 class，外观在 ./css。 */
const TIP_CLASS = "pet-cfg-tip";
/** 触发元素的属性名：选择器与取值都从它派生，改名只改一处。 */
const TIP_ATTR = "data-tip";
/** 光标与气泡的间隙（px）。 */
const TIP_GAP_PX = 10;
/** 唯一的那个气泡；悬停很频繁，反复建删会让气泡闪。 */
let bubble;
/** 当前挂着气泡的触发元素，用于跳过「在同一元素内移动」的重复派发。 */
let current;
/** 这一层的解除函数；`undefined` 表示没装。 */
let detach;
/** 收起气泡：元素留着复用，只摘显隐。 */
function hideTip() {
	bubble?.classList.remove("is-on");
	current = void 0;
}
/** 取气泡元素，没有就建一个挂到 body——挂在设置页里会被滚动容器裁掉。 */
function ensureTip() {
	if (bubble !== void 0 && bubble.parentNode === document.body) return bubble;
	const el = document.createElement("div");
	el.setAttribute("class", TIP_CLASS);
	el.setAttribute("role", "tooltip");
	document.body.appendChild(el);
	bubble = el;
	return el;
}
/** 从事件目标往上找触发元素；不在说明元素上时返回 `undefined`。 */
function triggerOf(node) {
	const host = node;
	if (host === null || typeof host.closest !== "function") return void 0;
	return host.closest("[" + TIP_ATTR + "]") ?? void 0;
}
/**
* 在光标处显示说明。
*
* @param text - 气泡正文。
* @param cursor - 光标位置（视口坐标）。
*/
function showTip(text, cursor) {
	const el = ensureTip();
	el.textContent = text;
	el.style.left = "0px";
	el.style.top = "0px";
	const placed = tooltipPlacement(cursor, {
		w: el.offsetWidth,
		h: el.offsetHeight
	}, {
		x: 0,
		y: 0,
		w: window.innerWidth,
		h: window.innerHeight
	}, TIP_GAP_PX);
	el.style.left = placed.x + "px";
	el.style.top = placed.y + "px";
	el.classList.add("is-on");
}
/** 光标进入触发元素：换一条说明就重摆，同一元素内移动不动。 */
function onOver(event) {
	const trigger = triggerOf(event.target);
	if (trigger === void 0 || trigger === current) return;
	const text = trigger.getAttribute(TIP_ATTR);
	if (text === null || text === "") return;
	showTip(text, {
		x: event.clientX,
		y: event.clientY
	});
	current = trigger;
}
/** 光标离开：移进触发元素自己的子节点也会派发 pointerout，只有真离开才收。 */
function onOut(event) {
	const from = triggerOf(event.target);
	if (from === void 0) return;
	if (triggerOf(event.relatedTarget ?? null) === from) return;
	hideTip();
}
function attachTipLayer() {
	if (detach !== void 0) return detach;
	const root = document;
	root.addEventListener("pointerover", onOver);
	root.addEventListener("pointerout", onOut);
	root.addEventListener("pointerdown", hideTip);
	root.addEventListener("scroll", hideTip, true);
	detach = () => {
		root.removeEventListener("pointerover", onOver);
		root.removeEventListener("pointerout", onOut);
		root.removeEventListener("pointerdown", hideTip);
		root.removeEventListener("scroll", hideTip, true);
		bubble?.remove();
		bubble = void 0;
		current = void 0;
		detach = void 0;
	};
	return detach;
}

//#endregion
//#region src/client/settings/pet-draft.ts
function nextPetId(list, kind = "main") {
	const prefix = kind === "main" ? "pet" : kind;
	for (let n = 2;; n += 1) {
		const id = prefix + "-" + n;
		if (!list.some((pet) => pet.id === id)) return id;
	}
}
function draftPet(template, id) {
	return {
		id,
		name: id,
		size: template.size,
		sizePercent: template.sizePercent ?? SIZE_PERCENT_DEFAULT,
		balanceEnabled: template.balanceEnabled,
		whisperEnabled: template.whisperEnabled,
		workStatusEnabled: template.workStatusEnabled,
		fixedEnabled: template.fixedEnabled,
		display: template.display,
		position: { ...template.position }
	};
}

//#endregion
//#region src/client/settings/use-pet-list.ts
function petKinds(pets) {
	const order = [];
	const counts = new Map();
	for (const pet of pets) {
		const entry = pet.assetRoot ?? "main";
		if (!counts.has(entry)) order.push(entry);
		counts.set(entry, (counts.get(entry) ?? 0) + 1);
	}
	return order.map((entry) => ({
		entry,
		kind: entry === "main" ? "main" : "pack",
		count: counts.get(entry) ?? 0
	}));
}
function mainPetsOf(pets) {
	return pets.filter((pet) => (pet.assetRoot ?? "main") === "main");
}
function usePetList(rt, requestDialog) {
	const { useState, useCallback, useRef } = rt;
	const initial = petBridge.current;
	const [pets, setPets] = useState(initial.map((pet) => ({
		...pet,
		position: { ...pet.position }
	})));
	const [kind, setKind] = useState(initial[0]?.assetRoot ?? "main");
	const [selId, setSelId] = useState(initial[0]?.id ?? "");
	const loadedRef = useRef([]);
	const kindRef = useRef(kind);
	kindRef.current = kind;
	const update = (patch) => setPets((list) => list.map((pet) => {
		if (pet.id !== selId) return pet;
		const { position: posPatch,...rest } = patch;
		return {
			...pet,
			...rest,
			position: posPatch ? {
				...pet.position,
				...posPatch
			} : pet.position
		};
	}));
	const add = () => {
		const group = pets.filter((pet) => (pet.assetRoot ?? "main") === kind);
		const template = group[0];
		if (!template) return;
		const id = nextPetId(pets, kind);
		const draft = {
			...draftPet(template, id),
			assetRoot: kind
		};
		setPets((list) => {
			const next = [...list];
			let at = -1;
			for (let i = 0; i < next.length; i += 1) if ((next[i].assetRoot ?? "main") === kind) at = i;
			next.splice(at + 1, 0, draft);
			return next;
		});
		setSelId(id);
	};
	const remove = () => {
		const list = pets.filter((pet) => pet.id !== selId);
		setPets(list);
		setSelId(list[0]?.id ?? "");
	};
	const replace = useCallback((entries) => {
		loadedRef.current = entries;
		const loaded = entries.flatMap((entry) => entry.pets);
		const nextKind = entries.some((entry) => entry.key === kindRef.current) ? kindRef.current : entries[0]?.key ?? "main";
		setPets(loaded);
		setKind(nextKind);
		setSelId((id) => {
			if (loaded.some((pet) => pet.id === id)) return id;
			return loaded.find((pet) => (pet.assetRoot ?? "main") === nextKind)?.id ?? "";
		});
	}, []);
	const selectKind = (entry) => {
		setKind(entry);
		const first = pets.find((pet) => (pet.assetRoot ?? "main") === entry);
		if (first) setSelId(first.id);
	};
	const current$1 = pets.find((pet) => pet.id === selId);
	const entryPrompt = loadedRef.current.find((item) => item.key === kind)?.entryPrompt ?? "";
	const requestRemove = () => {
		if (!current$1) return;
		const entry = current$1.assetRoot ?? "main";
		const groupSize = pets.filter((pet) => (pet.assetRoot ?? "main") === entry).length;
		if (groupSize <= 1) requestDialog(entry === "main" ? { kind: "lastOne" } : {
			kind: "lastOfKind",
			entry
		});
		else requestDialog({ kind: "remove" });
	};
	return {
		pets,
		mainPets: mainPetsOf(pets),
		kinds: petKinds(pets),
		kind,
		visiblePets: pets.filter((pet) => (pet.assetRoot ?? "main") === kind),
		selId,
		entryPrompt,
		select: setSelId,
		selectKind,
		update,
		add,
		requestRemove,
		remove,
		replace,
		packWrites: () => diffPackWrites(loadedRef.current, pets)
	};
}

//#endregion
//#region src/client/settings/use-remote-data.ts
function useRemoteData(rt) {
	const { useState, useEffect } = rt;
	const [paths, setPaths] = useState(null);
	const [catalog, setCatalog] = useState(null);
	const [catalogFailed, setCatalogFailed] = useState(false);
	useEffect(() => {
		let alive = true;
		loadMeta().then((meta) => {
			if (alive) setPaths(meta);
		});
		return () => {
			alive = false;
		};
	}, []);
	useEffect(() => {
		let alive = true;
		loadModelCatalog().then((groups) => {
			if (!alive) return;
			if (groups === null) setCatalogFailed(true);
			else setCatalog(groups);
		});
		return () => {
			alive = false;
		};
	}, []);
	return {
		paths,
		catalog,
		catalogFailed
	};
}

//#endregion
//#region src/client/settings/locales/de.ts
const de = {
	nav: "Desktop-Pet-Konfiguration",
	intro: "Mehrere Pets verwalten: Jedes Pet hat eigene Größe und Position (gilt sofort nach dem Speichern).",
	petCardTitle: "Pet-Konfiguration",
	petCardHint: "Einstellungen pro Pet: Name / Größe / Anzeige / Position / Offsets / die vier Funktionsschalter. Nach dem Ändern unten auf „Speichern\" klicken – gilt sofort.",
	globalTitle: "Globale Schalter",
	globalHint: "Gilt für alle Pets (ein Pet-Pack kann dies in seiner Art-Datei überschreiben). Diese Schalter ändern nur den lokalen Zustand und werden beim „Speichern\" mit in die Benutzerkonfiguration geschrieben (kein sofortiges Schreiben); Systembenachrichtigungen werden nach dem Speichern sofort neu eingelesen, ohne Neuladen der Seite.",
	cornerHint: "An welcher Bildschirmecke das Pet klebt (im Desktop-Modus pro Monitor-Arbeitsbereich).",
	marginXHint: "Horizontaler Abstand zur gewählten Ecke (px), beliebige Zahl.",
	marginYHint: "Vertikaler Abstand zur gewählten Ecke (px), beliebige Zahl.",
	"cmd.chat": "Chat",
	"cmd.pet": "Pet",
	"cmd.balance": "Guthaben",
	"shortcut.open": "Pet-Chat öffnen",
	"shortcut.chat": "Chatfenster öffnen",
	"shortcut.hear": "Spracheingabe",
	"shortcut.capture": "Bildschirmfoto in den Chat",
	shortcutCardTitle: "Tastenkürzel",
	shortcutCardHint: "Aufgeklappt zwei Gruppen: Pet-Tastenkürzel und globale Tastenkürzel.",
	shortcutRowChat: "Chat öffnen",
	shortcutRowHold: "Zum Sprechen halten",
	shortcutRowHear: "Spracheingabe",
	shortcutRowCapture: "Bildschirmfoto",
	shortcutRowPaste: "Bild einfügen",
	shortcutRowTodo: "Aufgaben",
	shortcutRowSleep: "Schlafen / Aufwachen",
	shortcutRowDisplay: "Anzeigeposition",
	shortcutRowSidebar: "Seitenleisten-Chat öffnen",
	shortcutGroupPet: "Pet-Tastenkürzel",
	shortcutGroupPetHint: "Im Web genügt der Zeiger auf dem Pet. Im Desktop-Fenster zuerst auf das Pet klicken, damit es den Tastaturfokus bekommt.",
	shortcutGroupGlobal: "Globale Tastenkürzel",
	shortcutGroupGlobalHint: "Werden von DSH im Web und im Desktop-Fenster verteilt; änderbar unter Einstellungen → Allgemein → Tastenkürzel.",
	petsLabel: "Pet-Liste",
	add: "Pet hinzufügen",
	remove: "Entfernen",
	confirmRemove: "Pet „{id}\" wirklich löschen?",
	confirmTitle: "Aktion bestätigen",
	cancel: "Abbrechen",
	ok: "Verstanden",
	atLeastOne: "Mindestens ein Pet muss erhalten bleiben.",
	emptyPets: "Noch keine Pets – auf „Pet hinzufügen\" klicken, um eines zu erstellen.",
	sizeLabel: "Größe (Breite px)",
	sizeHint: "Höhe automatisch = Breite × 9/16.",
	sizePercentLabel: "Max. Bildschirmbreite (%)",
	sizePercentHint: "Wie viel der Bildschirmbreite der Pet höchstens einnimmt: 100 = nie breiter als ein Bildschirm (bei breiten Fenstern identisch mit px); 30–40 macht ihn auf dem Handy deutlich kleiner, ohne den Desktop zu verändern. Wird beim Laden einmal berechnet; nach Größenänderung neu laden.",
	nameLabel: "Name",
	nameHint: "Anzeigename: erscheint beim Hovern über dem Pet und fließt in die KI-Persona ein („Dein Name ist X\"). Doppelt erlaubt; leer = es gilt die Pet-ID.",
	personaLabel: "Persona (optional)",
	personaHint: "Gilt nur für dieses Pet. Leer lassen = Persona des Eintrags übernehmen – der graue Text im Feld ist genau diese. Das tatsächlich an das Modell gesendete System = dieser Text + automatisch angehängtem Hinweis „Dein Name ist <Name>\" + aktuellem Zeitkontext; Name und Datum hier also nicht wiederholen.",
	personaCount: "{n} Zeichen",
	balanceEnabled: "Guthaben-Funktion",
	balanceEnabledHint: "Wenn aktiv, spielt dieses Pet Guthaben-Animationen und zeigt die Guthaben-Blase.",
	whisperEnabled: "Flüstern",
	whisperEnabledHint: "Wenn aktiv, erzeugt dieses Pet regelmäßig per KI einen Satz und spielt die Flüstern-Animation (Persona siehe Feld „Persona\" unten; leer = Eintrag übernehmen).",
	workStatusEnabled: "Arbeitsstatus-Kopplung",
	workStatusEnabledHint: "Wenn aktiv, folgt dieses Pet dem DSH-Arbeitsstatus: Denken / Arbeiten / Warten auf Bestätigung / Fertig / Fehler wechseln automatisch die passende Animation und zeigen eine Blase (Animationspool in der Top-Level-Konfiguration; nur Zuhören, keine Modellaufrufe).",
	fixedEnabled: "Pet fixieren",
	fixedEnabledHint: "Wenn aktiv, dreht sich das Pet bei Zufallsanimationen nicht mehr selbst um und läuft nicht weg – es spielt nur Leerlauf und kleine Aktionen am Platz. Rechtsklick-Auswahl, API-Auslöser sowie Guthaben-/Flüstern-/Arbeitsstatus-Animationen sind nicht betroffen.",
	displayLabel: "Anzeige",
	displayHint: "web = nur Browser / desktop = nur Desktop / both = beides / none = nichts",
	"display.web": "Nur Browser",
	"display.desktop": "Nur Desktop",
	"display.both": "Beides",
	"display.none": "Nichts",
	cornerLabel: "Position",
	"corner.top-left": "Oben links",
	"corner.top-right": "Oben rechts",
	"corner.bottom-left": "Unten links",
	"corner.bottom-right": "Unten rechts",
	marginX: "Horizontaler Versatz",
	marginY: "Vertikaler Versatz",
	save: "Speichern",
	saveHotkey: "Ctrl+S / Cmd+S",
	sync: "Synchronisieren",
	confirmSync: "Wirklich synchronisieren? Die mitgelieferte Standardkonfiguration (alle Felder + Kommentare) überschreibt die Benutzerkonfiguration; Ihre aktuellen Anpassungen gehen verloren.",
	corruptTitle: "Benutzerkonfiguration beschädigt – nicht gespeichert",
	corruptConfirm: "Trotzdem speichern",
	corruptBody: "Die Benutzerkonfigurationsdatei ist nicht lesbar (beschädigt, kein gültiges JSON/JSONC): {path}. Beim Weiterspeichern wird die Datei anhand der Whitelist neu aufgebaut – alle aktuellen Inhalte (animations / physics / memes und weitere eigene Felder) gehen verloren. Abbrechen = Datei unverändert lassen (zuerst die Konfiguration reparieren, dann speichern); Bestätigen = trotzdem speichern (vorhandene Inhalte verwerfen).",
	syncHint: "„Synchronisieren\" schreibt die mitgelieferte Standardkonfiguration (inkl. Kommentare und aller erweiterten Felder) in die Benutzerkonfigurationsdatei und überschreibt die aktuellen Anpassungen; danach ist die Datei direkt bearbeitbar. Zwei Hinweise: (1) Sobald die Datei existiert, ist sie eine explizite Override-Schicht – spätere Änderungen an den mitgelieferten Standards greifen nicht automatisch (außer bei erneuter Synchronisierung oder Löschen der Datei); (2) „Speichern\" auf dieser Seite schreibt die Datei anhand der Whitelist neu (Feldwerte bleiben, Kommentare entfallen).",
	configMeta: "Erweitert (Dateien)",
	configMetaHint: "Die Benutzerkonfiguration kann Pet-Liste / Animationspools / Wiedergabegewichtung überschreiben; Änderungen greifen nach Aktualisieren oder Neustart: im Browser die Seite neu laden, im Desktop-Modus Rechtsklick auf das Pet → „Konfiguration neu laden\" (lädt alle Desktop-Pet-Fenster neu); die Standardkonfiguration ist die vollständige Referenz.",
	defaultConfig: "Standardkonfiguration (schreibgeschützt, vollständige Referenz)",
	userConfig: "Benutzerkonfiguration (eigene Überschreibungen)",
	todosFile: "To-do-Daten (Listentext, Fälligkeit und Erledigt-Status; Löschen entspricht alle To-dos leeren)",
	animationDir: "Verzeichnis der Animations-Assets (Animationen anpassen/ergänzen)",
	memesDir: "Verzeichnis der Meme-Bilder (Bilder anpassen/ergänzen)",
	logFile: "Protokolldatei (für die Fehlersuche; kann geleert werden)",
	logFileNote: "Die Desktop-Version hat keine Konsole, daher gehen alle Laufzeitprotokolle des Plugins (Start, Absturz/Neustart des Desktop-Pets, Fehler und Warnungen) in diese eine Datei; bitte bei Problemmeldungen anhängen. Maximal 1 MB pro Datei, danach bleiben nur die letzten 512 KB erhalten.",
	saved: "Gespeichert – die Pets gelten sofort.",
	loadError: "Konfiguration konnte nicht geladen werden",
	saveError: "Konfiguration konnte nicht gespeichert werden. Bitte Serververbindung, Schreibrechte im Konfigurationsverzeichnis und Serverprotokoll prüfen.",
	saveInvalid: "Konfiguration konnte nicht gespeichert werden: Inhalt ungültig. Bitte prüfen und erneut versuchen.",
	syncError: "Synchronisieren fehlgeschlagen. Bitte Serververbindung und Schreibrechte im Konfigurationsverzeichnis prüfen.",
	loading: "Konfiguration wird geladen…",
	retry: "Erneut versuchen",
	invalid: "Bitte Eingaben prüfen: Größe muss positiv sein, Ränder dürfen beliebige Zahlen sein.",
	busy: "Wird gespeichert…",
	extraPetsHint: "Weitere {n} Art(en) stammen aus Dateien im Verzeichnis pet/ (<Name>-config.json + <Name>-animation/); oben in der Zeile „Arten\" umschalten und bearbeiten. Speichern schreibt jeweils in die eigene Paketkonfiguration, nie in main-config.jsonc.",
	kindLabel: "Arten",
	kindMain: "Integriert",
	lastOfKind: "„{entry}\" hat nur noch dieses eine Pet – beim Löschen verschwindet die ganze Art. Zum vollständigen Entfernen die Pet-Pack-Dateien löschen.",
	savePartial: "Haupt-Pets gespeichert, aber {names} konnten nicht zurückgeschrieben werden: Prüfen Sie, ob die Pack-Konfiguration gültig und das Verzeichnis beschreibbar ist.",
	notifyToggle: "Systembenachrichtigungen",
	notifyToggleHint: "System-Toasts (unten rechts auf dem Desktop) bei Abschluss einer Konversation, Fehlern, Berechtigungsanfragen und Rückfragen – nur wenn das Fenster nicht fokussiert ist.",
	clickSoundToggle: "Klick-Sound",
	clickSoundToggleHint: "Beim Klick auf ein Pet ertönt der integrierte Klick-Sound (assets/sound/click-duck.wav, Lautstärke 0.5); Klicks innerhalb von 100 ms werden nur einmal abgespielt, auch bei mehreren Pets überlagert sich nichts. Aus = völlig stumm. Wird beim „Speichern\" in die Benutzerkonfiguration geschrieben.",
	whisperImageToggle: "Flüstern-Bilder",
	whisperImageToggleHint: "Hängt an jede Flüstern-Zeile ein zufälliges Meme aus dem Pool (Bildzuordnung im Top-Level-Feld `memes` der Konfiguration). Token: Flüstern ruft ohnehin pro Zyklus das Modell auf, das Bild fügt nur Name + Beschreibung des gezogenen Memes (ca. 100 Zeichen / ≈60 Token) an dieselbe Anfrage an – vernachlässigbar.",
	chatImageToggle: "Chat-Bilder",
	chatImageToggleHint: "Die KI wählt im Chat passend zum Kontext ein Meme aus dem Pool (optional; Zuordnung im Top-Level-Feld `memes`). Token: Jede Nachricht führt den gesamten Katalog mit – aktuell ca. 1,1k Zeichen (≈650 Token, etwa 11-mal so viel wie beim Flüstern) und linear mit der Bildanzahl wachsend; aus = es wird kein Zeichen angehängt.",
	chatAnimationToggle: "Chat-Aktionen",
	chatAnimationToggleHint: "Wenn an, enthält die Chat-Anfrage die Liste der spielbaren Animationen (alle Aktionen unter animations.categories): Hält das Modell die Zeile für eine tatsächliche Aufführung, spielt das Pet sie sofort; sonst antwortet es nur mit Text. Token: Jede Nachricht führt die ganze Liste mit; aus = es wird nichts angehängt. Globaler Standard für alle Pets (ein Pet-Pack kann ihn in seiner eigenen Konfigurationsdatei überschreiben).",
	confineToggle: "Auf aktuellen Bildschirm begrenzen",
	confineToggleHint: "Mehrere Monitore: Wenn an, bleibt das Pet auf dem Bildschirm, auf dem es sich gerade befindet – ein geworfenes Pet prallt nur innerhalb des Bildschirms ab, auf dem es losgelassen wurde (Bildschirmfugen wirken als Wände, es fliegt nicht zum Nachbarmonitor), und autonomes Umherlaufen bleibt auf dem aktuellen Bildschirm (ein Schritt über die Fuge wird einfach verworfen). Aus = Überqueren der Bildschirme wie gewohnt. Nur Desktop-Modus – das Browser-Overlay bleibt ohnehin im Viewport.",
	trayToggle: "System-Tray",
	trayToggleHint: "Zeigt im Desktop-Modus ein Tray-Symbol (Windows: Infobereich, macOS: Menüleiste). Es listet alle Pets der Konfiguration und schaltet die Anzeige um – auch für Pets, die gerade nicht auf dem Desktop sind und kein Fenster zum Rechtsklicken haben. Ohne Tray lässt sich ein Pet nur über den Browser (Einstellungsseite oder Rechtsklick auf das Web-Pet) zurück auf den Desktop holen. Windows blendet das Symbol ohnehin in die „ausgeblendeten Symbole\" aus. Nur Desktop-Modus.",
	voiceTitle: "Sprachausgabe",
	voiceHint: "Drei Schalter und eine Stimme: Der Hauptschalter steuert die automatische Ausgabe, die beiden Unterschalter je eine Art proaktiver Meldung. Standardmäßig alle aus; wird beim „Speichern\" in die Benutzerkonfiguration geschrieben (kein sofortiges Schreiben).",
	voiceEnabled: "Sprachausgabe aktivieren",
	voiceEnabledHint: "Hauptschalter für die automatische Sprachausgabe. Aus = regelmäßige Flüstern-Sätze und To-do-Erinnerungen werden nicht gesprochen (die beiden Unterschalter unten wirken dann nicht). Manuelles Flüstern, Chat-Antworten und die Lautsprecher-Schaltfläche im Chat-Panel sind nicht betroffen – die haben Sie selbst ausgelöst, die sprechen direkt. Es betrifft nur das Sprechen: Blasen, Chat-Gedächtnis und Systembenachrichtigungen bleiben unberührt; eine fehlgeschlagene Synthese wird nur protokolliert und unterbricht den Chat nicht.",
	voiceWhisperEnabled: "Flüstern sprechen",
	voiceWhisperEnabledHint: "Spricht den regelmäßig erzeugten Flüstern-Satz (manuelles Flüstern per Rechtsklick bleibt unberührt). Unterliegt dem Hauptschalter oben: Ist er aus, wirkt dieser Schalter nicht. Standardmäßig aus – Flüstern ist Hintergrundbegleitung und sollte nicht ungefragt Geräusche machen.",
	voiceTodoEnabled: "To-do-Erinnerungen sprechen",
	voiceTodoEnabledHint: "Spricht eine fällige To-do-Erinnerung (die Blase erscheint weiterhin; dieser Schalter entscheidet nur, ob gesprochen wird). Unterliegt dem Hauptschalter oben. Standardmäßig aus.",
	voiceNameLabel: "Stimme",
	voiceVolumeLabel: "Lautstärke",
	voiceVolumeHint: "Wiedergabelautstärke als Dezimalzahl 0–1: 1 ist die maximale Lautstärke (100 %), 0 ist stumm. Ändert nur die Lautheit und synthetisiert kein Audio neu, kostet also nichts extra. Unabhängig vom Hauptschalter oben — bei ausgeschaltetem Schalter ohne Wirkung.",
	physicsTitle: "Physik (Zieh- und Wurfgefühl)",
	physicsHint: "Globaler Standard für alle Pets (ein Pet-Pack kann ihn in seiner Art-Datei überschreiben); wird beim „Speichern\" in die Benutzerkonfiguration geschrieben (kein sofortiges Schreiben). Im Browser sofort wirksam, im Desktop-Modus, sobald das Speichern die Pet-Fenster neu lädt.",
	mobileTitle: "Mobil-Effekte",
	mobileHint: "Nur im Handy-Browser sinnvoll: Vibration braucht einen Motor, die beiden Bewegungs-Schalter brauchen Neigungs-/Beschleunigungssensoren, und Sensoren gibt es nur über HTTPS oder localhost.",
	"physics.gravity": "Schwerkraft",
	"physics.gravityHint": "px/s², größer = fällt schneller; 0 = schwerelos (fliegt geradeaus weiter)",
	"physics.restitution": "Elastizität",
	"physics.restitutionHint": "0–1, Geschwindigkeitsanteil beim Abprallen von Wand/Boden (1 = voll elastisch, 0 = bleibt sofort stehen)",
	"physics.groundFriction": "Kontaktreibung",
	"physics.groundFrictionHint": "/s, Abklingen der Geschwindigkeit entlang jeder Kontaktfläche (Wand, Boden, Decke); 0 = überall eisglatt",
	"physics.throwPower": "Wurfkraft",
	"physics.throwPowerHint": "> 0, Gesamtfaktor für Federfolge und Abwurfgeschwindigkeit (1 = Standard; höher = folgt enger, wirft härter)",
	physicsCeilingBounce: "Deckenabprall",
	physicsCeilingBounceHint: "Aus: Würfe können oben aus dem Bildschirm fliegen (die Schwerkraft holt sie zurück)",
	physicsPetCollision: "Pet-Kollisionen",
	physicsPetCollisionHint: "Ein fliegendes Pet prallt mit Impulserhaltung von anderen ab (Masse ∝ Größe²)",
	physicsHaptic: "Kollisions-Vibration",
	physicsHapticHint: "Ein Impuls pro Treffer (Wand, Boden, Decke, andere Pets). Funktioniert in Chrome/Edge; nicht auf iOS oder in WebView-Hüllen wie Via. „Nicht stören“ blockiert die Vibration.",
	physicsTilt: "Schwerkraft per Neigung",
	physicsTiltHint: "Handy neigen: die Schwerkraft folgt der Neigung (Betrag = der Wert oben). Bei Schwerkraft 0 bewirkt Neigen nichts. Benötigt HTTPS/localhost.",
	physicsShake: "Schütteln zum Werfen",
	physicsShakeHint: "Schütteln schleudert den Pet in Wurfrichtung; die Stärke folgt throwPower. Unabhängig von der Schwerkraft, funktioniert also auch bei 0. Benötigt HTTPS/localhost.",
	invalidPhysics: "Bitte Physikwerte prüfen: Schwerkraft / Bodenreibung ≥ 0, Elastizität 0–1, Wurfkraft > 0.",
	fontTitle: "Aussehen & Schrift",
	fontHint: "Die Schriftart gilt für alle Texte, die derzeit die Candy-Schrift nutzen: Pet-Blase, Hover-Tooltip, Chat-Fenster, Score-Popup; die Schriftgröße gilt nur für Pet-Blase und Hover-Tooltip (Chat- und Score-Popup behalten ihre Größe). Globaler Standard für alle Pets (ein Pet-Pack kann ihn in seiner Art-Datei überschreiben); wird beim „Speichern\" in die Benutzerkonfiguration geschrieben – im Browser sofort wirksam, im Desktop-Modus, sobald das Speichern die Pet-Fenster neu lädt.",
	fontFamilyLabel: "Schriftart",
	fontFamilyHint: "„Candy (integriert)\" wird mit dem Plugin geliefert; die übrigen sind Systemschriften. Fehlt eine Schrift auf diesem Rechner, greift die nächste im Stapel (nie leer, kein Fehler).",
	fontSizeLabel: "Schriftgröße (px)",
	fontSizeHint: "Schriftgröße des Blasentexts; Tooltip und kleinere Zeilen in der Blase skalieren anteilig. Bereich 4–200.",
	fontFollowToggle: "Schriftgröße mit Pet-Größe skalieren",
	fontFollowToggleHint: "An (Standard): die Schrift wächst mit dem Pet – bei 462 px Breite entspricht sie genau der obigen Größe. Aus: die Größe bleibt unabhängig von der Pet-Größe konstant.",
	invalidFont: "Bitte Schrifteinstellungen prüfen: Die Schriftart muss in der Liste stehen, die Größe eine Zahl zwischen 4 und 200 sein.",
	"font.candy": "Candy (integriert)",
	"font.yahei": "Microsoft YaHei / PingFang",
	"font.youyuan": "YouYuan",
	"font.kaiti": "KaiTi",
	"font.simsun": "SimSun",
	"font.comic": "Comic Sans MS",
	"font.system": "Systemstandard",
	modelTitle: "Chat & Modelle",
	modelHint: "Welches Modell Flüstern und Chat jeweils nutzen und wie viel Verlauf jeder Chat-Aufruf mitführt. „Aktueller Konversation folgen\" = das Modell, das Ihre aktuelle Konversation verwendet (Standard). Globaler Standard: gilt für alle Pets, ein Pet-Pack kann ihn in seiner Art-Datei überschreiben. Die Optionen stammen aus derselben Quelle wie die Modellauswahl von DSH und werden vom Host live geliefert.",
	modelFollow: "Aktueller Konversation folgen",
	modelSearch: "Modelle suchen…",
	modelEmpty: "Keine passenden Modelle.",
	modelNoModels: "Keine Modelle verfügbar.",
	modelLoading: "Modellliste wird aktualisiert…",
	modelTriggerAria: "Modell wählen, aktuell {model}",
	modelUnknown: " (aktuelle Konfiguration, nicht in der Liste)",
	modelNone: "Für diesen Anbieter sind keine Modelle verfügbar",
	whisperModelLabel: "Flüstern-Modell",
	chatModelLabel: "Chat-Modell",
	modelFieldHint: "„Aktueller Konversation folgen\" = Modell der aktuellen Konversation; schlägt ein gewähltes Modell fehl, fällt das Plugin auf das Modell der aktuellen Konversation zurück und versucht es einmal erneut.",
	invalidModel: "Bitte Modelleinstellungen prüfen: Anbieter und Modell entweder beide wählen oder beide leer lassen (aktuelle Konversation folgen).",
	modelCatalogFailed: "Modellliste konnte nicht geladen werden (Seite neu laden für einen neuen Versuch); die aktuellen Konfigurationswerte bleiben unverändert erhalten.",
	chatMemory: "Chat-Verlaufsrunden",
	chatMemoryHint: "Wie viele der letzten Runden jeder Chat-Aufruf mitführt (1 Runde = 1 Frage + 1 Antwort; 0 = kein Verlauf, jede Nachricht ist neu). Das Gedächtnis selbst behält alles – dieser Wert bestimmt nur, wie viel in den Kontext kommt: mehr merkt mehr und kostet mehr Token. Globaler Standard für alle Pets (ein Pet-Pack kann ihn in seiner Art-Datei überschreiben).",
	invalidChatMemory: "Bitte Chat-Verlaufsrunden prüfen: Zahl ≥ 0 erforderlich.",
	chatImageLimit: "Max. Chat-Bilder",
	chatImageLimitHint: "Wie viele Memes beim Chat höchstens an das Modell gelistet werden („erste N\" = die ersten N in der Konfiguration; was bevorzugt gesendet werden soll, nach vorne verschieben). Die ganze Liste wird an jede Nachricht angehängt, Token wachsen linear mit der Anzahl – eine lange Liste kostet nur. Mit der Grenze auf die ersten N wählt das Modell nur daraus. 0 = keine Grenze (alles senden). Integrierter Standard 10. Globaler Standard für alle Pets (ein Pet-Pack kann ihn in seiner Art-Datei überschreiben). Nur Chat-Auswahl: Flüstern führt nur das gezogene Meme mit.",
	invalidChatImageLimit: "Bitte das Limit für Chat-Bilder prüfen: Zahl ≥ 0 erforderlich (0 = keine Grenze).",
	notifyTest: "Testbenachrichtigung",
	notifyTestOk: "Testbenachrichtigung gesendet – bitte unten rechts auf dem Desktop prüfen.",
	notifyDenyUnsupported: "Systembenachrichtigungen werden in dieser Umgebung nicht unterstützt (keine Notification-API).",
	notifyDenyBlocked: "Die Benachrichtigungsberechtigung ist im Browser blockiert.",
	notifyDenyRejected: "Sie haben im Berechtigungsdialog „Blockieren\" gewählt.",
	notifyDenyError: "Fehler beim Anfordern der Berechtigung",
	notifyGuide: "Anleitung: links neben der Adressleiste auf 🔒/ⓘ klicken → „Website-Einstellungen\" → „Benachrichtigungen\" → auf „Zulassen\" setzen, Seite neu laden und erneut versuchen.",
	storageTitle: "Deinstallation & Speicher",
	storageHint: "Alle Orte, an denen das Plugin auf diesem Rechner Daten ablegt. Cache löschen ist unschädlich (wird automatisch neu geladen/neu aufgebaut); „Plugin-Benutzerdaten\" löschen kostet Konfiguration und Chat-Gedächtnis.",
	"storage.userData": "Plugin-Benutzerdaten: eigene Konfiguration main-config.jsonc, Chat-Gedächtnis memory.json, eigene Animations-Assets main-animation/, Datei-Pets pet/",
	"storage.electron": "Electron-Laufzeit für das Desktop-Pet (groß; wird beim nächsten Start des Desktop-Modus automatisch neu heruntergeladen)",
	"storage.desktopCache": "Cache der Desktop-Pet-Fenster und Skalierungs-Cache des Hauptbildschirms (löschbar, wird automatisch neu aufgebaut)",
	"storage.electronCache": "Download-Cache des Electron-Installers (löschbar, wird bei Bedarf neu geladen)",
	"storage.package": "Das Plugin selbst (von DSH verwaltet – mit dem Befehl unten entfernen, nicht von Hand löschen)",
	storageMissing: " (noch nicht erstellt)",
	uninstallTitle: "So deinstallieren Sie",
	uninstallStep1: "1. Zuerst DSH beenden (das Desktop-Pet beendet sich mit); die obigen Dateien nicht löschen, während das Pet läuft.",
	uninstallStep2: "2. Das Plugin selbst entfernen (im Terminal ausführen; entfernt es auch aus der Bundle-Schicht des Profils):",
	uninstallStep3: "3. Die obigen Orte nach Bedarf löschen: Caches sind unschädlich; „Plugin-Benutzerdaten\" löschen kostet Konfiguration und Chat-Gedächtnis (vorher main-config.jsonc sichern, wenn Sie es behalten wollen).",
	uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

//#endregion
//#region src/client/settings/locales/en.ts
const en = {
	nav: "Pet Config",
	intro: "Manage multiple pets: each pet has its own size and position (applies instantly after saving).",
	petCardTitle: "Pet",
	petCardHint: "Per-pet settings: name / size / display / corner / offsets / the four feature switches. Click \"Save\" at the bottom to apply instantly.",
	globalTitle: "Global switches",
	globalHint: "Shared by every pet (a pet pack may override them in its own kind file). These switches only change local state and are written to the user config on \"Save\" (never written immediately); system notifications re-read right after saving, no page refresh needed.",
	cornerHint: "Which screen corner the pet sticks to (per-monitor work area in desktop mode).",
	marginXHint: "Horizontal distance from the chosen corner (px); any number.",
	marginYHint: "Vertical distance from the chosen corner (px); any number.",
	"cmd.chat": "Chat",
	"cmd.pet": "Pet",
	"cmd.balance": "Balance",
	"shortcut.open": "Open pet chat",
	"shortcut.chat": "Open chat bubble",
	"shortcut.hear": "Voice input",
	"shortcut.capture": "Screenshot to chat",
	shortcutCardTitle: "Shortcuts",
	shortcutCardHint: "Two groups once expanded: pet shortcuts and global shortcuts.",
	shortcutRowChat: "Open chat",
	shortcutRowHold: "Hold to talk",
	shortcutRowHear: "Voice input",
	shortcutRowCapture: "Screenshot",
	shortcutRowPaste: "Paste image",
	shortcutRowTodo: "Todo list",
	shortcutRowSleep: "Sleep / wake",
	shortcutRowDisplay: "Display position",
	shortcutRowSidebar: "Open sidebar chat",
	shortcutGroupPet: "Pet shortcuts",
	shortcutGroupPetHint: "On the web, hovering the pet is enough. In the desktop pet window, click the pet first so it takes keyboard focus.",
	shortcutGroupGlobal: "Global shortcuts",
	shortcutGroupGlobalHint: "Dispatched by DSH in the web app and the desktop window; rebind them in Settings → General → Shortcuts.",
	petsLabel: "Pets",
	add: "Add pet",
	remove: "Remove",
	confirmRemove: "Delete pet \"{id}\"?",
	confirmTitle: "Confirm action",
	cancel: "Cancel",
	ok: "Got it",
	atLeastOne: "Keep at least one pet.",
	emptyPets: "No pets yet — click \"Add pet\" to create one.",
	sizeLabel: "Size (width px)",
	sizeHint: "Height is automatic = width × 9/16.",
	sizePercentLabel: "Max screen width (%)",
	sizePercentHint: "How much of the screen width the pet may take: 100 = never wider than one screen (identical to px on wide windows); try 30–40 to make it clearly smaller on a phone without changing the desktop. Computed once on page load; refresh after resizing.",
	nameLabel: "Name",
	nameHint: "Shown on hover and added to AI personas (\"your name is X\"). Duplicates allowed; empty falls back to the pet id.",
	personaLabel: "Persona (optional)",
	personaHint: "Applies to this pet only. Leave empty to follow the entry persona — the grey text inside the box is exactly that. The system prompt actually sent = this text + an appended 「your name is \"<name>\"」 line + the current time context, so do not repeat the name or the date here.",
	personaCount: "{n} chars",
	balanceEnabled: "Balance",
	balanceEnabledHint: "When enabled, this pet plays balance animations and shows the balance bubble.",
	whisperEnabled: "Whisper",
	whisperEnabledHint: "When enabled, this pet periodically generates a line via AI and plays the whisper animation (persona = the field below; empty follows the entry).",
	workStatusEnabled: "Work status",
	workStatusEnabledHint: "When enabled, this pet follows DSH work state: thinking / working / waiting / done / error switch animations and show bubbles (pool in top-level config; listening only, no model calls).",
	fixedEnabled: "Pin in place",
	fixedEnabledHint: "When enabled, the random chain no longer turns this pet or walks it away — only idle and in-place actions play. Right-click picks, API triggers and balance / whisper / work-status animations are unaffected.",
	displayLabel: "Display",
	displayHint: "web = browser only / desktop = desktop only / both = both / none = neither",
	"display.web": "Browser only",
	"display.desktop": "Desktop only",
	"display.both": "Both",
	"display.none": "Neither",
	cornerLabel: "Position",
	"corner.top-left": "Top-left",
	"corner.top-right": "Top-right",
	"corner.bottom-left": "Bottom-left",
	"corner.bottom-right": "Bottom-right",
	marginX: "Horizontal offset",
	marginY: "Vertical offset",
	save: "Save",
	saveHotkey: "Ctrl+S / Cmd+S",
	sync: "Sync",
	confirmSync: "Sync? This overwrites the user config with the bundled default config (all fields + comments); current customizations are lost.",
	corruptTitle: "User config is corrupted — not saved",
	corruptConfirm: "Save anyway",
	corruptBody: "The user config file cannot be parsed (corrupted, not valid JSON/JSONC): {path}. Saving now rebuilds it from the whitelist — everything currently in that file (animations / physics / memes …) will be lost. Cancel = leave the file untouched (fix it and save again); Confirm = save anyway (discard what is in the file).",
	syncHint: "\"Sync\" writes the bundled default config (comments + every advanced field included) to the user config file, overwriting your current customizations; the file is then directly editable. Two caveats: (1) once created, that file is an explicit override layer — later changes to the bundled defaults will not take effect automatically (until you sync again or delete the file); (2) clicking \"Save\" on this page rewrites the file from a whitelist — field values are kept, comments are dropped.",
	configMeta: "Advanced (files)",
	configMetaHint: "User config may override pets / animation pools / weights — refresh or restart to apply: refresh the page in the browser, or right-click a desktop pet → \"Reload config\" (rebuilds every desktop pet window). The default config is the complete reference.",
	defaultConfig: "Default config (read-only, complete reference)",
	userConfig: "User config (custom overrides)",
	todosFile: "Todo data (text, due time and done state; deleting it clears every todo)",
	animationDir: "Animation assets dir (add/customize animations here)",
	memesDir: "Meme images dir (add/customize images here)",
	logFile: "Log file (for troubleshooting; safe to clear)",
	logFileNote: "The DSH desktop app has no console, so every runtime log of the plugin (startup, desktop pet crashes/restarts, errors and warnings) goes into this single file — attach it when reporting a problem. It is capped at 1 MB; once full, only the latest 512 KB is kept.",
	saved: "Saved — the pets updated instantly.",
	loadError: "Failed to load config",
	saveError: "Failed to save config. Check the server connection, configuration directory write permissions and server log.",
	saveInvalid: "Failed to save config: invalid configuration. Check the values and try again.",
	syncError: "Failed to sync config. Check the server connection and configuration directory write permissions.",
	loading: "Loading config…",
	retry: "Retry",
	invalid: "Check your input: size must be positive; margins can be any number.",
	busy: "Saving…",
	extraPetsHint: "{n} more kind(s) come from files in the pet/ directory (<name>-config.json + <name>-animation/). Switch to them in the Kinds row above; Save writes back to each pack's own config, never into main-config.jsonc.",
	kindLabel: "Kinds",
	kindMain: "Built-in",
	lastOfKind: "\"{entry}\" has only this pet left — deleting it would remove the whole kind. Delete the pet pack files to remove it entirely.",
	savePartial: "Main pets saved, but {names} could not be written back: check that the pack config is valid and the directory is writable.",
	notifyToggle: "System notifications",
	notifyToggleHint: "OS-level toasts (bottom-right of the desktop) for conversation completion, failures, permission requests, and questions — only while this window is unfocused.",
	clickSoundToggle: "Click sound",
	clickSoundToggleHint: "Plays the built-in click sound (assets/sound/click-duck.wav, volume 0.5) when a pet is clicked; repeated clicks within 100ms play only once, so multiple pets never stack up. Turn it off for silence. Written to the user config together with Save.",
	whisperImageToggle: "Whisper images",
	whisperImageToggleHint: "Attach one random meme from the pool to each whisper line (image mapping lives in the top-level `memes` config field). Tokens: a whisper already calls the model every cycle, so the image only appends the name + description of that one meme (~100 chars / ~60 tokens) to the same request — negligible.",
	chatImageToggle: "Chat images",
	chatImageToggleHint: "Let the AI pick one meme from the pool that fits the current context (optional; mapping lives in the top-level `memes` config field). Tokens: every message carries the whole catalog — currently ~1.1k chars (~650 tokens, about 11x the whisper case) and growing with the number of images; turning this off appends nothing at all.",
	chatAnimationToggle: "Chat actions",
	chatAnimationToggleHint: "When on, the chat request carries the list of playable animations (every action under animations.categories): if the model judges that the line really performs one, the pet acts it out on the spot; otherwise it replies in text only. Tokens: every message carries the whole list; off appends nothing. Global default for all pets (a pet pack can override it in its own config file).",
	confineToggle: "Lock to the current screen",
	confineToggleHint: "Multi-monitor: when on, the pet stays inside the screen it is currently on — a thrown pet bounces only inside the screen it was released on (screen seams act as walls, so it never flies to the neighbouring monitor), and autonomous wandering only walks within the screen it is currently on (a step that would cross the seam is simply cancelled). Turn this off to let it cross screens as usual. Desktop only — the browser overlay always stays inside the viewport anyway.",
	trayToggle: "System tray",
	trayToggleHint: "Shows a tray icon (notification area on Windows, menu bar on macOS) once desktop mode is running. It lists every pet in the config and toggles each one between desktop and web/none — including pets that are currently off the desktop and therefore have no window to right-click. With it off, bringing a pet back to the desktop requires opening the browser (the settings page, or right-clicking a web pet there). Windows already folds third-party icons into the \"hidden icons\" overflow. Desktop mode only.",
	voiceTitle: "Voice",
	voiceHint: "Three switches plus a voice: the master switch gates automatic speech, the two sub-switches gate one kind of proactive message each. All off by default; written to the user config on \"Save\" (never written immediately).",
	voiceEnabled: "Speak replies",
	voiceEnabledHint: "Master switch for automatic speech. When off, periodic whispers and todo reminders stay silent (the two sub-switches below have no effect). Manual whispers, chat replies and the speaker button in the chat panel are not gated — you asked for those, so the surface you asked from speaks them directly. It only affects whether sound is produced — bubbles, chat memory and system notifications are untouched; a failed synthesis is logged and never interrupts the conversation.",
	voiceWhisperEnabled: "Speak whispers",
	voiceWhisperEnabledHint: "Speaks the periodically generated whisper (right-clicking for a manual whisper is unaffected). Gated by the master switch above. Off by default — whispers are background narration and should not make noise unasked.",
	voiceTodoEnabled: "Speak todo reminders",
	voiceTodoEnabledHint: "Speaks a todo reminder when it comes due (the bubble still appears; this only decides whether it is spoken). Gated by the master switch above. Off by default.",
	voiceNameLabel: "Voice",
	voiceVolumeLabel: "Volume",
	voiceVolumeHint: "Playback volume as a 0–1 decimal: 1 is full volume (100%), 0 is muted. Changes loudness only and never re-synthesizes audio, so adjusting it costs nothing extra. Independent of the master switch above — it has no effect while that switch is off.",
	physicsTitle: "Physics (drag & throw feel)",
	physicsHint: "Global default, shared by every pet (a pet pack may override it in its own kind file); written to the user config on \"Save\" (never written immediately). Applies instantly in the browser; on the desktop it applies once Save reloads the pet windows.",
	mobileTitle: "Mobile effects",
	mobileHint: "Only meaningful in a phone browser: haptics needs a vibration motor, the two motion switches need tilt / accelerometer sensors, and sensors require HTTPS or localhost.",
	"physics.gravity": "Gravity",
	"physics.gravityHint": "px/s² — the higher, the faster it falls; 0 = weightless (flies straight forever)",
	"physics.restitution": "Bounciness",
	"physics.restitutionHint": "0–1, speed kept when bouncing off a wall or the floor (1 = perfectly elastic, 0 = stops dead)",
	"physics.groundFriction": "Contact friction",
	"physics.groundFrictionHint": "per second, damping along any surface hit (wall, floor, ceiling); 0 = frictionless ice everywhere",
	"physics.throwPower": "Throw power",
	"physics.throwPowerHint": "> 0, overall multiplier for spring tracking and release speed (1 = default; higher = tighter tracking, harder throws)",
	physicsCeilingBounce: "Ceiling bounce",
	physicsCeilingBounceHint: "Turn this off to let a throw fly out through the top of the screen (gravity still pulls it back)",
	physicsPetCollision: "Pet collisions",
	physicsPetCollisionHint: "A flying pet bounces off the others with momentum conservation (mass ∝ size²)",
	physicsHaptic: "Collision haptics",
	physicsHapticHint: "One buzz per hit (walls, floor, ceiling, other pets). Works in Chrome/Edge; not on iOS or WebView shells like Via. Do Not Disturb blocks it.",
	physicsTilt: "Tilt gravity",
	physicsTiltHint: "Tilt the phone and gravity follows it (magnitude = the gravity value above); with gravity at 0 tilt has no effect. Requires HTTPS/localhost.",
	physicsShake: "Shake to throw",
	physicsShakeHint: "Shake to fling the pet along the shake direction; strength scales with throwPower. Independent of gravity, so it still works at gravity 0. Requires HTTPS/localhost.",
	invalidPhysics: "Check the physics values: gravity / ground friction ≥ 0, bounciness 0–1, throw power > 0.",
	fontTitle: "Appearance & font",
	fontHint: "The family applies to every place that currently uses the candy font: pet bubble, hover tooltip, chat popup, score popup. The size applies only to the pet bubble and the hover tooltip (chat and score popups keep their own size). Global default, shared by every pet (a pet pack may override it in its own kind file); written to the user config on \"Save\" — instant in the browser, and on the desktop it applies once Save reloads the pet windows.",
	fontFamilyLabel: "Font",
	fontFamilyHint: "\"Candy (bundled)\" ships with the plugin; the others are system fonts. If a font is missing on this machine, it falls back to the next one in the stack (never blank, never an error).",
	fontSizeLabel: "Font size (px)",
	fontSizeHint: "Bubble body text size; the tooltip and the smaller lines inside the bubble scale proportionally. Range 4–200.",
	fontFollowToggle: "Scale font with pet size",
	fontFollowToggleHint: "On (default): the font grows with the pet — at 462 px width it is exactly the size above. Off: the size stays fixed regardless of pet size.",
	invalidFont: "Check the font settings: the family must be in the list and the size must be a number between 4 and 200.",
	"font.candy": "Candy (bundled)",
	"font.yahei": "Microsoft YaHei / PingFang",
	"font.youyuan": "YouYuan",
	"font.kaiti": "KaiTi",
	"font.simsun": "SimSun",
	"font.comic": "Comic Sans MS",
	"font.system": "System default",
	modelTitle: "Chat & models",
	modelHint: "Which model each of whisper and chat uses, and how much history every chat request carries. \"Follow current conversation\" uses the model your current conversation is on (default). Global default: applies to every pet, and a pet pack may override it in its own kind file. The options come from the same source as the DSH model picker, served live by the host.",
	modelFollow: "Follow current conversation",
	modelSearch: "Search models…",
	modelEmpty: "No matching models.",
	modelNoModels: "No models available.",
	modelLoading: "Refreshing model list…",
	modelTriggerAria: "Select model, current {model}",
	modelUnknown: " (current config, not in the list)",
	modelNone: "No models available for this provider",
	whisperModelLabel: "Whisper model",
	chatModelLabel: "Chat model",
	modelFieldHint: "\"Follow current conversation\" uses the conversation model; if a chosen model fails, the plugin falls back to the conversation model and retries once.",
	invalidModel: "Check the model settings: pick both a provider and a model, or leave both empty (follow the current conversation).",
	modelCatalogFailed: "Failed to load the model list (refresh the page to retry); your current values are kept as they are.",
	chatMemory: "Chat history rounds",
	chatMemoryHint: "How many recent rounds each chat request carries (1 round = 1 question + 1 answer; 0 = no history, every message starts fresh). The memory itself keeps everything — this only decides how much goes into the context: higher remembers more and costs more tokens. Global default, shared by every pet (a pet pack may override it in its own kind file).",
	invalidChatMemory: "Check the chat history rounds: it must be a number ≥ 0.",
	chatImageLimit: "Chat image limit",
	chatImageLimitHint: "How many memes at most are listed to the model during chat (\"first N\" = the first N you wrote in the config, so move the ones you want sent to the front). That whole list is attached to every message and tokens grow linearly with the count, so a long list is pure burn; capping it to the first N makes the model pick only among those. 0 = no limit (send everything). Built-in default 10. Global default, shared by every pet (a pet pack may override it in its own kind file). Chat only — a whisper carries just the one meme it drew.",
	invalidChatImageLimit: "Check the chat image limit: it must be a number ≥ 0 (0 = no limit).",
	notifyTest: "Test notification",
	notifyTestOk: "Test notification sent — check the bottom-right of your desktop.",
	notifyDenyUnsupported: "System notifications are not supported in this environment (no Notification API).",
	notifyDenyBlocked: "Notification permission is blocked by the browser.",
	notifyDenyRejected: "You chose \"Block\" in the permission prompt.",
	notifyDenyError: "Failed to request permission",
	notifyGuide: "Guide: click the 🔒/ⓘ icon next to the address bar → Site settings → Notifications → set to \"Allow\", then refresh and retry.",
	storageTitle: "Uninstall & storage",
	storageHint: "Every location this plugin writes to. Deleting cache folders is harmless (they re-download / rebuild); deleting \"plugin user data\" loses your config and chat memory.",
	"storage.userData": "Plugin user data: custom config main-config.jsonc, chat memory memory.json, custom animation assets main-animation/, file pets pet/",
	"storage.electron": "Electron runtime used by the desktop pet (large; re-downloaded automatically the next time desktop mode starts)",
	"storage.desktopCache": "Desktop pet window cache and primary-monitor scale cache (safe to delete, rebuilt automatically)",
	"storage.electronCache": "Electron installer download cache (safe to delete, re-downloaded when needed)",
	"storage.package": "The plugin itself (managed by DSH — remove it with the command below instead of deleting it)",
	storageMissing: " (not created yet)",
	uninstallTitle: "How to uninstall",
	uninstallStep1: "1. Quit DSH first (the desktop pet exits with it); do not delete these files while the pet is running.",
	uninstallStep2: "2. Remove the plugin itself (run in a terminal; this also drops it from the profile bundle layer):",
	uninstallStep3: "3. Delete the locations above as needed: cache folders are harmless; deleting \"plugin user data\" loses your config and chat memory (back up main-config.jsonc first if you want to keep it).",
	uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

//#endregion
//#region src/client/settings/locales/es.ts
const es = {
	nav: "Configuración de mascotas",
	intro: "Gestiona varias mascotas: cada una tiene su propio tamaño y posición (se aplica al instante después de guardar).",
	petCardTitle: "Mascota",
	petCardHint: "Ajustes por mascota: nombre / tamaño / visualización / esquina / márgenes / los cuatro interruptores de funciones. Pulsa \"Guardar\" abajo para aplicar al instante.",
	globalTitle: "Interruptores globales",
	globalHint: "Compartidos por todas las mascotas (un pet pack puede sobrescribirlos en el archivo de su propio tipo). Estos interruptores solo cambian el estado local y se escriben en la configuración del usuario al \"Guardar\" (nunca al instante); las notificaciones del sistema se vuelven a leer justo después de guardar, sin necesidad de recargar la página.",
	cornerHint: "En qué esquina de la pantalla se pega la mascota (en escritorio se calcula por el área de trabajo de cada monitor).",
	marginXHint: "Distancia horizontal desde la esquina elegida (px); puede ser cualquier número.",
	marginYHint: "Distancia vertical desde la esquina elegida (px); puede ser cualquier número.",
	"cmd.chat": "Chat",
	"cmd.pet": "Mascota",
	"cmd.balance": "Saldo",
	"shortcut.open": "Abrir el chat de la mascota",
	"shortcut.chat": "Abrir la ventana de chat",
	"shortcut.hear": "Entrada de voz",
	"shortcut.capture": "Captura de pantalla al chat",
	shortcutCardTitle: "Atajos",
	shortcutCardHint: "Al expandir hay dos grupos: atajos de la mascota y atajos globales.",
	shortcutRowChat: "Abrir chat",
	shortcutRowHold: "Mantener para hablar",
	shortcutRowHear: "Entrada de voz",
	shortcutRowCapture: "Captura de pantalla",
	shortcutRowPaste: "Pegar imagen",
	shortcutRowTodo: "Tareas",
	shortcutRowSleep: "Dormir / despertar",
	shortcutRowDisplay: "Posición de visualización",
	shortcutRowSidebar: "Abrir el chat lateral",
	shortcutGroupPet: "Atajos de la mascota",
	shortcutGroupPetHint: "En la web basta con pasar el puntero sobre la mascota. En la ventana del escritorio hay que hacer clic en la mascota para que reciba el foco del teclado.",
	shortcutGroupGlobal: "Atajos globales",
	shortcutGroupGlobalHint: "Los distribuye DSH en la web y en la ventana del escritorio; se cambian en Ajustes → General → Atajos.",
	petsLabel: "Mascotas",
	add: "Agregar mascota",
	remove: "Eliminar",
	confirmRemove: "¿Eliminar la mascota \"{id}\"?",
	confirmTitle: "Confirmar acción",
	cancel: "Cancelar",
	ok: "Entendido",
	atLeastOne: "Debe quedar al menos una mascota.",
	emptyPets: "Aún no hay mascotas; haz clic en \"Agregar mascota\" para crear una.",
	sizeLabel: "Tamaño (ancho px)",
	sizeHint: "La altura es automática = ancho × 9/16.",
	sizePercentLabel: "Ancho de pantalla máx. (%)",
	sizePercentHint: "Cuánto del ancho de pantalla puede ocupar la mascota: 100 = nunca más ancha que una pantalla (igual que px en ventanas anchas); 30–40 la hace claramente más pequeña en el móvil sin cambiar el escritorio. Se calcula una vez al cargar; recarga tras redimensionar.",
	nameLabel: "Nombre",
	nameHint: "Se muestra al pasar el cursor y se añade a las personas de la IA (\"tu nombre es X\"). Se permiten duplicados; si se deja vacío, se usa el id de la mascota.",
	personaLabel: "Persona (opcional)",
	personaHint: "Solo afecta a esta mascota. Déjalo vacío para seguir la persona de la entrada: el texto gris del cuadro es exactamente ese contenido. El system que se envía al modelo = este texto + una línea añadida con \"tu nombre es <nombre>\" + el contexto de la hora actual, así que no repitas aquí el nombre ni la fecha.",
	personaCount: "{n} caracteres",
	balanceEnabled: "Saldo",
	balanceEnabledHint: "Cuando está activado, esta mascota reproduce animaciones de saldo y muestra el globo de saldo.",
	whisperEnabled: "Susurros",
	whisperEnabledHint: "Cuando está activado, esta mascota genera periódicamente una frase con IA y reproduce la animación de susurro (la persona está en el campo de abajo; vacío sigue la entrada).",
	workStatusEnabled: "Estado de trabajo",
	workStatusEnabledHint: "Cuando está activado, esta mascota sigue el estado de trabajo de DSH: pensando / trabajando / esperando confirmación / terminado / error cambian la animación y muestran globos (el pool está en la configuración de nivel superior; solo escucha, no llama al modelo).",
	fixedEnabled: "Fijar en el sitio",
	fixedEnabledHint: "Cuando está activado, la cadena aleatoria ya no gira ni aleja a esta mascota: solo se reproducen acciones de reposo y en el sitio. Las selecciones con clic derecho, los disparos por API y las animaciones de saldo / susurro / estado de trabajo no se ven afectados.",
	displayLabel: "Visualización",
	displayHint: "web = solo navegador / desktop = solo escritorio / both = ambos / none = ninguno",
	"display.web": "Solo navegador",
	"display.desktop": "Solo escritorio",
	"display.both": "Ambos",
	"display.none": "Ninguno",
	cornerLabel: "Posición",
	"corner.top-left": "Arriba a la izquierda",
	"corner.top-right": "Arriba a la derecha",
	"corner.bottom-left": "Abajo a la izquierda",
	"corner.bottom-right": "Abajo a la derecha",
	marginX: "Margen horizontal",
	marginY: "Margen vertical",
	save: "Guardar",
	saveHotkey: "Ctrl+S / Cmd+S",
	sync: "Sincronizar",
	confirmSync: "¿Sincronizar? Esto sobrescribe la configuración del usuario con la configuración predeterminada incluida (todos los campos + comentarios); las personalizaciones actuales se perderán.",
	corruptTitle: "La configuración del usuario está dañada; no se guardó",
	corruptConfirm: "Guardar de todos modos",
	corruptBody: "No se puede analizar el archivo de configuración del usuario (dañado, no es JSON/JSONC válido): {path}. Si guardas ahora, se reconstruirá desde la lista blanca: todo lo que hay actualmente en ese archivo (animations / physics / memes…) se perderá. Cancelar = no tocar el archivo (corrígelo y vuelve a guardar); Confirmar = guardar de todos modos (descartar lo que hay en el archivo).",
	syncHint: "\"Sincronizar\" escribe la configuración predeterminada incluida (con comentarios y todos los campos avanzados) en el archivo de configuración del usuario, sobrescribiendo tus personalizaciones actuales; después el archivo se puede editar directamente. Dos advertencias: (1) una vez creado, ese archivo es una capa de sobrescritura explícita: los cambios posteriores en los valores predeterminados incluidos no se aplicarán automáticamente (hasta que vuelvas a sincronizar o borres el archivo); (2) al pulsar \"Guardar\" en esta página se reescribe el archivo desde una lista blanca: los valores de los campos se conservan, pero los comentarios se pierden.",
	configMeta: "Avanzado (archivos)",
	configMetaHint: "La configuración del usuario puede sobrescribir las mascotas / los pools de animación / los pesos; recarga o reinicia para aplicarlo: recarga la página en el navegador, o haz clic derecho en una mascota de escritorio → \"Recargar configuración\" (reconstruye todas las ventanas de mascotas de escritorio). La configuración predeterminada es la referencia completa.",
	defaultConfig: "Configuración predeterminada (solo lectura, referencia completa)",
	userConfig: "Configuración del usuario (sobrescrituras personalizadas)",
	todosFile: "Datos de tareas (texto de la lista, hora de vencimiento y estado de completado; borrarlo vacía todas las tareas)",
	animationDir: "Directorio de recursos de animación (añade o personaliza animaciones aquí)",
	memesDir: "Directorio de imágenes de memes (añade o personaliza imágenes aquí)",
	logFile: "Archivo de registro (para diagnóstico; se puede vaciar)",
	logFileNote: "La versión de escritorio no tiene consola, así que todos los registros de ejecución del plugin (inicio, fallos y reinicios de la mascota de escritorio, errores y advertencias) van a este único archivo; adjúntalo al reportar un problema. El límite por archivo es de 1 MB; al llenarse solo se conservan los últimos 512 KB.",
	saved: "Guardado: las mascotas se actualizaron al instante.",
	loadError: "No se pudo cargar la configuración",
	saveError: "No se pudo guardar la configuración. Revisa la conexión con el servidor, los permisos de escritura del directorio de configuración y el registro del servidor.",
	saveInvalid: "No se pudo guardar la configuración: el contenido no es válido. Revísalo e inténtalo de nuevo.",
	syncError: "No se pudo sincronizar la configuración. Revisa la conexión con el servidor y los permisos de escritura del directorio de configuración.",
	loading: "Cargando configuración…",
	retry: "Reintentar",
	invalid: "Revisa los datos: el tamaño debe ser positivo; los márgenes pueden ser cualquier número.",
	busy: "Guardando…",
	extraPetsHint: "Otras {n} variantes provienen de archivos del directorio pet/ (<nombre>-config.json + <nombre>-animation/). Cambia a ellas en la fila Tipos de arriba; Guardar escribe en la configuración de cada pack, nunca en main-config.jsonc.",
	kindLabel: "Tipos",
	kindMain: "Integrado",
	lastOfKind: "«{entry}» solo tiene esta mascota; si la eliminas, desaparece todo el tipo. Para quitarlo por completo, borra los archivos del pack de la mascota.",
	savePartial: "Las mascotas principales se guardaron, pero {names} no se pudo escribir de vuelta: revisa que la configuración del pack sea válida y que el directorio tenga permisos de escritura.",
	notifyToggle: "Notificaciones del sistema",
	notifyToggleHint: "Avisos del sistema operativo (abajo a la derecha del escritorio) al completarse una conversación, si falla la generación, cuando se solicita permiso o cuando hay que elegir; solo mientras esta ventana no tiene el foco.",
	clickSoundToggle: "Sonido al hacer clic",
	clickSoundToggleHint: "Reproduce el sonido de clic integrado (assets/sound/click-duck.wav, volumen 0.5) al hacer clic en una mascota; los clics repetidos en menos de 100 ms solo suenan una vez, así que varias mascotas nunca se superponen. Desactívalo para silencio total. Se escribe en la configuración del usuario al Guardar.",
	whisperImageToggle: "Imágenes en susurros",
	whisperImageToggleHint: "Adjunta un meme aleatorio del pool a cada susurro (el mapeo de imágenes está en el campo `memes` de la configuración de nivel superior). Tokens: un susurro ya llama al modelo en cada ciclo, así que la imagen solo añade el nombre + la descripción de ese meme (~100 caracteres / ~60 tokens) a la misma solicitud: insignificante.",
	chatImageToggle: "Imágenes en el chat",
	chatImageToggleHint: "Deja que la IA elija un meme del pool que encaje con el contexto actual (opcional; el mapeo está en el campo `memes` de la configuración de nivel superior). Tokens: cada mensaje lleva el catálogo completo, unos 1.1k caracteres (~650 tokens, unas 11 veces el caso de los susurros) y crece con el número de imágenes; si lo desactivas, no se adjunta ni un carácter.",
	chatAnimationToggle: "Acciones en el chat",
	chatAnimationToggleHint: "Cuando está activado, la petición de chat lleva la lista de animaciones que se pueden representar (todas las acciones de animations.categories): si el modelo considera que la frase realmente representa una, la mascota la ejecuta en el acto; si no, responde solo con texto. Tokens: cada mensaje lleva la lista completa; desactivado no se adjunta nada. Valor predeterminado global para todas las mascotas (un pet pack puede sobrescribirlo en su propio archivo de configuración).",
	confineToggle: "Limitar a la pantalla actual",
	confineToggleHint: "Varios monitores: cuando está activado, la mascota solo se mueve dentro de la pantalla en la que está: una mascota lanzada rebota únicamente dentro de la pantalla donde se soltó (las uniones entre pantallas actúan como muros, así que nunca vuela al monitor vecino), y el vagabundeo autónomo solo camina dentro de la pantalla actual (el paso que cruzaría la unión se cancela). Desactívalo para permitir vuelos y caminatas entre pantallas. Solo afecta al modo escritorio: el overlay del navegador ya se queda dentro del viewport.",
	trayToggle: "Bandeja del sistema",
	trayToggleHint: "Muestra un icono en la bandeja (área de notificaciones en Windows, barra de menús en macOS) cuando el modo escritorio está activo. Lista todas las mascotas de la configuración y alterna cada una entre escritorio y web/ninguno, incluidas las que ahora no están en el escritorio y no tienen ventana donde hacer clic derecho. Con esto desactivado, para devolver una mascota al escritorio hay que abrir el navegador (la página de configuración o el clic derecho sobre la mascota web). Windows ya oculta los iconos de terceros en «iconos ocultos». Solo afecta al modo escritorio.",
	voiceTitle: "Voz",
	voiceHint: "Tres interruptores y una voz: el maestro controla la locución automática y los dos secundarios controlan un tipo de mensaje proactivo cada uno. Todo desactivado por defecto; se escribe en la configuración del usuario al \"Guardar\" (nunca al instante).",
	voiceEnabled: "Locutar respuestas",
	voiceEnabledHint: "Interruptor maestro de la locución automática. Si está desactivado, los susurros periódicos y los recordatorios de tareas quedan en silencio (los dos interruptores de abajo no tienen efecto). Los susurros manuales, las respuestas del chat y el botón de altavoz del panel de chat no dependen de él: los pediste tú, así que la superficie desde la que los pediste los locuta directamente. Solo afecta a si se produce sonido: los globos, la memoria del chat y las notificaciones del sistema no cambian; un fallo de síntesis se registra y nunca interrumpe la conversación.",
	voiceWhisperEnabled: "Locutar susurros",
	voiceWhisperEnabledHint: "Locuta el susurro generado periódicamente (el susurro manual con clic derecho no se ve afectado). Depende del interruptor maestro de arriba. Desactivado por defecto: los susurros son narración de fondo y no deberían sonar sin pedirlo.",
	voiceTodoEnabled: "Locutar recordatorios de tareas",
	voiceTodoEnabledHint: "Locuta el recordatorio de una tarea cuando vence (el globo sigue apareciendo; esto solo decide si se locuta). Depende del interruptor maestro de arriba. Desactivado por defecto.",
	voiceNameLabel: "Voz",
	voiceVolumeLabel: "Volumen",
	voiceVolumeHint: "Volumen de reproducción como decimal 0–1: 1 es el volumen máximo (100 %) y 0 silencia. Solo cambia la intensidad y no vuelve a sintetizar el audio, así que ajustarlo no tiene coste extra. Es independiente del interruptor general de arriba: con ese interruptor apagado no surte efecto.",
	physicsTitle: "Física (sensación al arrastrar y lanzar)",
	physicsHint: "Valor predeterminado global, compartido por todas las mascotas (un pet pack puede sobrescribirlo en el archivo de su propio tipo); se escribe en la configuración del usuario al \"Guardar\" (nunca al instante). En el navegador se aplica al instante; en el escritorio se aplica cuando Guardar recarga las ventanas de mascotas.",
	mobileTitle: "Efectos móviles",
	mobileHint: "Solo tienen sentido en el navegador del móvil: la vibración necesita motor, los dos interruptores de movimiento necesitan sensores de inclinación/aceleración, y los sensores exigen HTTPS o localhost.",
	"physics.gravity": "Gravedad",
	"physics.gravityHint": "px/s²: cuanto mayor, más rápido cae; 0 = sin gravedad (vuela en línea recta para siempre)",
	"physics.restitution": "Rebote",
	"physics.restitutionHint": "0–1, velocidad que se conserva al rebotar en una pared o el suelo (1 = completamente elástico, 0 = se detiene en seco)",
	"physics.groundFriction": "Fricción de contacto",
	"physics.groundFrictionHint": "por segundo, amortiguación a lo largo de cualquier superficie (pared, suelo, techo); 0 = hielo en todas",
	"physics.throwPower": "Fuerza de lanzamiento",
	"physics.throwPowerHint": "> 0, multiplicador general del seguimiento con resorte y de la velocidad de salida (1 = predeterminado; más alto = sigue más pegado y lanza más fuerte)",
	physicsCeilingBounce: "Rebote en el techo",
	physicsCeilingBounceHint: "Desactívalo para que un lanzamiento pueda salir por la parte superior de la pantalla (la gravedad sigue tirando de él hacia abajo)",
	physicsPetCollision: "Colisiones entre mascotas",
	physicsPetCollisionHint: "Una mascota en vuelo rebota contra las demás conservando el momento (masa ∝ tamaño²)",
	physicsHaptic: "Vibración al chocar",
	physicsHapticHint: "Una vibración por impacto (paredes, suelo, techo, otras mascotas). Funciona en Chrome/Edge; no en iOS ni en navegadores WebView como Via. El modo No molestar la bloquea.",
	physicsTilt: "Gravedad por inclinación",
	physicsTiltHint: "Inclina el móvil y la gravedad lo sigue (magnitud = el valor de arriba); con gravedad en 0 la inclinación no hace nada. Requiere HTTPS/localhost.",
	physicsShake: "Agitar para lanzar",
	physicsShakeHint: "Agita para lanzar la mascota en la dirección del gesto; la fuerza escala con throwPower. No depende de la gravedad, así que funciona con gravedad 0. Requiere HTTPS/localhost.",
	invalidPhysics: "Revisa los parámetros de física: gravedad / fricción con el suelo ≥ 0, rebote 0–1, fuerza de lanzamiento > 0.",
	fontTitle: "Apariencia y fuente",
	fontHint: "La familia se aplica a todos los textos que ahora usan la fuente candy: globo de la mascota, tooltip al pasar el cursor, ventana de chat y ventana de puntuación. El tamaño solo se aplica al globo de la mascota y al tooltip (las ventanas de chat y de puntuación conservan su tamaño). Valor predeterminado global, compartido por todas las mascotas (un pet pack puede sobrescribirlo en el archivo de su propio tipo); se escribe en la configuración del usuario al \"Guardar\": al instante en el navegador y, en el escritorio, cuando Guardar recarga las ventanas de mascotas.",
	fontFamilyLabel: "Fuente",
	fontFamilyHint: "«Candy (integrada)» viene con el plugin; las demás son fuentes del sistema. Si una fuente no está instalada en esta máquina, se usa la siguiente de la pila (nunca queda en blanco ni da error).",
	fontSizeLabel: "Tamaño de fuente (px)",
	fontSizeHint: "Tamaño del texto del globo; el tooltip y las líneas pequeñas dentro del globo se escalan en proporción. Rango 4–200.",
	fontFollowToggle: "Escalar la fuente con el tamaño de la mascota",
	fontFollowToggleHint: "Activado (predeterminado): la fuente crece con la mascota; con 462 px de ancho es exactamente el tamaño de arriba. Desactivado: el tamaño queda fijo sin importar el tamaño de la mascota.",
	invalidFont: "Revisa la configuración de la fuente: la familia debe estar en la lista y el tamaño debe ser un número entre 4 y 200.",
	"font.candy": "Candy (integrada)",
	"font.yahei": "Microsoft YaHei / PingFang",
	"font.youyuan": "YouYuan",
	"font.kaiti": "KaiTi",
	"font.simsun": "SimSun",
	"font.comic": "Comic Sans MS",
	"font.system": "Predeterminada del sistema",
	modelTitle: "Chat y modelos",
	modelHint: "Qué modelo usa cada uno de susurros y chat, y cuánto historial lleva cada solicitud de chat. \"Seguir la conversación actual\" usa el modelo de tu conversación actual (predeterminado). Valor predeterminado global: se aplica a todas las mascotas y un pet pack puede sobrescribirlo en el archivo de su propio tipo. Las opciones vienen de la misma fuente que el selector de modelos de DSH y el host las sirve en vivo.",
	modelFollow: "Seguir la conversación actual",
	modelSearch: "Buscar modelos…",
	modelEmpty: "No hay modelos que coincidan.",
	modelNoModels: "No hay modelos disponibles.",
	modelLoading: "Actualizando la lista de modelos…",
	modelTriggerAria: "Seleccionar modelo, actual {model}",
	modelUnknown: " (configuración actual, no está en la lista)",
	modelNone: "Este proveedor no tiene modelos disponibles",
	whisperModelLabel: "Modelo de susurros",
	chatModelLabel: "Modelo de chat",
	modelFieldHint: "\"Seguir la conversación actual\" usa el modelo de la conversación; si el modelo elegido falla, se vuelve al modelo de la conversación y se reintenta una vez.",
	invalidModel: "Revisa la configuración del modelo: elige proveedor y modelo, o deja ambos vacíos (seguir la conversación actual).",
	modelCatalogFailed: "No se pudo cargar la lista de modelos (recarga la página para reintentar); tus valores actuales se conservan tal cual.",
	chatMemory: "Rondas de historial del chat",
	chatMemoryHint: "Cuántas rondas recientes lleva cada solicitud de chat (1 ronda = 1 pregunta + 1 respuesta; 0 = sin historial, cada mensaje empieza de cero). La memoria en sí lo guarda todo: esto solo decide cuánto entra en el contexto; más rondas recuerdan más y gastan más tokens. Valor predeterminado global, compartido por todas las mascotas (un pet pack puede sobrescribirlo en el archivo de su propio tipo).",
	invalidChatMemory: "Revisa las rondas de historial del chat: debe ser un número ≥ 0.",
	chatImageLimit: "Límite de imágenes en el chat",
	chatImageLimitHint: "Cuántos memes como máximo se listan al modelo durante el chat (\"los primeros N\" = los N que escribiste primero en la configuración; mueve al frente los que quieras enviar). Esa lista completa se adjunta a cada mensaje y los tokens crecen de forma lineal con la cantidad, así que una lista larga es puro gasto; limitarla a los primeros N hace que el modelo elija solo entre esos. 0 = sin límite (enviar todo). Valor integrado predeterminado: 10. Valor predeterminado global, compartido por todas las mascotas (un pet pack puede sobrescribirlo en el archivo de su propio tipo). Solo afecta a la selección de imágenes del chat: un susurro lleva solo el meme que sacó.",
	invalidChatImageLimit: "Revisa el límite de imágenes del chat: debe ser un número ≥ 0 (0 = sin límite).",
	notifyTest: "Probar notificación",
	notifyTestOk: "Notificación de prueba enviada; mírala abajo a la derecha del escritorio.",
	notifyDenyUnsupported: "Este entorno no admite notificaciones del sistema (no hay API Notification).",
	notifyDenyBlocked: "El navegador tiene bloqueado el permiso de notificaciones.",
	notifyDenyRejected: "Elegiste «Bloquear» en el aviso de permiso.",
	notifyDenyError: "Error al solicitar permiso",
	notifyGuide: "Guía: haz clic en el icono 🔒/ⓘ junto a la barra de direcciones → Configuración del sitio → Notificaciones → cámbialo a «Permitir» y luego recarga la página y reintenta.",
	storageTitle: "Desinstalación y almacenamiento",
	storageHint: "Todas las ubicaciones que escribe este plugin. Borrar las cachés no rompe nada (se vuelven a descargar/reconstruir); borrar los «datos de usuario del plugin» pierde la configuración y la memoria del chat.",
	"storage.userData": "Datos de usuario del plugin: configuración personalizada main-config.jsonc, memoria del chat memory.json, recursos de animación personalizados main-animation/, mascotas de archivo pet/",
	"storage.electron": "Runtime de Electron que usa la mascota de escritorio (grande; se vuelve a descargar automáticamente la próxima vez que se active el modo escritorio)",
	"storage.desktopCache": "Caché de las ventanas de mascotas de escritorio y caché de escala del monitor principal (se puede borrar, se reconstruye automáticamente)",
	"storage.electronCache": "Caché de descarga del instalador de Electron (se puede borrar, se vuelve a descargar cuando haga falta)",
	"storage.package": "El plugin en sí (lo gestiona DSH: quítalo con el comando de abajo en vez de borrarlo a mano)",
	storageMissing: " (aún no se ha creado)",
	uninstallTitle: "Cómo desinstalar",
	uninstallStep1: "1. Cierra DSH primero (la mascota de escritorio se cierra con él); no borres estos archivos mientras la mascota esté en ejecución.",
	uninstallStep2: "2. Quita el plugin en sí (ejecútalo en la terminal; también lo elimina de la capa de bundles del perfil):",
	uninstallStep3: "3. Borra las ubicaciones de arriba según necesites: las cachés no hacen daño; borrar los «datos de usuario del plugin» pierde la configuración y la memoria del chat (haz una copia de main-config.jsonc si quieres conservarla).",
	uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

//#endregion
//#region src/client/settings/locales/fr.ts
const fr = {
	nav: "Configuration des compagnons",
	intro: "Gérez plusieurs compagnons : chacun a sa taille et sa position (appliquées immédiatement après l'enregistrement).",
	petCardTitle: "Compagnon",
	petCardHint: "Réglages par compagnon : nom / taille / affichage / coin / décalages / les quatre interrupteurs de fonctionnalités. Cliquez sur « Enregistrer » en bas pour appliquer immédiatement.",
	globalTitle: "Interrupteurs globaux",
	globalHint: "Partagés par tous les compagnons (un pet pack peut les remplacer dans son propre fichier de type). Ces interrupteurs ne modifient que l'état local et sont écrits dans la configuration utilisateur lors de l'enregistrement (jamais immédiatement) ; les notifications système sont relues juste après l'enregistrement, sans rafraîchir la page.",
	cornerHint: "Le coin de l'écran auquel le compagnon se colle (par zone de travail de chaque écran en mode bureau).",
	marginXHint: "Distance horizontale au coin choisi (px) ; n'importe quel nombre.",
	marginYHint: "Distance verticale au coin choisi (px) ; n'importe quel nombre.",
	"cmd.chat": "Discussion",
	"cmd.pet": "Compagnon",
	"cmd.balance": "Solde",
	"shortcut.open": "Ouvrir le chat du compagnon",
	"shortcut.chat": "Ouvrir la fenêtre de chat",
	"shortcut.hear": "Saisie vocale",
	"shortcut.capture": "Capture d’écran vers le chat",
	shortcutCardTitle: "Raccourcis",
	shortcutCardHint: "Deux groupes une fois déployé : raccourcis du compagnon et raccourcis globaux.",
	shortcutRowChat: "Ouvrir le chat",
	shortcutRowHold: "Maintenir pour parler",
	shortcutRowHear: "Saisie vocale",
	shortcutRowCapture: "Capture d’écran",
	shortcutRowPaste: "Coller une image",
	shortcutRowTodo: "Tâches",
	shortcutRowSleep: "Dormir / réveiller",
	shortcutRowDisplay: "Position d’affichage",
	shortcutRowSidebar: "Ouvrir le chat latéral",
	shortcutGroupPet: "Raccourcis du compagnon",
	shortcutGroupPetHint: "Sur le web, il suffit de survoler le compagnon. Dans la fenêtre du bureau, cliquez d’abord sur le compagnon pour qu’il prenne le focus clavier.",
	shortcutGroupGlobal: "Raccourcis globaux",
	shortcutGroupGlobalHint: "Distribués par DSH dans le web et la fenêtre du bureau ; modifiables dans Réglages → Général → Raccourcis.",
	petsLabel: "Compagnons",
	add: "Ajouter un compagnon",
	remove: "Supprimer",
	confirmRemove: "Supprimer le compagnon « {id} » ?",
	confirmTitle: "Confirmer l'action",
	cancel: "Annuler",
	ok: "Compris",
	atLeastOne: "Gardez au moins un compagnon.",
	emptyPets: "Aucun compagnon pour l'instant — cliquez sur « Ajouter un compagnon » pour en créer un.",
	sizeLabel: "Taille (largeur px)",
	sizeHint: "La hauteur est automatique = largeur × 9/16.",
	sizePercentLabel: "Largeur d’écran max (%)",
	sizePercentHint: "Part de la largeur d’écran que le pet peut occuper : 100 = jamais plus large qu’un écran (identique au px sur une fenêtre large) ; 30–40 le rend nettement plus petit sur téléphone sans changer le bureau. Calculé une fois au chargement ; rechargez après redimensionnement.",
	nameLabel: "Nom",
	nameHint: "Affiché au survol du compagnon et ajouté aux personas de l'IA (« votre nom est X »). Les doublons sont permis ; laissé vide, l'identifiant du compagnon est utilisé.",
	personaLabel: "Persona (facultatif)",
	personaHint: "Ne concerne que ce compagnon. Laissez vide pour suivre le persona de l'entrée — le texte grisé dans le champ est exactement celui-ci. Le system réellement envoyé au modèle = ce texte + la ligne « votre nom est <nom> » ajoutée automatiquement + le contexte temporel courant ; ne répétez donc ni le nom ni la date ici.",
	personaCount: "{n} caractères",
	balanceEnabled: "Fonction solde",
	balanceEnabledHint: "Une fois activée, ce compagnon joue l'animation de solde et affiche la bulle de solde.",
	whisperEnabled: "Murmures",
	whisperEnabledHint: "Une fois activé, ce compagnon génère périodiquement une phrase via l'IA et joue l'animation de murmure (persona = le champ ci-dessous ; vide = celui de l'entrée).",
	workStatusEnabled: "Suivi de l'état de travail",
	workStatusEnabledHint: "Une fois activé, ce compagnon suit l'état de travail de DSH : réflexion / travail / attente de confirmation / terminé / erreur déclenchent l'animation correspondante et une bulle (le pool se trouve au niveau supérieur de la configuration ; écoute seule, aucun appel au modèle).",
	fixedEnabled: "Compagnon fixe",
	fixedEnabledHint: "Une fois activé, la chaîne aléatoire ne fait plus se retourner ni s'éloigner le compagnon — seules les actions sur place sont jouées. Les déclenchements par menu contextuel et par API, ainsi que les animations solde / murmure / état de travail, ne sont pas affectés.",
	displayLabel: "Affichage",
	displayHint: "web = navigateur seul / desktop = bureau seul / both = les deux / none = aucun",
	"display.web": "Navigateur seul",
	"display.desktop": "Bureau seul",
	"display.both": "Les deux",
	"display.none": "Aucun",
	cornerLabel: "Position",
	"corner.top-left": "En haut à gauche",
	"corner.top-right": "En haut à droite",
	"corner.bottom-left": "En bas à gauche",
	"corner.bottom-right": "En bas à droite",
	marginX: "Décalage horizontal",
	marginY: "Décalage vertical",
	save: "Enregistrer",
	saveHotkey: "Ctrl+S / Cmd+S",
	sync: "Synchroniser",
	confirmSync: "Synchroniser ? La configuration par défaut intégrée (tous les champs + commentaires) remplacera la configuration utilisateur ; vos personnalisations actuelles seront perdues.",
	corruptTitle: "Configuration utilisateur corrompue — non enregistrée",
	corruptConfirm: "Enregistrer quand même",
	corruptBody: "Le fichier de configuration utilisateur est illisible (corrompu, JSON/JSONC invalide) : {path}. Enregistrer maintenant le reconstruit à partir de la liste blanche — tout son contenu actuel (animations / physics / memes, etc.) sera perdu. Annuler = ne pas toucher au fichier (corrigez-le puis enregistrez) ; Confirmer = enregistrer quand même (le contenu actuel du fichier est abandonné).",
	syncHint: "« Synchroniser » écrit la configuration par défaut intégrée (commentaires et tous les champs avancés compris) dans le fichier de configuration utilisateur, en écrasant vos personnalisations ; le fichier est ensuite modifiable directement. Deux réserves : (1) une fois créé, ce fichier est une couche de remplacement explicite — les changements ultérieurs des valeurs par défaut intégrées ne s'appliquent pas automatiquement (sauf nouvelle synchronisation ou suppression du fichier) ; (2) cliquer sur « Enregistrer » sur cette page réécrit le fichier à partir d'une liste blanche — les valeurs sont conservées, les commentaires disparaissent.",
	configMeta: "Configuration avancée (fichiers)",
	configMetaHint: "La configuration utilisateur peut remplacer la liste des compagnons / les pools d'animation / les poids ; rechargez la page ou redémarrez pour appliquer : rafraîchissez la page dans le navigateur, ou sur le bureau, clic droit sur un compagnon → « Recharger la configuration » (reconstruit toutes les fenêtres de compagnons). La configuration par défaut est la référence complète.",
	defaultConfig: "Configuration par défaut (lecture seule, référence complète)",
	userConfig: "Configuration utilisateur (remplacements personnalisés)",
	todosFile: "Données de tâches (texte, échéance et état ; les supprimer vide toutes les tâches)",
	animationDir: "Dossier des animations (pour ajouter ou personnaliser des animations)",
	memesDir: "Dossier des mèmes (pour ajouter ou personnaliser des images)",
	logFile: "Fichier journal (pour le dépannage ; peut être vidé)",
	logFileNote: "L'application de bureau n'a pas de console : tous les journaux d'exécution du plugin (démarrage, plantages / redémarrages des compagnons, erreurs et avertissements) sont écrits dans ce seul fichier — joignez-le à vos rapports de problème. Limité à 1 Mo ; une fois plein, seuls les 512 Ko les plus récents sont conservés.",
	saved: "Enregistré — les compagnons sont à jour immédiatement.",
	loadError: "Échec du chargement de la configuration",
	saveError: "Échec de l'enregistrement de la configuration. Vérifiez la connexion au serveur, les droits d'écriture du dossier de configuration et le journal du serveur.",
	saveInvalid: "Échec de l'enregistrement : configuration invalide. Vérifiez les valeurs et réessayez.",
	syncError: "Échec de la synchronisation. Vérifiez la connexion au serveur et les droits d'écriture du dossier de configuration.",
	loading: "Chargement de la configuration…",
	retry: "Réessayer",
	invalid: "Vérifiez votre saisie : la taille doit être positive ; les marges peuvent être n'importe quel nombre.",
	busy: "Enregistrement…",
	extraPetsHint: "{n} autre(s) type(s) proviennent de fichiers du dossier pet/ (<nom>-config.json + <nom>-animation/) ; basculez dessus dans la ligne « Types » ci-dessus. L'enregistrement écrit dans la configuration propre à chaque pack, jamais dans main-config.jsonc.",
	kindLabel: "Types",
	kindMain: "Intégré",
	lastOfKind: "« {entry} » n'a plus que ce compagnon — le supprimer ferait disparaître tout le type. Pour le retirer complètement, supprimez les fichiers du pack.",
	savePartial: "Compagnons principaux enregistrés, mais {names} n'ont pas pu être écrits : vérifiez que la configuration du pack est valide et que le dossier est accessible en écriture.",
	notifyToggle: "Notifications système",
	notifyToggleHint: "Notifications du système d'exploitation (en bas à droite du bureau) pour la fin d'une conversation, les échecs, les demandes de permission et les questions — uniquement lorsque cette fenêtre n'a pas le focus.",
	clickSoundToggle: "Son au clic",
	clickSoundToggleHint: "Joue le son intégré (assets/sound/click-duck.wav, volume 0,5) quand on clique sur un compagnon ; les clics répétés en moins de 100 ms ne sonnent qu'une fois, donc plusieurs compagnons ne se superposent jamais. Désactivez-le pour un silence total. Écrit dans la configuration utilisateur avec « Enregistrer ».",
	whisperImageToggle: "Images des murmures",
	whisperImageToggleHint: "Joindre un mème tiré au hasard dans le pool à chaque murmure (la correspondance des images se trouve dans le champ memes, au niveau supérieur de la configuration). Tokens : un murmure appelle déjà le modèle à chaque cycle ; l'image ajoute seulement le nom + la description de ce mème (environ 100 caractères / ~60 tokens) à la même requête — négligeable.",
	chatImageToggle: "Images de discussion",
	chatImageToggleHint: "L'IA choisit un mème du pool adapté au contexte (facultatif ; la correspondance se trouve dans le champ memes, au niveau supérieur de la configuration). Tokens : chaque message transporte tout le catalogue — actuellement environ 1,1 k caractères (~650 tokens, soit environ 11 fois le cas des murmures) et cela croît avec le nombre d'images ; désactivé, rien du tout n'est ajouté.",
	chatAnimationToggle: "Actions en discussion",
	chatAnimationToggleHint: "Une fois activé, la requête de discussion transporte la liste des animations jouables (toutes les actions de animations.categories) : si le modèle estime que la réplique joue réellement l'une d'elles, le compagnon la joue immédiatement ; sinon il répond seulement en texte. Tokens : chaque message transporte toute la liste ; désactivé, rien n'est ajouté. Valeur par défaut globale pour tous les compagnons (un pet pack peut la surcharger dans son propre fichier de configuration).",
	confineToggle: "Limiter à l'écran actuel",
	confineToggleHint: "Multi-écrans : une fois activé, le compagnon reste sur l'écran où il se trouve — un compagnon lancé ne rebondit que sur l'écran du relâchement (les jointures d'écrans font office de murs, il ne passe pas sur l'écran voisin) et l'errance autonome ne se fait que sur l'écran actuel (tout pas qui franchirait la jointure est annulé). Désactivé, il traverse les écrans comme d'habitude. Mode bureau uniquement — l'overlay du navigateur reste de toute façon dans la zone visible.",
	trayToggle: "Zone de notification",
	trayToggleHint: "Affiche une icône dans la zone de notification (barre de menus sur macOS) dès que le mode bureau démarre. Elle liste tous les compagnons de la configuration et permet de basculer chacun entre bureau et web / aucun — y compris ceux qui ne sont pas sur le bureau et n'ont donc aucune fenêtre à cliquer droit. Une fois désactivée, ramener un compagnon sur le bureau exige d'ouvrir le navigateur (la page de configuration, ou un clic droit sur le compagnon web). Windows range déjà ces icônes dans le panneau « icônes masquées ». Mode bureau uniquement.",
	voiceTitle: "Synthèse vocale",
	voiceHint: "Trois interrupteurs et une voix : l'interrupteur principal commande la lecture automatique, les deux sous-interrupteurs commandent chacun un type de message proactif. Tout est désactivé par défaut et écrit dans la configuration utilisateur lors de l'enregistrement (jamais immédiatement).",
	voiceEnabled: "Lecture vocale",
	voiceEnabledHint: "Interrupteur principal de la lecture automatique. Désactivé, les murmures périodiques et les rappels de tâches restent muets (les deux sous-interrupteurs ci-dessous n'ont alors aucun effet). Les murmures manuels, les réponses de discussion et le bouton haut-parleur du panneau de discussion ne sont pas concernés — vous les avez demandés, la surface qui les déclenche les lit directement. Cela ne décide que du son émis : bulles, mémoire de discussion et notifications système restent intactes ; un échec de synthèse est seulement journalisé et n'interrompt jamais la conversation.",
	voiceWhisperEnabled: "Lire les murmures",
	voiceWhisperEnabledHint: "Lit le murmure généré périodiquement (un murmure manuel par clic droit n'est pas concerné). Soumis à l'interrupteur principal ci-dessus. Désactivé par défaut — les murmures sont une narration de fond et ne doivent pas faire de bruit sans qu'on le demande.",
	voiceTodoEnabled: "Lire les rappels de tâches",
	voiceTodoEnabledHint: "Lit un rappel de tâche à son échéance (la bulle s'affiche toujours ; cet interrupteur décide seulement s'il est lu). Soumis à l'interrupteur principal ci-dessus. Désactivé par défaut.",
	voiceNameLabel: "Voix",
	voiceVolumeLabel: "Volume",
	voiceVolumeHint: "Volume de lecture en décimal 0–1 : 1 correspond au volume maximal (100 %), 0 coupe le son. Seule l’intensité change et l’audio n’est pas resynthétisé, donc le régler ne coûte rien de plus. Indépendant de l’interrupteur général ci-dessus : il est sans effet quand celui-ci est désactivé.",
	physicsTitle: "Physique (ressenti du glisser-lancer)",
	physicsHint: "Valeurs par défaut globales, partagées par tous les compagnons (un pet pack peut les remplacer dans son propre fichier de type) ; écrites dans la configuration utilisateur lors de l'enregistrement (jamais immédiatement). Appliquées immédiatement dans le navigateur ; sur le bureau, après que l'enregistrement a rechargé les fenêtres des compagnons.",
	mobileTitle: "Effets mobiles",
	mobileHint: "Ces réglages n'ont de sens que dans un navigateur mobile : la vibration exige un moteur, les deux interrupteurs de mouvement exigent des capteurs d'inclinaison / d'accélération, et ces capteurs ne fonctionnent qu'en HTTPS ou sur localhost.",
	"physics.gravity": "Gravité",
	"physics.gravityHint": "px/s², plus la valeur est élevée, plus la chute est rapide ; 0 = apesanteur (trajectoire rectiligne uniforme)",
	"physics.restitution": "Rebond",
	"physics.restitutionHint": "0 à 1, proportion de vitesse conservée lors du rebond contre un mur ou le sol (1 = parfaitement élastique, 0 = arrêt net)",
	"physics.groundFriction": "Frottement de contact",
	"physics.groundFrictionHint": "par seconde, atténuation de la vitesse le long de toute surface touchée (mur, sol, plafond) ; 0 = verglas partout",
	"physics.throwPower": "Force de lancer",
	"physics.throwPowerHint": "> 0, multiplicateur global du suivi ressort et de la vitesse de lancer (1 = valeur par défaut ; plus haut = suivi plus ferme et lancers plus violents)",
	physicsCeilingBounce: "Rebond au plafond",
	physicsCeilingBounceHint: "Désactivé, un lancer peut sortir par le haut de l'écran (la gravité le ramène)",
	physicsPetCollision: "Collisions entre compagnons",
	physicsPetCollisionHint: "Un compagnon en vol rebondit sur les autres en conservant la quantité de mouvement (masse ∝ taille²)",
	physicsHaptic: "Vibration aux collisions",
	physicsHapticHint: "Une vibration par impact (murs, sol, plafond, autres compagnons). Fonctionne dans Chrome/Edge ; pas sur iOS ni dans les coques WebView comme Via. Le mode Ne pas déranger la bloque.",
	physicsTilt: "Gravité par inclinaison",
	physicsTiltHint: "Inclinez le téléphone : la gravité suit (valeur = celle ci-dessus) ; avec une gravité à 0, l’inclinaison n’a aucun effet. Nécessite HTTPS/localhost.",
	physicsShake: "Secouer pour lancer",
	physicsShakeHint: "Secouez pour lancer le compagnon dans le sens du geste ; la force suit throwPower. Indépendant de la gravité, donc utilisable à gravité 0. Nécessite HTTPS/localhost.",
	invalidPhysics: "Vérifiez les paramètres physiques : gravité / frottement au sol ≥ 0, rebond entre 0 et 1, force de lancer > 0.",
	fontTitle: "Apparence et police",
	fontHint: "La famille s'applique partout où la police bonbon est utilisée : bulle du compagnon, infobulle, fenêtre de discussion, fenêtre de score ; la taille ne concerne que la bulle et l'infobulle (les fenêtres de discussion et de score gardent la leur). Valeurs globales par défaut, partagées par tous les compagnons (un pet pack peut les remplacer dans son propre fichier de type) ; écrites dans la configuration utilisateur lors de l'enregistrement — immédiat dans le navigateur, et sur le bureau après rechargement des fenêtres par l'enregistrement.",
	fontFamilyLabel: "Police",
	fontFamilyHint: "« Bonbon (intégrée) » est fournie avec le plugin ; les autres sont des polices système. Si une police manque sur la machine, la pile passe à la suivante (jamais de vide ni d'erreur).",
	fontSizeLabel: "Taille de police (px)",
	fontSizeHint: "Taille du texte des bulles ; l'infobulle et les petites lignes de la bulle suivent proportionnellement. Plage 4 à 200.",
	fontFollowToggle: "Mettre la police à l'échelle du compagnon",
	fontFollowToggleHint: "Activé (par défaut) : la police grandit avec le compagnon — à 462 px de largeur, elle correspond exactement à la taille ci-dessus. Désactivé : la taille reste fixe quelle que soit la taille du compagnon.",
	invalidFont: "Vérifiez les réglages de police : la famille doit figurer dans la liste et la taille doit être un nombre entre 4 et 200.",
	"font.candy": "Bonbon (intégrée)",
	"font.yahei": "Microsoft YaHei / PingFang",
	"font.youyuan": "YouYuan",
	"font.kaiti": "KaiTi",
	"font.simsun": "SimSun",
	"font.comic": "Comic Sans MS",
	"font.system": "Police système",
	modelTitle: "Discussion et modèles",
	modelHint: "Quel modèle utilisent les murmures et la discussion, et combien d'historique chaque requête transporte. « Suivre la conversation actuelle » utilise le modèle de votre conversation en cours (par défaut). Valeur globale par défaut : s'applique à tous les compagnons, et un pet pack peut la remplacer dans son propre fichier de type. Les options viennent de la même source que le sélecteur de modèles de DSH, fournies en direct par l'hôte.",
	modelFollow: "Suivre la conversation actuelle",
	modelSearch: "Rechercher un modèle…",
	modelEmpty: "Aucun modèle correspondant.",
	modelNoModels: "Aucun modèle disponible.",
	modelLoading: "Actualisation de la liste des modèles…",
	modelTriggerAria: "Choisir un modèle, actuellement {model}",
	modelUnknown: " (configuration actuelle, absent de la liste)",
	modelNone: "Aucun modèle disponible pour ce fournisseur",
	whisperModelLabel: "Modèle des murmures",
	chatModelLabel: "Modèle de discussion",
	modelFieldHint: "« Suivre la conversation actuelle » utilise le modèle de la conversation ; si un modèle choisi échoue, le plugin revient au modèle de la conversation et réessaie une fois.",
	invalidModel: "Vérifiez les réglages de modèle : choisissez à la fois un fournisseur et un modèle, ou laissez les deux vides (suivre la conversation actuelle).",
	modelCatalogFailed: "Échec du chargement de la liste des modèles (rafraîchissez la page pour réessayer) ; vos valeurs actuelles sont conservées telles quelles.",
	chatMemory: "Tours d'historique de discussion",
	chatMemoryHint: "Nombre de tours récents transportés par chaque requête de discussion (1 tour = 1 question + 1 réponse ; 0 = aucun historique, chaque message repart de zéro). La mémoire elle-même conserve tout — cette valeur décide seulement de ce qui entre dans le contexte : plus elle est élevée, plus le compagnon se souvient, et plus cela coûte de tokens. Valeur globale par défaut, partagée par tous les compagnons (un pet pack peut la remplacer dans son propre fichier de type).",
	invalidChatMemory: "Vérifiez les tours d'historique : il faut un nombre ≥ 0.",
	chatImageLimit: "Limite d'images de discussion",
	chatImageLimitHint: "Nombre maximal de mèmes proposés au modèle pendant la discussion (« N premiers » = les N premières entrées de la configuration ; déplacez en tête celles que vous voulez voir partir en priorité). Toute la liste est jointe à chaque message et les tokens croissent linéairement avec le nombre, donc une longue liste coûte cher ; la limiter aux N premières restreint le choix du modèle à celles-là. 0 = aucune limite (tout envoyer). Valeur intégrée par défaut : 10. Valeur globale par défaut, partagée par tous les compagnons (un pet pack peut la remplacer dans son propre fichier de type). Discussion uniquement — un murmure ne porte que le mème tiré.",
	invalidChatImageLimit: "Vérifiez la limite d'images de discussion : il faut un nombre ≥ 0 (0 = aucune limite).",
	notifyTest: "Tester la notification",
	notifyTestOk: "Notification de test envoyée — regardez en bas à droite de votre bureau.",
	notifyDenyUnsupported: "Les notifications système ne sont pas prises en charge dans cet environnement (pas d'API Notification).",
	notifyDenyBlocked: "L'autorisation de notification est bloquée par le navigateur.",
	notifyDenyRejected: "Vous avez choisi « Bloquer » dans la demande d'autorisation.",
	notifyDenyError: "Échec de la demande d'autorisation",
	notifyGuide: "Marche à suivre : cliquez sur l'icône 🔒/ⓘ à gauche de la barre d'adresse → « Paramètres du site » → « Notifications » → choisissez « Autoriser », puis rafraîchissez la page et réessayez.",
	storageTitle: "Désinstallation et stockage",
	storageHint: "Tous les emplacements où ce plugin écrit sur la machine. Supprimer les caches est sans risque (ils sont retéléchargés / reconstruits) ; supprimer les « données utilisateur du plugin » fait perdre la configuration et la mémoire de discussion.",
	"storage.userData": "Données utilisateur du plugin : configuration personnalisée main-config.jsonc, mémoire de discussion memory.json, animations personnalisées main-animation/, compagnons fichiers pet/",
	"storage.electron": "Runtime Electron du compagnon de bureau (volumineux ; retéléchargé automatiquement au prochain démarrage du mode bureau)",
	"storage.desktopCache": "Cache des fenêtres de compagnons et cache d'échelle de l'écran principal (suppression sans risque, reconstruit automatiquement)",
	"storage.electronCache": "Cache de téléchargement de l'installateur Electron (suppression sans risque, retéléchargé si besoin)",
	"storage.package": "Le plugin lui-même (géré par DSH — retirez-le avec la commande ci-dessous plutôt que de le supprimer à la main)",
	storageMissing: " (pas encore créé)",
	uninstallTitle: "Comment désinstaller",
	uninstallStep1: "1. Quittez d'abord DSH (le compagnon de bureau s'arrête avec lui) ; ne supprimez pas ces fichiers pendant que le compagnon tourne.",
	uninstallStep2: "2. Retirez le plugin lui-même (dans un terminal ; il est aussi retiré de la couche bundle du profil) :",
	uninstallStep3: "3. Supprimez les emplacements ci-dessus selon vos besoins : les caches sont sans risque ; supprimer les « données utilisateur du plugin » fait perdre la configuration et la mémoire de discussion (sauvegardez main-config.jsonc si vous voulez le garder).",
	uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

//#endregion
//#region src/client/settings/locales/ja.ts
const ja = {
	nav: "デスクトップペット設定",
	intro: "複数のペットを管理できます。ペットごとにサイズと位置を個別に設定できます（保存するとすぐに反映されます）。",
	petCardTitle: "ペットの設定",
	petCardHint: "ペットごとに個別設定します：名前 / サイズ / 表示位置 / 位置 / オフセット / 4つの機能スイッチ。設定後、最下部の「保存」をクリックするとすぐに反映されます。",
	globalTitle: "グローバルスイッチ",
	globalHint: "すべてのペットに共通です（pet pack は自身の種類ファイルで個別に上書きできます）。これらのスイッチはローカル状態のみを変更し、「保存」時にまとめてユーザー設定へ書き込みます（即時書き込みはしません）。システム通知の設定は保存後すぐに再読み込みされ、ページの更新は不要です。",
	cornerHint: "ペットが画面のどの隅に貼り付くかを指定します（デスクトップでは各ディスプレイのワークエリア基準）。",
	marginXHint: "選択した隅からの水平距離（px）。任意の数値が使えます。",
	marginYHint: "選択した隅からの垂直距離（px）。任意の数値が使えます。",
	"cmd.chat": "チャット",
	"cmd.pet": "ペット",
	"cmd.balance": "残高",
	"shortcut.open": "ペット会話を開く",
	"shortcut.chat": "会話ウィンドウを開く",
	"shortcut.hear": "音声入力",
	"shortcut.capture": "スクリーンショットを会話へ",
	shortcutCardTitle: "ショートカット",
	shortcutCardHint: "開くと 2 グループに分かれます：ペットのショートカットとグローバルショートカット。",
	shortcutRowChat: "会話を開く",
	shortcutRowHold: "押して話す",
	shortcutRowHear: "音声入力",
	shortcutRowCapture: "スクリーンショット",
	shortcutRowPaste: "画像を貼り付け",
	shortcutRowTodo: "ToDo",
	shortcutRowSleep: "寝る / 起きる",
	shortcutRowDisplay: "表示位置",
	shortcutRowSidebar: "サイドバーの会話を開く",
	shortcutGroupPet: "ペットのショートカット",
	shortcutGroupPetHint: "Web はポインタをペットに合わせるだけ。デスクトップペットのウィンドウは、先にペットをクリックしてキーボードフォーカスを移してください。",
	shortcutGroupGlobal: "グローバルショートカット",
	shortcutGroupGlobalHint: "Web とデスクトップ版のウィンドウでは DSH が振り分けます。設定 → 一般 → ショートカットで変更できます。",
	petsLabel: "ペット一覧",
	add: "ペットを追加",
	remove: "削除",
	confirmRemove: "ペット「{id}」を削除しますか？",
	confirmTitle: "操作の確認",
	cancel: "キャンセル",
	ok: "了解",
	atLeastOne: "ペットは少なくとも1匹必要です。",
	emptyPets: "ペットがありません。「ペットを追加」をクリックして作成してください。",
	sizeLabel: "サイズ（幅 px）",
	sizeHint: "高さは自動 = 幅 × 9/16。",
	sizePercentLabel: "画面幅の上限（%）",
	sizePercentHint: "ペットが画面幅のどれだけを占めるかの上限です。100 = 画面幅を超えない（広いウィンドウでは px と完全に同じ）；30–40 にすると PC はそのままにスマホで明確に小さくなります。読み込み時に一度だけ計算されるので、ウィンドウサイズを変えたら再読み込みしてください。",
	nameLabel: "名前",
	nameHint: "表示名：ペットにマウスを重ねると表示され、AI のペルソナにも追加されます（あなたの名前は X）。重複も可能です。空欄の場合はペット id が使われます。",
	personaLabel: "ペルソナ（任意）",
	personaHint: "このペットだけに適用されます。空欄 = 所属するエントリのペルソナに従います（入力欄のグレーの文字がその内容です）。実際にモデルへ送る system = このテキスト + 自動追加される「あなたの名前は“<名前>”」+ 現在時刻のコンテキスト。ここに名前や日付を再度書かないでください。",
	personaCount: "{n} 文字",
	balanceEnabled: "残高機能",
	balanceEnabledHint: "有効にすると、このペットが残高アニメーションを再生し、残高バブルを表示します。",
	whisperEnabled: "ひとりごと",
	whisperEnabledHint: "有効にすると、このペットが定期的に AI で一言を生成し、ひとりごとアニメーションを再生します（ペルソナは下の「ペルソナ」欄。空欄ならエントリに従います）。",
	workStatusEnabled: "作業状態の連動",
	workStatusEnabledHint: "有効にすると、このペットが DSH の作業状態に追従します：思考中 / 作業中 / 確認待ち / 完了 / エラー時に、対応するアニメーションへ切り替えてバブルを表示します（アニメーションプールは設定のトップレベル。監視のみでモデルは呼び出しません）。",
	fixedEnabled: "ペットを固定",
	fixedEnabledHint: "有効にすると、ランダムアニメーションでペットが方向転換したり歩き去ったりしなくなり、その場の待機とランダムな小さな動作だけを再生します。右クリックメニューからの再生、API トリガー、残高 / ひとりごと / 作業状態のアニメーションには影響しません。",
	displayLabel: "表示位置",
	displayHint: "web=ブラウザのみ / desktop=デスクトップのみ / both=両方 / none=どちらも非表示",
	"display.web": "ブラウザのみ",
	"display.desktop": "デスクトップのみ",
	"display.both": "両方に表示",
	"display.none": "どちらも非表示",
	cornerLabel: "位置",
	"corner.top-left": "左上",
	"corner.top-right": "右上",
	"corner.bottom-left": "左下",
	"corner.bottom-right": "右下",
	marginX: "水平オフセット",
	marginY: "垂直オフセット",
	save: "保存",
	saveHotkey: "Ctrl+S / Cmd+S",
	sync: "同期",
	confirmSync: "同期しますか？プロジェクト内蔵のデフォルト設定（全フィールド + コメント）でユーザー設定を上書きするため、現在のカスタマイズ内容は失われます。",
	corruptTitle: "ユーザー設定が破損しているため保存されませんでした",
	corruptConfirm: "強制保存",
	corruptBody: "ユーザー設定ファイルを解析できません（内容が破損しており、正しい JSON/JSONC ではありません）：{path}。保存を続けるとホワイトリストに従ってこのファイルを再構築します——現在このファイルにある内容（animations / physics / memes などのカスタムフィールド）はすべて失われます。キャンセル = ファイルを変更しない（設定を正しい形式に戻してから保存）；確認 = 強制保存（ファイル内の既存内容を破棄）。",
	syncHint: "「同期」はプロジェクト内蔵のデフォルト設定（コメントとすべての高度なフィールドを含む）をユーザー設定ファイルへ書き込み、現在のカスタマイズ内容を上書きします。その後はこのファイルを直接編集できます。注意点が2つあります：① ファイルが一度生成されると明示的な上書きレイヤーになるため、プラグイン更新後の内蔵デフォルトの変更は自動では反映されません（再度同期するか、ファイルを削除するまで）。② このページで「保存」をクリックすると、ホワイトリストに従ってファイルが書き換えられます（フィールド値は保持されますが、コメントは削除されます）。",
	configMeta: "詳細設定（ファイル）",
	configMetaHint: "ユーザー設定はペット一覧 / アニメーションプール / 再生ウェイトを上書きできます。変更後は更新または再起動で反映されます：ブラウザではページを更新、デスクトップではペットを右クリック →「設定を再読み込み」（すべてのデスクトップペットウィンドウを再読み込み）。デフォルト設定が完全なリファレンスです。",
	defaultConfig: "デフォルト設定（読み取り専用、完全なリファレンス）",
	userConfig: "ユーザー設定（カスタム上書き）",
	todosFile: "ToDo データ（リストの内容、期限、完了状態。削除すると ToDo がすべて消えます）",
	animationDir: "アニメーション素材ディレクトリ（アニメーションをカスタマイズ / 追加できます）",
	memesDir: "ミーム画像ディレクトリ（画像をカスタマイズ / 追加できます）",
	logFile: "ログファイル（トラブルシューティング用。消去しても問題ありません）",
	logFileNote: "デスクトップ版にはコンソールがないため、プラグインの実行ログ（起動、デスクトップペットのクラッシュ / 再起動、エラーと警告）はすべてこの1つのファイルに書き込まれます。問題を報告する際はこのファイルを添付してください。1ファイルあたり最大 1 MB で、いっぱいになると最新の 512 KB だけが残ります。",
	saved: "保存しました。ペットにすぐ反映されました。",
	loadError: "設定の読み込みに失敗しました",
	saveError: "設定の保存に失敗しました。サーバー接続、設定ディレクトリの書き込み権限、サーバーログを確認してください。",
	saveInvalid: "設定の保存に失敗しました：設定内容が無効です。確認してから再試行してください。",
	syncError: "設定の同期に失敗しました。サーバー接続と設定ディレクトリの書き込み権限を確認してください。",
	loading: "設定を読み込み中…",
	retry: "再試行",
	invalid: "入力を確認してください：サイズは正の数、余白は任意の数値です。",
	busy: "保存中…",
	extraPetsHint: "ほかに {n} 種類が pet/ ディレクトリのファイル（<名>-config.json + <名>-animation/）から読み込まれます。上の「種類」バーで切り替えて変更できます。保存は各キャラクターパックの設定に書き戻され、main-config.jsonc には混ざりません。",
	kindLabel: "種類",
	kindMain: "内蔵",
	lastOfKind: "「{entry}」はこの1匹だけです。削除するとこの種類自体がなくなります。完全に削除するには、そのキャラクターパックのファイルを直接削除してください。",
	savePartial: "メインペットは保存されましたが、{names} を書き戻せませんでした：そのキャラクターパックの設定が正しいか、ディレクトリが書き込み可能かを確認してください。",
	notifyToggle: "システム通知",
	notifyToggleHint: "会話の完了 / 生成失敗 / 権限リクエスト / ユーザーへの確認を、ウィンドウが非アクティブのときに OS レベルの通知（デスクトップ右下）で表示します。",
	clickSoundToggle: "クリック音",
	clickSoundToggleHint: "ペットをクリックすると内蔵の効果音（assets/sound/click-duck.wav、音量 0.5）が一度鳴ります。100ms 以内の連続クリックは1回だけ鳴り、複数起動しても重なりません。オフにすると完全に無音になります。「保存」と一緒にユーザー設定へ書き込まれます。",
	whisperImageToggle: "ひとりごとの画像",
	whisperImageToggleHint: "ひとりごとのとき、ミーム画像プールからランダムに1枚を選び、その一言と一緒に表示します（画像のマッピングは設定ファイルのトップレベル memes）。トークン：ひとりごとは元々毎回モデルを呼ぶので、選んだ画像の名前 + 説明（約100文字 / ≈60トークン）を同じリクエストに加えるだけで、増分はごくわずかです。",
	chatImageToggle: "チャットの画像",
	chatImageToggleHint: "チャット時、AI が現在の文脈に合う画像をミーム画像プールから1枚選びます（選ばないこともできます。画像のマッピングは設定ファイルのトップレベル memes）。トークン：メッセージごとに一覧全体をリクエストに添付するため、現在約 1.1k 文字（≈650トークン、ひとりごと画像の約11倍）で、画像の数に比例して増えます。オフにすると1文字も添付しません。",
	chatAnimationToggle: "チャットのアクション",
	chatAnimationToggleHint: "オンにすると、チャット時に演じられるアニメーション一覧（animations.categories の全アクション）をモデルに渡します。この一言が実際にその動作を演じているとモデルが判断したときだけ、ペットがその場で演じます。合うものがなければ文字だけの返答になります。トークン：メッセージごとに一覧全体を添付します。オフなら 1 つも添付しません。グローバル既定で全ペット共通（pet pack は自分の設定ファイルで上書き可）。",
	confineToggle: "現在の画面に固定",
	confineToggleHint: "マルチディスプレイの場合：オンにすると、ペットは現在いる画面の中だけで動きます。投げたペットは離したときの画面内でだけ跳ね（画面の境目は壁として扱われ、隣の画面へは飛びません）、自動での徘徊も現在いる画面内だけを歩きます（境目を越える一歩はその場でキャンセル）。オフにすると従来どおり画面をまたいで飛んだり歩いたりします。デスクトップモードのみに影響します。ブラウザのオーバーレイは元々ビューポート内だけで動きます。",
	trayToggle: "システムトレイ",
	trayToggleHint: "デスクトップモード起動後、通知領域（macOS ではメニューバー）にアイコンを常駐させ、設定に含まれるすべてのペットを一覧表示します。チェックを入れると、そのペットの表示位置を切り替えられます——現在デスクトップに表示されておらず、右クリックできるウィンドウがないペットも含みます。オフにすると、ペットをデスクトップに戻すにはブラウザで設定ページを開くか、Web 側のペットを右クリックするしかありません。Windows では元々「隠れたアイコン」に折りたたまれます。デスクトップモードのみに影響します。",
	voiceTitle: "音声読み上げ",
	voiceHint: "ペットが音を出すための3つのスイッチと声質：マスタースイッチが自動読み上げを制御し、2つのサブスイッチがそれぞれ異なる種類の自発メッセージを制御します。デフォルトはすべてオフで、「保存」時にユーザー設定へ書き込まれます（即時書き込みはしません）。",
	voiceEnabled: "音声読み上げ",
	voiceEnabledHint: "自動読み上げのマスタースイッチです。オフにすると、定期的なひとりごとと ToDo リマインダーは読み上げません（下の2つのサブスイッチは無効になります）。手動のひとりごと、チャットの返信、チャットパネルのスピーカーボタンは制限されません——これらはあなたが明示的に操作したもので、操作した画面側がそのまま読み上げます。「声を出すかどうか」だけに影響します：バブル、会話メモリ、システム通知は変わりません。音声合成に失敗した場合はログに残すだけで、会話を中断しません。",
	voiceWhisperEnabled: "ひとりごとの読み上げ",
	voiceWhisperEnabledHint: "定期的に生成されるひとりごとを読み上げます（右クリックの手動ひとりごとはこの項目の影響を受けません）。上のマスタースイッチに従います：マスタースイッチがオフのときはこの項目は無効です。デフォルトはオフ——ひとりごとは背景ナレーションなので、デフォルトで声を出すべきではありません。",
	voiceTodoEnabled: "ToDo の読み上げ",
	voiceTodoEnabledHint: "期限が来た ToDo リマインダーを読み上げます（同じ文言でバブルも表示され、この項目は読み上げるかどうかだけを決めます）。上のマスタースイッチに従います。デフォルトはオフです。",
	voiceNameLabel: "声質",
	voiceVolumeLabel: "音量",
	voiceVolumeHint: "読み上げの音量（0〜1 の小数）。1 が最大音量（100%）、0 は消音です。変わるのは再生の大きさだけで、音声の再合成は行いません。上の総スイッチとは別の設定で、総スイッチが切のときは効果がありません。",
	physicsTitle: "物理（ドラッグ＆投げの感触）",
	physicsHint: "グローバルデフォルトで、すべてのペットに共通です（pet pack は自身の種類ファイルで個別に上書きできます）。「保存」時にユーザー設定へ書き込まれます（即時書き込みはしません）。ブラウザでは保存後すぐに反映され、デスクトップでは保存でペットウィンドウが再読み込みされてから反映されます。",
	mobileTitle: "モバイル向け効果",
	mobileHint: "スマホのブラウザでのみ意味があります。振動にはモーター、2 つの体感スイッチには傾き／加速度センサーが必要で、センサーは HTTPS または localhost でのみ使えます。",
	"physics.gravity": "重力",
	"physics.gravityHint": "px/s²。大きいほど速く落下します。0 = 無重力（投げると等速直線運動で飛び続けます）",
	"physics.restitution": "弾性",
	"physics.restitutionHint": "0～1。壁や床に当たったときに残る速度の割合（1 = 完全弾性、0 = 当たった瞬間に停止）",
	"physics.groundFriction": "接触摩擦",
	"physics.groundFrictionHint": "/s。壁・床・天井に当たった後の接線方向の速度の減衰率。0 = どの面も氷のよう",
	"physics.throwPower": "投げる力",
	"physics.throwPowerHint": "> 0。バネの追従性と投げ出しの初速の全体倍率（1 = デフォルト。大きいほどよく追従し、勢いよく飛びます）",
	physicsCeilingBounce: "天井での跳ね返り",
	physicsCeilingBounceHint: "オフにすると、投げたペットが画面の上端を越えて飛び出せます（重力が引き戻します）",
	physicsPetCollision: "ペット同士の衝突",
	physicsPetCollisionHint: "飛行中のペットが他のペットに当たると、運動量保存に従って弾き返されます（質量 ∝ サイズ²）",
	physicsHaptic: "衝突時の振動",
	physicsHapticHint: "壁・床・天井・ペット同士の衝突ごとに 1 回振動します。Chrome / Edge で動作。iOS と Via のような WebView ブラウザでは無効。サイレント/集中モードは振動を止めます。",
	physicsTilt: "傾きで重力",
	physicsTiltHint: "端末を傾けると重力がそちらへ向かいます（大きさは上の重力値）。重力が 0 のときは傾けても効果がありません。HTTPS/localhost が必要です。",
	physicsShake: "振って投げる",
	physicsShakeHint: "振った方向へペットを飛ばします。強さは投げる力（throwPower）に比例し、重力とは無関係なので重力 0 でも使えます。HTTPS/localhost が必要です。",
	invalidPhysics: "物理パラメータを確認してください：重力 / 地面摩擦 ≥ 0、弾性 0～1、投げる力 > 0。",
	fontTitle: "外観とフォント",
	fontHint: "フォントの種類は、現在キャンディフォントを使用しているすべてのテキストに適用されます：ペットのバブル、ホバーツールチップ、チャットウィンドウ、スコアポップアップ。文字サイズはペットのバブルとホバーツールチップだけに適用されます（チャットウィンドウとスコアポップアップの文字サイズは変わりません）。グローバルデフォルトで、すべてのペットに共通です（pet pack は自身の種類ファイルで個別に上書きできます）。「保存」時にユーザー設定へ書き込まれ、ブラウザでは保存後すぐに反映、デスクトップでは保存でペットウィンドウが再読み込みされてから反映されます。",
	fontFamilyLabel: "フォント",
	fontFamilyHint: "「キャンディフォント（内蔵）」はプラグインに同梱されています。それ以外はシステムフォントで、このマシンにインストールされていない場合はフォントスタックの次のものへ自動的にフォールバックします（空白になったりエラーになったりはしません）。",
	fontSizeLabel: "文字サイズ（px）",
	fontSizeHint: "バブル本文の文字サイズ。ツールチップとバブル内の小さい文字は既存の比率で算出されます。範囲は 4～200。",
	fontFollowToggle: "文字サイズをペットの大きさに合わせて拡大縮小",
	fontFollowToggleHint: "オン（デフォルト）：ペットを大きくすると文字サイズも比例して大きくなり、幅 462 のときに上の設定値と一致します。オフ：文字サイズは一定で、ペットの大きさに左右されません。",
	invalidFont: "フォント設定を確認してください：フォントはドロップダウンリスト内、文字サイズは 4～200 の数値である必要があります。",
	"font.candy": "キャンディフォント（内蔵）",
	"font.yahei": "Microsoft YaHei / PingFang",
	"font.youyuan": "YouYuan",
	"font.kaiti": "KaiTi",
	"font.simsun": "SimSun",
	"font.comic": "Comic Sans MS",
	"font.system": "システムデフォルト",
	modelTitle: "会話とモデル",
	modelHint: "ひとりごととチャットがそれぞれどのモデルを使うか、またチャットが毎回何ラウンドの履歴をコンテキストに含めるか。「現在の会話に従う」= 現在の会話で使っているモデルを使用（デフォルト）。グローバルデフォルト：すべてのペットに適用され、pet pack は自身の種類ファイルで個別に上書きできます。選択肢は DSH のモデルピッカーと同じソースからホストがリアルタイムに提供します。",
	modelFollow: "現在の会話に従う",
	modelSearch: "モデルを検索…",
	modelEmpty: "一致するモデルがありません。",
	modelNoModels: "利用できるモデルがありません。",
	modelLoading: "モデル一覧を更新中…",
	modelTriggerAria: "モデルを選択（現在 {model}）",
	modelUnknown: " （現在の設定、一覧にありません）",
	modelNone: "このプロバイダーに利用できるモデルはありません",
	whisperModelLabel: "ひとりごとモデル",
	chatModelLabel: "チャットモデル",
	modelFieldHint: "「現在の会話に従う」= 現在の会話のモデルを使用。指定しても呼び出しに失敗した場合は、現在の会話のモデルへ自動的にフォールバックして1回再試行します。",
	invalidModel: "モデル設定を確認してください：プロバイダーとモデルは両方選択するか、両方空欄（現在の会話に従う）にしてください。",
	modelCatalogFailed: "モデル一覧の読み込みに失敗しました（ページを更新すると再試行できます）。現在の設定値はそのまま保持されます。",
	chatMemory: "会話履歴のラウンド数",
	chatMemoryHint: "各チャットリクエストに含める直近の履歴ラウンド数（1ラウンド = 1問1答。0 = 履歴なしで、毎回まったく新しい会話）。会話メモリ自体はすべて保存され、削除されません。この値はコンテキストに何ラウンド分を含めるかだけを決めます——大きいほどよく覚えていますが、トークンも多く消費します。グローバルデフォルトで、すべてのペットに共通です（pet pack は自身の種類ファイルで個別に上書きできます）。",
	invalidChatMemory: "会話履歴のラウンド数を確認してください：0 以上の数値である必要があります。",
	chatImageLimit: "チャット画像の上限枚数",
	chatImageLimitHint: "チャット時にモデルへ送るミーム画像一覧の最大枚数（「先頭 N 枚」= 設定の先頭に書いた N 件。優先して送りたい画像は順番を前にしてください）。一覧全体はメッセージごとに添付され、トークンは枚数に比例して増えるため、多いとそのままコストになります。先頭 N 枚に制限すると、モデルはその中からだけ選びます。0 = 制限なし（すべて送信）。内蔵デフォルトは 10。グローバルデフォルトで、すべてのペットに共通です（pet pack は自身の種類ファイルで上書きできます）。影響するのはチャットの画像選択だけです：ひとりごとは選んだ1枚だけを含めます。",
	invalidChatImageLimit: "チャット画像の上限枚数を確認してください：0 以上の数値である必要があります（0 = 制限なし）。",
	notifyTest: "テスト通知",
	notifyTestOk: "テスト通知を送信しました。デスクトップの右下を確認してください。",
	notifyDenyUnsupported: "この環境ではシステム通知がサポートされていません（ブラウザに Notification API がありません）。",
	notifyDenyBlocked: "通知権限がブラウザによって「ブロック」に設定されています。",
	notifyDenyRejected: "権限確認のダイアログで「ブロック」を選択しました。",
	notifyDenyError: "権限の要求中にエラーが発生しました",
	notifyGuide: "ガイド：アドレスバー左側の 🔒/ⓘ →「サイトの設定」→「通知」→「許可」に変更し、ページを更新してから再試行してください。",
	storageTitle: "アンインストールとストレージ",
	storageHint: "プラグインがこの PC 上に作成されるすべての場所です。キャッシュを削除しても使用に影響はありません（自動的に再ダウンロード / 再構築されます）。「プラグインのユーザーデータ」を削除すると、設定と会話メモリが失われます。",
	"storage.userData": "プラグインのユーザーデータ：カスタム設定 main-config.jsonc、会話メモリ memory.json、カスタムアニメーション素材 main-animation/、ファイル型ペット pet/",
	"storage.electron": "デスクトップペットが使う Electron ランタイム（サイズが大きい。削除すると次回デスクトップモード起動時に自動で再ダウンロードされます）",
	"storage.desktopCache": "デスクトップペットウィンドウのキャッシュとメインディスプレイのスケールキャッシュ（削除しても問題ありません。自動で再構築されます）",
	"storage.electronCache": "Electron インストーラーのダウンロードキャッシュ（削除しても問題ありません。必要時に再ダウンロードされます）",
	"storage.package": "プラグイン本体（DSH が管理します。手動で削除せず、下のアンインストールコマンドで削除してください）",
	storageMissing: " （未作成）",
	uninstallTitle: "アンインストール方法",
	uninstallStep1: "1. まず DSH を終了します（デスクトップペットも一緒に終了します）。ペットの実行中に上記のファイルを削除しないでください。",
	uninstallStep2: "2. プラグイン本体を削除します（ターミナルで実行します。profile の bundle レイヤーからも同時に削除されます）：",
	uninstallStep3: "3. 上記の場所を必要に応じて削除します：キャッシュは削除しても影響ありません。「プラグインのユーザーデータ」を削除すると設定と会話メモリが失われます（残したい場合は中の main-config.jsonc を先にバックアップしてください）。",
	uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

//#endregion
//#region src/client/settings/locales/pt.ts
const pt = {
	nav: "Configuração do pet",
	intro: "Gerencie vários pets: cada um tem tamanho e posição próprios (aplicado na hora após salvar).",
	petCardTitle: "Pet",
	petCardHint: "Ajustes por pet: nome / tamanho / exibição / posição / deslocamentos / os quatro interruptores. Clique em \"Salvar\" no fim para aplicar na hora.",
	globalTitle: "Interruptores globais",
	globalHint: "Compartilhados por todos os pets (um pet pack pode sobrescrevê-los no arquivo do próprio tipo). Estes interruptores só mudam o estado local e são gravados na configuração do usuário ao \"Salvar\" (nunca na hora); as notificações do sistema são relidas logo após salvar, sem recarregar a página.",
	cornerHint: "Em qual canto da tela o pet fica (no desktop, conforme a área de trabalho de cada monitor).",
	marginXHint: "Distância horizontal até o canto escolhido (px); qualquer número.",
	marginYHint: "Distância vertical até o canto escolhido (px); qualquer número.",
	"cmd.chat": "Conversa",
	"cmd.pet": "Pet",
	"cmd.balance": "Saldo",
	"shortcut.open": "Abrir o chat do pet",
	"shortcut.chat": "Abrir a janela de chat",
	"shortcut.hear": "Entrada de voz",
	"shortcut.capture": "Captura de tela para o chat",
	shortcutCardTitle: "Atalhos",
	shortcutCardHint: "Ao expandir há dois grupos: atalhos do pet e atalhos globais.",
	shortcutRowChat: "Abrir chat",
	shortcutRowHold: "Segurar para falar",
	shortcutRowHear: "Entrada de voz",
	shortcutRowCapture: "Captura de tela",
	shortcutRowPaste: "Colar imagem",
	shortcutRowTodo: "Tarefas",
	shortcutRowSleep: "Dormir / acordar",
	shortcutRowDisplay: "Posição de exibição",
	shortcutRowSidebar: "Abrir chat lateral",
	shortcutGroupPet: "Atalhos do pet",
	shortcutGroupPetHint: "Na web basta passar o ponteiro sobre o pet. Na janela do desktop, clique no pet primeiro para ele receber o foco do teclado.",
	shortcutGroupGlobal: "Atalhos globais",
	shortcutGroupGlobalHint: "São distribuídos pelo DSH na web e na janela do desktop; mudam em Configurações → Geral → Atalhos.",
	petsLabel: "Pets",
	add: "Adicionar pet",
	remove: "Remover",
	confirmRemove: "Excluir o pet \"{id}\"?",
	confirmTitle: "Confirmar ação",
	cancel: "Cancelar",
	ok: "Entendi",
	atLeastOne: "Mantenha pelo menos um pet.",
	emptyPets: "Nenhum pet ainda — clique em \"Adicionar pet\" para criar.",
	sizeLabel: "Tamanho (largura px)",
	sizeHint: "A altura é automática = largura × 9/16.",
	sizePercentLabel: "Largura máx. da tela (%)",
	sizePercentHint: "Quanto da largura da tela o pet pode ocupar: 100 = nunca mais largo que uma tela (igual ao px em janelas largas); 30–40 deixa bem menor no celular sem mudar o desktop. Calculado uma vez ao carregar; recarregue após redimensionar.",
	nameLabel: "Nome",
	nameHint: "Nome exibido ao passar o mouse e incluído na persona da IA (\"seu nome é X\"). Pode repetir; vazio usa o id do pet.",
	personaLabel: "Persona (opcional)",
	personaHint: "Vale só para este pet. Vazio = segue a persona da entrada — o texto cinza na caixa é exatamente isso. O system enviado ao modelo = este texto + uma linha \"seu nome é <nome>\" anexada automaticamente + o contexto de hora atual, então não repita o nome nem a data aqui.",
	personaCount: "{n} caracteres",
	balanceEnabled: "Saldo",
	balanceEnabledHint: "Quando ativado, este pet toca as animações de saldo e mostra o balão de saldo.",
	whisperEnabled: "Sussurro",
	whisperEnabledHint: "Quando ativado, este pet gera uma frase com IA periodicamente e toca a animação de sussurro (persona = o campo abaixo; vazio segue a entrada).",
	workStatusEnabled: "Status de trabalho",
	workStatusEnabledHint: "Quando ativado, este pet segue o estado de trabalho do DSH: pensando / trabalhando / aguardando confirmação / concluído / erro trocam a animação e mostram balões (o pool fica na configuração de topo; apenas escuta, sem chamar o modelo).",
	fixedEnabled: "Fixar no lugar",
	fixedEnabledHint: "Quando ativado, a cadeia aleatória não gira nem afasta mais este pet — só tocam as ações de espera no lugar. Escolhas pelo menu de contexto, gatilhos da API e animações de saldo / sussurro / status de trabalho não são afetadas.",
	displayLabel: "Exibição",
	displayHint: "web = só no navegador / desktop = só no desktop / both = nos dois / none = em nenhum",
	"display.web": "Só no navegador",
	"display.desktop": "Só no desktop",
	"display.both": "Nos dois",
	"display.none": "Em nenhum",
	cornerLabel: "Posição",
	"corner.top-left": "Canto superior esquerdo",
	"corner.top-right": "Canto superior direito",
	"corner.bottom-left": "Canto inferior esquerdo",
	"corner.bottom-right": "Canto inferior direito",
	marginX: "Deslocamento horizontal",
	marginY: "Deslocamento vertical",
	save: "Salvar",
	saveHotkey: "Ctrl+S / Cmd+S",
	sync: "Sincronizar",
	confirmSync: "Sincronizar? Isso sobrescreve a configuração do usuário com a configuração padrão incluída no projeto (todos os campos + comentários); as personalizações atuais serão perdidas.",
	corruptTitle: "A configuração do usuário está corrompida — não salva",
	corruptConfirm: "Salvar mesmo assim",
	corruptBody: "Não foi possível ler a configuração do usuário (conteúdo corrompido, não é JSON/JSONC válido): {path}. Salvar agora recria o arquivo a partir da lista branca — tudo o que está nele hoje (animações / física / memes etc.) será perdido. Cancelar = não mexe no arquivo (corrija e salve de novo); Confirmar = salva mesmo assim (descarta o conteúdo atual do arquivo).",
	syncHint: "\"Sincronizar\" grava a configuração padrão incluída no projeto (com comentários e todos os campos avançados) no arquivo do usuário, sobrescrevendo suas personalizações; depois disso o arquivo já pode ser editado direto. Dois avisos: (1) uma vez criado, o arquivo é uma camada de sobrescrita explícita — mudanças nos padrões do projeto não passam a valer sozinhas (só sincronizando de novo ou apagando o arquivo); (2) clicar em \"Salvar\" nesta página reescreve o arquivo pela lista branca — os valores são mantidos, os comentários são removidos.",
	configMeta: "Configuração avançada (arquivos)",
	configMetaHint: "A configuração do usuário pode sobrescrever a lista de pets / pools de animação / pesos — recarregue ou reinicie para aplicar: no navegador atualize a página, no desktop clique com o botão direito no pet → \"Recarregar configuração\" (recria todas as janelas de pet do desktop); a configuração padrão é a referência completa.",
	defaultConfig: "Configuração padrão (somente leitura, referência completa)",
	userConfig: "Configuração do usuário (sobrescritas personalizadas)",
	todosFile: "Dados de tarefas (texto, prazo e estado de conclusão; apagar equivale a limpar tudo)",
	animationDir: "Pasta de animações (adicione ou personalize animações aqui)",
	memesDir: "Pasta de memes (adicione ou personalize imagens aqui)",
	logFile: "Arquivo de log (para diagnóstico; pode ser limpo)",
	logFileNote: "O app desktop do DSH não tem console, então todo log de execução do plugin (inicialização, travamentos e reinícios do pet, erros e avisos) vai para este único arquivo — anexe-o ao relatar um problema. Limite de 1 MB por arquivo; ao encher, só os 512 KB mais recentes são mantidos.",
	saved: "Salvo — os pets atualizaram na hora.",
	loadError: "Falha ao carregar a configuração",
	saveError: "Falha ao salvar a configuração. Verifique a conexão com o servidor, a permissão de escrita na pasta de configuração e o log do servidor.",
	saveInvalid: "Falha ao salvar a configuração: conteúdo inválido. Revise os valores e tente de novo.",
	syncError: "Falha ao sincronizar a configuração. Verifique a conexão com o servidor e a permissão de escrita na pasta de configuração.",
	loading: "Carregando configuração…",
	retry: "Tentar de novo",
	invalid: "Revise os valores: o tamanho precisa ser positivo; as margens podem ser qualquer número.",
	busy: "Salvando…",
	extraPetsHint: "Mais {n} tipo(s) vêm de arquivos na pasta pet/ (<nome>-config.json + <nome>-animation/). Troque para eles na linha \"Tipos\" acima; salvar grava no config de cada pacote, nunca no main-config.jsonc.",
	kindLabel: "Tipos",
	kindMain: "Embutido",
	lastOfKind: "\"{entry}\" tem só este pet — excluí-lo remove o tipo inteiro. Para remover de vez, apague os arquivos do pet pack.",
	savePartial: "Os pets principais foram salvos, mas {names} não pôde ser gravado: verifique se o config do pacote é válido e se a pasta permite escrita.",
	notifyToggle: "Notificações do sistema",
	notifyToggleHint: "Avisos do sistema (canto inferior direito do desktop) para fim de conversa, falhas, pedidos de permissão e perguntas — só enquanto esta janela está sem foco.",
	clickSoundToggle: "Som de clique",
	clickSoundToggleHint: "Toca o som de clique embutido (assets/sound/click-duck.wav, volume 0.5) quando o pet é clicado; cliques repetidos em até 100ms tocam uma vez só, então vários pets não empilham som. Desligue para silêncio total. Gravado na configuração do usuário junto com o \"Salvar\".",
	whisperImageToggle: "Imagens no sussurro",
	whisperImageToggleHint: "Anexa um meme aleatório do pool a cada sussurro (o mapeamento de imagens fica no campo de topo memes). Tokens: o sussurro já chama o modelo a cada ciclo, então a imagem só acrescenta o nome + a descrição daquele meme (~100 caracteres / ~60 tokens) ao mesmo pedido — desprezível.",
	chatImageToggle: "Imagens na conversa",
	chatImageToggleHint: "Deixa a IA escolher um meme do pool conforme o contexto atual (opcional; o mapeamento fica no campo de topo memes). Tokens: cada mensagem leva o catálogo inteiro — hoje ~1,1 mil caracteres (~650 tokens, cerca de 11x o caso do sussurro) e cresce com o número de imagens; desligado, não acrescenta nada.",
	chatAnimationToggle: "Ações na conversa",
	chatAnimationToggleHint: "Quando ligado, o pedido de conversa leva a lista de animações que podem ser encenadas (todas as ações de animations.categories): se o modelo considerar que a frase realmente encena uma delas, o pet a executa na hora; caso contrário responde só com texto. Tokens: cada mensagem leva a lista inteira; desligado não acrescenta nada. Valor padrão global para todos os pets (um pet pack pode substituí-lo no próprio arquivo de configuração).",
	confineToggle: "Fixar na tela atual",
	confineToggleHint: "Vários monitores: quando ligado, o pet fica dentro da tela em que está — um pet arremessado quica só na tela onde foi solto (as emendas entre telas viram paredes, ele não voa para a tela vizinha), e o passeio autônomo só anda dentro da tela atual (o passo que cruzaria a emenda é cancelado). Desligado, ele cruza telas normalmente. Só afeta o modo desktop — o overlay do navegador já fica dentro da viewport.",
	trayToggle: "Bandeja do sistema",
	trayToggleHint: "Mostra um ícone na área de notificação (barra de menus no macOS) quando o modo desktop inicia. Ele lista todos os pets da configuração e alterna a exibição de cada um — inclusive os que estão fora do desktop agora e não têm janela para clicar com o botão direito. Sem ele, para trazer um pet de volta ao desktop é preciso abrir o navegador (a página de configuração, ou clicar com o botão direito no pet na web). O Windows já esconde ícones de terceiros na gaveta \"ícones ocultos\". Só afeta o modo desktop.",
	voiceTitle: "Voz",
	voiceHint: "Três interruptores e uma voz: o mestre controla a fala automática; os dois secundários controlam um tipo de mensagem proativa cada. Tudo desligado por padrão; gravado na configuração do usuário ao \"Salvar\" (nunca na hora).",
	voiceEnabled: "Falar respostas",
	voiceEnabledHint: "Interruptor mestre da fala automática. Desligado, sussurros periódicos e lembretes de tarefas ficam mudos (os dois secundários abaixo não têm efeito). Sussurro manual, respostas da conversa e o botão de alto-falante do painel de conversa não são afetados — você pediu, então a origem fala direto. Só decide se sai som: balões, memória da conversa e notificações do sistema não mudam; falha na síntese só gera log e nunca interrompe a conversa.",
	voiceWhisperEnabled: "Falar sussurros",
	voiceWhisperEnabledHint: "Fala o sussurro gerado periodicamente (o sussurro manual pelo botão direito não é afetado). Dependente do interruptor mestre acima. Desligado por padrão — sussurros são narração de fundo e não devem fazer barulho sem pedir.",
	voiceTodoEnabled: "Falar lembretes de tarefas",
	voiceTodoEnabledHint: "Fala o lembrete quando uma tarefa vence (o balão continua aparecendo; isto só decide se fala). Dependente do interruptor mestre acima. Desligado por padrão.",
	voiceNameLabel: "Voz",
	voiceVolumeLabel: "Volume",
	voiceVolumeHint: "Volume de reprodução em decimal 0–1: 1 é o volume máximo (100%) e 0 silencia. Altera apenas a intensidade e não sintetiza o áudio de novo, então ajustá-lo não custa nada extra. É independente do interruptor geral acima: com ele desligado, não tem efeito.",
	physicsTitle: "Física (sensação de arrastar e arremessar)",
	physicsHint: "Padrão global, compartilhado por todos os pets (um pet pack pode sobrescrever no arquivo do próprio tipo); gravado na configuração do usuário ao \"Salvar\" (nunca na hora). No navegador vale na hora; no desktop vale quando o \"Salvar\" recarrega as janelas do pet.",
	mobileTitle: "Efeitos no celular",
	mobileHint: "Só fazem sentido no navegador do celular: a vibração precisa de motor, os dois interruptores de movimento precisam de sensores de inclinação/aceleração, e os sensores exigem HTTPS ou localhost.",
	"physics.gravity": "Gravidade",
	"physics.gravityHint": "px/s² — quanto maior, mais rápido cai; 0 = sem gravidade (voa em linha reta para sempre)",
	"physics.restitution": "Restituição",
	"physics.restitutionHint": "0–1, velocidade mantida ao quicar na parede ou no chão (1 = totalmente elástico, 0 = para na hora)",
	"physics.groundFriction": "Atrito de contato",
	"physics.groundFrictionHint": "por segundo, perda de velocidade ao longo de qualquer superfície (parede, chão, teto); 0 = gelo em todas",
	"physics.throwPower": "Força de arremesso",
	"physics.throwPowerHint": "> 0, multiplicador geral da mola que segue o cursor e da velocidade de saída (1 = padrão; maior = mais colado ao cursor e arremessos mais fortes)",
	physicsCeilingBounce: "Quicar no teto",
	physicsCeilingBounceHint: "Desligado, o arremesso pode sair pelo topo da tela (a gravidade ainda traz o pet de volta)",
	physicsPetCollision: "Colisão entre pets",
	physicsPetCollisionHint: "Um pet em voo quica nos outros com conservação de momento (massa ∝ tamanho²)",
	physicsHaptic: "Vibração ao colidir",
	physicsHapticHint: "Uma vibração por impacto (paredes, chão, teto, outros pets). Funciona no Chrome/Edge; não no iOS nem em navegadores WebView como o Via. O modo Não perturbe bloqueia o vibrador.",
	physicsTilt: "Gravidade por inclinação",
	physicsTiltHint: "Incline o celular e a gravidade acompanha (magnitude = o valor acima); com gravidade em 0 a inclinação não faz nada. Requer HTTPS/localhost.",
	physicsShake: "Sacudir para arremessar",
	physicsShakeHint: "Sacuda para arremessar o pet na direção do gesto; a força acompanha o throwPower. Independe da gravidade, então funciona com gravidade 0. Requer HTTPS/localhost.",
	invalidPhysics: "Revise os valores de física: gravidade / atrito com o chão ≥ 0, restituição 0–1, força de arremesso > 0.",
	fontTitle: "Aparência e fonte",
	fontHint: "A família vale para todo texto que hoje usa a fonte candy: balão do pet, dica ao passar o mouse, janela de conversa, popup de pontuação. O tamanho vale só para o balão do pet e a dica (as janelas de conversa e de pontuação mantêm o próprio tamanho). Padrão global, compartilhado por todos os pets (um pet pack pode sobrescrever no arquivo do próprio tipo); gravado na configuração do usuário ao \"Salvar\" — na hora no navegador, e no desktop quando o \"Salvar\" recarrega as janelas do pet.",
	fontFamilyLabel: "Fonte",
	fontFamilyHint: "\"Candy (embutida)\" vem com o plugin; as demais são fontes do sistema. Se faltar na máquina, cai para a próxima da pilha (nunca fica em branco nem dá erro).",
	fontSizeLabel: "Tamanho da fonte (px)",
	fontSizeHint: "Tamanho do texto do balão; a dica e as linhas menores dentro do balão escalam na proporção. Faixa 4–200.",
	fontFollowToggle: "Escalar a fonte com o tamanho do pet",
	fontFollowToggleHint: "Ligado (padrão): a fonte cresce com o pet — com 462 px de largura fica exatamente no tamanho definido acima. Desligado: o tamanho fica fixo, independente do pet.",
	invalidFont: "Revise as configurações de fonte: a família precisa estar na lista e o tamanho precisa ser um número entre 4 e 200.",
	"font.candy": "Candy (embutida)",
	"font.yahei": "Microsoft YaHei / PingFang",
	"font.youyuan": "YouYuan",
	"font.kaiti": "KaiTi",
	"font.simsun": "SimSun",
	"font.comic": "Comic Sans MS",
	"font.system": "Padrão do sistema",
	modelTitle: "Conversa e modelos",
	modelHint: "Qual modelo o sussurro e a conversa usam, e quanta história cada pedido de conversa carrega. \"Seguir a conversa atual\" usa o modelo da conversa em que você está (padrão). Padrão global: vale para todos os pets, e um pet pack pode sobrescrever no arquivo do próprio tipo. As opções vêm da mesma fonte do seletor de modelos do DSH, servidas pelo host em tempo real.",
	modelFollow: "Seguir a conversa atual",
	modelSearch: "Buscar modelos…",
	modelEmpty: "Nenhum modelo corresponde.",
	modelNoModels: "Nenhum modelo disponível.",
	modelLoading: "Atualizando a lista de modelos…",
	modelTriggerAria: "Escolher modelo, atual {model}",
	modelUnknown: " (configuração atual, fora da lista)",
	modelNone: "Este provedor não tem modelos disponíveis",
	whisperModelLabel: "Modelo do sussurro",
	chatModelLabel: "Modelo da conversa",
	modelFieldHint: "\"Seguir a conversa atual\" usa o modelo da conversa; se um modelo escolhido falhar, o plugin volta ao modelo da conversa e tenta mais uma vez.",
	invalidModel: "Revise as configurações de modelo: escolha provedor e modelo, ou deixe os dois vazios (seguir a conversa atual).",
	modelCatalogFailed: "Falha ao carregar a lista de modelos (atualize a página para tentar de novo); os valores atuais são mantidos como estão.",
	chatMemory: "Rodadas de histórico",
	chatMemoryHint: "Quantas rodadas recentes cada pedido de conversa carrega (1 rodada = 1 pergunta + 1 resposta; 0 = sem histórico, cada mensagem começa do zero). A memória em si guarda tudo — isto só decide quanto entra no contexto: mais memória, mais tokens. Padrão global, compartilhado por todos os pets (um pet pack pode sobrescrever no arquivo do próprio tipo).",
	invalidChatMemory: "Revise as rodadas de histórico: precisa ser um número ≥ 0.",
	chatImageLimit: "Limite de imagens na conversa",
	chatImageLimitHint: "Quantos memes no máximo são listados ao modelo na conversa (\"primeiros N\" = os N primeiros da configuração, então mova para o começo os que quer enviar). A lista inteira vai em cada mensagem e os tokens crescem linearmente com a quantidade, então lista longa é gasto puro; limitar aos N primeiros faz o modelo escolher só entre eles. 0 = sem limite (envia tudo). Padrão embutido 10. Padrão global, compartilhado por todos os pets (um pet pack pode sobrescrever no arquivo do próprio tipo). Só afeta a conversa — o sussurro leva só o meme sorteado.",
	invalidChatImageLimit: "Revise o limite de imagens na conversa: precisa ser um número ≥ 0 (0 = sem limite).",
	notifyTest: "Testar notificação",
	notifyTestOk: "Notificação de teste enviada — veja o canto inferior direito do desktop.",
	notifyDenyUnsupported: "Este ambiente não suporta notificações do sistema (sem API Notification no navegador).",
	notifyDenyBlocked: "A permissão de notificação está marcada como bloqueada pelo navegador.",
	notifyDenyRejected: "Você escolheu \"Bloquear\" na janela de permissão.",
	notifyDenyError: "Erro ao pedir permissão",
	notifyGuide: "Como liberar: clique no 🔒/ⓘ ao lado da barra de endereços → \"Configurações do site\" → \"Notificações\" → mude para \"Permitir\", atualize a página e tente de novo.",
	storageTitle: "Desinstalação e armazenamento",
	storageHint: "Todos os lugares em que o plugin grava arquivos. Apagar caches não atrapalha (são baixados ou recriados sozinhos); apagar \"dados do usuário do plugin\" perde a configuração e a memória da conversa.",
	"storage.userData": "Dados do usuário do plugin: configuração personalizada main-config.jsonc, memória da conversa memory.json, animações personalizadas main-animation/, pets de arquivo pet/",
	"storage.electron": "Runtime Electron usado pelo pet do desktop (grande; é baixado de novo automaticamente na próxima vez que o modo desktop iniciar)",
	"storage.desktopCache": "Cache das janelas do pet e cache de escala do monitor principal (pode apagar; é recriado sozinho)",
	"storage.electronCache": "Cache de download do instalador do Electron (pode apagar; é baixado de novo quando preciso)",
	"storage.package": "O plugin em si (gerenciado pelo DSH — remova com o comando abaixo em vez de apagar na mão)",
	storageMissing: " (ainda não criado)",
	uninstallTitle: "Como desinstalar",
	uninstallStep1: "1. Feche o DSH primeiro (o pet do desktop fecha junto); não apague os arquivos acima com o pet em execução.",
	uninstallStep2: "2. Remova o plugin em si (no terminal; isto também o tira da camada de bundle do profile):",
	uninstallStep3: "3. Apague os locais acima conforme a necessidade: caches não fazem falta; apagar \"dados do usuário do plugin\" perde a configuração e a memória da conversa (faça backup do main-config.jsonc antes, se quiser manter).",
	uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

//#endregion
//#region src/client/settings/locales/ru.ts
const ru = {
	nav: "Настройки питомца",
	intro: "Управляйте несколькими питомцами: у каждого свои размер и позиция (применяются сразу после сохранения).",
	petCardTitle: "Питомец",
	petCardHint: "Настройки каждого питомца: имя / размер / отображение / позиция / отступы / четыре переключателя функций. Нажмите «Сохранить» внизу, чтобы применить сразу.",
	globalTitle: "Глобальные переключатели",
	globalHint: "Общие для всех питомцев (пакет питомца может переопределить их в своём файле вида). Эти переключатели меняют только локальное состояние и записываются в пользовательский конфиг по «Сохранить» (без немедленной записи); системные уведомления перечитываются сразу после сохранения, обновлять страницу не нужно.",
	cornerHint: "К какому углу экрана прикреплён питомец (в настольном режиме — рабочая область соответствующего монитора).",
	marginXHint: "Горизонтальное расстояние от выбранного угла (px); любое число.",
	marginYHint: "Вертикальное расстояние от выбранного угла (px); любое число.",
	"cmd.chat": "Чат",
	"cmd.pet": "Питомец",
	"cmd.balance": "Баланс",
	"shortcut.open": "Открыть чат питомца",
	"shortcut.chat": "Открыть окно чата",
	"shortcut.hear": "Голосовой ввод",
	"shortcut.capture": "Снимок экрана в чат",
	shortcutCardTitle: "Горячие клавиши",
	shortcutCardHint: "В раскрытом виде две группы: клавиши питомца и глобальные клавиши.",
	shortcutRowChat: "Открыть чат",
	shortcutRowHold: "Удерживать для речи",
	shortcutRowHear: "Голосовой ввод",
	shortcutRowCapture: "Снимок экрана",
	shortcutRowPaste: "Вставить изображение",
	shortcutRowTodo: "Задачи",
	shortcutRowSleep: "Спать / проснуться",
	shortcutRowDisplay: "Позиция показа",
	shortcutRowSidebar: "Открыть чат в панели",
	shortcutGroupPet: "Клавиши питомца",
	shortcutGroupPetHint: "В веб-версии достаточно навести курсор на питомца. В окне на рабочем столе сначала щёлкните питомца, чтобы он получил фокус клавиатуры.",
	shortcutGroupGlobal: "Глобальные клавиши",
	shortcutGroupGlobalHint: "Их распределяет DSH в веб-версии и в окне на рабочем столе; меняются в Настройки → Общие → Горячие клавиши.",
	petsLabel: "Питомцы",
	add: "Добавить питомца",
	remove: "Удалить",
	confirmRemove: "Удалить питомца «{id}»?",
	confirmTitle: "Подтверждение действия",
	cancel: "Отмена",
	ok: "Понятно",
	atLeastOne: "Оставьте хотя бы одного питомца.",
	emptyPets: "Питомцев пока нет — нажмите «Добавить питомца», чтобы создать.",
	sizeLabel: "Размер (ширина, px)",
	sizeHint: "Высота рассчитывается автоматически = ширина × 9/16.",
	sizePercentLabel: "Макс. ширина экрана (%)",
	sizePercentHint: "Какую долю ширины экрана может занимать питомец: 100 = не шире одного экрана (на широких окнах полностью совпадает с px); 30–40 заметно уменьшит его на телефоне, не меняя десктоп. Вычисляется один раз при загрузке; после изменения размера окна перезагрузите страницу.",
	nameLabel: "Имя",
	nameHint: "Отображаемое имя: всплывает при наведении и добавляется в образ ИИ («тебя зовут X»). Может повторяться; если пусто — используется id питомца.",
	personaLabel: "Образ (необязательно)",
	personaHint: "Действует только для этого питомца. Пусто = использовать образ записи — серый текст в поле и есть он. Фактический system для модели = этот текст + автоматически добавленная строка «тебя зовут \"<имя>\"» + текущий временной контекст, поэтому не повторяйте здесь имя и дату.",
	personaCount: "{n} симв.",
	balanceEnabled: "Функция баланса",
	balanceEnabledHint: "Если включено, питомец проигрывает анимацию баланса и показывает пузырь с балансом.",
	whisperEnabled: "Шёпот",
	whisperEnabledHint: "Если включено, питомец периодически генерирует фразу через ИИ и проигрывает анимацию шёпота (образ — поле ниже; пусто = образ записи).",
	workStatusEnabled: "Статус работы",
	workStatusEnabledHint: "Если включено, питомец следит за статусом работы DSH: размышление / работа / ожидание подтверждения / готово / ошибка — переключает анимации и показывает пузыри (пул в конфиге верхнего уровня; только прослушивание, без вызовов модели).",
	fixedEnabled: "Закрепить питомца",
	fixedEnabledHint: "Если включено, случайная цепочка больше не поворачивает и не уводит питомца — проигрываются только ожидание на месте и мелкие движения. Выбор по правому клику, запуски через API и анимации баланса / шёпота / статуса работы не затрагиваются.",
	displayLabel: "Отображение",
	displayHint: "web = только браузер / desktop = только рабочий стол / both = везде / none = нигде",
	"display.web": "Только браузер",
	"display.desktop": "Только рабочий стол",
	"display.both": "Везде",
	"display.none": "Нигде",
	cornerLabel: "Позиция",
	"corner.top-left": "Верхний левый",
	"corner.top-right": "Верхний правый",
	"corner.bottom-left": "Нижний левый",
	"corner.bottom-right": "Нижний правый",
	marginX: "Горизонтальный отступ",
	marginY: "Вертикальный отступ",
	save: "Сохранить",
	saveHotkey: "Ctrl+S / Cmd+S",
	sync: "Синхронизировать",
	confirmSync: "Синхронизировать? Пользовательский конфиг будет перезаписан встроенным конфигом по умолчанию (все поля + комментарии); текущие настройки будут потеряны.",
	corruptTitle: "Пользовательский конфиг повреждён — не сохранён",
	corruptConfirm: "Сохранить принудительно",
	corruptBody: "Не удаётся разобрать файл пользовательского конфига (повреждён, не валидный JSON/JSONC): {path}. При сохранении файл будет пересобран по белому списку — всё текущее содержимое (animations / physics / memes и другие пользовательские поля) будет потеряно. Отмена = не трогать файл (сначала исправьте конфиг и сохраните снова); Подтвердить = сохранить принудительно (отбросить содержимое файла).",
	syncHint: "«Синхронизировать» записывает встроенный конфиг по умолчанию (с комментариями и всеми расширенными полями) в файл пользовательского конфига, перезаписывая текущие настройки; после этого файл можно редактировать напрямую. Два замечания: ① после создания файл становится явным слоем переопределения — последующие изменения встроенных значений по умолчанию не применяются автоматически (пока не синхронизируете снова или не удалите файл); ② нажатие «Сохранить» на этой странице пересобирает файл по белому списку (значения полей сохраняются, комментарии удаляются).",
	configMeta: "Расширенная конфигурация (файлы)",
	configMetaHint: "Пользовательский конфиг может переопределять список питомцев / пулы анимаций / веса воспроизведения — изменения применяются после обновления или перезапуска: в браузере обновите страницу, в настольном режиме щёлкните питомца правой кнопкой → «Перезагрузить конфиг» (перезагружает все окна настольных питомцев); конфиг по умолчанию — полный справочник.",
	defaultConfig: "Конфиг по умолчанию (только чтение, полный справочник)",
	userConfig: "Пользовательский конфиг (свои переопределения)",
	todosFile: "Данные задач (текст списка, срок и статус выполнения; удаление очищает все задачи)",
	animationDir: "Каталог анимаций (можно добавлять и заменять анимации)",
	memesDir: "Каталог мемов (можно добавлять и заменять картинки)",
	logFile: "Файл журнала (для диагностики; можно очищать)",
	logFileNote: "В настольной версии нет консоли, поэтому все журналы работы плагина (запуск, падения и перезапуски настольных питомцев, ошибки и предупреждения) пишутся в этот единственный файл; прикладывайте его при сообщении о проблеме. Лимит файла — 1 МБ, при переполнении остаются последние 512 КБ.",
	saved: "Сохранено — питомцы обновились сразу.",
	loadError: "Не удалось загрузить конфиг",
	saveError: "Не удалось сохранить конфиг. Проверьте подключение к серверу, права на запись в каталог конфигурации и журнал сервера.",
	saveInvalid: "Не удалось сохранить конфиг: недопустимое содержимое. Проверьте значения и повторите попытку.",
	syncError: "Не удалось синхронизировать конфиг. Проверьте подключение к серверу и права на запись в каталог конфигурации.",
	loading: "Загрузка конфига…",
	retry: "Повторить",
	invalid: "Проверьте ввод: размер должен быть положительным, отступы — любым числом.",
	busy: "Сохранение…",
	extraPetsHint: "Ещё {n} вида берутся из файлов каталога pet/ (<имя>-config.json + <имя>-animation/); переключитесь на них в строке «Виды» выше — сохранение запишет в конфиг соответствующего пакета, не в main-config.jsonc.",
	kindLabel: "Виды",
	kindMain: "Встроенный",
	lastOfKind: "У «{entry}» остался только этот питомец — удаление уберёт весь вид. Чтобы удалить полностью, удалите файлы пакета.",
	savePartial: "Основные питомцы сохранены, но {names} не удалось записать: проверьте валидность конфига пакета и права на запись в каталог.",
	notifyToggle: "Системные уведомления",
	notifyToggleHint: "Уведомления ОС (в правом нижнем углу рабочего стола) о завершении диалога, ошибках генерации, запросах прав и вопросах — только когда окно не в фокусе.",
	clickSoundToggle: "Звук клика",
	clickSoundToggleHint: "При клике по питомцу воспроизводится встроенный звук (assets/sound/click-duck.wav, громкость 0.5); повторные клики в пределах 100 мс звучат один раз, поэтому несколько питомцев не накладываются. Выключите для полной тишины. Записывается в пользовательский конфиг вместе с «Сохранить».",
	whisperImageToggle: "Картинки к шёпоту",
	whisperImageToggleHint: "К каждой фразе шёпота добавляется случайный мем из пула (сопоставление картинок — в поле memes верхнего уровня конфига). Токены: шёпот и так вызывает модель каждый цикл, картинка лишь добавляет имя + описание выбранного мема (~100 символов / ≈60 токенов) в тот же запрос — прирост незначителен.",
	chatImageToggle: "Картинки к чату",
	chatImageToggleHint: "ИИ сам выбирает мем из пула под текущий контекст (может не выбирать; сопоставление — в поле memes верхнего уровня). Токены: каждое сообщение несёт весь список — сейчас ~1.1k символов (≈650 токенов, примерно в 11 раз больше, чем у шёпота) и растёт линейно с числом картинок; при выключении не добавляется ни одного символа.",
	chatAnimationToggle: "Действия в чате",
	chatAnimationToggleHint: "Если включено, запрос чата несёт список анимаций, которые можно сыграть (все действия из animations.categories): если модель считает, что реплика действительно изображает одно из них, питомец сразу его играет; иначе отвечает только текстом. Токены: каждое сообщение несёт весь список; при выключении не добавляется ничего. Глобальное значение по умолчанию для всех питомцев (pet pack может переопределить его в своём файле конфигурации).",
	confineToggle: "Не выходить за текущий экран",
	confineToggleHint: "Несколько мониторов: если включено, питомец остаётся в пределах экрана, на котором находится — брошенный питомец отскакивает только внутри экрана, где его отпустили (стыки экранов работают как стены, он не улетает на соседний монитор), а самостоятельные прогулки тоже идут только в пределах текущего экрана (шаг, пересекающий стык, просто отменяется). Если выключено, он свободно летает и ходит между экранами. Только настольный режим — браузерный оверлей и так остаётся в пределах окна.",
	trayToggle: "Системный трей",
	trayToggleHint: "В настольном режиме в области уведомлений (на macOS — в строке меню) постоянно показывается значок со всеми питомцами из конфига: галочка переключает место отображения, включая питомцев, которых сейчас нет на рабочем столе и у которых нет окна для правого клика. Если выключить, вернуть питомца на рабочий стол можно только через браузер (страница настроек или правый клик по питомцу на веб-странице). Windows и так сворачивает такие значки в «скрытые». Только настольный режим.",
	voiceTitle: "Голосовое озвучивание",
	voiceHint: "Три переключателя и голос: главный включает автоматическое озвучивание, два дополнительных — по одному типу активных сообщений. По умолчанию всё выключено; записывается в пользовательский конфиг по «Сохранить» (без немедленной записи).",
	voiceEnabled: "Озвучивание",
	voiceEnabledHint: "Главный переключатель автоматического озвучивания. Если выключен, периодический шёпот и напоминания о задачах не произносятся (два переключателя ниже не действуют); ручной шёпот, ответы в чате и кнопка динамика в панели чата от него не зависят — вы запросили их сами, и они озвучиваются сразу. Влияет только на «говорить или нет»: пузыри, история чата и системные уведомления не затрагиваются; ошибка синтеза пишется в журнал и не прерывает диалог.",
	voiceWhisperEnabled: "Озвучивать шёпот",
	voiceWhisperEnabledHint: "Озвучивает периодически генерируемую фразу шёпота (ручной шёпот по правому клику не затрагивается). Подчиняется главному переключателю выше. По умолчанию выключено — шёпот это фоновое повествование, он не должен звучать без запроса.",
	voiceTodoEnabled: "Озвучивать задачи",
	voiceTodoEnabledHint: "Озвучивает напоминание о задаче, когда подходит срок (пузырь появляется в любом случае; этот пункт решает только, произносить ли). Подчиняется главному переключателю выше. По умолчанию выключено.",
	voiceNameLabel: "Голос",
	voiceVolumeLabel: "Громкость",
	voiceVolumeHint: "Громкость воспроизведения в виде десятичной дроби 0–1: 1 — максимальная громкость (100 %), 0 — без звука. Меняется только уровень, звук заново не синтезируется, поэтому настройка ничего не стоит дополнительно. Не зависит от общего переключателя выше: при выключенном переключателе не действует.",
	physicsTitle: "Физика (ощущение перетаскивания и броска)",
	physicsHint: "Глобальное значение по умолчанию для всех питомцев (пакет питомца может переопределить в своём файле вида); записывается в пользовательский конфиг по «Сохранить» (без немедленной записи). В браузере применяется сразу, в настольном режиме — после перезагрузки окон питомцев при сохранении.",
	mobileTitle: "Эффекты для телефона",
	mobileHint: "Имеют смысл только в мобильном браузере: вибрации нужен мотор, двум переключателям движения — датчики наклона и ускорения, а датчики доступны только по HTTPS или на localhost.",
	"physics.gravity": "Гравитация",
	"physics.gravityHint": "px/s², чем больше, тем быстрее падает; 0 = без гравитации (летит по прямой с постоянной скоростью)",
	"physics.restitution": "Упругость",
	"physics.restitutionHint": "0~1, доля сохраняемой скорости при отскоке от стены / пола (1 = абсолютно упругий, 0 = останавливается при ударе)",
	"physics.groundFriction": "Трение о поверхности",
	"physics.groundFrictionHint": "/с, затухание скорости вдоль любой контактной поверхности (стена, пол, потолок); 0 = везде лёд",
	"physics.throwPower": "Общая сила броска",
	"physics.throwPowerHint": "> 0, общий множитель следования за курсором и начальной скорости броска (1 = по умолчанию; больше = точнее следует и сильнее бросок)",
	physicsCeilingBounce: "Отскок от потолка",
	physicsCeilingBounceHint: "Если выключено, бросок может вылететь за верхний край экрана (гравитация всё равно вернёт питомца)",
	physicsPetCollision: "Столкновения питомцев",
	physicsPetCollisionHint: "Летящий питомец отталкивается от других по закону сохранения импульса (масса ∝ размеру²)",
	physicsHaptic: "Вибрация при столкновении",
	physicsHapticHint: "Одна вибрация на удар (стены, пол, потолок, другие питомцы). Работает в Chrome/Edge; не работает на iOS и в WebView-оболочках вроде Via. Режим «Не беспокоить» блокирует вибрацию.",
	physicsTilt: "Гравитация по наклону",
	physicsTiltHint: "Наклоняйте телефон — гравитация следует за ним (величина = значение выше); при гравитации 0 наклон ничего не меняет. Нужен HTTPS/localhost.",
	physicsShake: "Встряхнуть, чтобы бросить",
	physicsShakeHint: "Встряхните, чтобы бросить питомца в направлении жеста; сила зависит от throwPower. Не зависит от гравитации, работает и при 0. Нужен HTTPS/localhost.",
	invalidPhysics: "Проверьте физические параметры: гравитация / трение о землю ≥ 0, упругость 0~1, общая сила броска > 0.",
	fontTitle: "Внешний вид и шрифт",
	fontHint: "Семейство шрифта применяется ко всем местам, где сейчас используется «мармеладный» шрифт: пузырь питомца, подсказка при наведении, окно чата, всплывающее окно счёта. Размер действует только на пузырь питомца и подсказку при наведении (в чате и окне счёта размер не меняется). Глобальное значение по умолчанию для всех питомцев (пакет питомца может переопределить в своём файле вида); записывается в пользовательский конфиг по «Сохранить» — в браузере сразу, в настольном режиме после перезагрузки окон питомцев.",
	fontFamilyLabel: "Шрифт",
	fontFamilyHint: "«Мармеладный (встроенный)» поставляется с плагином; остальные — системные шрифты. Если шрифта нет на машине, используется следующий в стеке (без пустых мест и ошибок).",
	fontSizeLabel: "Размер шрифта (px)",
	fontSizeHint: "Размер основного текста пузыря; подсказка и мелкий текст внутри пузыря масштабируются пропорционально. Диапазон 4~200.",
	fontFollowToggle: "Масштабировать шрифт вместе с питомцем",
	fontFollowToggleHint: "Включено (по умолчанию): при увеличении питомца шрифт растёт пропорционально, при ширине 462 это ровно заданный выше размер; выключено: размер фиксирован и не зависит от размера питомца.",
	invalidFont: "Проверьте настройки шрифта: семейство должно быть в списке, размер — числом от 4 до 200.",
	"font.candy": "Мармеладный (встроенный)",
	"font.yahei": "Microsoft YaHei / PingFang",
	"font.youyuan": "YouYuan",
	"font.kaiti": "KaiTi",
	"font.simsun": "SimSun",
	"font.comic": "Comic Sans MS",
	"font.system": "Системный по умолчанию",
	modelTitle: "Чат и модели",
	modelHint: "Какая модель используется для шёпота и для чата, и сколько истории каждый запрос чата несёт в контексте. «Следовать текущему диалогу» = использовать модель текущего диалога (по умолчанию). Глобальное значение по умолчанию: действует для всех питомцев, пакет питомца может переопределить в своём файле вида. Список тот же, что в выборе моделей DSH, и предоставляется хостом в реальном времени.",
	modelFollow: "Следовать текущему диалогу",
	modelSearch: "Поиск моделей…",
	modelEmpty: "Подходящих моделей нет.",
	modelNoModels: "Доступных моделей нет.",
	modelLoading: "Обновление списка моделей…",
	modelTriggerAria: "Выбрать модель, текущая {model}",
	modelUnknown: " (текущая настройка, отсутствует в списке)",
	modelNone: "У этого провайдера нет доступных моделей",
	whisperModelLabel: "Модель для шёпота",
	chatModelLabel: "Модель для чата",
	modelFieldHint: "«Следовать текущему диалогу» = использовать модель текущего диалога; если выбранная модель не сработает, плагин один раз повторит с моделью текущего диалога.",
	invalidModel: "Проверьте настройки модели: выберите и провайдера, и модель — либо оставьте оба поля пустыми (следовать текущему диалогу).",
	modelCatalogFailed: "Не удалось загрузить список моделей (обновите страницу, чтобы повторить); текущие значения сохранятся как есть.",
	chatMemory: "Реплик истории чата",
	chatMemoryHint: "Сколько последних реплик несёт каждый запрос чата (1 реплика = 1 вопрос + 1 ответ; 0 = без истории, каждое сообщение с чистого листа). Сама память хранит всё — это значение решает только, сколько попадает в контекст: больше = лучше помнит, но дороже по токенам. Глобальное значение по умолчанию для всех питомцев (пакет питомца может переопределить в своём файле вида).",
	invalidChatMemory: "Проверьте число реплик истории чата: нужно число ≥ 0.",
	chatImageLimit: "Лимит картинок в чате",
	chatImageLimitHint: "Сколько мемов максимум передаётся модели в чате («первые N» = первые N в конфиге, поэтому нужные перенесите в начало). Весь список прикладывается к каждому сообщению, и токены растут линейно с количеством — большой список это чистый перерасход; ограничение первыми N заставляет модель выбирать только из них. 0 = без ограничения (передавать все). Встроенное значение по умолчанию — 10. Глобальное значение по умолчанию для всех питомцев (пакет питомца может переопределить в своём файле вида). Только для выбора картинок в чате: шёпот несёт лишь одну выбранную картинку.",
	invalidChatImageLimit: "Проверьте лимит картинок в чате: нужно число ≥ 0 (0 = без ограничения).",
	notifyTest: "Тестовое уведомление",
	notifyTestOk: "Тестовое уведомление отправлено — проверьте правый нижний угол рабочего стола.",
	notifyDenyUnsupported: "В этой среде системные уведомления не поддерживаются (нет Notification API).",
	notifyDenyBlocked: "Разрешение на уведомления заблокировано браузером.",
	notifyDenyRejected: "Вы выбрали «Блокировать» в запросе разрешения.",
	notifyDenyError: "Ошибка при запросе разрешения",
	notifyGuide: "Подсказка: нажмите 🔒/ⓘ слева от адресной строки → «Настройки сайта» → «Уведомления» → выберите «Разрешить», затем обновите страницу и повторите.",
	storageTitle: "Удаление и хранилище",
	storageHint: "Все места, куда плагин пишет на этом компьютере. Удаление кеша не мешает работе (он скачается/пересоберётся); удаление «пользовательских данных плагина» стирает конфиг и память чата.",
	"storage.userData": "Пользовательские данные плагина: свой конфиг main-config.jsonc, память чата memory.json, свои анимации main-animation/, файловые питомцы pet/",
	"storage.electron": "Среда выполнения Electron для настольного питомца (большая; при следующем включении настольного режима скачается заново)",
	"storage.desktopCache": "Кеш окон настольных питомцев и кеш масштаба основного экрана (можно удалять, пересоберётся автоматически)",
	"storage.electronCache": "Кеш загрузки установщика Electron (можно удалять, при необходимости скачается заново)",
	"storage.package": "Сам плагин (управляется DSH — удаляйте командой ниже, не вручную)",
	storageMissing: " (ещё не создано)",
	uninstallTitle: "Как удалить",
	uninstallStep1: "1. Сначала закройте DSH (настольный питомец закроется вместе с ним); не удаляйте эти файлы, пока питомец запущен.",
	uninstallStep2: "2. Удалите сам плагин (выполните в терминале; он также убирается из слоя bundle профиля):",
	uninstallStep3: "3. Удалите нужные места из списка выше: кеш удалять безопасно; удаление «пользовательских данных плагина» стирает конфиг и память чата (если нужно сохранить — сначала сделайте резервную копию main-config.jsonc).",
	uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

//#endregion
//#region src/client/settings/locales/zh.ts
const zh = {
	nav: "桌宠配置",
	intro: "管理多个桌宠：每个宠物可独立设置大小与位置（保存后即时生效）。",
	petCardTitle: "宠物配置",
	petCardHint: "每只宠物独立配置：名字 / 大小 / 显示位置 / 位置 / 偏移 / 四个功能开关。改完点最下面的「保存」即时生效。",
	globalTitle: "全局开关",
	globalHint: "所有宠物共用（pet pack 可在自己种类文件里单独覆盖）。这几个开关只改本地状态，随「保存」整包写入用户配置（不做即时写入）；系统通知在保存后即时重读，无需刷新页面。",
	cornerHint: "宠物贴着屏幕的哪个角（桌面端按各自显示器的工作区算）。",
	marginXHint: "距所选角落的水平距离（px），可为任意数字。",
	marginYHint: "距所选角落的垂直距离（px），可为任意数字。",
	"cmd.chat": "对话",
	"cmd.pet": "桌宠",
	"cmd.balance": "余额",
	"shortcut.open": "打开桌宠对话",
	"shortcut.chat": "打开对话弹窗",
	"shortcut.hear": "语音输入",
	"shortcut.capture": "截图到对话",
	shortcutCardTitle: "快捷键",
	shortcutCardHint: "展开后分两组：桌宠快捷键与全局快捷键。",
	shortcutRowChat: "打开对话",
	shortcutRowHold: "按住说话",
	shortcutRowHear: "语音输入",
	shortcutRowCapture: "截图",
	shortcutRowPaste: "粘贴图片",
	shortcutRowTodo: "待办事项",
	shortcutRowSleep: "睡觉 / 起来",
	shortcutRowDisplay: "显示位置",
	shortcutRowSidebar: "打开侧栏对话",
	shortcutGroupPet: "桌宠快捷键",
	shortcutGroupPetHint: "网页端鼠标停在宠物上即可；桌面宠物窗口要先点一下宠物，拿到键盘焦点后才生效。",
	shortcutGroupGlobal: "全局快捷键",
	shortcutGroupGlobalHint: "网页端与桌面版窗口里由 DSH 分发；可在「设置 → 通用 → 快捷键」改绑。",
	petsLabel: "宠物列表",
	add: "添加宠物",
	remove: "删除",
	confirmRemove: "确定删除宠物「{id}」吗？",
	confirmTitle: "确认操作",
	cancel: "取消",
	ok: "知道了",
	atLeastOne: "至少保留一个宠物。",
	emptyPets: "暂无宠物，点击「添加宠物」创建。",
	sizeLabel: "大小（宽度 px）",
	sizeHint: "高度自动 = 宽度 × 9/16。",
	sizePercentLabel: "屏幕宽度上限（%）",
	sizePercentHint: "桌宠最多占屏幕多宽：100 = 不超过一屏宽，窗口比宠物宽时与按 px 显示完全一致；填 30–40 可让手机竖屏明显变小，桌面观感不变。只在页面加载时计算一次，改窗口大小后刷新生效。",
	nameLabel: "名字",
	nameHint: "显示名：鼠标悬浮宠物时弹出，也会加进 AI 人设（你的名字是 X）。可重复，留空按宠物 id 处理。",
	personaLabel: "人设（可选）",
	personaHint: "只影响这只宠物。留空 = 跟随所属条目的人设——输入框里的灰色文字就是那份内容。实际发给模型的 system = 这段 + 自动追加的「你的名字是“<名字>”」+ 当前时间背景，所以别在这里再写名字和日期。",
	personaCount: "{n} 字",
	balanceEnabled: "余额功能",
	balanceEnabledHint: "启用后该宠物触发余额动画并显示余额气泡。",
	whisperEnabled: "碎碎念",
	whisperEnabledHint: "启用后该宠物按周期用 AI 生成一句话并播碎碎念动画（人设见下方「人设」框，留空跟随条目）。",
	workStatusEnabled: "工作状态联动",
	workStatusEnabledHint: "启用后该宠物跟随 DSH 工作状态：思考/工作中/等待确认/完成/出错时自动切对应动画并弹气泡（动画池在配置顶层，仅监听不调用模型）。",
	fixedEnabled: "宠物固定",
	fixedEnabledHint: "启用后随机动画不再让宠物自己转向或走开，只播原地待机与随机小动作；右键菜单点播、接口触发、余额/碎碎念/工作状态动画不受影响。",
	displayLabel: "显示位置",
	displayHint: "web=仅浏览器 / desktop=仅桌面 / both=两者都显示 / none=都不显示",
	"display.web": "仅浏览器",
	"display.desktop": "仅桌面",
	"display.both": "两者都显示",
	"display.none": "都不显示",
	cornerLabel: "位置",
	"corner.top-left": "左上角",
	"corner.top-right": "右上角",
	"corner.bottom-left": "左下角",
	"corner.bottom-right": "右下角",
	marginX: "水平偏移",
	marginY: "垂直偏移",
	save: "保存",
	saveHotkey: "Ctrl+S / Cmd+S",
	sync: "同步",
	confirmSync: "确定同步吗？将用项目内置的默认配置（完整字段 + 注释）覆盖用户配置，当前的自定义内容会丢失。",
	corruptTitle: "用户配置已损坏，未保存",
	corruptConfirm: "强行保存",
	corruptBody: "用户配置文件解析不了（内容已损坏，不是合法 JSON/JSONC）：{path}。继续保存会按白名单重建这个文件——它里面现有的内容（animations / physics / memes 等自定义字段）会全部丢失。取消 = 不动文件（先去把配置改回合法再保存）；确认 = 强行保存（丢弃文件里现有的内容）。",
	syncHint: "「同步」会把项目内置的默认配置（含注释与全部高级字段）写入用户配置文件，覆盖当前自定义内容；之后可直接编辑该文件。注意两点：① 文件一旦生成即为显式覆盖层——插件升级后内置默认的变化不会自动生效（除非再次同步或删除该文件）；② 在本页点「保存」会按白名单重写该文件（字段值保留，但注释会被去掉）。",
	configMeta: "高级配置（文件）",
	configMetaHint: "用户配置可覆盖宠物列表 / 动画池 / 播放权重，修改后刷新或重启生效：浏览器端刷新页面，桌面端右键宠物 →「重载配置」（重载全部桌面宠物窗口）；默认配置为完整参考。",
	defaultConfig: "默认配置（只读，完整参考）",
	userConfig: "用户配置（自定义覆盖）",
	todosFile: "待办数据（清单正文、到期时间与完成状态；删掉等于清空待办）",
	animationDir: "动画素材目录（可自定义/扩充动画）",
	memesDir: "表情包目录（可自定义/扩充配图）",
	logFile: "日志文件（排障用，可清空）",
	logFileNote: "桌面版没有控制台，插件的运行日志（启动、桌面宠物崩溃/重启、错误与告警）全部写进这一个文件；反馈问题请附上它。单文件上限 1 MB，写满只留最新的 512 KB。",
	saved: "已保存，桌宠即时生效。",
	loadError: "加载配置失败",
	saveError: "保存配置失败，请检查服务连接、配置目录的写入权限或服务日志。",
	saveInvalid: "保存配置失败：配置内容无效，请检查后重试。",
	syncError: "同步配置失败，请检查服务连接和配置目录的写入权限。",
	loading: "正在加载配置…",
	retry: "重试",
	invalid: "请检查输入：大小需为正数，边距可为任意数字。",
	busy: "保存中…",
	extraPetsHint: "另 {n} 个种类来自 pet/ 目录文件（<名>-config.json + <名>-animation/），在上方「种类」条里切换即可修改；保存会写回各自的角色包配置，不混进 main-config.jsonc。",
	kindLabel: "种类",
	kindMain: "内置",
	lastOfKind: "「{entry}」只剩这一只，删掉就没有这个种类了。要彻底移除请直接删除该角色包文件。",
	savePartial: "主宠物已保存，但 {names} 没能写回：检查该角色包配置是否合法、目录是否可写。",
	notifyToggle: "系统通知",
	notifyToggleHint: "对话完成 / 生成失败 / 权限申请 / 用户选择，在窗口失焦时弹出系统级通知（桌面右下角）。",
	clickSoundToggle: "点击音效",
	clickSoundToggleHint: "点一下宠物播一声内置音效（assets/sound/click-duck.wav，音量 0.5；100ms 内的连续点击只响一次，多开也不会叠音）。关掉即完全静音。随「保存」写入用户配置。",
	whisperImageToggle: "碎碎念配图",
	whisperImageToggleHint: "碎碎念时从表情包池随机抽一张，连同那句话一起显示（图片映射在配置文件顶层 memes）。token：碎碎念本来就每次生成都要调一次模型，配图只是把抽中那张的名称+描述（约 100 字符 / ≈60 token）加进同一次请求，增量可忽略。",
	chatImageToggle: "对话配图",
	chatImageToggleHint: "对话时由 AI 按当前语境从表情包池挑一张配图（可不挑；图片映射在配置文件顶层 memes）。token：每条消息都要把整张清单附进请求，当前约 1.1k 字符（≈650 token，约碎碎念配图的 11 倍），并随图片数量线性增长；关掉则一个字符都不附。",
	chatAnimationToggle: "对话动作联动",
	chatAnimationToggleHint: "开启后，对话时会把可表演的动作清单（animations.categories 下的全部动作）交给模型：模型认为这句话确实在演某个动作时，宠物当场演出来；没有合适的就只回文字。token：每条消息都要附整张动作清单，关掉则一个名字都不附。全局默认，所有宠物共用（pet pack 可在自己种类文件里覆盖）。",
	confineToggle: "锁定在当前屏幕",
	confineToggleHint: "多屏用户：开了之后宠物只在当前所在那块屏幕内活动——甩出去的宠物只在松手时所在那块屏内弹（屏缝当墙，不飞到隔壁屏），自主漫游也只在当前所在那块屏内走（越出屏缝的那一步直接取消）。关掉则照常跨屏飞行 / 跨屏行走。只影响桌面模式——浏览器 overlay 本来就只在视口内活动。",
	trayToggle: "系统托盘",
	trayToggleHint: "桌面模式启动后在通知区域（macOS 为菜单栏）常驻一个图标，列出配置里的全部宠物，勾选就能切换显示位置——包括当前不在桌面、没有窗口可右键的那些。关掉之后要把宠物叫回桌面，只能开浏览器用设置页，或在网页端那只宠物身上右键。Windows 本来就会把它折叠进「隐藏的图标」面板。仅影响桌面模式。",
	voiceTitle: "语音播报",
	voiceHint: "桌宠出声的三个开关与音色：总开关管自动播报，两个细分开关各管一类主动消息。默认全关，随「保存」写入用户配置（不做即时写入）。",
	voiceEnabled: "语音播报",
	voiceEnabledHint: "自动播报的总开关。关掉后周期碎碎念与待办提醒都不念（下面两个细分开关不起作用）；手动碎碎念、对话回复与对话面板的喇叭按钮不受它限制——那些是你主动点的，发起的那一端直接念。只影响「说不说」：气泡、对话记忆与系统通知都不受影响；合成失败只留日志，不打断对话。",
	voiceWhisperEnabled: "碎碎念播报",
	voiceWhisperEnabledHint: "周期生成的那句碎碎念念出来（手动右键的碎碎念不受本项影响）。受上面的总开关约束：总开关关掉时本项不起作用。默认关闭——碎碎念是背景旁白，不该默认出声。",
	voiceTodoEnabled: "待办播报",
	voiceTodoEnabledHint: "到点的待办提醒念出来（同一句照样弹气泡，本项只决定念不念）。受上面的总开关约束。默认关闭。",
	voiceNameLabel: "音色",
	voiceVolumeLabel: "音量",
	voiceVolumeHint: "播报音量，0–1 的小数：1 是最大音量（100%），0 是静音。只改播放响度，不会重新合成音频，调它不额外花钱。与上面的总开关是两件事——总开关关着时它不起作用。",
	physicsTitle: "物理（拖拽抛掷手感）",
	physicsHint: "全局默认，所有宠物共用（pet pack 可在自己种类文件里单独覆盖）；随「保存」写入用户配置（不做即时写入）。浏览器保存后即时生效，桌面端由保存重载宠物窗口后生效。",
	mobileTitle: "移动端效果",
	mobileHint: "这几项只在手机浏览器上有意义：振动要有马达，两个体感开关要有姿态 / 加速度传感器；传感器还要求 HTTPS 或 localhost。",
	"physics.gravity": "重力",
	"physics.gravityHint": "px/s²，越大落得越快；0 = 无重力（抛出去匀速直线飞）",
	"physics.restitution": "弹性",
	"physics.restitutionHint": "0~1，碰壁 / 落地反弹保留的速度比例（1 = 完全弹性，0 = 撞上即停）",
	"physics.groundFriction": "接触摩擦",
	"physics.groundFrictionHint": "/s，撞墙 / 落地 / 撞顶后沿接触面方向的速度衰减率；0 = 四面都像冰面",
	"physics.throwPower": "总力度",
	"physics.throwPowerHint": "> 0，弹簧跟手与甩出初速的整体倍率（1 = 默认；越大越跟手、甩得越猛）",
	physicsCeilingBounce: "顶部反弹",
	physicsCeilingBounceHint: "关掉后抛掷可飞出屏幕顶部（重力仍会把它拉回来）",
	physicsPetCollision: "宠物互撞",
	physicsPetCollisionHint: "飞行中的宠物撞到别的宠物按动量守恒弹开（质量 ∝ 尺寸²）",
	physicsHaptic: "碰撞震动",
	physicsHapticHint: "撞墙、落地、撞顶、互撞各震一下。Chrome / Edge 可用；iOS 与 Via 等 WebView 壳不生效；勿扰模式会挡住振动。",
	physicsTilt: "倾斜控制重力",
	physicsTiltHint: "倾斜手机 = 重力朝那边，大小就是上面的重力值；重力为 0 时倾斜没有效果。需要 HTTPS 或 localhost。",
	physicsShake: "摇一摇抛出",
	physicsShakeHint: "摇一摇沿甩动方向把宠物甩出去，力度 = 基准 × 总力度；与重力无关，重力设 0 也能甩。需要 HTTPS 或 localhost。",
	invalidPhysics: "请检查物理参数：重力 / 地面摩擦 ≥ 0，弹性 0~1，总力度 > 0。",
	fontTitle: "外观与字体",
	fontHint: "字体种类作用于现在用软糖体的全部文字：宠物气泡、悬浮提示、对话窗、得分弹窗；字号只作用于宠物气泡与悬浮提示（对话窗与得分弹窗的字号不变）。全局默认，所有宠物共用（pet pack 可在自己种类文件里单独覆盖）；随「保存」写入用户配置，浏览器保存后即时生效，桌面端由保存重载宠物窗口后生效。",
	fontFamilyLabel: "字体",
	fontFamilyHint: "「软糖体（内置）」随插件提供；其余为系统字体，机器上没装时自动回退到字体栈里的下一个（不会空白或报错）。",
	fontSizeLabel: "字号（px）",
	fontSizeHint: "气泡正文字号；悬浮提示与气泡内的小字按既有比例派生。范围 4~200。",
	fontFollowToggle: "字号随宠物大小缩放",
	fontFollowToggleHint: "开启（默认）：宠物调大时字号等比放大，462 宽时正好是上面设定的字号；关闭：字号恒定，不随宠物大小变化。",
	invalidFont: "请检查字体设置：字体需在下拉列表内，字号需为 4~200 的数字。",
	"font.candy": "软糖体（内置）",
	"font.yahei": "微软雅黑 / 苹方",
	"font.youyuan": "幼圆",
	"font.kaiti": "楷体",
	"font.simsun": "宋体",
	"font.comic": "漫画体",
	"font.system": "系统默认",
	modelTitle: "对话与模型",
	modelHint: "碎碎念与对话各自用哪个模型，以及对话每次带多少历史进上下文。选「跟随当前对话」= 用你当前对话正在用的那个模型（默认）。全局默认：对所有宠物生效，pet pack 可在自己种类文件里单独覆盖。选项与 DSH 的模型选择器同源，由宿主实时提供。",
	modelFollow: "跟随当前对话",
	modelSearch: "搜索模型…",
	modelEmpty: "没有匹配的模型。",
	modelNoModels: "没有可用的模型。",
	modelLoading: "正在刷新模型列表…",
	modelTriggerAria: "选择模型，当前 {model}",
	modelUnknown: "（当前配置，不在列表中）",
	modelNone: "该服务商没有可用模型",
	whisperModelLabel: "碎碎念模型",
	chatModelLabel: "对话模型",
	modelFieldHint: "选「跟随当前对话」= 用当前对话的模型；指定了但调用失败会自动回落到当前对话的模型重试一次。",
	invalidModel: "请检查模型设置：服务商与模型要么都选，要么都留空（跟随当前对话）。",
	modelCatalogFailed: "模型列表加载失败（刷新页面可重试）；当前配置值仍会原样保留。",
	chatMemory: "对话历史条数",
	chatMemoryHint: "每次对话请求携带的最近历史轮数（1 轮 = 1 问 1 答；0 = 不带历史，每句都是全新对话）。对话记忆本身全存不删，此值只决定截多少进上下文——越大越记得住，也越费 token。全局默认，所有宠物共用（pet pack 可在自己种类文件里单独覆盖）。",
	invalidChatMemory: "请检查对话历史条数：需为 ≥ 0 的数字。",
	chatImageLimit: "对话配图张数上限",
	chatImageLimitHint: "对话时发给模型的表情包清单最多几张（「前 N 张」= 配置里写在前面的那 N 条，想让哪几张优先被发出去就把顺序往前挪）。整张清单是每条消息都要附的，token 随张数线性增长——张数一多就是纯烧钱，限制成前 N 张，模型只从这几张里挑。0 = 不限制（全部发）。内置默认 10。全局默认，所有宠物共用（pet pack 可在自己种类文件里覆盖）。只影响对话选图：碎碎念只带抽中的那一张。",
	invalidChatImageLimit: "请检查对话配图张数上限：需为 ≥ 0 的数字（0 = 不限制）。",
	notifyTest: "测试弹窗",
	notifyTestOk: "测试通知已发送，请查看桌面右下角。",
	notifyDenyUnsupported: "当前环境不支持系统通知（浏览器无 Notification API）。",
	notifyDenyBlocked: "通知权限已被浏览器标记为「阻止」。",
	notifyDenyRejected: "你在权限询问弹窗中选择了「阻止」。",
	notifyDenyError: "申请权限时出错",
	notifyGuide: "引导：点击地址栏左侧 🔒/ⓘ →「网站设置」→「通知」→ 改为「允许」，刷新页面后重试。",
	storageTitle: "卸载与存储",
	storageHint: "插件在本机落下的全部位置。删缓存不影响使用（会自动重下/重建）；删「插件用户数据」会丢配置与对话记忆。",
	"storage.userData": "插件用户数据：自定义配置 main-config.jsonc、对话记忆 memory.json、自定义动画素材 main-animation/、文件宠物 pet/",
	"storage.electron": "桌面宠物用的 Electron 运行时（体积较大；删除后下次启用桌面模式会自动重新下载）",
	"storage.desktopCache": "桌面宠物窗口的缓存与主屏缩放缓存（可删，会自动重建）",
	"storage.electronCache": "Electron 安装包下载缓存（可删，需要时会重新下载）",
	"storage.package": "插件本体（由 DSH 管理，用下面的卸载命令移除，不要手删）",
	storageMissing: "（尚未创建）",
	uninstallTitle: "卸载方法",
	uninstallStep1: "1. 先退出 DSH（桌面宠物随之退出）；不要在桌宠运行时删除上面的文件。",
	uninstallStep2: "2. 卸载插件本体（终端执行，会同时从 profile 的 bundle 层移除）：",
	uninstallStep3: "3. 按需删除上面的位置：缓存类删了无影响；「插件用户数据」删了会丢配置与对话记忆（想保留就先备份其中的 main-config.jsonc）。",
	uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

//#endregion
//#region src/client/settings/locales/index.ts
const NS = "pet.config";
const dicts = {
	zh,
	en,
	ja,
	es,
	fr,
	de,
	ru,
	pt
};

//#endregion
//#region src/client/settings.ts
function makePetConfigSection(rt) {
	const { h, useState, useEffect, useRef, useCallback, t } = rt;
	injectSettingsCss();
	const { q } = makeUiKit({
		h,
		t
	});
	const PetCard = makePetCard(rt);
	const GlobalCard = makeGlobalCard(rt);
	const FontCard = makeFontCard(rt);
	const ShortcutsCard = makeShortcutsCard(rt);
	const Actions = makeActions(rt);
	const { ConfigMetaCard, StorageCard } = makePathsCards(rt);
	const SettingsDialog = makeDialog(rt);
	const LoadStatus = makeLoadStatus({
		h,
		t
	});
	return function PetConfigSection() {
		const [saving, setBusy] = useState(false);
		const [msg, setMsg] = useState({
			kind: "",
			text: ""
		});
		const [permMsg, setPermMsg] = useState({
			kind: "",
			text: ""
		});
		const rootRef = useRef(null);
		const [dialog, setDialog] = useState(null);
		const { pets, mainPets, selId, update, remove, replace, packWrites } = usePetList(rt, setDialog);
		const { paths } = useRemoteData(rt);
		useEffect(() => attachTipLayer(), []);
		const [notifyEnabled, setNotifyEnabled] = useState(true);
		const [clickSound, setClickSound] = useState(true);
		const [confineScreen, setConfineScreen] = useState(false);
		const [trayEnabled, setTrayEnabled] = useState(true);
		const [whisperImage, setWhisperImage] = useState(false);
		const [chatImage, setChatImage] = useState(false);
		const [chatAnimation, setChatAnimation] = useState(true);
		const [voiceEnabled, setVoiceEnabled] = useState(false);
		const [voiceName, setVoiceName] = useState("zh-CN-XiaoyiNeural");
		const [voiceVolume, setVoiceVolume] = useState(1);
		const [voiceWhisperEnabled, setVoiceWhisperEnabled] = useState(false);
		const [voiceTodoEnabled, setVoiceTodoEnabled] = useState(false);
		const [physics, setPhysics] = useState({ ...DEFAULT_PHYSICS });
		const [font, setFont] = useState({ ...DEFAULT_FONT });
		const [whisperModel, setWhisperModel] = useState({
			provider: "",
			model: ""
		});
		const [chatModel, setChatModel] = useState({
			provider: "",
			model: ""
		});
		const [chatMemory, setChatMemory] = useState(10);
		const [chatImageLimit, setChatImageLimit] = useState(20);
		const applyConfig = useCallback((merged) => {
			const entries = readConfigEntries(merged);
			const patch = readMainConfig(merged);
			if (entries === null || patch === null) throw new Error("Invalid config response");
			replace(entries);
			if (patch.notificationsEnabled !== void 0) setNotifyEnabled(patch.notificationsEnabled);
			if (patch.clickSoundEnabled !== void 0) setClickSound(patch.clickSoundEnabled);
			if (patch.whisperImageEnabled !== void 0) setWhisperImage(patch.whisperImageEnabled);
			if (patch.chatImageEnabled !== void 0) setChatImage(patch.chatImageEnabled);
			if (patch.chatAnimationEnabled !== void 0) setChatAnimation(patch.chatAnimationEnabled);
			if (patch.confineToScreen !== void 0) setConfineScreen(patch.confineToScreen);
			if (patch.trayEnabled !== void 0) setTrayEnabled(patch.trayEnabled);
			if (patch.voiceEnabled !== void 0) setVoiceEnabled(patch.voiceEnabled);
			if (patch.voiceName !== void 0) setVoiceName(patch.voiceName);
			if (patch.voiceVolume !== void 0) setVoiceVolume(patch.voiceVolume);
			if (patch.voiceWhisperEnabled !== void 0) setVoiceWhisperEnabled(patch.voiceWhisperEnabled);
			if (patch.voiceTodoEnabled !== void 0) setVoiceTodoEnabled(patch.voiceTodoEnabled);
			if (patch.physics !== void 0) setPhysics(patch.physics);
			if (patch.font !== void 0) setFont(patch.font);
			if (patch.whisperModel !== void 0) setWhisperModel(patch.whisperModel);
			if (patch.chatModel !== void 0) setChatModel(patch.chatModel);
			if (patch.chatMemoryRounds !== void 0) setChatMemory(patch.chatMemoryRounds);
			if (patch.chatImageLimit !== void 0) setChatImageLimit(patch.chatImageLimit);
		}, [replace]);
		const { loadState, retry } = useConfigLoad(rt, applyConfig);
		const busy = saving || loadState !== "ready";
		const toggleNotify = async (v) => {
			setNotifyEnabled(v);
			if (v) await requestNotificationPermission();
		};
		const testNotification = () => void runNotificationTest({
			t,
			report: setPermMsg
		});
		const cur = pets.find((p) => p.id === selId) ?? null;
		const globalFlags = {
			notificationsEnabled: notifyEnabled,
			clickSoundEnabled: clickSound,
			confineToScreen: confineScreen,
			trayEnabled
		};
		const flagSetters = {
			notificationsEnabled: (value) => void toggleNotify(value),
			clickSoundEnabled: setClickSound,
			confineToScreen: setConfineScreen,
			trayEnabled: setTrayEnabled
		};
		const setGlobalFlag = (key, value) => flagSetters[key](value);
		const patchFont = (patch) => setFont((current$1) => ({
			...current$1,
			...patch
		}));
		const write = createWriteFlow({
			fields: () => ({
				pets: mainPets,
				notificationsEnabled: notifyEnabled,
				clickSoundEnabled: clickSound,
				whisperImageEnabled: whisperImage,
				chatImageEnabled: chatImage,
				chatAnimationEnabled: chatAnimation,
				confineToScreen: confineScreen,
				trayEnabled,
				voiceEnabled,
				voiceName,
				voiceVolume,
				voiceWhisperEnabled,
				voiceTodoEnabled,
				physics,
				whisperModel,
				chatModel,
				chatMemoryRounds: chatMemory,
				chatImageLimit,
				font
			}),
			busy: () => busy,
			setBusy,
			setMsg,
			setDialog,
			dialog: () => dialog,
			applyConfig,
			packWrites,
			userFile: () => paths?.user ?? "",
			t,
			onRemove: remove
		});
		const saveRef = useRef(() => {});
		useEffect(() => {
			saveRef.current = () => void write.save();
		});
		useEffect(() => {
			const onKey = (e) => {
				if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
				if (e.key.toLowerCase() !== "s") return;
				const root = rootRef.current;
				if (!root || !root.isConnected || root.getClientRects().length === 0) return;
				e.preventDefault();
				saveRef.current();
			};
			document.addEventListener("keydown", onKey);
			return () => document.removeEventListener("keydown", onKey);
		}, []);
		return h("section", {
			ref: rootRef,
			className: "dsh-pet-cfg",
			style: { maxWidth: "720px" },
			children: [
				h("h2", {
					className: "dsh-pet-cfg__title",
					children: [t("nav"), q(t("intro"))]
				}),
				h(LoadStatus, {
					loadState,
					onRetry: retry
				}),
				h(PetCard, {
					pet: cur,
					busy,
					msg,
					onChange: update,
					onSave: () => void write.save()
				}),
				h(GlobalCard, {
					busy,
					values: globalFlags,
					onChange: setGlobalFlag
				}),
				h(FontCard, {
					busy,
					font,
					onChange: patchFont
				}),
				h(Actions, {
					busy,
					msg,
					permMsg,
					onSave: () => void write.save(),
					onSync: write.requestSync,
					onTestNotification: testNotification
				}),
				h(ShortcutsCard, {}),
				paths ? h(ConfigMetaCard, { paths }) : null,
				paths ? h(StorageCard, { paths }) : null,
				dialog ? h(SettingsDialog, {
					dialog,
					selId,
					onDismiss: () => setDialog(null),
					onConfirm: write.confirmDialog
				}) : null
			]
		});
	};
}

//#endregion
//#region src/client/pet/click-sound.ts
/** 音效文件地址。 */
const CLICK_SOUND_URL = ROUTE_PATH + "/sound/click-duck.wav";
/** 音量：与其余提示音同一档，不抢对话内容。 */
const CLICK_SOUND_VOLUME = .5;
/** 连点节流：100ms 内只响一次，避免连点变成噪音。 */
const CLICK_SOUND_THROTTLE_MS = 100;
/** 复用的 audio 实例，首次播放时创建。 */
let clickAudio = null;
/** 上一次真正播放的时间戳（ms）。 */
let lastClickSoundAt = 0;
/** 点击音效开关；配置未加载前保守静音。 */
let clickSoundEnabled = false;
function setClickSoundEnabled(enabled) {
	clickSoundEnabled = enabled;
}
function playClickSound() {
	if (!clickSoundEnabled) return;
	const now = Date.now();
	if (now - lastClickSoundAt < CLICK_SOUND_THROTTLE_MS) return;
	lastClickSoundAt = now;
	try {
		clickAudio ?? (clickAudio = new Audio(CLICK_SOUND_URL));
		clickAudio.volume = CLICK_SOUND_VOLUME;
		clickAudio.currentTime = 0;
		clickAudio.play().catch(() => {});
	} catch {}
}

//#endregion
//#region src/client/menu-service.ts
/** owner → 本页可见的 label 列表（来源是 /state 的 sections.menu 快照）。 */
const labels = new Map();
/** owner → 每项的点击闩锁（连点两次同一条只留最后一次，与宿主一致）。 */
const marks = new Map();
function setMenuItems(items) {
	labels.clear();
	for (const item of items) {
		const list = labels.get(item.owner);
		if (list === void 0) labels.set(item.owner, [item.label]);
		else if (!list.includes(item.label)) list.push(item.label);
	}
	for (const [owner, entry] of marks) {
		const list = labels.get(owner);
		if (list === void 0) {
			marks.delete(owner);
			continue;
		}
		for (const label of [...entry.keys()]) if (!list.includes(label)) entry.delete(label);
	}
}
function setMenuClick(owner, label, pet) {
	let entry = marks.get(owner);
	if (entry === void 0) {
		entry = new Map();
		marks.set(owner, entry);
	}
	entry.set(label, pet);
}
function takeMenuEvents(owner) {
	const list = labels.get(owner);
	if (list === void 0) return {
		ok: false,
		reason: "unknown-owner"
	};
	const entry = marks.get(owner);
	const events = {};
	for (const label of list) {
		events[label] = entry?.get(label) ?? null;
		entry?.set(label, null);
	}
	return {
		ok: true,
		events
	};
}

//#endregion
//#region src/client/pet/menu-actions.ts
/** 显示位置：写配置后宿主回成品聚合，交给容器重渲染。 */
async function switchDisplay(deps, display) {
	try {
		const response = await fetch(ROUTE_PATH + "/pet-display", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				id: deps.petId,
				display
			})
		});
		if (!response.ok) throw new Error("pet-display HTTP " + response.status);
		const body = await response.json();
		if (body.ok === false) throw new Error("pet-display 被拒：" + String(body.reason ?? ""));
		deps.applyMerged(body);
	} catch (error) {
		deps.warn("[dsh-pet] 显示位置切换失败 " + (error instanceof Error ? error.message : String(error)));
	}
}
function createMenuActions(deps) {
	const { petId } = deps;
	/** 动作端点：POST 一次，失败只留一行 warn——结果由 /state 送回，这里没有返回值可用。 */
	const fireAction = (route, label) => {
		postAction(route).then((ok) => {
			if (!ok) deps.warn("[dsh-pet] " + label + "失败 pet=" + petId);
		}).catch((error) => deps.warn("[dsh-pet] " + label + "异常 pet=" + petId + " " + String(error)));
	};
	const run = (leaf$1, playbackId, keepFacing = false, hostInstruction = false) => {
		if (!hostInstruction && deps.sleeping?.() === true && deps.locked?.() !== true && !isSleepAllowedAction(leaf$1.action)) {
			const pool = deps.sleepRefuseTexts?.() ?? [];
			const text = pool[Math.floor(Math.random() * pool.length)];
			if (text !== void 0) deps.say?.(text);
			return;
		}
		if (leaf$1.action === "third-party") {
			const owner = leaf$1.owner ?? "";
			if (owner !== "") {
				setMenuClick(owner, leaf$1.label, petId);
				postAction(ROUTE_PATH + "/menu/click", {
					owner,
					label: leaf$1.label,
					pet: petId
				}).catch((error) => deps.warn("[dsh-pet] 第三方菜单点击上报失败 " + String(error)));
			}
			return;
		}
		if (leaf$1.action === "sleep" || leaf$1.action === "wake") {
			const route = leaf$1.action === "sleep" ? "/sleep" : "/wake";
			console.info("[dsh-pet] 菜单" + (leaf$1.action === "sleep" ? "睡觉" : "起来") + " pet=" + petId);
			fireAction(ROUTE_PATH + route + "?pet=" + encodeURIComponent(petId), leaf$1.action === "sleep" ? "睡觉" : "起来");
			return;
		}
		if (leaf$1.action === "todo") {
			deps.openTodo();
			return;
		}
		if (leaf$1.action === "set-display") {
			const display = leaf$1.display;
			if (!display) return;
			console.info("[dsh-pet] 菜单切换显示位置 pet=" + petId + " display=" + display);
			switchDisplay(deps, display);
			return;
		}
		if (leaf$1.action === "home") {
			deps.stopThrow();
			deps.stopMove();
			deps.resetPosition();
			return;
		}
		if (!leaf$1.anim) return;
		const cuePlaybackId = playbackId ?? null;
		if (!keepFacing && isNoMirrorAnimation(deps.animations().categories, leaf$1.anim) && deps.isFacingRight()) deps.faceLeft();
		const movies = deps.animations().moves.actions;
		if (movies.some((action) => action.name === leaf$1.anim)) {
			if (deps.tryMove(leaf$1.anim) === false) {
				deps.stopMove();
				deps.playOnce(leaf$1.anim, cuePlaybackId);
			} else if (cuePlaybackId !== null) deps.report(cuePlaybackId, "failed", "busy");
			return;
		}
		deps.stopMove();
		deps.playOnce(leaf$1.anim, cuePlaybackId);
	};
	return { run };
}

//#endregion
//#region src/client/pet/playback-report.ts
function playbackReportRequest(playbackId, status, reason) {
	return {
		url: ROUTE_PATH + "/playback/" + encodeURIComponent(playbackId) + "/report",
		body: reason === void 0 ? { status } : {
			status,
			reason
		}
	};
}
function makePlaybackReporter(o) {
	return (playbackId, status, reason) => {
		const request = playbackReportRequest(playbackId, status, reason);
		postAction(request.url, request.body).then((ok) => {
			if (!ok) console.warn("[dsh-pet] 播放回执未送达 pet=" + o.petId + " id=" + playbackId + " status=" + status);
		});
	};
}

//#endregion
//#region src/client/pet/animation/next-animation.ts
function decideNextAnimation(input) {
	const { kind, animations, facing, current: current$1, move } = input;
	if (kind === "idle") return {
		kind: "IDLE",
		anim: pick(animations.idle, current$1),
		play: true
	};
	if (kind === "turn") return {
		kind: "TURN",
		anim: pick(animations.turn, current$1),
		play: true
	};
	if (kind === "move" && move !== false && move !== void 0) return {
		kind: "MOVES",
		anim: typeof move === "string" ? move : null,
		play: false
	};
	const action = pickCategoryAction(animations.categories, animations.idle, facing, current$1);
	return {
		kind: action.id,
		anim: action.name,
		play: true
	};
}

//#endregion
//#region src/client/pet/card/sleep-machine.ts
function createSleepMachine(hub, pickNext, log$3) {
	let current$1 = null;
	/** 换一段：`once` 决定播完是否触发 ended（循环段必须 false）。 */
	const play = (name, once) => {
		hub.card.actions.setOnce(once);
		hub.card.actions.setAnim(name);
		hub.card.actions.bumpSeq();
	};
	const apply = (state) => {
		const petId = hub.cfg().id;
		if (state.sleeping) {
			if (current$1 !== null) return;
			hub.stopMotion();
			hub.bubbles.hideWork();
			current$1 = {
				set: {
					start: state.start,
					loop: state.loop,
					end: state.end
				},
				phase: "start"
			};
			log$3(petId, "睡觉 -> [" + state.start + "]");
			play(state.start, true);
			return;
		}
		if (current$1 === null || current$1.phase === "end") return;
		if (current$1.phase === "start") {
			current$1 = null;
			log$3(petId, "入睡被打断：不播起来");
			return;
		}
		current$1.phase = "end";
		log$3(petId, "醒来 -> [" + current$1.set.end + "]");
		play(current$1.set.end, true);
	};
	return {
		apply,
		consumeEnded: () => {
			if (current$1 === null) return false;
			if (current$1.phase === "start") {
				current$1.phase = "loop";
				play(current$1.set.loop, false);
				return true;
			}
			if (current$1.phase === "loop") {
				play(current$1.set.loop, false);
				return true;
			}
			current$1 = null;
			pickNext();
			return true;
		},
		sleeping: () => current$1 !== null,
		phase: () => current$1?.phase ?? null
	};
}

//#endregion
//#region src/client/pet/card/animation-flow.ts
/** 日志行的时刻前缀。 */
const stamp$3 = () => new Date().toTimeString().slice(0, 8);
/** 一行带时刻与宠物 id 的日志。 */
const log$2 = (petId, message) => {
	console.log("[dsh-pet] " + stamp$3() + " pet=" + petId + " " + message);
};
function createAnimationFlow(rt) {
	const { useRef } = rt;
	return function useAnimationFlow(hub, workStatus) {
		const workStatusRef = useRef(workStatus);
		workStatusRef.current = workStatus;
		const machineRef = useRef(null);
		const sleep$1 = () => machineRef.current ?? (machineRef.current = createSleepMachine(hub, pickNext, log$2));
		/** 此刻是否在睡（含两段过渡）。 */
		const sleeping = () => sleep$1().sleeping();
		/** 当前睡觉阶段；醒着为 null。 */
		const sleepPhase = () => sleep$1().phase();
		/** 应用宿主写的睡觉状态（转发给状态机）。 */
		const applySleep = (state) => sleep$1().apply(state);
		/** 非终态工作状态回到档位循环；冻结、空闲与终态都返回 false。 */
		const resumeWorkStatusAnim = () => {
			const card = hub.card;
			if (hub.ownAnim.isFrozen()) return false;
			if (sleeping()) return false;
			const ws = workStatusRef.current;
			if (!ws || !ws.state || ws.state === "success" || ws.state === "error") return false;
			const pool = hub.anims().events?.workStatus;
			if (!pool || pool.length === 0) return false;
			const idx = WORK_STATUS_INDEX[ws.state];
			const slot = pool[idx];
			if (slot === void 0) return false;
			const name = pickSlot(slot, card.animRef.current);
			log$2(hub.cfg().id, "互动结束恢复状态动画: " + name);
			card.actions.setOnce(Array.isArray(slot) && slot.length > 1);
			card.actions.setAnim(name);
			return true;
		};
		/** 按权重掷骰选择下一段自播动画。 */
		const pickNext = () => {
			const card = hub.card;
			if (hub.ownAnim.isFrozen()) return;
			if (sleeping()) return;
			const roll = Math.random();
			const kind = rollKind(roll, hub.cfg().animationWeights, { fixed: hub.cfg().fixedEnabled });
			const move = kind === "move" ? hub.tryWalk() : void 0;
			const decision = decideNextAnimation({
				kind,
				animations: hub.anims(),
				facing: card.facingRef.current,
				current: card.animRef.current,
				move
			});
			log$2(hub.cfg().id, "facing=" + card.facingRef.current + " roll=" + roll.toFixed(4) + " -> [" + decision.kind + "] " + (decision.anim ?? "移动进行中(不重播)"));
			if (decision.play && decision.anim !== null) card.actions.setAnim(decision.anim);
			card.actions.setOnce(true);
			card.actions.bumpSeq();
		};
		/** 按播完判定改状态。 */
		const applyEndedCue = (cue) => {
			const card = hub.card;
			if (sleep$1().consumeEnded()) return;
			if (cue.kind === "ignore") return;
			if (cue.kind === "work-rotate") {
				card.actions.setOnce(true);
				card.actions.setAnim(cue.anim);
				card.actions.bumpSeq();
				return;
			}
			if (cue.kind === "work-replay") {
				card.actions.setOnce(false);
				card.actions.bumpSeq();
				return;
			}
			if (cue.kind === "event-done") {
				if (resumeWorkStatusAnim()) return;
				if (hub.anims().idle.length) card.actions.setAnim(pick(hub.anims().idle, card.animRef.current));
				card.actions.setOnce(true);
				card.actions.bumpSeq();
				return;
			}
			if (cue.kind === "turn") {
				const next = card.state.facing === "left" ? "right" : "left";
				card.actions.setFacing(next);
				card.facingRef.current = next;
				return;
			}
			if (cue.kind === "interaction-done") {
				if (resumeWorkStatusAnim()) return;
				if (hub.anims().idle.length) card.actions.setAnim(pick(hub.anims().idle, card.animRef.current));
				card.actions.setOnce(true);
				card.actions.bumpSeq();
				return;
			}
			pickNext();
		};
		/** 说一句：抽碎碎念动画并弹气泡，两者独立。 */
		const speak = (text, image, url, duration, anim) => {
			const card = hub.card;
			let name = null;
			if (anim !== false && !sleeping()) {
				const pool = hub.anims().events?.whisper;
				if (!pool || pool.length === 0) {
					console.error("[dsh-pet] 配置缺少 animations.events.whisper，无法播放碎碎念动画");
					return;
				}
				name = pickSlot(pick(pool, card.animRef.current), card.animRef.current);
			}
			log$2(hub.cfg().id, "whisper" + (name === null ? " （不联动动画）" : " -> [" + name + "]") + " 「" + text + "」");
			if (name !== null) {
				hub.stopMotion();
				card.actions.setOnce(true);
				card.actions.setAnim(name);
			}
			hub.bubbles.showWhisper(text, {
				image,
				url
			}, duration);
		};
		return {
			applyEndedCue,
			applySleep,
			pickNext,
			resumeWorkStatusAnim,
			sleepPhase,
			sleeping,
			speak
		};
	};
}

//#endregion
//#region src/client/pet/timings.ts
const BUBBLE_DURATION_MS = 10 * 1e3;
const STATE_WAIT_MS = 1e3;
const STATE_FALLBACK_MS = 1e3;

//#endregion
//#region src/client/pet/card/bubble-slots.ts
function decideBubbleSlot(input) {
	if (input.todoOn) return "todo";
	if (input.workTerminal && input.workOn && input.workText && input.workStatusEnabled) return "work-terminal";
	if (input.sayOn && input.sayText) return "say";
	if (input.workOn && input.workText && input.workStatusEnabled) return "work";
	return "none";
}
function createBubbleSlots(rt, components) {
	const { h, useState, useRef, useEffect } = rt;
	const TextBubble = components.textBubble;
	const TodoBubble = components.todoBubble;
	return function useBubbleSlots(input) {
		const [sayOn, setSayOn] = useState(false);
		const [sayText, setSayText] = useState(null);
		const sayTimerRef = useRef(null);
		const [todoOn, setTodoOn] = useState(false);
		const [workOn, setWorkOn] = useState(false);
		const [workText, setWorkText] = useState(null);
		const workTimerRef = useRef(null);
		useEffect(() => () => {
			if (sayTimerRef.current !== null) window.clearTimeout(sayTimerRef.current);
			if (workTimerRef.current !== null) window.clearTimeout(workTimerRef.current);
		}, []);
		const armSayTimeout = (duration) => {
			if (sayTimerRef.current !== null) window.clearTimeout(sayTimerRef.current);
			sayTimerRef.current = window.setTimeout(() => setSayOn(false), duration);
		};
		const showWhisper = (text, _parts, duration) => {
			if (duration === 0) return;
			setSayText(text);
			setSayOn(true);
			armSayTimeout(duration ?? BUBBLE_DURATION_MS);
		};
		const clearWhisper = () => {
			if (sayTimerRef.current !== null) window.clearTimeout(sayTimerRef.current);
			setSayOn(false);
			setSayText(null);
		};
		const armWorkTimeout = () => {
			if (workTimerRef.current !== null) window.clearTimeout(workTimerRef.current);
			workTimerRef.current = window.setTimeout(() => setWorkOn(false), BUBBLE_DURATION_MS);
		};
		const lightWork = (terminal) => {
			setWorkOn(true);
			if (terminal) armWorkTimeout();
			else if (workTimerRef.current !== null) {
				window.clearTimeout(workTimerRef.current);
				workTimerRef.current = null;
			}
		};
		const hideWork = () => setWorkOn(false);
		const resetWork = () => {
			setWorkOn(false);
			setWorkText(null);
		};
		const showTodo = () => setTodoOn(true);
		const hideTodo = () => setTodoOn(false);
		const toggleTodo = () => setTodoOn((v) => !v);
		const node = () => {
			const slot = decideBubbleSlot({
				todoOn,
				workTerminal: input.workTerminal,
				workOn,
				workText,
				workStatusEnabled: input.workStatusEnabled,
				sayOn,
				sayText
			});
			if (slot === "todo") return h(TodoBubble, {
				on: todoOn,
				onClose: hideTodo
			});
			if (slot === "say") return sayText === null ? null : h(TextBubble, {
				text: sayText,
				on: sayOn
			});
			if (slot === "work" || slot === "work-terminal") return workText === null ? null : h(TextBubble, {
				text: workText,
				on: workOn
			});
			return null;
		};
		return {
			clearWhisper,
			hideTodo,
			hideWork,
			lightWork,
			node,
			resetWork,
			showTodo,
			showWhisper,
			toggleTodo,
			updateWorkText: setWorkText
		};
	};
}

//#endregion
//#region src/client/pet/animation/cues.ts
/** 工作状态是否处在「非终态」：终态（success / error）与空闲都不续播档位动画。 */
const isWorkActive = (state) => state !== null && state !== void 0 && state !== "success" && state !== "error";
function decideEndedCue(input) {
	const { animations, current: current$1, workState } = input;
	const isEvent = isEventAnim(animations.events, current$1);
	if (isEvent && isWorkActive(workState)) {
		const nextWork = nextWorkStatusAnim(animations.events?.workStatus ?? [], current$1);
		if (nextWork !== null) return {
			kind: "work-rotate",
			anim: nextWork
		};
		if (poolIncludes(animations.events?.workStatus ?? [], current$1)) return { kind: "work-replay" };
	}
	if (isEvent) return { kind: "event-done" };
	if (animations.turn.includes(current$1)) return { kind: "turn" };
	if (animations.drag.includes(current$1) || animations.clicks.includes(current$1)) return { kind: "interaction-done" };
	return { kind: "random" };
}

//#endregion
//#region src/client/pet/animation/asset-loader.ts
function createAssetLoader(timeoutMs) {
	/** 在途请求：销毁时统一中断，否则卸载后完成的响应会创建无人回收的地址。 */
	const inflight = new Set();
	return {
		load: (url, handlers) => {
			const controller = new AbortController();
			inflight.add(controller);
			const timer = window.setTimeout(() => controller.abort(), timeoutMs);
			const settle = () => {
				window.clearTimeout(timer);
				inflight.delete(controller);
			};
			fetch(url, {
				cache: "default",
				signal: controller.signal
			}).then((response) => {
				if (!response.ok) throw new Error("asset HTTP " + response.status);
				return response.blob();
			}).then((blob) => {
				settle();
				handlers.onObjectUrl(URL.createObjectURL(blob));
			}).catch((error) => {
				settle();
				handlers.onError(error);
			});
		},
		abortAll: () => {
			for (const controller of inflight) controller.abort();
			inflight.clear();
		},
		release: (objectUrl) => {
			URL.revokeObjectURL(objectUrl);
		}
	};
}

//#endregion
//#region src/client/pet/animation/assets.ts
function animationAssetUrl(source) {
	if (source.cueUrl) return source.cueUrl;
	const root = source.assetRoot === "" ? source.id : source.assetRoot;
	return ROUTE_PATH + "/thumb/" + encodeURIComponent(root) + "/" + encodeURIComponent(source.anim) + source.ext;
}

//#endregion
//#region src/client/pet/animation/media.ts
/** 本次会话已定论的扩展名，`null` = 尚未判断。 */
let resolvedExt = null;
function prefersMov() {
	const ua = navigator.userAgent;
	if (/iPhone|iPad|iPod/i.test(ua)) return true;
	if (/Chrome|Chromium|Edg|OPR|Firefox|FxiOS/i.test(ua)) return false;
	return /Mac/i.test(navigator.platform || ua);
}
function thumbExt() {
	if (resolvedExt === null) {
		const explicit = ANIMATION_EXT;
		resolvedExt = explicit === ".mov" || prefersMov() ? ".mov" : ".webm";
	}
	return resolvedExt;
}

//#endregion
//#region src/client/pet/animation/animation.ts
/** 换源失败与打断的原因，落进回执的 `reason` 字段。 */
const REASON_ASSET_LOAD = "asset-load";
const REASON_PLAY_REJECTED = "play-rejected";
const REASON_DECODE = "decode-error";
const REASON_SUPERSEDED = "superseded";
const REASON_FROZEN = "frozen";
/** 资源超时（ms）：DSH WebServer 偶发 stalled，超时就丢弃本次换源。 */
const ASSET_FETCH_TIMEOUT_MS = 1e4;
/** 日志时间戳：与其余宠物日志同一格式，便于对照同一次事件。 */
const stamp$2 = (petId) => new Date().toTimeString().slice(0, 8) + " pet=" + petId;
function createOwnAnimation(deps) {
	/** 当前前台槽位：0 = A，1 = B。 */
	let front = 0;
	/** 挂起的换源；`null` = 没有换源在等首帧。 */
	let pending = null;
	/** 换源世代号，只增不减。 */
	let gen = 0;
	/** 待消费的点播地址，一次性取走。 */
	let cueUrl = null;
	/** 正在播的点播编号。 */
	let playing = null;
	/** 冻结标志：只挡自动来源，显式指令照常。 */
	let frozen = deps.initiallyFrozen;
	/** 两个槽位各自的 blob 地址，换源时先释放旧的。 */
	const blobUrl = {
		a: null,
		b: null
	};
	const loader = deps.loader ?? createAssetLoader(ASSET_FETCH_TIMEOUT_MS);
	/** 挂载标志：卸载后迟到的加载结果直接丢弃。 */
	let mounted = true;
	const slotOf = (index) => index === 0 ? "a" : "b";
	const elementOf = (index) => index === 0 ? deps.videoA() : deps.videoB();
	const frontVideo = () => elementOf(front);
	/** 上报并清掉「正在播」的编号；`keep` 为真时不清（同一编号继续播）。 */
	const reportOnce = (playbackId, status, reason) => {
		if (playing === playbackId) playing = null;
		deps.report(playbackId, status, reason);
	};
	const switchTo = (next, nextOnce, cuePlaybackId) => {
		if (cuePlaybackId !== null) deps.clearCuePlayback();
		const cfg = deps.cfg();
		const url = cueUrl;
		cueUrl = null;
		if (next === "") return;
		if (pending !== null && pending.anim === next && pending.once === nextOnce) {
			if (cuePlaybackId !== null) {
				playing = cuePlaybackId;
				deps.report(cuePlaybackId, "playing");
			}
			return;
		}
		if (isEventAnim(cfg.animations.events, next)) console.log("[dsh-pet] " + stamp$2(cfg.id) + " switch " + next + " once=" + nextOnce);
		const swapGen = gen += 1;
		pending = {
			anim: next,
			once: nextOnce,
			gen: swapGen
		};
		const targetIndex = front === 0 ? 1 : 0;
		const el = elementOf(targetIndex);
		if (el === null) return;
		el.loop = !nextOnce;
		el.muted = true;
		el.autoplay = true;
		el.playsInline = true;
		el.onended = nextOnce ? (event) => deps.onEnded(handleEnded(event)) : null;
		el.onerror = cuePlaybackId === null ? null : () => reportOnce(cuePlaybackId, "failed", REASON_DECODE);
		const assetUrl = animationAssetUrl({
			cueUrl: url,
			assetRoot: cfg.assetRoot ?? "",
			id: cfg.id,
			anim: next,
			ext: thumbExt()
		});
		loader.load(assetUrl, {
			onObjectUrl: (objectUrl) => {
				if (!mounted) {
					loader.release(objectUrl);
					return;
				}
				if (pending?.gen !== swapGen) {
					loader.release(objectUrl);
					return;
				}
				const slot = slotOf(targetIndex);
				const previous = blobUrl[slot];
				if (previous !== null) loader.release(previous);
				blobUrl[slot] = objectUrl;
				el.src = objectUrl;
				el.load();
			},
			onError: (error) => {
				if (!mounted) return;
				if (pending?.gen !== swapGen) return;
				pending = null;
				if (cuePlaybackId !== null) reportOnce(cuePlaybackId, "failed", REASON_ASSET_LOAD);
				console.warn("[dsh-pet] 素材加载失败 pet=" + cfg.id + " anim=" + next + "：" + (error instanceof Error ? error.message : String(error)) + "（已释放本次切换）");
			}
		});
		const onReady = () => {
			el.removeEventListener("loadeddata", onReady);
			if (pending?.gen !== swapGen) return;
			const outgoing = elementOf(front);
			el.classList.add("is-front");
			if (outgoing !== null && outgoing !== el) {
				outgoing.classList.remove("is-front");
				outgoing.onended = null;
				outgoing.onerror = null;
				outgoing.pause();
				if (playing !== null && playing !== cuePlaybackId) reportOnce(playing, "cancelled", REASON_SUPERSEDED);
			}
			front = front === 0 ? 1 : 0;
			pending = null;
			playing = cuePlaybackId;
			el.style.transform = deps.facing() === "right" ? "scaleX(-1)" : "";
			el.play().then(() => {
				if (cuePlaybackId !== null) deps.report(cuePlaybackId, "playing");
			}).catch(() => {
				if (cuePlaybackId !== null) reportOnce(cuePlaybackId, "failed", REASON_PLAY_REJECTED);
			});
			deps.onFrontReady(el);
		};
		el.addEventListener("loadeddata", onReady);
	};
	const handleEnded = (event) => {
		const endedOn = event === void 0 ? null : event.currentTarget;
		if (endedOn !== null && !endedOn.classList.contains("is-front")) return { kind: "ignore" };
		const done = playing;
		if (done !== null) {
			playing = null;
			deps.report(done, "ended");
		}
		if (deps.isDragging()) return { kind: "ignore" };
		if (frozen) return { kind: "ignore" };
		const cue = decideEndedCue({
			animations: deps.cfg().animations,
			current: deps.currentAnim(),
			workState: deps.workStatus()?.state
		});
		const petId = deps.cfg().id;
		if (cue.kind === "work-rotate") console.log("[dsh-pet] " + stamp$2(petId) + " workStatus 档内轮换: " + deps.currentAnim() + " -> " + cue.anim);
		else if (cue.kind === "work-replay") console.log("[dsh-pet] " + stamp$2(petId) + " workStatus 循环续播: " + deps.currentAnim());
		else if (cue.kind === "event-done") console.log("[dsh-pet] " + stamp$2(petId) + " 事件动画播完 ended anim=" + deps.currentAnim());
		return cue;
	};
	return {
		switchTo,
		handleEnded,
		stopLoopingFront: () => {
			const el = frontVideo();
			if (el === null) return;
			el.loop = false;
			el.onended = (event) => deps.onEnded(handleEnded(event));
		},
		setCueUrl: (url) => {
			cueUrl = url;
		},
		setFrozen: (next) => {
			if (frozen === next) return null;
			frozen = next;
			if (next) {
				frontVideo()?.pause();
				if (playing !== null) reportOnce(playing, "cancelled", REASON_FROZEN);
				return { kind: "frozen" };
			}
			return { kind: "resumed" };
		},
		isFrozen: () => frozen,
		frontVideo,
		playingPlayback: () => playing,
		dispose: () => {
			mounted = false;
			loader.abortAll();
			if (blobUrl.a !== null) loader.release(blobUrl.a);
			if (blobUrl.b !== null) loader.release(blobUrl.b);
			blobUrl.a = null;
			blobUrl.b = null;
		}
	};
}

//#endregion
//#region src/client/pose.ts
/** petId → 取当前实况的函数；PetCard 挂载时注册、卸载时摘除。 */
const readers$1 = new Map();
function registerPose(petId, read) {
	readers$1.set(petId, read);
	return () => {
		if (readers$1.get(petId) === read) readers$1.delete(petId);
	};
}
function readPose(petId) {
	if (typeof petId !== "string" || petId === "") return null;
	const read = readers$1.get(petId);
	return read === void 0 ? null : read();
}

//#endregion
//#region src/client/progress.ts
/** petId → 取当前进度的函数；PetCard 挂载时注册、卸载时摘除。 */
const readers = new Map();
function registerProgress(petId, read) {
	readers.set(petId, read);
	return () => {
		if (readers.get(petId) === read) readers.delete(petId);
	};
}
function readProgress(petId) {
	if (typeof petId !== "string" || petId === "") return null;
	const read = readers.get(petId);
	return read === void 0 ? null : read();
}

//#endregion
//#region src/client/pet/card/animation.ts
function createCardAnimation(rt) {
	const { useEffect, useRef } = rt;
	return function useCardAnimation(input) {
		const { card, cfgRef, live, petId, workStatusRef } = input;
		const ownAnimRef = useRef(null);
		ownAnimRef.current ?? (ownAnimRef.current = createOwnAnimation({
			videoA: input.videoA,
			videoB: input.videoB,
			cfg: () => cfgRef.current,
			currentAnim: () => card.animRef.current,
			workStatus: () => workStatusRef.current,
			facing: () => card.facingRef.current,
			report: input.report,
			clearCuePlayback: () => input.setCuePlayback(null),
			onFrontReady: (el) => {
				if (live.current.walk.hasPending()) live.current.walk.start(el);
			},
			onEnded: (cue) => live.current.flow?.applyEndedCue(cue),
			isDragging: () => live.current.drag.isActive(),
			initiallyFrozen: input.lock?.locked === true && input.lock.expiresAt > Date.now()
		}));
		const ownAnim = ownAnimRef.current;
		live.current.ownAnim = ownAnim;
		const { anim, cuePlayback, once, seq } = card.state;
		useEffect(() => {
			ownAnim.switchTo(anim, once, cuePlayback);
		}, [
			anim,
			once,
			seq,
			cuePlayback
		]);
		useEffect(() => {
			const services = live.current;
			const onResize = () => card.actions.setCustomPos((prev) => {
				if (!prev) return prev;
				const { size } = cfgRef.current;
				const { halfW, halfH, bottomPad } = derivePetMetrics(size);
				const viewport = {
					width: window.innerWidth,
					height: window.innerHeight
				};
				const half = {
					w: halfW,
					h: halfH
				};
				const box = centerToBox(prev, viewport, half);
				return { ...boxToRatio(clampReachableBox(box, viewport, {
					size,
					bottomPad
				}), viewport, half) };
			});
			window.addEventListener("resize", onResize);
			const unregisterPose = registerPose(petId, () => {
				const center = live.current.center();
				return {
					x: center.x / window.innerWidth,
					y: center.y / window.innerHeight,
					facing: card.facingRef.current
				};
			});
			const unregisterProgress = registerProgress(petId, () => {
				const el = ownAnim.frontVideo();
				const playbackId = ownAnim.playingPlayback();
				const anim$1 = card.animRef.current;
				if (el === null) return {
					playbackId,
					anim: anim$1,
					currentTime: 0,
					duration: 0,
					paused: true,
					buffering: false
				};
				const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
				return {
					playbackId,
					anim: anim$1,
					currentTime: el.currentTime,
					duration,
					paused: el.paused,
					buffering: el.readyState < 3 || el.seeking
				};
			});
			return () => {
				window.removeEventListener("resize", onResize);
				unregisterPose();
				unregisterProgress();
				ownAnim.dispose();
				services.stopMove();
				services.drag.stopFollow();
			};
		}, []);
		return ownAnim;
	};
}

//#endregion
//#region src/shared/score.ts
const SCORE_MIN_SPEED = 400;
/** 每 100 px/s 记 1 分（基准尺寸 462px 下）。 */
const SCORE_SPEED_PER_POINT = 100;
const clickScore = (speed, size) => {
	if (speed <= 0 || size <= 0) return 0;
	return Math.max(1, Math.round(speed / SCORE_SPEED_PER_POINT * (PET_REF_WIDTH / size)));
};

//#endregion
//#region src/shared/score-popup.ts
const SCORE_POPUP_DURATION_MS = 2200;
const SCORE_POPUP_CSS = [
	".dsh-pet-score{position:fixed;z-index:2147483002;min-width:120px;text-align:center;",
	"background:rgba(255,255,255,.97);border:1px solid rgba(255,179,0,.35);border-radius:12px;",
	"box-shadow:0 10px 32px rgba(0,0,0,.22);padding:8px 16px 9px;user-select:none;pointer-events:auto;",
	"font-family:var(--dsh-pet-font-family,'ShangshouSoftCandy','Yuanti SC','YouYuan','幼圆','Comic Sans MS','PingFang SC','Microsoft YaHei',sans-serif);}",
	".dsh-pet-score.is-in{animation:dshPetScorePop .28s ease}",
	".dsh-pet-score-val{font-size:22px;line-height:1.25;font-weight:700;color:#ff8f00;font-variant-numeric:tabular-nums}",
	".dsh-pet-score-sub{font-size:11px;line-height:1.4;color:rgba(43,43,43,.6);margin-top:2px;white-space:nowrap}",
	".dsh-pet-score-burst{position:fixed;inset:0;pointer-events:none;z-index:2147483002}",
	".dsh-pet-score-particle{position:absolute;border-radius:50%;pointer-events:none}",
	"@keyframes dshPetScorePop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}"
].join("");
/** 样式只注入一次（同 CHAT_CSS 的注入模式）。 */
let scoreCssInjected = false;
function injectScoreCss() {
	if (scoreCssInjected || typeof document === "undefined") return;
	scoreCssInjected = true;
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-pet";
	tag.dataset.pluginCss = "dsh-pet/score";
	tag.textContent = SCORE_POPUP_CSS;
	document.head.appendChild(tag);
}
/** 粒子数量。 */
const BURST_COUNT = 20;
/** 初速范围（px/s）。 */
const BURST_SPEED_MIN = 120;
const BURST_SPEED_MAX = 460;
/** 重力（px/s²）：粒子向上喷出后回落。 */
const BURST_GRAVITY = 700;
/** 单粒子寿命范围（ms）。 */
const BURST_LIFE_MIN = 500;
const BURST_LIFE_MAX = 900;
/** 粒子半径范围（px）。 */
const BURST_RADIUS_MIN = 3;
const BURST_RADIUS_MAX = 7;
/** 暖色盘（积分与庆祝感）。 */
const BURST_COLORS = [
	"#ffb300",
	"#ff8f00",
	"#ff7043",
	"#f4511e",
	"#ffc400",
	"#ffd54f",
	"#ef5350"
];
function spawnScoreBurst(x, y) {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	injectScoreCss();
	const root = document.createElement("div");
	root.className = "dsh-pet-score-burst";
	document.body.appendChild(root);
	const parts = [];
	for (let i = 0; i < BURST_COUNT; i++) {
		const angle = Math.random() * Math.PI * 2;
		const speed = BURST_SPEED_MIN + Math.random() * (BURST_SPEED_MAX - BURST_SPEED_MIN);
		const r = BURST_RADIUS_MIN + Math.random() * (BURST_RADIUS_MAX - BURST_RADIUS_MIN);
		const el = document.createElement("div");
		el.className = "dsh-pet-score-particle";
		el.style.left = x + "px";
		el.style.top = y + "px";
		el.style.width = r * 2 + "px";
		el.style.height = r * 2 + "px";
		el.style.background = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
		root.appendChild(el);
		parts.push({
			el,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 80,
			t0: performance.now(),
			life: BURST_LIFE_MIN + Math.random() * (BURST_LIFE_MAX - BURST_LIFE_MIN)
		});
	}
	const step = () => {
		const now = performance.now();
		let alive = false;
		for (const p of parts) {
			const tSec = (now - p.t0) / 1e3;
			const lifeRatio = (now - p.t0) / p.life;
			if (lifeRatio >= 1) continue;
			alive = true;
			p.el.style.transform = "translate(" + p.vx * tSec + "px," + (p.vy * tSec + .5 * BURST_GRAVITY * tSec * tSec) + "px)";
			p.el.style.opacity = String(Math.max(0, 1 - lifeRatio));
		}
		if (alive) requestAnimationFrame(step);
		else root.remove();
	};
	requestAnimationFrame(step);
}
function mountScorePopup(opts) {
	injectScoreCss();
	const x = opts.x;
	const y = opts.y;
	const root = document.createElement("div");
	root.className = "dsh-pet-score";
	const val = document.createElement("div");
	val.className = "dsh-pet-score-val";
	val.textContent = "+" + opts.score;
	const sub = document.createElement("div");
	sub.className = "dsh-pet-score-sub";
	sub.textContent = "速度 " + Math.round(opts.speed) + " · 大小 " + Math.round(opts.size);
	root.appendChild(val);
	root.appendChild(sub);
	document.body.appendChild(root);
	const rr = root.getBoundingClientRect();
	root.style.left = Math.max(4, Math.min(x - rr.width / 2, window.innerWidth - rr.width - 4)) + "px";
	root.style.top = Math.max(4, y - rr.height - 14) + "px";
	root.offsetWidth;
	root.classList.add("is-in");
	let closed = false;
	let timer = null;
	const close = () => {
		if (closed) return;
		closed = true;
		if (timer !== null) window.clearTimeout(timer);
		timer = null;
		document.removeEventListener("mousedown", onDocPointerDown, true);
		document.removeEventListener("keydown", onDocKeyDown, true);
		root.remove();
		if (opts.onClose) opts.onClose();
	};
	const mountedAt = performance.now();
	let graceConsumed = false;
	const onDocPointerDown = (e) => {
		if (closed) return;
		if (!graceConsumed) {
			graceConsumed = true;
			if (e.timeStamp - mountedAt < 300) return;
		}
		if (root.contains(e.target)) return;
		close();
	};
	const onDocKeyDown = (e) => {
		if (closed) return;
		if (e.key === "Escape") close();
	};
	document.addEventListener("mousedown", onDocPointerDown, true);
	document.addEventListener("keydown", onDocKeyDown, true);
	timer = window.setTimeout(close, SCORE_POPUP_DURATION_MS);
	return {
		el: root,
		close
	};
}

//#endregion
//#region src/client/pet/motion/drag-follow.ts
function createDragFollow(deps) {
	/** 在跑的 rAF；`null` = 没在追。 */
	let frame = null;
	/** 世代号：起跑或停下 +1，迟到的帧据此自弃。 */
	let token = 0;
	/** 追赶目标；`null` = 没有目标。 */
	let target = null;
	/** 上一帧的速度（px/s），跨帧累积出过阻尼手感。 */
	let velocity = {
		vx: 0,
		vy: 0
	};
	/** 上一帧的时刻（ms）。 */
	let last = 0;
	const stop = () => {
		token++;
		if (frame !== null) {
			cancelAnimationFrame(frame);
			frame = null;
		}
		target = null;
		velocity = {
			vx: 0,
			vy: 0
		};
	};
	const aim = (next) => {
		target = next;
	};
	const start = (rootEl) => {
		if (frame !== null) return;
		const current$1 = deps.card();
		const spring = current$1.physics.throwPower;
		const own = ++token;
		last = performance.now();
		const step = () => {
			if (token !== own) return;
			const goal = target;
			if (!goal) {
				frame = null;
				return;
			}
			const now = performance.now();
			const dt = Math.min((now - last) / 1e3, 1 / 30);
			last = now;
			const box = current$1.box() ?? {
				x: 0,
				y: 0
			};
			let x = box.x;
			let y = box.y;
			velocity.vx = springStep(velocity.vx, x, goal.x, dt, spring);
			velocity.vy = springStep(velocity.vy, y, goal.y, dt, spring);
			x += velocity.vx * dt;
			y += velocity.vy * dt;
			current$1.setBox({
				x,
				y
			});
			rootEl.style.left = x + "px";
			rootEl.style.top = y + "px";
			rootEl.style.right = "auto";
			rootEl.style.bottom = "auto";
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
	};
	return {
		aim,
		start,
		stop
	};
}

//#endregion
//#region src/client/pet/motion/touch-press.ts
/**
* 触屏长按：按住到一定时长把这次按压当右键，计时期间手指移动超过容差就取消。
* 不负责右键菜单本身，也不碰拖拽与点击判定——到点只回调，派发交给调用方。
* 鼠标与笔不走这条分支，起表前先按指针类型挡掉。
* 不变量：同一时刻只有一个计时器；到点时按压若已结束，回调自弃。
* @module dsh-pet/src/client/pet/motion/touch-press
*/
/** 触屏长按多久算右键（ms）。 */
const LONG_PRESS_MS = 500;
/** 计时期间手指移动超过这个距离就取消（px）。 */
const SLOP_PX = 8;
function createTouchPress(deps) {
	/** 待触发的计时器；`null` = 没有在等。 */
	let timer = null;
	/** 本次按下的现场，到点时交给回调。 */
	let pending = null;
	const cancel = () => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
		pending = null;
	};
	const arm = (target) => {
		cancel();
		if (target.pointerType === "mouse" || target.pointerType === "pen") return;
		pending = target;
		timer = setTimeout(() => {
			timer = null;
			const current$1 = pending;
			pending = null;
			if (current$1 === null || !deps.stillHolding()) return;
			deps.onMenu(current$1);
		}, LONG_PRESS_MS);
	};
	const move = (distancePx) => {
		if (timer === null) return;
		if (distancePx > SLOP_PX) cancel();
	};
	return {
		arm,
		cancel,
		isArmed: () => timer !== null,
		move
	};
}

//#endregion
//#region src/client/pet/motion/drag.ts
/** 复位的按下状态：避免每个实例各写一份字面量。 */
const IDLE_PRESS = {
	active: false,
	dragging: false,
	sx: 0,
	sy: 0,
	offX: 0,
	offY: 0,
	sling: false,
	anchorX: 0,
	anchorY: 0
};
/** 松手后这段时间内的指针事件视为同一次拖拽的尾巴（ms）。 */
const JUST_DRAGGED_MS = 100;
/** 日志行的时刻前缀。 */
const stamp$1 = () => new Date().toTimeString().slice(0, 8);
/** 一行带时刻与宠物 id 的日志：客户端统一前缀，便于按宠物 grep。 */
const log$1 = (petId, message) => {
	console.log("[dsh-pet] " + stamp$1() + " pet=" + petId + " " + message);
};
/**
* 抓取瞬间记一行速度，手速够快就打分。
*
* @param current - 当帧能力。
* @param x - 指针横坐标（px），分数从这里弹出。
* @param y - 指针纵坐标（px）。
* @returns 是否打过分；调用方据此让随后的 click 不再播普通点击动画。
*/
function noteGrab(current$1, x, y) {
	const grab = current$1.grabVelocity();
	const speed = grab ? Math.hypot(grab.vx, grab.vy) : 0;
	log$1(current$1.petId, "grab vx=" + (grab ? Math.round(grab.vx) : 0) + " vy=" + (grab ? Math.round(grab.vy) : 0) + " |v|=" + Math.round(speed));
	if (speed < SCORE_MIN_SPEED) return false;
	const score = clickScore(speed, current$1.size);
	log$1(current$1.petId, "click-score speed=" + Math.round(speed) + " size=" + current$1.size + " -> +" + score);
	spawnScoreBurst(x, y);
	mountScorePopup({
		x,
		y,
		score,
		speed,
		size: current$1.size
	});
	return true;
}
function createDrag(card) {
	let press = { ...IDLE_PRESS };
	/** 「刚拖完」窗口的截止时刻（ms）；用时刻而不是定时器，读的时候再判，少一个待清理的句柄。 */
	let justDraggedUntil = 0;
	let pressScoreFired = false;
	let lastPressAt = 0;
	const follow = createDragFollow({ card });
	let mousePressHit = null;
	/** 捕获丢失后的松手：坐标来自 mouseup，落点判定与正常松开完全一致。 */
	function onWindowMouseUp(e) {
		const hit = mousePressHit;
		if (!hit || e.button !== 0 || e.buttons !== 0) return;
		endPress(card(), {
			x: e.clientX,
			y: e.clientY,
			hit
		});
	}
	/** 鼠标按下时登记命中区并挂兜底；node 里的测试没有 window，替身自己提供。 */
	const armMouseFallback = (hit) => {
		mousePressHit = hit;
		if (typeof window !== "undefined") window.addEventListener("mouseup", onWindowMouseUp, true);
	};
	const clearMouseFallback = () => {
		mousePressHit = null;
		if (typeof window !== "undefined") window.removeEventListener("mouseup", onWindowMouseUp, true);
	};
	/** 触屏长按：计时与容差在 motion/touch-press.ts，到点后把这次按压当右键。 */
	const touchPress = createTouchPress({
		onMenu: (target) => {
			press.active = false;
			pressScoreFired = true;
			if (target.el.hasPointerCapture(target.pointerId)) target.el.releasePointerCapture(target.pointerId);
			log$1(card().petId, "-> [TOUCH-MENU]");
			target.el.dispatchEvent(new MouseEvent("contextmenu", {
				bubbles: true,
				button: 2,
				cancelable: true,
				clientX: target.x,
				clientY: target.y,
				view: window
			}));
		},
		stillHolding: () => press.active && !press.dragging
	});
	/**
	* 记下这次按下的几何与弹弓判定。
	*
	* @param c - 当帧能力。
	* @param e - 按下事件。
	* @returns 新的按下状态。
	*/
	const beginPress = (c, e) => {
		e.currentTarget.classList.add("dragging");
		e.currentTarget.setPointerCapture(e.pointerId);
		c.setTipOn(false);
		const rootEl = c.root();
		let offX = 0;
		let offY = 0;
		if (rootEl) {
			const rr = rootEl.getBoundingClientRect();
			offX = e.clientX - (rr.left + rr.width / 2);
			offY = e.clientY - (rr.top + rr.height / 2);
			c.setBox({
				x: rr.left,
				y: rr.top
			});
		}
		const pressNow = performance.now();
		const sling = pressNow - lastPressAt < SLINGSHOT_DOUBLE_MS;
		lastPressAt = sling ? 0 : pressNow;
		const anchor = c.box();
		return {
			active: true,
			anchorX: anchor ? anchor.x + c.halfW : e.clientX,
			anchorY: anchor ? anchor.y + c.halfH : e.clientY,
			dragging: false,
			offX,
			offY,
			sling,
			sx: e.clientX,
			sy: e.clientY
		};
	};
	const onPointerDown = (e) => {
		const c = card();
		if (e.button !== 0) return;
		if (c.isFrozen()) c.releaseLock();
		pressScoreFired = noteGrab(c, e.clientX, e.clientY);
		c.stopFlight();
		follow.stop();
		c.stopAutonomy();
		press = beginPress(c, e);
		clearMouseFallback();
		if (e.pointerType === "mouse") armMouseFallback(e.currentTarget);
		touchPress.arm({
			el: e.currentTarget,
			pointerId: e.pointerId,
			pointerType: e.pointerType,
			x: e.clientX,
			y: e.clientY
		});
	};
	const onPointerMove = (e) => {
		const c = card();
		if (c.tipOn()) c.placeTip(e.clientX, e.clientY);
		if (!press.active) return;
		const dx = e.clientX - press.sx;
		const dy = e.clientY - press.sy;
		touchPress.move(Math.hypot(dx, dy));
		if (!press.dragging) {
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
			press.dragging = true;
			c.setDragging(true);
			c.setOnce(true);
			if (c.dragAnims.length) {
				const name = pick(c.dragAnims);
				log$1(c.petId, "-> [DRAG] " + name);
				c.playAnim(name);
			}
		}
		follow.aim({
			x: e.clientX - press.offX - c.halfW,
			y: e.clientY - press.offY - c.halfH
		});
		const rootEl = c.root();
		if (rootEl) follow.start(rootEl);
		const stageEl = c.stage();
		if (stageEl) stageEl.style.transform = "none";
	};
	/**
	* 松手结算：原地放下、甩抛或弹弓。
	*
	* @param c - 当帧能力。
	* @param point - 松手现场；指针没跟上时用它的坐标兜底算落点。
	*/
	const settleRelease = (c, point) => {
		const current$1 = c.box();
		c.commitPlace(current$1 ?? {
			x: point.x - press.offX - c.halfW,
			y: point.y - press.offY - c.halfH
		});
	};
	/**
	* 松手后把提示摆回光标处并点亮；指针已移出命中区时保持收起。
	*
	* @param c - 当帧能力。
	* @param point - 松手现场。
	*/
	const restoreTip = (c, point) => {
		const hitRect = point.hit.getBoundingClientRect();
		const inside = point.x >= hitRect.left && point.x <= hitRect.right && point.y >= hitRect.top && point.y <= hitRect.bottom;
		if (!inside) return;
		c.placeTip(point.x, point.y);
		c.setTipOn(true);
	};
	/**
	* 松手收尾的唯一路径：复位按下态、摘拖拽类、结算去向并把提示摆回去。
	*
	* @param c - 当帧能力。
	* @param point - 松手现场；正常 pointerup 与捕获丢失后的 window mouseup 都折算成它。
	*/
	const endPress = (c, point) => {
		clearMouseFallback();
		touchPress.cancel();
		const wasDragging = press.dragging;
		press.active = false;
		press.dragging = false;
		point.hit.classList.remove("dragging");
		follow.stop();
		if (wasDragging) {
			justDraggedUntil = performance.now() + JUST_DRAGGED_MS;
			c.setDragging(false);
			const stageEl = c.stage();
			if (stageEl) stageEl.style.transform = "translateY(" + c.bottomPad + "px)";
			if (!c.resumeWork()) {
				if (c.idleAnims.length) c.playAnim(pick(c.idleAnims, c.currentAnim));
				c.setOnce(true);
			}
			settleRelease(c, point);
		}
		restoreTip(c, point);
	};
	const onPointerUp = (e) => {
		endPress(card(), {
			x: e.clientX,
			y: e.clientY,
			hit: e.currentTarget
		});
	};
	const onClick = () => {
		const c = card();
		if (press.active || press.dragging || performance.now() < justDraggedUntil) return;
		if (pressScoreFired) {
			pressScoreFired = false;
			c.stopFlight();
			c.stopAutonomy();
			return;
		}
		c.stopFlight();
		c.stopAutonomy();
		c.playClickSound();
		c.setOnce(true);
		if (!c.clickAnims.length) return;
		const name = pick(c.clickAnims);
		log$1(c.petId, "-> [CLICK] " + name);
		c.markSquash();
		c.bumpSeq();
		c.playAnim(name);
	};
	return {
		isActive: () => press.active,
		justDragged: () => performance.now() < justDraggedUntil,
		onClick,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		stopFollow: follow.stop,
		dispose: clearMouseFallback
	};
}

//#endregion
//#region src/client/pet/card/drag.ts
function createCardDrag(rt) {
	const { useRef, useEffect } = rt;
	return function useCardDrag(input) {
		const { bumpSeq, card, cfgRef, live, motion, root, setAnim, setCustomPos, setDragging } = input;
		const { setOnce, setTipOn, stage } = input;
		const dragCard = () => {
			const metrics = motion.metrics();
			return {
				petId: cfgRef.current.id,
				size: metrics.size,
				halfW: metrics.halfW,
				halfH: metrics.halfH,
				bottomPad: metrics.bottomPad,
				physics: cfgRef.current.physics,
				dragAnims: live.current.flow?.sleeping() ?? false ? [] : cfgRef.current.animations.drag,
				clickAnims: cfgRef.current.animations.clicks,
				idleAnims: live.current.flow?.sleeping() ?? false ? [] : cfgRef.current.animations.idle,
				currentAnim: card.animRef.current,
				setOnce: (on) => setOnce(on),
				playAnim: (name) => setAnim(name),
				bumpSeq: () => bumpSeq(),
				markSquash: () => {},
				setDragging,
				resumeWork: () => live.current.flow?.resumeWorkStatusAnim() ?? false,
				stopAutonomy: () => motion.stopMove(),
				stopFlight: () => {},
				startFlight: () => {},
				isFrozen: () => live.current.ownAnim.isFrozen(),
				releaseLock: () => live.current.releaseLock(),
				grabVelocity: () => null,
				playClickSound: () => playClickSound(),
				tipOn: () => live.current.tipOn(),
				placeTip: (x, y) => live.current.placeTip(x, y),
				setTipOn,
				stage,
				root,
				box: () => motion.box(),
				setBox: (box) => motion.setBox(box),
				commitPlace: (box) => {
					const metrics$1 = motion.metrics();
					const viewport = {
						width: window.innerWidth,
						height: window.innerHeight
					};
					const half = {
						w: metrics$1.halfW,
						h: metrics$1.halfH
					};
					const reached = clampReachableBox(box, viewport, metrics$1);
					const rootEl = root();
					if (rootEl) {
						rootEl.style.left = reached.x + "px";
						rootEl.style.top = reached.y + "px";
						rootEl.style.right = "auto";
						rootEl.style.bottom = "auto";
					}
					motion.setBox(reached);
					setCustomPos(boxToRatio(reached, viewport, half));
				}
			};
		};
		const dragRef = useRef(null);
		dragRef.current ?? (dragRef.current = createDrag(dragCard));
		const drag = dragRef.current;
		useEffect(() => () => drag.dispose(), [drag]);
		live.current.drag = drag;
		return drag;
	};
}

//#endregion
//#region src/client/pet/card/entry.ts
function createCardEntry(rt) {
	const { useEffect, useRef } = rt;
	return function useCardEntry(input) {
		const { card, cfgRef, drag, live, menuItemsRef, motion, runMenuAction, showTodo, tipRef, toggleTodo } = input;
		const menuRef = useRef(null);
		const placeTip = (clientX, clientY) => {
			const tipEl = tipRef.current;
			if (!tipEl) return;
			const viewport = document.documentElement;
			const p = tooltipPlacement({
				x: clientX,
				y: clientY
			}, {
				w: tipEl.offsetWidth,
				h: tipEl.offsetHeight
			}, {
				x: 0,
				y: 0,
				w: viewport.clientWidth,
				h: viewport.clientHeight
			}, motion.metrics().size * TOOLTIP_GAP_RATIO);
			tipEl.style.left = p.x + "px";
			tipEl.style.top = p.y + "px";
		};
		useEffect(() => () => {
			if (menuRef.current) {
				menuRef.current.close();
				menuRef.current = null;
			}
		}, []);
		const openTodo = () => showTodo();
		const hoverRef = useRef(false);
		const toggleTodoRef = useRef(toggleTodo);
		toggleTodoRef.current = toggleTodo;
		const toggleSleepRef = useRef(() => {});
		toggleSleepRef.current = () => {
			const asleep = live.current.flow?.sleeping() ?? false;
			runMenuAction(asleep ? {
				label: "起来",
				action: "wake"
			} : {
				label: "睡觉",
				action: "sleep"
			});
		};
		const switchDisplayRef = useRef(() => {});
		switchDisplayRef.current = (display) => {
			runMenuAction({
				label: "显示位置",
				action: "set-display",
				display
			});
		};
		useEffect(() => {
			const onKeyDown = (e) => {
				if (!hoverRef.current) return;
				const display = displayOfHotkey(e);
				if (display !== void 0) {
					e.preventDefault();
					switchDisplayRef.current(display);
					return;
				}
				if (isSleepHotkey(e)) {
					e.preventDefault();
					toggleSleepRef.current();
					return;
				}
				if (!isTodoHotkey(e)) return;
				e.preventDefault();
				toggleTodoRef.current();
			};
			document.addEventListener("keydown", onKeyDown, true);
			return () => document.removeEventListener("keydown", onKeyDown, true);
		}, []);
		live.current.placeTip = placeTip;
		live.current.tipOn = () => card.state.tipOn;
		const handleContextMenu = (e) => {
			const more = buildMoreBranch(menuItemsRef.current);
			const asleep = live.current.flow?.sleeping() ?? false;
			const canSleep = (cfgRef.current.animations.sleep ?? []).length > 0;
			const sleepItem = asleep ? {
				label: "起来",
				action: "wake",
				hint: SLEEP_HOTKEY_HINT
			} : {
				label: "睡觉",
				action: "sleep",
				hint: SLEEP_HOTKEY_HINT
			};
			const tools = [{
				label: "待办事项",
				action: "todo",
				hint: TODO_HOTKEY_HINT
			}, ...canSleep ? [sleepItem] : []];
			const tail = [displayMenuBranch(), {
				label: "回到初始位置",
				action: "home"
			}];
			const tree = [
				...tools,
				...buildMenuTree(cfgRef.current.animations),
				...tail,
				...more ? [more] : []
			];
			if (!tree.length) return;
			e.preventDefault();
			e.stopPropagation();
			if (drag.isActive() || drag.justDragged()) return;
			motion.stopMove();
			if (menuRef.current) menuRef.current.close();
			menuRef.current = mountContextMenu({
				tree,
				x: e.clientX,
				y: e.clientY,
				onAction: runMenuAction,
				onClose: () => {
					if (menuRef.current) menuRef.current = null;
				}
			});
		};
		return {
			handleContextMenu,
			onPointerEnter: (e) => {
				hoverRef.current = true;
				placeTip(e.clientX, e.clientY);
				card.actions.setTipOn(true);
			},
			onPointerLeave: () => {
				hoverRef.current = false;
				card.actions.setTipOn(false);
			},
			openTodo,
			placeTip
		};
	};
}

//#endregion
//#region src/client/pet/motion/position-follow.ts
function createPositionFollow(deps) {
	/** 进行中的 rAF；`null` = 没有跟随在跑。 */
	let frame = null;
	/** 世代号：每次开始或停止 +1，迟到的帧据此自弃。 */
	let token = 0;
	const stop = () => {
		token += 1;
		if (frame !== null) {
			cancelAnimationFrame(frame);
			frame = null;
		}
	};
	/** 写包围盒与四个 style，弹簧和直线两条路共用。 */
	const paint = (el, x, y) => {
		deps.setBox({
			x,
			y
		});
		el.style.left = x + "px";
		el.style.top = y + "px";
		el.style.right = "auto";
		el.style.bottom = "auto";
	};
	const apply = (rx, ry, mode, duration) => {
		if (deps.isDragging()) return;
		deps.takeOver();
		const target = centerToBox({
			rx,
			ry
		}, deps.viewport(), deps.half());
		const el = deps.root();
		if (!el || mode === "instant" || mode === "line" && duration <= 0) {
			deps.setBox(target);
			deps.commit({
				rx,
				ry
			});
			return;
		}
		const current$1 = token + 1;
		token = current$1;
		if (frame !== null) cancelAnimationFrame(frame);
		if (mode === "line") {
			if (duration <= 0) return;
			const from = deps.box() ?? target;
			const t0 = performance.now();
			const step$1 = () => {
				if (token !== current$1) return;
				const p = Math.min((performance.now() - t0) / duration, 1);
				if (p >= 1) {
					paint(el, target.x, target.y);
					frame = null;
					deps.commit({
						rx,
						ry
					});
					return;
				}
				paint(el, from.x + (target.x - from.x) * p, from.y + (target.y - from.y) * p);
				frame = requestAnimationFrame(step$1);
			};
			frame = requestAnimationFrame(step$1);
			return;
		}
		let last = performance.now();
		const vel = {
			vx: 0,
			vy: 0
		};
		const step = () => {
			if (token !== current$1) return;
			const now = performance.now();
			const dt = Math.min((now - last) / 1e3, 1 / 30);
			last = now;
			let x = deps.box()?.x ?? target.x;
			let y = deps.box()?.y ?? target.y;
			vel.vx = springStep(vel.vx, x, target.x, dt, deps.spring());
			vel.vy = springStep(vel.vy, y, target.y, dt, deps.spring());
			x += vel.vx * dt;
			y += vel.vy * dt;
			paint(el, x, y);
			if (Math.abs(target.x - x) < .5 && Math.abs(target.y - y) < .5 && Math.abs(vel.vx) < 1 && Math.abs(vel.vy) < 1) {
				paint(el, target.x, target.y);
				frame = null;
				deps.commit({
					rx,
					ry
				});
				return;
			}
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
	};
	return {
		apply,
		stop
	};
}

//#endregion
//#region src/shared/motion.ts
const planMove = (o) => {
	const side = o.sideAllow ?? 0;
	const distance = randomBetween(o.minDist, o.maxDist);
	const target = o.cx + o.dir * distance;
	if (o.areas && o.areas.length > 0) {
		const bodyHalf = o.halfW - side;
		if (!rectAtPoint(o.areas, target - bodyHalf - o.margin, o.cy)) return null;
		if (!rectAtPoint(o.areas, target + bodyHalf + o.margin, o.cy)) return null;
	} else {
		const leftBound = o.margin + o.halfW - side;
		const rightBound = o.W - o.margin - o.halfW + side;
		if (target < leftBound || target > rightBound) return null;
	}
	return {
		startRatio: o.cx / o.W,
		startYRatio: o.cy / o.H,
		targetRatio: target / o.W,
		totalRatio: Math.abs(target - o.cx) / o.W
	};
};

//#endregion
//#region src/client/pet/motion/move-action.ts
function planMoveAction(input) {
	const actions = input.moves.actions;
	if (actions.length === 0) return null;
	const random = input.random ?? Math.random;
	const chosen = input.preferredName ? actions.find((action) => action.name === input.preferredName) ?? null : actions[Math.floor(random() * actions.length)];
	if (!chosen) return null;
	const params = Object.assign({}, input.moves.default, chosen.params ?? {});
	const dir = input.facing === "right" ? 1 : -1;
	const distScale = input.size / PET_REF_WIDTH;
	const plan = planMove({
		cx: input.center.x,
		cy: input.center.y,
		W: input.viewport.width,
		H: input.viewport.height,
		dir,
		minDist: params.minDist * distScale,
		maxDist: params.maxDist * distScale,
		margin: params.margin,
		halfW: input.halfW,
		sideAllow: input.sideAllow
	});
	if (plan === null) return null;
	return {
		anim: chosen.name,
		pending: {
			...plan,
			dir,
			leadSec: params.leadSec,
			tailSec: params.tailSec
		}
	};
}

//#endregion
//#region src/client/pet/motion/walk.ts
/** 元数据未就绪时的兜底时长（秒）：取内置走路素材的常见时长，避免除零。 */
const FALLBACK_DURATION_SEC = 10.09;
function createWalk(deps) {
	/** 在跑的 rAF；`null` = 没在走。 */
	let frame = null;
	/** 世代号：开跑或停走 +1，迟到的帧据此自弃。 */
	let token = 0;
	/** 已规划、等待视频就绪的走位。 */
	let pending = null;
	const hasPending = () => pending !== null;
	const start = (el) => {
		if (pending === null || frame !== null) return;
		const move = pending;
		pending = null;
		const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : FALLBACK_DURATION_SEC;
		const travelWindow = Math.max(.1, duration - move.leadSec - move.tailSec);
		const own = ++token;
		const step = () => {
			if (token !== own) return;
			const t = el.currentTime || 0;
			const { halfW, halfH } = deps.metrics();
			const { width: W, height: H } = deps.viewport();
			let ratioX;
			if (t <= move.leadSec) ratioX = move.startRatio;
			else if (t >= duration - move.tailSec) ratioX = move.targetRatio;
			else ratioX = move.startRatio + (move.targetRatio - move.startRatio) * ((t - move.leadSec) / travelWindow);
			const box = {
				x: ratioX * W - halfW,
				y: move.startYRatio * H - halfH
			};
			const rootEl = deps.root();
			if (rootEl) {
				rootEl.style.left = box.x + "px";
				rootEl.style.top = box.y + "px";
				rootEl.style.right = "auto";
				rootEl.style.bottom = "auto";
			}
			deps.setBox(box);
			if (t < duration - move.tailSec) frame = requestAnimationFrame(step);
			else {
				frame = null;
				deps.commit({
					rx: move.targetRatio,
					ry: move.startYRatio
				});
			}
		};
		frame = requestAnimationFrame(step);
	};
	const tryMove = (preferredName) => {
		if (frame !== null || pending !== null || deps.isFlying()) return true;
		const metrics = deps.metrics();
		const action = planMoveAction({
			moves: deps.moves(),
			preferredName,
			facing: deps.facing(),
			size: metrics.size,
			center: deps.center(),
			viewport: deps.viewport(),
			halfW: metrics.halfW,
			sideAllow: metrics.sideAllow
		});
		if (action === null) return false;
		pending = action.pending;
		deps.play(action.anim);
		return action.anim;
	};
	const stop = () => {
		pending = null;
		token++;
		if (frame !== null) {
			cancelAnimationFrame(frame);
			frame = null;
		}
	};
	return {
		hasPending,
		start,
		stop,
		tryMove
	};
}

//#endregion
//#region src/client/pet/card/motion.ts
function createCardMotion(rt) {
	const { useRef } = rt;
	return function useCardMotion(input) {
		const { card, cfgRef, live, metrics, moves, root, setAnim, setOnce, setCustomPos } = input;
		const motionRef = useRef(metrics);
		motionRef.current = metrics;
		const movesRef = useRef(moves);
		movesRef.current = moves;
		const boxRef = useRef(null);
		const currentCenterX = () => {
			const cp = card.customPosRef.current;
			if (cp) return cp.rx * window.innerWidth;
			const rootEl = root();
			if (rootEl) return rootEl.getBoundingClientRect().left + motionRef.current.halfW;
			return window.innerWidth - 24 - motionRef.current.halfW;
		};
		const currentCenterY = () => {
			const cp = card.customPosRef.current;
			if (cp) return cp.ry * window.innerHeight;
			const rootEl = root();
			if (rootEl) return rootEl.getBoundingClientRect().top + motionRef.current.halfH;
			return window.innerHeight - 20 - motionRef.current.halfH;
		};
		const posFollowRef = useRef(null);
		posFollowRef.current ?? (posFollowRef.current = createPositionFollow({
			root,
			box: () => boxRef.current,
			setBox: (box) => {
				boxRef.current = box;
			},
			commit: setCustomPos,
			viewport: () => ({
				width: window.innerWidth,
				height: window.innerHeight
			}),
			half: () => ({
				w: motionRef.current.halfW,
				h: motionRef.current.halfH
			}),
			spring: () => cfgRef.current.physics.throwPower,
			isDragging: () => live.current.drag.isActive(),
			takeOver: () => {
				walkRef.current?.stop();
				posFollowRef.current?.stop();
			}
		}));
		const posFollow = posFollowRef.current;
		const walkRef = useRef(null);
		walkRef.current ?? (walkRef.current = createWalk({
			root,
			center: () => ({
				x: currentCenterX(),
				y: currentCenterY()
			}),
			metrics: () => motionRef.current,
			moves: () => movesRef.current,
			facing: () => card.facingRef.current,
			viewport: () => ({
				width: window.innerWidth,
				height: window.innerHeight
			}),
			isFlying: () => false,
			play: (name) => {
				setOnce(true);
				setAnim(name);
			},
			setBox: (box) => {
				boxRef.current = box;
			},
			commit: setCustomPos
		}));
		const walk = walkRef.current;
		const stopMove = () => {
			walkRef.current?.stop();
			posFollowRef.current?.stop();
		};
		const center = () => ({
			x: currentCenterX(),
			y: currentCenterY()
		});
		live.current.walk = walk;
		live.current.posFollow = posFollow;
		live.current.center = center;
		live.current.stopMove = stopMove;
		return {
			box: () => boxRef.current,
			center,
			metrics: () => motionRef.current,
			posFollow,
			setBox: (box) => {
				boxRef.current = box;
			},
			stopMove,
			walk
		};
	};
}

//#endregion
//#region src/client/pet/card/state.ts
function createCardState(rt) {
	const { useState, useRef } = rt;
	return function useCardState(init) {
		const [anim, setAnim] = useState(init.anim);
		const [once, setOnce] = useState(true);
		const [seq, setSeq] = useState(0);
		const [cuePlayback, setCuePlayback] = useState(null);
		const [facing, setFacing] = useState("left");
		const [dragging, setDragging] = useState(false);
		const [tipOn, setTipOn] = useState(false);
		const [customPos, setCustomPos] = useState(null);
		const [size, setSize] = useState(init.size);
		const [corner, setCorner] = useState(init.corner);
		const [margin, setMargin] = useState(init.margin);
		const animRef = useRef(anim);
		animRef.current = anim;
		const facingRef = useRef(facing);
		facingRef.current = facing;
		const customPosRef = useRef(customPos);
		customPosRef.current = customPos;
		const bumpSeq = () => setSeq((s) => s + 1);
		const play = (next, opts) => {
			setAnim(next);
			setOnce(opts?.once ?? true);
			if (opts?.replay) bumpSeq();
			if (opts?.cue !== void 0) setCuePlayback(opts.cue);
		};
		return {
			actions: {
				bumpSeq,
				play,
				setAnim,
				setCorner,
				setCuePlayback,
				setCustomPos,
				setDragging,
				setFacing,
				setMargin,
				setOnce,
				setSize,
				setTipOn
			},
			animRef,
			customPosRef,
			facingRef,
			state: {
				anim,
				corner,
				cuePlayback,
				customPos,
				dragging,
				facing,
				margin,
				once,
				seq,
				size,
				tipOn
			}
		};
	};
}

//#endregion
//#region src/client/pet/card/cue-effects.ts
/** 日志行的时刻前缀。 */
const stamp = () => new Date().toTimeString().slice(0, 8);
/** 一行带时刻的日志：客户端统一前缀，便于 grep。 */
const log = (message) => {
	console.log("[dsh-pet] " + stamp() + " " + message);
};
function createCueEffects(rt) {
	const { useEffect, useRef } = rt;
	return function useCueEffects(hub, props) {
		const { animCue, animCueTick, posCue, posCueTick, say, sayTick } = props;
		const { workStatus, workStatusTick } = props;
		const prevWorkRef = useRef(0);
		const prevWorkStateRef = useRef(void 0);
		const prevSayRef = useRef(0);
		const prevAnimRef = useRef(0);
		const prevPosRef = useRef(0);
		/** 工作状态联动：按档位播动画并弹文本气泡；回空闲时收起气泡并改播完即停。 */
		const consumeWorkStatus = () => {
			const cfg = hub.cfg();
			const card = hub.card;
			if (!cfg.workStatusEnabled) return;
			if (workStatusTick === 0 || workStatusTick === prevWorkRef.current) return;
			prevWorkRef.current = workStatusTick;
			if (hub.ownAnim.isFrozen()) return;
			if (hub.sleeping()) return;
			if (!workStatus || workStatus.state === null) {
				log("pet=" + cfg.id + " " + (prevWorkStateRef.current ?? "null") + "->null    播完即停（回待机，收起气泡）");
				prevWorkStateRef.current = null;
				if (poolIncludes(hub.anims().events?.workStatus ?? [], card.animRef.current)) hub.ownAnim.stopLoopingFront();
				hub.bubbles.resetWork();
				return;
			}
			const pool = hub.anims().events?.workStatus;
			if (!pool || pool.length === 0) {
				console.error("[dsh-pet] 配置缺少 animations.events.workStatus，无法播放工作状态动画");
				return;
			}
			const idx = WORK_STATUS_INDEX[workStatus.state];
			const slot = pool[idx];
			if (slot === void 0) {
				console.error("[dsh-pet] work-status 档位索引越界：state=" + workStatus.state + " idx=" + idx);
				return;
			}
			const name = pickSlot(slot, card.animRef.current);
			log("pet=" + cfg.id + " " + (prevWorkStateRef.current ?? "null") + "->" + workStatus.state + "    " + name);
			const stateChanged = prevWorkStateRef.current !== workStatus.state;
			prevWorkStateRef.current = workStatus.state;
			hub.stopMotion();
			const textGroup = Array.isArray(cfg.workStatusTexts) ? cfg.workStatusTexts[idx] : void 0;
			const configuredText = Array.isArray(textGroup) && textGroup.length > 0 ? textGroup[Math.floor(Math.random() * textGroup.length)] : void 0;
			hub.bubbles.updateWorkText(workStatus.task ?? configuredText ?? null);
			const terminal = workStatus.state === "success" || workStatus.state === "error";
			if (stateChanged) hub.bubbles.lightWork(terminal);
			const rotating = !terminal && Array.isArray(slot) && slot.length > 1;
			card.actions.setOnce(terminal || rotating);
			card.actions.setAnim(name);
		};
		/** 说话（碎碎念、命令气泡、对话回复、清空）：序号变化即执行清空或弹气泡。 */
		const consumeSay = () => {
			if (!say || say.seq === prevSayRef.current) return;
			prevSayRef.current = say.seq;
			if (say.kind === "clear") {
				hub.bubbles.clearWhisper();
				return;
			}
			hub.speak(say.text, say.image, say.url, say.duration, say.anim);
		};
		/** 点播动画：url 插播一段，名称走菜单同一套动作。 */
		const consumeAnimCue = () => {
			const card = hub.card;
			if (!animCue || animCue.seq === prevAnimRef.current) return;
			prevAnimRef.current = animCue.seq;
			const explicitFacing = animCue.facing !== void 0;
			if (animCue.facing !== void 0) {
				card.actions.setFacing(animCue.facing);
				card.facingRef.current = animCue.facing;
			}
			if (animCue.url !== void 0) {
				hub.stopMotion();
				hub.ownAnim.setCueUrl(animCue.url);
				card.actions.setOnce(true);
				card.actions.bumpSeq();
				card.actions.setAnim(animCue.url);
				card.actions.setCuePlayback(animCue.playbackId ?? null);
				return;
			}
			if (animCue.name === void 0) return;
			hub.playByName(animCue.name, animCue.playbackId, explicitFacing);
		};
		/** 位置指令：交给位置跟随；用户正按着宠物时由驱动整拍丢弃。 */
		const consumePosCue = () => {
			if (!posCue || posCue.seq === prevPosRef.current) return;
			prevPosRef.current = posCue.seq;
			hub.posFollow.apply(posCue.x, posCue.y, posCue.mode, posCue.duration);
		};
		useEffect(() => {
			consumeWorkStatus();
			consumeSay();
			consumeAnimCue();
			consumePosCue();
		}, [
			workStatusTick,
			sayTick,
			animCueTick,
			posCueTick
		]);
	};
}

//#endregion
//#region src/client/pet/card/lock-freeze.ts
function freezeDeadline(lock, nowMs) {
	const expiresAt = lock?.locked === true ? lock.expiresAt : 0;
	return expiresAt > nowMs ? expiresAt : 0;
}
/** 执行一次翻转；cue 为 null 表示状态本来就是这个值。 */
function dispatchCue(cue, handlers) {
	if (cue === null) return;
	if (cue.kind === "frozen") handlers.onFrozen();
	else handlers.onResumed();
}
function createLockFreeze(rt) {
	const { useEffect, useRef } = rt;
	return function useLockFreeze(input) {
		/** 解冻定时器；重算与本地解冻前都必须清掉，否则旧定时器会提前解冻。 */
		const timerRef = useRef(null);
		/** 清掉解冻定时器；重复调用安全。 */
		const clearTimer = () => {
			if (timerRef.current !== null) {
				window.clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		};
		useEffect(() => {
			clearTimer();
			const now = Date.now();
			const expiresAt = freezeDeadline(input.lock, now);
			dispatchCue(input.setFrozen(expiresAt > now), input);
			if (expiresAt <= now) return clearTimer;
			timerRef.current = window.setTimeout(() => {
				timerRef.current = null;
				dispatchCue(input.setFrozen(false), input);
			}, expiresAt - now);
			return clearTimer;
		}, [input.lockTick, input.lock]);
		return { release: () => {
			clearTimer();
			dispatchCue(input.setFrozen(false), input);
		} };
	};
}

//#endregion
//#region src/client/pet/card/runtime.ts
function createCardRuntime(rt) {
	const { h, useEffect, useRef, useState } = rt;
	/** 文本气泡：说话与工作状态共用。 */
	const TextBubble = makeTextBubble({ h });
	/** 待办气泡：面板本体挂在自己身上，关闭按钮回调装配根。 */
	const TodoBubble = makeTodoBubble({
		h,
		useEffect,
		useRef
	});
	/** 四种气泡的单槽：显隐、停留计时与优先级都在这里。 */
	const useBubbleSlots = createBubbleSlots({
		h,
		useState,
		useEffect,
		useRef
	}, {
		textBubble: TextBubble,
		todoBubble: TodoBubble
	});
	const useCardState = createCardState({
		useState,
		useRef
	});
	const useLockFreeze = createLockFreeze({
		useEffect,
		useRef
	});
	const useCueEffects = createCueEffects({
		useEffect,
		useRef
	});
	const useAnimationFlow = createAnimationFlow({ useRef });
	const useCardAnimation = createCardAnimation({
		useEffect,
		useRef
	});
	const useCardMotion = createCardMotion({
		useEffect,
		useRef
	});
	const useCardDrag = createCardDrag({
		useRef,
		useEffect
	});
	const useCardEntry = createCardEntry({
		useEffect,
		useRef
	});
	return function useCardRuntime(props) {
		const { cfg, lock, lockTick, menuItemsRef, sleep: sleep$1, sleepTick, workStatus } = props;
		const effectiveSizePx = resolvePetSizePx(cfg.size, cfg.sizePercent, window.innerWidth);
		const card = useCardState({
			anim: cfg.animations.idle[0] ?? "",
			corner: cfg.position.corner,
			margin: {
				x: cfg.position.marginX,
				y: cfg.position.marginY
			},
			size: effectiveSizePx
		});
		const { actions, state } = card;
		const { corner, customPos, dragging, facing, margin, size, tipOn } = state;
		const liveRef = useRef({});
		const menuActionsRef = useRef(null);
		const entryRef = useRef(null);
		const pendingSquashRef = useRef(false);
		const cfgRef = useRef(cfg);
		cfgRef.current = cfg;
		const workStatusRef = useRef(workStatus);
		workStatusRef.current = workStatus;
		const rootRef = useRef(null);
		const stageRef = useRef(null);
		const videoARef = useRef(null);
		const videoBRef = useRef(null);
		const tipRef = useRef(null);
		const reportPlayback = makePlaybackReporter({ petId: cfg.id });
		const { halfW, halfH, bottomPad, sideAllow } = derivePetMetrics(size);
		const fontPx = resolveFontPx(cfg.font, size);
		const petAnims = cfg.animations;
		useEffect(() => {
			actions.setSize(resolvePetSizePx(cfg.size, cfg.sizePercent, window.innerWidth));
		}, [cfg.size, cfg.sizePercent]);
		useEffect(() => {
			actions.setCorner(cfg.position.corner);
			actions.setMargin({
				x: cfg.position.marginX,
				y: cfg.position.marginY
			});
			actions.setCustomPos(null);
		}, [
			cfg.position.corner,
			cfg.position.marginX,
			cfg.position.marginY
		]);
		const bubbles = useBubbleSlots({
			workStatusEnabled: cfg.workStatusEnabled,
			workTerminal: workStatus?.state === "success" || workStatus?.state === "error"
		});
		const ownAnim = useCardAnimation({
			card,
			cfgRef,
			live: liveRef,
			lock,
			pendingSquash: pendingSquashRef,
			petId: cfg.id,
			report: reportPlayback,
			setCuePlayback: actions.setCuePlayback,
			videoA: () => videoARef.current,
			videoB: () => videoBRef.current,
			workStatusRef
		});
		const motion = useCardMotion({
			card,
			cfgRef,
			live: liveRef,
			metrics: {
				bottomPad,
				halfH,
				halfW,
				sideAllow,
				size
			},
			moves: petAnims.moves,
			petId: cfg.id,
			root: () => rootRef.current,
			setAnim: actions.setAnim,
			setCustomPos: actions.setCustomPos,
			setOnce: actions.setOnce
		});
		const drag = useCardDrag({
			bumpSeq: actions.bumpSeq,
			card,
			cfgRef,
			live: liveRef,
			motion,
			pendingSquash: pendingSquashRef,
			root: () => rootRef.current,
			setAnim: actions.setAnim,
			setCustomPos: actions.setCustomPos,
			setDragging: actions.setDragging,
			setOnce: actions.setOnce,
			setTipOn: actions.setTipOn,
			stage: () => stageRef.current
		});
		const entry = useCardEntry({
			card,
			cfgRef,
			drag,
			live: liveRef,
			menuItemsRef,
			motion,
			runMenuAction: (leaf$1, playbackId, keepFacing) => menuActionsRef.current?.run(leaf$1, playbackId, keepFacing),
			showTodo: bubbles.showTodo,
			tipRef,
			toggleTodo: bubbles.toggleTodo
		});
		entryRef.current = entry;
		menuActionsRef.current ?? (menuActionsRef.current = createMenuActions({
			animations: () => cfgRef.current.animations,
			applyMerged: (merged) => petBridge.reload(merged),
			faceLeft: () => actions.setFacing("left"),
			isFacingRight: () => card.facingRef.current === "right",
			openTodo: () => entryRef.current?.openTodo(),
			petId: cfg.id,
			playOnce: (anim, playbackId) => {
				actions.setOnce(true);
				actions.setAnim(anim);
				actions.setCuePlayback(playbackId);
			},
			report: reportPlayback,
			resetPosition: () => actions.setCustomPos(null),
			say: (text) => liveRef.current.flow?.speak(text, void 0, void 0, void 0, false),
			locked: () => ownAnim.isFrozen(),
			sleepRefuseTexts: () => cfgRef.current.sleepRefuseTexts ?? [],
			sleeping: () => liveRef.current.flow?.sleeping() ?? false,
			stopMove: motion.stopMove,
			stopThrow: () => {},
			tryMove: motion.walk.tryMove,
			warn: (message) => console.warn(message)
		}));
		const menuActions = menuActionsRef.current;
		const lockFreeze = useLockFreeze({
			lock,
			lockTick,
			onFrozen: () => {
				motion.stopMove();
				bubbles.hideWork();
			},
			onResumed: () => {
				if (liveRef.current.flow?.resumeWorkStatusAnim() ?? false) return;
				if (petAnims.idle.length) {
					actions.setAnim(pick(petAnims.idle, card.animRef.current));
					actions.setOnce(true);
					actions.bumpSeq();
				}
			},
			setFrozen: ownAnim.setFrozen
		});
		liveRef.current.releaseLock = () => {
			lockFreeze.release();
			postAction(ROUTE_PATH + "/lock/release?pet=" + encodeURIComponent(cfg.id), { force: true });
		};
		const hub = {
			anims: () => cfgRef.current.animations,
			bubbles,
			card,
			cfg: () => cfgRef.current,
			isDragging: () => drag.isActive(),
			ownAnim,
			playByName: (anim, playbackId, keepFacing) => menuActions.run({
				anim,
				label: anim
			}, playbackId, keepFacing, true),
			posFollow: motion.posFollow,
			speak: (text, image, url, duration, anim) => liveRef.current.flow?.speak(text, image, url, duration, anim),
			sleeping: () => liveRef.current.flow?.sleeping() ?? false,
			locked: () => ownAnim.isFrozen(),
			stopMotion: motion.stopMove,
			tryWalk: motion.walk.tryMove
		};
		useCueEffects(hub, props);
		const flow = useAnimationFlow(hub, workStatus);
		liveRef.current.flow = flow;
		useEffect(() => {
			if (sleep$1) flow.applySleep(sleep$1);
		}, [sleepTick]);
		const stageStyle = petStageStyle(dragging, bottomPad);
		const rootStyle = petRootStyle(customPos, {
			width: window.innerWidth,
			height: window.innerHeight
		}, {
			h: halfH,
			w: halfW
		});
		return {
			bubble: bubbles.node(),
			corner,
			facing,
			fontBubblePx: fontPx.bubble,
			fontTipPx: fontPx.tip,
			marginX: margin.x,
			marginY: margin.y,
			name: cfg.name,
			onClick: () => {
				if (drag.justDragged() || drag.isActive()) return;
				const phase = liveRef.current.flow?.sleepPhase() ?? null;
				if (phase !== null && phase !== "start") {
					playClickSound();
					postAction(ROUTE_PATH + "/wake?pet=" + encodeURIComponent(cfg.id));
					return;
				}
				if (phase === "start") postAction(ROUTE_PATH + "/wake?pet=" + encodeURIComponent(cfg.id));
				drag.onClick();
			},
			onContextMenu: entry.handleContextMenu,
			onPointerDown: drag.onPointerDown,
			onPointerEnter: entry.onPointerEnter,
			onPointerLeave: entry.onPointerLeave,
			onPointerMove: drag.onPointerMove,
			onPointerUp: drag.onPointerUp,
			rootRef,
			rootStyle,
			size,
			stageRef,
			stageStyle,
			tipOn,
			tipRef,
			videoARef,
			videoBRef
		};
	};
}

//#endregion
//#region src/client/pet/card/pet-card.ts
function createPetCard(rt) {
	const { h } = rt;
	/** 宠物卡的 DOM 结构：只拼装，不持有状态。 */
	const CardView = makeCardView({ h });
	const useCardRuntime = createCardRuntime(rt);
	/** 单个宠物实例，配置由容器传入。 */
	function PetCard(props) {
		return h(CardView, useCardRuntime(props));
	}
	return PetCard;
}

//#endregion
//#region src/client/pet/state-poll.ts
/** 一个不会 resolve 的等待：单纯让出这一拍，用定时器而不是忙等。 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function runStatePoll(deps) {
	/** 宿主是否支持长轮询：首拍带 counter 就是支持。 */
	let longPoll = false;
	/** 上次拿到的 counter，作为长轮询的 since。 */
	let since;
	while (deps.isAlive()) {
		let state = null;
		try {
			state = await deps.fetch(longPoll && since !== void 0 ? {
				since,
				timeoutMs: deps.waitMs
			} : void 0);
		} catch {}
		if (!deps.isAlive()) return;
		if (state !== null) {
			longPoll = typeof state.counter === "number";
			if (longPoll && typeof state.counter === "number") since = state.counter;
			deps.onState(state);
		}
		if (state === null || !longPoll) await sleep(deps.fallbackMs);
	}
}

//#endregion
//#region src/client/state-service.ts
/** 最近一拍的状态；`null` = 本页还没拉到过。 */
let latest = null;
/** 订阅者：每来一拍通知一次。 */
const listeners = new Set();
function setStateSnapshot(state) {
	latest = state;
	for (const listener of listeners) try {
		listener(state);
	} catch (error) {
		console.error("[dsh-pet] 状态订阅回调出错（已忽略，不影响轮询）：", error);
	}
}
function getStateSnapshot() {
	return latest;
}

//#endregion
//#region src/client/pet/multi.ts
function createPetMulti(rt, Card) {
	const { h, useState, useEffect, useRef } = rt;
	return function PetMulti() {
		const [pets, setPets] = useState([]);
		const [ready, setReady] = useState(false);
		const [workStatus, setWorkStatus] = useState(null);
		const [workStatusTick, setWorkStatusTick] = useState(0);
		useEffect(() => {
			const family = pets[0]?.font?.family;
			if (family === void 0) return;
			document.documentElement.style.setProperty("--dsh-pet-font-family", fontStackOf(family));
		}, [pets]);
		useEffect(() => {
			let alive = true;
			/** 唯一填充点：成品聚合 → 渲染列表；条目级字段只由 flattenConfigPets 吹入。 */
			const applyMerged = (merged) => {
				const main = merged?.main;
				if (typeof main !== "object" || main === null) throw new Error("配置响应不是成品聚合（host 版本不匹配？）");
				setClickSoundEnabled(main.clickSoundEnabled === true);
				const flattened = flattenConfigPets(merged);
				petBridge.current = flattened;
				petBridge.template = Array.isArray(main.pets) ? main.pets[0] ?? void 0 : void 0;
				setPets(flattened);
			};
			/** 拉取成品聚合：host readAllConfig 的输出，客户端零校验零兜底。 */
			const loadMerged = async () => {
				const r = await fetch(ROUTE_PATH + "/config", { cache: "no-store" });
				if (!r.ok) throw new Error("config HTTP " + r.status);
				const body = await r.json();
				if (body.ok === false) throw new Error("config: " + String(body.reason ?? "failed"));
				return body;
			};
			(async () => {
				try {
					const merged = await loadMerged();
					if (!alive) return;
					applyMerged(merged);
					setReady(true);
				} catch (e) {
					console.error("[dsh-pet] 配置加载失败", e);
				}
			})();
			petBridge.reload = (merged) => {
				(async () => {
					try {
						const next = merged ?? await loadMerged();
						if (!alive) return;
						applyMerged(next);
					} catch (e) {
						console.error("[dsh-pet] 配置重载失败，保留当前渲染列表", e);
					}
				})();
			};
			return () => {
				alive = false;
				petBridge.reload = () => {};
			};
		}, []);
		const visiblePets = pets.filter((p) => isWebVisible(p.display));
		const [sayTick, setSayTick] = useState(0);
		const sayRef = useRef({});
		const [animCueTick, setAnimCueTick] = useState(0);
		const animCueRef = useRef({});
		const [posCueTick, setPosCueTick] = useState(0);
		const posCueRef = useRef({});
		const [lockTick, setLockTick] = useState(0);
		const lockRef = useRef({});
		const [sleepTick, setSleepTick] = useState(0);
		const sleepRef = useRef({});
		const menuItemsRef = useRef([]);
		useEffect(() => {
			if (!ready) return;
			let alive = true;
			let baseline = null;
			/** 分段叶子 → 消费端副作用；不认识的名字已被 resolveLeafPath 挡在外面。 */
			const applySection = (name, leaf$1) => {
				switch (name) {
					case "config":
						petBridge.reload();
						return;
					case "workStatus": {
						const snap = readWorkStatus(leaf$1);
						if (snap) {
							setWorkStatus(snap);
							setWorkStatusTick((t) => t + 1);
						}
						return;
					}
					case "notify":
						notifyFromFrame(leaf$1.data);
						return;
					case "menu":
						menuItemsRef.current = readMenuItems(leaf$1.data, "web");
						setMenuItems(menuItemsRef.current);
						return;
				}
			};
			/** 宠物叶子 → 该宠物的指令槽；序号自增，卡片据此知道「又写了一次」。 */
			const applyPetLeaf = (name, petId, leaf$1) => {
				switch (name) {
					case "say": {
						const said = readSay(leaf$1);
						if (!said) return;
						sayRef.current[petId] = {
							...said,
							seq: (sayRef.current[petId]?.seq ?? 0) + 1
						};
						setSayTick((t) => t + 1);
						return;
					}
					case "anim": {
						const hit = readAnim(leaf$1);
						if (!hit) return;
						animCueRef.current[petId] = {
							name: hit.name,
							url: hit.url,
							playbackId: hit.playbackId,
							facing: hit.facing,
							seq: (animCueRef.current[petId]?.seq ?? 0) + 1
						};
						setAnimCueTick((t) => t + 1);
						return;
					}
					case "position": {
						const hit = readPosition(leaf$1);
						if (!hit) return;
						posCueRef.current[petId] = {
							...hit,
							seq: (posCueRef.current[petId]?.seq ?? 0) + 1
						};
						setPosCueTick((t) => t + 1);
						return;
					}
					case "lock": {
						const hit = readLock(leaf$1);
						if (!hit) return;
						lockRef.current[petId] = hit;
						setLockTick((t) => t + 1);
						return;
					}
					case "sleep": {
						const hit = readSleep(leaf$1);
						if (!hit) return;
						sleepRef.current[petId] = hit;
						setSleepTick((t) => t + 1);
						return;
					}
				}
			};
			/** 应用一份轮询状态：首拉只记基线，之后按 counter 变化逐个分发。 */
			const applyState = (s) => {
				setStateSnapshot(s);
				if (baseline === null) {
					baseline = flattenCounters(s);
					menuItemsRef.current = readMenuItems(s.sections.menu?.data, "web");
					setMenuItems(menuItemsRef.current);
					for (const [petId, entry] of Object.entries(s.pets)) {
						const hit = entry?.sleep?.data == null ? null : readSleep(entry.sleep);
						if (hit) sleepRef.current[petId] = hit;
					}
					setSleepTick((t) => t + 1);
					return;
				}
				for (const { path, leaf: leaf$1 } of takeChanged(s, baseline)) {
					if (leaf$1.data === null) continue;
					const target = resolveLeafPath(path);
					if (target === null) continue;
					if (target.where === "section") applySection(target.name, leaf$1);
					else applyPetLeaf(target.name, target.petId, leaf$1);
				}
			};
			runStatePoll({
				fetch: (options) => fetchState(void 0, options === void 0 ? void 0 : {
					since: options.since,
					timeoutMs: options.timeoutMs
				}),
				onState: applyState,
				waitMs: STATE_WAIT_MS,
				fallbackMs: STATE_FALLBACK_MS,
				isAlive: () => alive
			});
			return () => {
				alive = false;
			};
		}, [ready]);
		return ready ? visiblePets.map((p) => h(Card, {
			key: p.id,
			cfg: p,
			workStatus,
			workStatusTick,
			say: sayRef.current[p.id],
			sayTick,
			animCue: animCueRef.current[p.id],
			animCueTick,
			posCue: posCueRef.current[p.id],
			posCueTick,
			lock: lockRef.current[p.id],
			lockTick,
			sleep: sleepRef.current[p.id],
			sleepTick,
			menuItemsRef
		})) : null;
	};
}

//#endregion
//#region src/client/pet.ts
function makePetUI(rt) {
	injectPetCss();
	const PetCard = createPetCard(rt);
	const PetMulti = createPetMulti(rt, PetCard);
	return PetMulti;
}

//#endregion
//#region src/client/nav-icon.ts
/**
* 设置面板导航图标补丁：把「桌宠配置」那一行的兜底齿轮换成指定图标。
* DSH 的导航图标按分区 id 硬编码白名单，且私有、外部拿不到引用，只能在 DOM 层做。
* 只打 `data-*` 标记并用 `::before` + mask 画字形，不动 DOM 结构，否则 React 会对被替换的节点 removeChild 崩。
* mask 是 data URI，即独立图像文档：宿主 0.2.2 起图标改成 sprite 引用（`<use>` 指向页面里的 `<symbol>`），
* 必须先展开成自包含 SVG，否则 mask 全透明、齿轮又被盖住，那一行直接变成零图标。
* sprite 由宿主在挂载后才注入，装配这一刻取不到，所以字形推迟到认出面板时才解析。
* 认行只能靠标题文本：投影到 DOM 的只有 label，而 account 行条件出现、位置会漂，不能用 `:nth-child`。
* 降级：缺 document / MutationObserver、取不到字形时不装（齿轮留着），认不出那一行时什么都不做，只告警。
* @module dsh-pet/src/client/nav-icon
*/
/** 注入的样式表去重标记（与宠物页面 / 设置页同一套 `data-plugin-css` 约定）。 */
const STYLE_TAG = "dsh-pet/nav-icon.css";
/** 打在目标行 `<button>` 上的标记属性：React 从不 diff 它，重渲染 / 切语言都不会掉。 */
const MARK = "data-dsh-pet-nav";
/** 设置面板根节点：shell 用 `createPortal` 挂到 body 上。 */
const PANEL_SELECTOR = "[data-shortcut-modal=\"settings\"]";
/**
* 类名来自 CSS Modules，哈希前缀会随 DSH 构建变，只匹配 `navList` / `navCell` / `navLabel` 这些名字部分。
*/
const LIST_SELECTOR = "[class*=\"navList\"]";
const CELL_SELECTOR = "[class*=\"navCell\"]";
const LABEL_SELECTOR = "[class*=\"navLabel\"]";
function svgMaskUri(svg) {
	const source = svg.trim();
	if (source === "") return "";
	const namespaced = /<svg[^>]*\sxmlns=/i.test(source) ? source : source.replace(/<svg\b/i, "<svg xmlns=\"http://www.w3.org/2000/svg\"");
	return "url(\"data:image/svg+xml," + encodeURIComponent(namespaced.split("currentColor").join("#000")) + "\")";
}
function expandUseRefs(svg, lookup) {
	const ref = /<use\b[^>]*\s(?:xlink:)?href="#([^"]+)"/i.exec(svg);
	if (ref === null) return svg;
	const symbol = lookup(ref[1]);
	if (symbol === void 0) return void 0;
	const attrs = Object.entries(symbol.attrs).map(([name, value]) => " " + name + "=\"" + value + "\"").join("");
	return "<svg xmlns=\"http://www.w3.org/2000/svg\"" + attrs + ">" + symbol.content + "</svg>";
}
function symbolIn(find) {
	return (id) => {
		const symbol = find(id);
		if (symbol === null) return void 0;
		const attrs = {};
		for (let index = 0; index < symbol.attributes.length; index += 1) {
			const attr = symbol.attributes.item(index);
			if (attr === null || attr.name === "id") continue;
			attrs[attr.name] = attr.value;
		}
		return {
			attrs,
			content: symbol.innerHTML
		};
	};
}
/** 换字形用的 CSS：盖住齿轮，用 `::before` + mask 画上我们的图标。 */
function cssFor(glyph) {
	return [
		"/* 「桌宠配置」行的导航图标：盖住齿轮，换成本模块的图形 */",
		"[" + MARK + "] [class*=\"navIcon\"]{display:none}",
		"[" + MARK + "]::before{content:\"\";flex:none;width:16px;height:16px;background-color:currentColor;-webkit-mask:" + glyph + " center/16px 16px no-repeat;mask:" + glyph + " center/16px 16px no-repeat}"
	].join("\n");
}
/** 注入样式表（只注入一次）。 */
function injectCss(doc, glyph) {
	if (doc.querySelector("style[data-plugin-css=\"" + STYLE_TAG + "\"]") !== null) return;
	const tag = doc.createElement("style");
	tag.dataset.plugin = "dsh-pet";
	tag.dataset.pluginCss = STYLE_TAG;
	tag.textContent = cssFor(glyph);
	doc.head.appendChild(tag);
}
/** 异常 → 单行文案（告警用）。 */
function describe(error) {
	return error instanceof Error ? error.message : String(error);
}
function installSectionNavIcon(target) {
	const doc = typeof document === "undefined" ? void 0 : document;
	const Observer = typeof MutationObserver === "undefined" ? void 0 : MutationObserver;
	if (doc === void 0 || Observer === void 0 || doc.body === null) {
		console.warn("[dsh-pet] 设置页导航图标不可用：缺少 document / body / MutationObserver（齿轮照旧）");
		return () => {};
	}
	let injected = false;
	let warnedGlyph = false;
	/** 告警只报一次：面板反复开关会反复走到同一条失败路径。 */
	const warnGlyph = (reason) => {
		if (warnedGlyph) return;
		warnedGlyph = true;
		console.warn("[dsh-pet] 设置页导航图标不可用：" + reason + "（齿轮照旧）");
	};
	/** 解析并注入换字形样式；成功一次后不再重算，失败时留待面板下次出现再试。 */
	const ensureCss = () => {
		if (injected) return;
		let glyph;
		try {
			const expanded = expandUseRefs(target.renderSvg(), symbolIn((id) => doc.getElementById(id)));
			if (expanded === void 0) {
				warnGlyph("sprite 里找不到引用的 <symbol>");
				return;
			}
			glyph = svgMaskUri(expanded);
		} catch (error) {
			warnGlyph("图标渲染失败：" + describe(error));
			return;
		}
		if (glyph === "") {
			warnGlyph("图标渲成了空 SVG");
			return;
		}
		injectCss(doc, glyph);
		injected = true;
	};
	let warned = false;
	/** 给面板里标题匹配的那一行打标记（幂等；已打过的不再读标题）。 */
	const markPanel = (panel) => {
		try {
			const wanted = target.label();
			if (wanted === "") return;
			const list = panel.querySelector(LIST_SELECTOR);
			if (list === null) return;
			for (const cell of list.querySelectorAll(CELL_SELECTOR)) {
				if (cell.getAttribute(MARK) !== null) continue;
				if (cell.querySelector(LABEL_SELECTOR)?.textContent === wanted) cell.setAttribute(MARK, "");
			}
		} catch (error) {
			if (!warned) {
				warned = true;
				console.warn("[dsh-pet] 设置页导航图标补丁异常，本次跳过（齿轮照旧）：" + describe(error));
			}
		}
	};
	let watched;
	let panelObserver;
	const sync = () => {
		const panel = doc.querySelector(PANEL_SELECTOR);
		if (panel === null) {
			panelObserver?.disconnect();
			panelObserver = void 0;
			watched = void 0;
			return;
		}
		markPanel(panel);
		if (panel === watched) return;
		ensureCss();
		panelObserver?.disconnect();
		watched = panel;
		panelObserver = new Observer(() => {
			markPanel(panel);
		});
		panelObserver.observe(panel, {
			childList: true,
			subtree: true
		});
	};
	sync();
	const bodyObserver = new Observer(sync);
	bodyObserver.observe(doc.body, { childList: true });
	return () => {
		bodyObserver.disconnect();
		panelObserver?.disconnect();
	};
}

//#endregion
//#region src/client/app-shortcut.ts
const SHORTCUT_PROFILES = [
	"desktop:macos",
	"desktop:windows",
	"desktop:linux",
	"web:macos",
	"web:windows"
];
function registerAppShortcut(ctx, shortcut) {
	const shortcuts = ctx.get?.("shortcuts");
	if (shortcuts === void 0 || typeof shortcuts.register !== "function") {
		console.warn("[dsh-pet] 快捷键服务不可用，「" + shortcut.id + "」未注册");
		return {
			registered: false,
			dispose: () => {}
		};
	}
	try {
		const defaults = Object.fromEntries(SHORTCUT_PROFILES.map((profile) => [profile, shortcut.binding]));
		const dispose = shortcuts.register({
			id: shortcut.id,
			label: shortcut.label,
			aliases: [],
			defaults,
			regions: ["page", "editable"],
			modals: [],
			resolve: () => ({
				status: "handled",
				run: shortcut.run
			})
		});
		return {
			registered: true,
			dispose: () => dispose()
		};
	} catch (error) {
		console.warn("[dsh-pet] 快捷键注册失败：" + (error instanceof Error ? error.message : String(error)));
		return {
			registered: false,
			dispose: () => {}
		};
	}
}

//#endregion
//#region src/client/pet/card/registry.ts
/** 按宠物 id 登记；Map 的插入序就是渲染序，「第一只」的兜底直接靠它。 */
const handles = new Map();
function pickPetChatHandle() {
	const mainId = petBridge.template?.id;
	if (typeof mainId === "string") {
		const main = handles.get(mainId);
		if (main !== void 0) return main;
	}
	return handles.values().next().value;
}
function togglePetChatHear(handle) {
	if (handle === void 0) return;
	if (handle.isHearing()) handle.stopHear();
	else handle.startHear();
}
function togglePetChat(handle) {
	if (handle === void 0) return;
	if (handle.isOpen()) handle.close();
	else handle.open();
}

//#endregion
//#region src/client/pet/card/shortcut.ts
const PET_FLOAT_COMMAND_ID = "pet-chat.float";
const PET_HEAR_COMMAND_ID = "pet-chat.hear";
const PET_CAPTURE_COMMAND_ID = "pet-chat.capture";
/** 弹窗键位：主修饰键 + Shift + L。T 在浏览器里被「恢复标签页」占用，L 两端都空着。 */
const FLOAT_BINDING = {
	code: "KeyL",
	modifiers: ["primary", "shift"]
};
/** 录音键位：主修饰键 + Shift + M（M = mic）。V 在输入框里会被浏览器当成「粘贴为纯文本」，避开。 */
const HEAR_BINDING = {
	code: "KeyM",
	modifiers: ["primary", "shift"]
};
/** 截图键位：主修饰键 + Shift + S。Edge 与 Firefox 把它给了自己的截图，Chrome 空着。 */
const CAPTURE_BINDING = {
	code: "KeyS",
	modifiers: ["primary", "shift"]
};
/** 命令 id 与默认键位：注册与展示都从这里取，不写第二份。 */
const COMMANDS = {
	chat: {
		id: PET_FLOAT_COMMAND_ID,
		binding: FLOAT_BINDING
	},
	hear: {
		id: PET_HEAR_COMMAND_ID,
		binding: HEAR_BINDING
	},
	capture: {
		id: PET_CAPTURE_COMMAND_ID,
		binding: CAPTURE_BINDING
	}
};
function registerPetCardShortcuts(ctx, label) {
	const float = registerAppShortcut(ctx, {
		id: COMMANDS.chat.id,
		label: () => label("shortcut.chat"),
		binding: COMMANDS.chat.binding,
		run: () => togglePetChat(pickPetChatHandle())
	});
	const hear = registerAppShortcut(ctx, {
		id: COMMANDS.hear.id,
		label: () => label("shortcut.hear"),
		binding: COMMANDS.hear.binding,
		run: () => togglePetChatHear(pickPetChatHandle())
	});
	const capture = registerAppShortcut(ctx, {
		id: COMMANDS.capture.id,
		label: () => label("shortcut.capture"),
		binding: COMMANDS.capture.binding,
		run: () => pickPetChatHandle()?.screenshot()
	});
	return { dispose: () => {
		float.dispose();
		hear.dispose();
		capture.dispose();
	} };
}

//#endregion
//#region src/client/app.ts
function makeFactory() {
	return (require) => {
		const module = { exports: {} };
		const react = require("react");
		const { useEffect, useRef, useState, useCallback } = react;
		const { jsx: h } = require("react/jsx-runtime");
		let primitives;
		try {
			primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		} catch (error) {
			console.warn("[dsh-pet] 图标模块不可用：" + (error instanceof Error ? error.message : String(error)));
		}
		let renderIconSvg;
		try {
			const { createRoot } = require("react-dom/client");
			const { flushSync } = require("react-dom");
			renderIconSvg = (icon) => {
				const holder = document.createElement("div");
				const root = createRoot(holder);
				try {
					flushSync(() => root.render(h(icon, { size: 16 })));
					return holder.innerHTML;
				} finally {
					root.unmount();
				}
			};
		} catch (error) {
			console.warn("[dsh-pet] 图标渲染器不可用：" + (error instanceof Error ? error.message : String(error)));
		}
		const PetMulti = makePetUI({
			h,
			useState,
			useEffect,
			useRef
		});
		const name = "pet";
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, dicts), "dsh-pet: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.provide("petApi7340", {
				getState: getStateSnapshot,
				menuEvents: takeMenuEvents,
				pose: readPose,
				progress: readProgress
			});
			ctx.effect(() => initNotify({
				openSession: (sessionId) => ctx.get?.("uiWorkspace")?.openSession?.(sessionId),
				sessionTitle: (sessionId) => {
					const row = ctx.get?.("sessions")?.list?.getSnapshot?.()?.byId?.[sessionId];
					const title = typeof row?.title === "string" ? row.title.trim() : "";
					return title || void 0;
				}
			}), "dsh-pet: notifications");
			ctx.effect(() => {
				const renderIcon = renderIconSvg;
				const icon = primitives?.IconSlidersTwoOutlineMedium;
				if (renderIcon === void 0 || icon === void 0) {
					console.warn("[dsh-pet] 设置页导航图标不可用");
					return () => {};
				}
				return installSectionNavIcon({
					label: () => t("nav"),
					renderSvg: () => renderIcon(icon)
				});
			}, "dsh-pet: settings nav icon");
			ctx.slots.inject("shell.overlay", function* () {
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "pet",
					order: 1e3
				}, () => h(PetMulti, {}));
			});
			const PetConfigSection = makePetConfigSection({
				h,
				useState,
				useEffect,
				useRef,
				useCallback,
				t
			});
			ctx.slots.inject("settings.section", function* () {
				yield ctx.slots.register({
					name: "settings.section",
					id: "pet-config",
					order: 30,
					label: () => t("nav"),
					inject: () => ({ t })
				}, PetConfigSection);
			});
			ctx.effect(() => {
				const card = registerPetCardShortcuts(ctx, (key) => t(key));
				return () => card.dispose();
			}, "dsh-pet: shortcuts");
		}
		module.exports = {
			apply,
			inject,
			name
		};
		return module.exports;
	};
}

//#endregion
//#region src/client/index.ts
window.__ModuleLoader__.load({
	id: "dsh-pet",
	factory: makeFactory()
});

//#endregion
})();