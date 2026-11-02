/**
 * 运动驱动：拖拽跟随、抛掷、位置指令与 Q 弹挤压的帧循环。
 *
 * PetSprite 由 sprite.js 定义，本文件只往原型上挂方法，必须在其后加载。
 * 每条驱动只管自己的帧句柄与世代号；停止由调用方决定，互不 import。
 * @module dsh-pet/runtime/electron-helper/sprite-motion
 */
'use strict';

Object.assign(PetSprite.prototype, {
  startMoveDrive(el) {
    const pm = this.pendingMove;
    if (!pm || this.moveRef !== null) return;
    this.pendingMove = null;
    const { startRatio, startYRatio, targetRatio, leadSec, tailSec } = pm;
    const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 10.09;
    const travelWindow = Math.max(0.1, duration - leadSec - tailSec);
    const token = ++this.moveToken;
    const W = VIEW.w;
    const H = VIEW.h;
    const step = () => {
      if (this.moveToken !== token) return;
      const t = el.currentTime || 0;
      let ratioX;
      if (t <= leadSec) ratioX = startRatio;
      else if (t >= duration - tailSec) ratioX = targetRatio;
      // 按规划落点插值而不是 dir × 距离：minDist/maxDist 为负时符号必须保留，
      // 否则规划往左、驱动往右，走完再跳回原本的方向。
      else ratioX = startRatio + (targetRatio - startRatio) * ((t - leadSec) / travelWindow);
      // 移动的是窗口（宠物包围盒跟随），sprite 在本窗口内不动
      this.sendBounds(ratioX * W - this.halfW, startYRatio * H - this.halfH);
      if (t < duration - tailSec) {
        this.moveRef = requestAnimationFrame(step);
      } else {
        this.moveRef = null;
        this.customPos = { rx: targetRatio, ry: startYRatio };
      }
    };
    this.moveRef = requestAnimationFrame(step);
  },

  stopMove() {
    this.pendingMove = null;
    this.moveToken++;
    if (this.moveRef !== null) {
      cancelAnimationFrame(this.moveRef);
      this.moveRef = null;
    }
    // 位置指令的弹簧也是自主移动：停走路时一并停掉，否则两套运动系统会同时改窗口位置。
    this.stopPosFollow();
  },

  // 拖拽抛掷物理（弹簧跟手 + 甩抛 + 重力反弹）
  stopDragFollow() {
    this.dragFollowToken++;
    if (this.dragFollow !== null) {
      cancelAnimationFrame(this.dragFollow);
      this.dragFollow = null;
    }
    this.dragTarget = null;
    this.dragVel = { vx: 0, vy: 0 };
  },

  /** rAF 弹簧跟随：窗口朝拖拽目标过阻尼追赶（不再硬贴指针），抹平高频抖动 */
  startDragFollow() {
    if (this.dragFollow !== null) return;
    const token = ++this.dragFollowToken;
    let last = performance.now();
    const step = () => {
      if (this.dragFollowToken !== token) return;
      const target = this.dragTarget;
      if (!target) {
        this.dragFollow = null;
        return;
      }
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const vel = this.dragVel;
      let x = this.pos.x;
      let y = this.pos.y;
      vel.vx = S.springStep(vel.vx, x, target.x, dt, S.DEFAULT_THROW_POWER);
      vel.vy = S.springStep(vel.vy, y, target.y, dt, S.DEFAULT_THROW_POWER);
      x += vel.vx * dt;
      y += vel.vy * dt;
      this.sendBounds(x, y); // 移动的是窗口（this.pos 实时更新）；sprite 在本窗口内不动
      this.dragFollow = requestAnimationFrame(step);
    };
    this.dragFollow = requestAnimationFrame(step);
  },

  /** 停止抛掷（空中被抓/点菜单/回家时定格在当前落点）。必须同时清 throwState——否则「抓住后温柔放下」
   *  会残留最后一次飞行速度，静止的宠物点一下就被误判成飞行中。 */
  stopThrow() {
    this.throwToken++;
    if (this.throwRef !== null) {
      cancelAnimationFrame(this.throwRef);
      this.throwRef = null;
    }
    this.throwState = null;
  },

  /** 纯落位：拖拽/弹弓/被撞都直接定在该点，不再抛掷、重力、反弹或跨窗碰撞（物理引擎已移除）。 */
  startThrow(px, py) {
    this.stopDragFollow();
    this.stopMove();
    this.stopThrow();
    this.sendBounds(px, py);
    this.customPos = { rx: (this.pos.x + this.halfW) / VIEW.w, ry: (this.pos.y + this.halfH) / VIEW.h };
    window.__dshPetDebug.lastDragRelease = { x: this.pos.x, y: this.pos.y };
  },

  // 位置 / 抛掷指令（POST /position、POST /throw）
  stopPosFollow() {
    this.posFollowToken++;
    if (this.posFollow !== null) {
      cancelAnimationFrame(this.posFollow);
      this.posFollow = null;
    }
  },

  /**
   * 位置指令：把宠物中心挪到归一化坐标 (rx, ry)，与 customPos 同一套语义。
   * mode 三选一：instant 一帧到位；spring 走过阻尼弹簧；line 在 duration 毫秒里直线走完
   * （duration <= 0 等同 instant）。用户正按着宠物时整拍静默丢弃——手指底下的东西不该跑。
   * 归一化空间是工作区并集的外接矩形，落点会被夹到 AREAS 并集（空洞不可达）。
   */
  moveToCenter(rx, ry, mode, duration) {
    if (this.dragState.active) return; // 用户交互优先
    this.stopThrow(); // 先显式接管：停掉飞行与走路（stopMove 顺带停掉上一次的位置跟随）
    this.stopMove();
    // 归一化空间是外接矩形，不规则布局里含大片空洞；position() 的 customPos 分支零夹取，
    // 不夹的话落进空洞的坐标会把宠物放进看不见的地方。鼠标拖拽到不了那里不是因为代码在拦，
    // 而是光标物理上出不去屏幕——位置接口必须自己补这道守卫：把身体中心夹到 AREAS 并集。
    const c = S.clampPointToRegion(AREAS, rx * VIEW.w, ry * VIEW.h);
    // 夹取后的比例才是要写进 customPos 的值：position() 会按它重算窗口位置。
    const fx = c.x / VIEW.w;
    const fy = c.y / VIEW.h;
    const px = c.x - this.halfW;
    const py = c.y - this.halfH;
    if (mode === 'instant' || (mode === 'line' && duration <= 0)) {
      this.sendBounds(px, py);
      this.customPos = { rx: fx, ry: fy };
      return;
    }
    const token = ++this.posFollowToken;
    if (mode === 'line') {
      // 直线补间：在像素空间插值——按归一化比例插值会把斜线走歪（外接矩形不是正方形）
      const fromX = this.pos.x;
      const fromY = this.pos.y;
      const t0 = performance.now();
      const step = () => {
        if (this.posFollowToken !== token) return;
        const p = Math.min((performance.now() - t0) / duration, 1);
        if (p >= 1) {
          // 精确落位：终点不留残余偏差（弹簧那条靠收敛阈值收尾，这条靠 p 到 1）
          this.posFollow = null;
          this.sendBounds(px, py);
          this.customPos = { rx: fx, ry: fy };
          return;
        }
        this.sendBounds(fromX + (px - fromX) * p, fromY + (py - fromY) * p);
        this.posFollow = requestAnimationFrame(step);
      };
      this.posFollow = requestAnimationFrame(step);
      return;
    }
    // spring：过阻尼弹簧跟随——没有行程时间，靠收敛判定自己收尾
    let last = performance.now();
    const vel = { vx: 0, vy: 0 };
    const step = () => {
      if (this.posFollowToken !== token) return;
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      let x = this.pos.x;
      let y = this.pos.y;
      vel.vx = S.springStep(vel.vx, x, px, dt, S.DEFAULT_THROW_POWER);
      vel.vy = S.springStep(vel.vy, y, py, dt, S.DEFAULT_THROW_POWER);
      x += vel.vx * dt;
      y += vel.vy * dt;
      this.sendBounds(x, y);
      // 收敛判定：足够近且足够慢 → 精确落位并提交。拖拽跟手靠指针松手结束，这条得自己判。
      if (Math.abs(px - x) < 0.5 && Math.abs(py - y) < 0.5 && Math.abs(vel.vx) < 1 && Math.abs(vel.vy) < 1) {
        this.posFollow = null;
        this.sendBounds(px, py);
        this.customPos = { rx: fx, ry: fy };
        return;
      }
      this.posFollow = requestAnimationFrame(step);
    };
    this.posFollow = requestAnimationFrame(step);
  },

  /**
   * 抛掷指令：角度（度，0 = 正右，逆时针为正）+ 力度倍率 → 初速度，交给 startThrow；
   * 下游的重力/反弹/摩擦/落地 Q 弹/跨窗碰撞全是既有行为。
   */
  throwWith() {
    /* 抛掷已移除：桌面端为纯跟手，点播 /throw 指令不再产生飞行。 */
  },

  /** 被撞回调（跨窗碰撞 broker 转发）：停当前动作，从落点以新初速抛出去（全复用现有物理） */
  onDeskHit(vx, vy) {
    this.stopMove();
    this.stopDragFollow();
    this.stopThrow();
    this.startThrow(this.pos.x, this.pos.y, vx, vy);
  },

  /** Q 弹挤压：前台视频垂直压扁（贴地锚定再回弹），曲线在 shared。depth = 下压幅度
   *  （点击固定 0.55，落地按冲击速度动态取）；reduce-motion 时跳过。 */
  startSquash(el, depth = S.SQ_SQUASH) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const token = ++this.squashToken;
    if (this.squashRef !== null) cancelAnimationFrame(this.squashRef);
    const origin = el.style.transformOrigin;
    el.style.transformOrigin = 'bottom';
    const t0 = performance.now();
    const step = () => {
      if (this.squashToken !== token) return;
      const u = Math.min((performance.now() - t0) / S.SQ_DURATION_MS, 1);
      const scale = S.squashScale(u, depth);
      el.style.transform = (this.facing === 'right' ? 'scaleX(-1) ' : '') + 'scaleY(' + scale + ')';
      if (u < 1) {
        this.squashRef = requestAnimationFrame(step);
      } else {
        this.squashRef = null;
        el.style.transformOrigin = origin;
        // 恢复纯镜像（若期间 switchTo 重置过 transform，也以镜像为准）
        el.style.transform = this.facing === 'right' ? 'scaleX(-1)' : '';
      }
    };
    this.squashRef = requestAnimationFrame(step);
  },

  stopSquash() {
    this.squashToken++;
    if (this.squashRef !== null) {
      cancelAnimationFrame(this.squashRef);
      this.squashRef = null;
    }
  },

  // 点击 vs 拖拽（阈值/抓取偏移/释放回循环待机；移动的是窗口）
});
