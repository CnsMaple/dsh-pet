/**
 * 气泡与悬浮提示的渲染：工作状态 / 碎碎念 / 余额三段内容共用一个气泡槽，按优先级择一显示。
 *
 * PetSprite 由 sprite.js 定义，本文件只往原型上挂方法，必须在其后加载。
 * 只读实例状态，除 DOM 与 syncInputBusy() 之外不写任何字段。
 * @module dsh-pet/runtime/electron-helper/sprite-bubble
 */
'use strict';

Object.assign(PetSprite.prototype, {
  setTip(on) {
    const next = !!on;
    if (next === this.tipOn) return;
    this.tipOn = next;
    this.renderTip();
  },

  /**
   * 悬浮提示渲染：文本 = 宠物显示名（宿主已保证非空）；位置 = 光标右下（装不下自动翻边），
   * 摆位判据与浏览器端共用 shared 的 tooltipPlacement。
   *
   * 光标存的是视口坐标，而提示是 position:fixed、DOM 坐标相对窗口，所以这里减掉窗口原点。
   * 存视口坐标而非窗口坐标，是因为窗口会随宠物移动：只在这里按当前原点重算一次，贴光标不会漂。
   */
  renderTip() {
    if (this.tip.textContent !== this.pet.name) this.tip.textContent = this.pet.name;
    const cursor = this.tipCursor;
    if (cursor) {
      const winX = this.pos.x - this.margin.l;
      const winY = this.pos.y - this.margin.t;
      const winW = this.size + this.margin.l + this.margin.r;
      const winH = this.winH + this.margin.t + this.margin.b;
      // 允许显示范围 = 窗口 ∩ 光标所在屏的工作区：只按窗口夹会画到屏幕外，只按工作区夹会落到
      // 窗口外（html/body 是 overflow:hidden，一样看不见）。
      const area = S.resolveRect(WORK_AREAS, cursor.x, cursor.y) ?? { x: winX, y: winY, width: winW, height: winH };
      const x0 = Math.max(winX, area.x);
      const y0 = Math.max(winY, area.y);
      const x1 = Math.min(winX + winW, area.x + area.width);
      const y1 = Math.min(winY + winH, area.y + area.height);
      const p = S.tooltipPlacement(
        { x: cursor.x - winX, y: cursor.y - winY },
        { w: this.tip.offsetWidth, h: this.tip.offsetHeight },
        { x: x0 - winX, y: y0 - winY, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) },
        this.size * S.TOOLTIP_GAP_RATIO,
      );
      this.tip.style.left = p.x + 'px';
      this.tip.style.top = p.y + 'px';
    }
    this.tip.classList.toggle('is-on', this.tipOn);
    window.__dshPetDebug.tooltipOn = this.tipOn;
  },
  /** 会话状态气泡：有会话时渲染到 sessionBox（向上堆叠），并让工作状态气泡让位。 */
  renderSessions(list) {
    const box = this.sessionBox;
    if (!box) return;
    if (!list || list.length === 0) {
      box.classList.remove('is-on');
      box.innerHTML = '';
      return;
    }
    const shown = this.showAllSessions ? list : list.slice(0, 1);
    const STATE_WORD = { thinking: '思考中', working: '运行中', result: '出结果', waiting: '等待确认' };
    box.innerHTML = '';
    for (const it of shown) {
      const b = document.createElement('div');
      b.className = 'pet-session-bubble';
      const t = document.createElement('div');
      t.className = 'dst';
      t.textContent = it.title || '';
      b.appendChild(t);
      if (it.state) {
        const s = document.createElement('div');
        s.className = 'dss';
        s.textContent = STATE_WORD[it.state] || it.state;
        b.appendChild(s);
      }
      for (const tool of Array.isArray(it.tools) ? it.tools : []) {
        const k = document.createElement('div');
        k.className = 'dsk';
        k.textContent = '· ' + tool;
        b.appendChild(k);
      }
      box.appendChild(b);
    }
    box.classList.add('is-on');
  },

  renderBubble() {
    const sessions = Array.isArray(this.sessions) ? this.sessions : [];
    // 有会话状态气泡时让位：待办面板 / 说话气泡优先，其余情况显示会话气泡、收起工作状态气泡。
    const showSessions = sessions.length > 0 && !this.todoOpen && !(this.whisperOn && this.whisperText);
    if (showSessions) {
      this.bubble.classList.remove('is-on');
      window.__dshPetDebug.lastBubbleTitle = sessions[0] && sessions[0].title ? String(sessions[0].title) : '';
      this.renderSessions(sessions);
      this.syncInputBusy();
      return;
    }
    this.renderSessions(null);
    this.bubble.classList.toggle('dsh-pet-todo-bubble', this.todoOpen);
    if (this.todoOpen) {
      this.bubble.classList.add('is-on');
      window.__dshPetDebug.lastBubbleTitle = '待办事项';
      this.syncInputBusy();
      return;
    }
    const workOn = !!(this.workOn && this.workText);
    const sayOn = !!(this.whisperOn && this.whisperText);
    const workTerminal = this.workState === 'success' || this.workState === 'error';
    const slot = workTerminal && workOn ? 'work' : sayOn ? 'say' : workOn ? 'work' : 'none';
    this.bubble.classList.toggle('is-whisper', slot === 'work' || slot === 'say');
    this.bubble.classList.remove('is-clickable', 'is-expanded');
    if (slot === 'none') {
      this.bubble.classList.remove('is-on');
      window.__dshPetDebug.lastBubbleTitle = '';
      this.syncInputBusy();
      return;
    }
    this.bubble.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'pet-bub-row';
    line.textContent = slot === 'work' ? this.workText : this.whisperText;
    this.bubble.appendChild(line);
    this.bubble.classList.add('is-on');
    window.__dshPetDebug.lastBubbleTitle = this.bubble.textContent.slice(0, 60);
    this.syncInputBusy();
  },
});
