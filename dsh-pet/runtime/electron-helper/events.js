/**
 * 桌面 Helper 的事件联动：余额、碎碎念、第三方点播与工作状态的展示与轮询。
 *
 * 展示与 tick 回调挂在 PetSprite.prototype 上，必须在 sprite.js 之后加载（顶层就改写原型）；startLoops 是全部轮询的
 * 唯一入口，boot 成功后调用。不负责动画播放与气泡渲染本身（见 sprite.js）。依赖 constants.js / sprite.js。
 *
 * @module dsh-pet/runtime/electron-helper/events
 */
'use strict';

// 工作状态联动：容器每秒轮询 /state，counter 变化才递增 tick，各宠物按 workStatusEnabled 门控。
// 气泡驻留：thinking/working/result/waiting 常驻到状态切走，success/error 10s 自动收起，state=null 收起。
// 动画：进行中档位循环播，终态播一遍回 idle 链；回空闲时把正在循环的那段改成「播完即停」。
PetSprite.prototype.onWorkTick = function onWorkTick(snapshot, tick) {
  if (!this.pet.workStatusEnabled) return; // 未启用工作状态联动 -> 该宠物完全免疫（与浏览器一致）
  if (tick === 0 || tick === this.prevWorkTick) return;
  this.prevWorkTick = tick;
  // 占用锁：锁生效时不响应工作状态——它是自动来源（任务事件驱动），没有「用户手动要」这条路。
  // 判在 tick 消费之后：占用期间的变化当过去了，解冻时由 applyFreeze 重新对齐当前状态。
  // 宿主侧不挡这个全局段：sections.workStatus 是所有宠物共用一份，跳过写入会连带静音别的宠物。
  if (this.frozen) return;
  const state = snapshot && snapshot.state ? snapshot.state : null;
  this.workState = state; // 当前工作状态：互动/事件动画播完恢复档位循环用
  const stateChanged = this.prevWorkState !== state;
  this.prevWorkState = state;
  if (!state) {
    // 回空闲：把正在循环播的进行中档位动画改成「播完即停」。进行中档位走 switchTo(name, false)
    // （loop=true、onended=null），ended 永不触发；这里不切动画，链就拿不到推进信号，
    // 宠物会卡在那段工作动画上。只改当前段：它结束后走 handleEnded → playIdle。
    // 睡觉时前台那段是睡姿循环：改掉它的 loop/onended 会既打断睡姿又把随机链拽回来，跳过。
    if (!this.sleeping && S.poolIncludes(this.animations.events?.workStatus ?? [], this.anim)) {
      const frontEl = this.front === 0 ? this.videoA : this.videoB;
      if (frontEl) {
        frontEl.loop = false;
        frontEl.onended = () => this.handleEnded();
      }
    }
    // 空闲：收起常驻气泡
    if (this.workTimer !== null) window.clearTimeout(this.workTimer);
    this.workTimer = null;
    this.workOn = false;
    this.workText = null;
    this.renderBubble();
    return;
  }
  const pool = this.animations.events?.workStatus;
  if (!pool || pool.length === 0) {
    console.error('[dsh-pet] 配置缺少 animations.events.workStatus，无法播放工作状态动画');
    return;
  }
  const idx = S.WORK_STATUS_INDEX[state];
  const slot = pool[idx];
  if (slot === undefined) {
    console.error('[dsh-pet] work-status 档位索引越界：state=' + state + ' idx=' + idx);
    return;
  }
  const name = S.pickSlot(slot, this.anim); // 数组槽位档内随机抽 1，避开当前正播动画（与浏览器一致）
  console.log(
    '[dsh-pet] ' +
      new Date().toTimeString().slice(0, 8) +
      ' workStatus pet=' +
      this.pet.id +
      ' state=' +
      state +
      ' -> [' +
      idx +
      '] ' +
      name,
  );
  this.stopMove();
  // 气泡文本：任务详情优先，否则从条目级 workStatusTexts[档位] 随机抽一句；整档缺失则只播动画。
  const textGroup = Array.isArray(this.pet.workStatusTexts) ? this.pet.workStatusTexts[idx] : undefined;
  const configuredText =
    Array.isArray(textGroup) && textGroup.length > 0
      ? textGroup[Math.floor(Math.random() * textGroup.length)]
      : undefined;
  this.workText = (snapshot && snapshot.task) || configuredText || null;
  const terminal = state === 'success' || state === 'error';
  // 气泡点亮/收起只在状态变化时动作：同状态后续 tick 不重新点亮已自动收起的终态气泡，否则会被反复弹回。
  if (stateChanged) {
    this.workOn = true;
    if (this.workTimer !== null) window.clearTimeout(this.workTimer);
    this.workTimer = terminal
      ? window.setTimeout(() => {
          this.workOn = false;
          this.renderBubble();
        }, BUBBLE_DURATION_MS)
      : null; // 非终态：常驻，不设自动收起
  }
  this.renderBubble();
  // 睡觉：气泡与 workState 已经更新，动画不换——自动来源不该打断睡姿（睡姿循环归睡觉状态机）。
  if (this.sleeping) return;
  // 循环语义：终态播一遍回 idle；非终态多候选档位播一遍 → ended 轮换到下一候选；
  // 非终态单候选档位无限循环。
  const rotating = !terminal && Array.isArray(slot) && slot.length > 1;
  if (terminal || rotating) this.playOnce(name);
  else this.switchTo(name, false); // 进行中循环播（单动画/单候选档位）
};

// 轮询组装：容器统一拉取与触发，与浏览器端同一套路径。

// 统一轮询（GET /state，长轮询）：与浏览器同一份数据来源与渲染入口。
// 每个叶子 = { counter, data }：首拉只记基线（不渲染），之后 counter 变了才渲染。
let stateBaseline = null;
/** 我手里这份 S 的版本号（undefined = 首拉，不带参数 → 立刻拿全量） */
let stateSince;
/** 宿主支持长轮询吗？响应带 counter = 支持；不带 = 老宿主（会立刻返回全量，必须退避） */
let stateLongPoll = true;

/** 会话状态气泡叶子 → 所有宠物窗口换成同一份会话列表并重绘（多宠共享一份）。 */
function applySessionsLeaf(leaf) {
  const data = leaf && leaf.data;
  const list = Array.isArray(data)
    ? data
        .filter((x) => x && typeof x.id === 'string')
        .map((x) => ({
          id: String(x.id),
          title: typeof x.title === 'string' ? x.title : '',
          state: typeof x.state === 'string' ? x.state : '',
          tools: Array.isArray(x.tools) ? x.tools.filter((t) => typeof t === 'string') : [],
          tool: typeof x.tool === 'string' ? x.tool : undefined,
          detail: typeof x.detail === 'string' ? x.detail : undefined,
        }))
    : [];
  for (const s of sprites) {
    s.sessions = list;
    s.renderBubble();
  }
}

/** 说话叶子 → 对应宠物播说话动画 + 气泡。`kind: 'clear'` = 收起气泡，其余 = 弹一个气泡。 */
function applySayLeaf(petId, leaf) {
  const said = S.readSay(leaf);
  if (!said) return;
  for (const s of sprites) {
    if (s.pet.id !== petId) continue;
    if (said.kind === 'clear') {
      s.clearWhisper();
      continue;
    }
    s.showWhisper(said.text, said.image, said.url, said.duration, said.anim);
    // 两端各判各的：叶子点名 desktop 才念，没点名或点了网页端就只弹气泡。
    // 必须留在按 petId 过滤的循环里：每个窗口都收到全部叶子（全局计数器唤醒所有窗口），
    // 放到循环外会让没装这只宠物的窗口跟着一起念，N 只桌面宠物就是 N 份语音。
  }
}

/** 工作状态叶子 → 各宠物切档位动画 + 气泡（含回到空闲：state=null 用于收起常驻气泡） */
function applyWorkStatusLeaf(leaf) {
  const snap = S.toWorkStatus(leaf.data);
  if (!snap) return;
  workTick++;
  // 睡着不看不听：自动来源的工作状态整条跳过（动画与气泡都不更新），醒来后的下一次状态变化重新对齐
  for (const s of sprites) if (!s.sleeping) s.onWorkTick(snap, workTick);
}

/** 点播动画叶子 → 对应宠物播该动画。
 *  name 复用右键菜单同一个处理函数（镜像修正、移动类走真实位移），url 是第三方完整地址、
 *  只换源播一次。facing 必须在换源之前赋给 sprite——switchTo 在 onReady 里按它贴 scaleX(-1)。
 *  没给 facing 就保持宠物当前朝向；给了则跳过「文字类动画点播前强制朝左」的修正。 */
function applyAnimLeaf(petId, leaf) {
  const hit = S.readAnim(leaf);
  if (!hit) return;
  for (const s of sprites) {
    if (s.pet.id !== petId) continue;
    const explicitFacing = hit.facing !== undefined;
    if (explicitFacing) s.facing = hit.facing; // 必须在换源前：switchTo 里按它贴 scaleX(-1)
    if (hit.url !== undefined) s.playUrlOnce(hit.url, hit.playbackId);
    else if (hit.name !== undefined)
      s.onMenuAction({ label: hit.name, anim: hit.name, playbackId: hit.playbackId }, explicitFacing, true);
  }
}

/** 位置指令叶子 → 对应宠物挪过去；复用 sprite.moveToCenter，只分发、不重写运动学。 */
function applyPositionLeaf(petId, leaf) {
  const hit = S.readPosition(leaf);
  if (!hit) return;
  for (const s of sprites) {
    if (s.pet.id === petId) s.moveToCenter(hit.x, hit.y, hit.mode, hit.duration);
  }
}

/** 抛掷指令已移除：宿主不再提供 /throw，桌面端纯跟手，这里留空实现防御旧状态。 */
function applyThrowLeaf() {}

/** 占用锁叶子 → 对应宠物冻结/解冻。它不是指令而是状态：sprite 自己按 expiresAt 定时解除，
 *  因为宿主侧过期是懒判的、不会推「锁没了」。 */
function applyLockLeaf(petId, leaf) {
  const hit = S.readLock(leaf);
  if (!hit) return;
  for (const s of sprites) {
    if (s.pet.id === petId) s.setLock(hit);
  }
}

/** 睡觉叶子 → 对应宠物进睡/醒来。它同样是状态而不是指令：三段名由宿主挑定，sprite 只照播并
 *  自己推进「开始（一次）→ 循环（无限）→ 起来（一次）」——视频播完只有渲染端知道。 */
function applySleepLeaf(petId, leaf) {
  const data = leaf && leaf.data;
  if (!data || typeof data !== 'object') return;
  let state;
  if (data.sleeping === false) {
    state = { sleeping: false };
  } else if (data.sleeping === true) {
    // sleeping: true 却缺任何一段名 = 形状非法：宁可不睡（保持现状），也不播一段不存在的动画
    for (const key of ['start', 'loop', 'end']) {
      if (typeof data[key] !== 'string' || data[key] === '') return;
    }
    state = { sleeping: true, start: data.start, loop: data.loop, end: data.end };
  } else {
    return; // 不认识的取值（老宿主 / 脏数据）：跳过这一拍
  }
  for (const s of sprites) {
    if (s.pet.id === petId) s.setSleep(state);
  }
}

/** 第三方菜单快照叶子 → 灌进各宠物（右键菜单据此拼「更多」）。它是当前状态、不是事件，
 *  注册与覆盖时写一次，所有窗口共用同一份快照。 */
function applyMenuLeaf(leaf) {
  const items = S.readMenuItems(leaf ? leaf.data : null, 'desktop');
  for (const s of sprites) s.menuItems = items;
}

/** 系统通知段：桌面端用 Electron 原生通知弹出；帧映射与过滤复用 shared 的 frameToToast（aborted/interrupted 等跳过）。 */
function applyNotifyFrame(leaf) {
  if (!leaf || leaf.data === null) return;
  const cfg = typeof config !== 'undefined' ? config : null;
  if (cfg && cfg.notificationsEnabled === false) return;
  if (!S.frameToToast || !window.petBridge || typeof window.petBridge.notify !== 'function') return;
  const frame = leaf.data;
  const type = frame && frame.type;
  if (type === 'approval/requested' && cfg && cfg.notificationApproval === false) return;
  if (type === 'question/requested' && cfg && cfg.notificationQuestion === false) return;
  if (type === 'session/event' && cfg && cfg.notificationTurnEnd === 'never') {
    const ev = (frame && frame.event) || {};
    if (ev.type === 'turn/end') return;
  }
  const t = S.frameToToast(frame);
  if (!t) return;
  const sessionId = frame && typeof frame.sessionId === 'string' ? frame.sessionId : '';
  const silent = !!(cfg && cfg.notificationSound === 'none');
  window.petBridge.notify({ title: t.title, body: t.body, sessionId, silent });
}

/** 跑一拍 /state。返回 true = 按长轮询命中（宿主支持长轮询，可以立刻再请求）。 */
async function pollStateOnce() {
  try {
    const s = await S.fetchState(
      STATE_URL,
      stateLongPoll && stateSince !== undefined ? { since: stateSince, timeoutMs: STATE_WAIT_MS } : undefined,
    );
    if (!s) return false;
    // 响应带 counter = 宿主支持长轮询；不带 = 老宿主（不认识 since/timeout，会立刻返回全量），
    // 这时必须退回固定间隔轮询，否则这个循环就是忙等。
    stateLongPoll = typeof s.counter === 'number';
    if (stateLongPoll) stateSince = s.counter;
    if (stateBaseline === null) {
      stateBaseline = S.flattenCounters(s); // 首拉：只记基线，不渲染（避免启动/重载时重放旧气泡）
      // 第三方菜单项是状态而不是事件：首拉就要装上，否则 helper 重启后要等下次注册才出现
      applyMenuLeaf(s.sections ? s.sections.menu : null);
      // 会话气泡是状态：首拉补一次，否则 helper 重启前已在跑的会话不显示。
      applySessionsLeaf(s.sections ? s.sections.sessions : null);
      // 睡觉同样是状态：helper 重启 / 重载配置后宿主仍记着它在睡，这里必须补一次；
      // 否则渲染端显示醒着，而宿主因「已在睡」不回写叶子，只能等宿主重启才恢复。
      for (const [petId, entry] of Object.entries((s && s.pets) || {})) {
        if (entry && entry.sleep && entry.sleep.data !== null) applySleepLeaf(petId, entry.sleep);
      }
      return true;
    }
    for (const change of S.takeChanged(s, stateBaseline)) {
      if (change.leaf.data === null) continue;
      else if (change.path === 'sections.workStatus') applyWorkStatusLeaf(change.leaf);
      else if (change.path === 'sections.menu') applyMenuLeaf(change.leaf);
      else if (change.path === 'sections.notify') applyNotifyFrame(change.leaf);
      else if (change.path === 'sections.sessions') applySessionsLeaf(change.leaf);
      else if (change.path.startsWith('pets.') && change.path.endsWith('.say')) {
        // 宠物 id 允许含点号：按前缀/后缀切片，绝不 split('.')
        applySayLeaf(change.path.slice('pets.'.length, -'.say'.length), change.leaf);
      } else if (change.path.startsWith('pets.') && change.path.endsWith('.anim')) {
        // 点播动画：同样按前缀/后缀切片（counter 每次写入都递增，连点两次也会分发两次）
        applyAnimLeaf(change.path.slice('pets.'.length, -'.anim'.length), change.leaf);
      } else if (change.path.startsWith('pets.') && change.path.endsWith('.position')) {
        // 位置指令：同样按前缀/后缀切片，绝不 split('.')
        applyPositionLeaf(change.path.slice('pets.'.length, -'.position'.length), change.leaf);
      } else if (change.path.startsWith('pets.') && change.path.endsWith('.lock')) {
        // 占用锁：同上切片，绝不 split('.')。它是状态而不是指令（见 applyLockLeaf）
        applyLockLeaf(change.path.slice('pets.'.length, -'.lock'.length), change.leaf);
      } else if (change.path.startsWith('pets.') && change.path.endsWith('.sleep')) {
        // 睡觉：同上切片。它是状态而不是指令（见 applySleepLeaf）
        applySleepLeaf(change.path.slice('pets.'.length, -'.sleep'.length), change.leaf);
      }
    }
    return true;
  } catch {
    /* 轻量轮询失败静默：下一拍再试 */
    return false;
  }
}

function startLoops() {
  if (loopsStarted) return;
  loopsStarted = true;

  // 统一轮询是自调度的长轮询（请求 → 处理 → 立刻再请求）：宿主在版本没变时挂起，空闲时
  // 1 请求/秒，叶子一变立刻收到。本窗口只装一只宠物，所以每个窗口各跑一份；全局计数器意味着
  // 任意写入会唤醒所有窗口（有意为之）。
  const stateLoop = async () => {
    const hit = await pollStateOnce();
    setTimeout(() => void stateLoop(), hit && stateLongPoll ? 0 : 1000);
  };
  void stateLoop();
}
