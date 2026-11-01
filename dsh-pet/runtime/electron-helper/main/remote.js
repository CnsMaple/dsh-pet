/**
 * 远程显示模式的监督器：从宿主拉宠物列表并在变化时重建窗口，同时用 /config 拉取是否持续失败判断宿主死活。
 *
 * 显示层进程由宿主在 Windows 侧拉起，宿主一旦消失（插件卸载 / WSL 停机），本进程应自行退出，
 * 所以把「连续多次拉配置失败」当作宿主已死的信号，交回调收尾。
 * @module dsh-pet/runtime/electron-helper/main/remote
 */
'use strict';

/** 连续失败多少次判定宿主已消失（每拍约 1–2s）。 */
const HOST_DEAD_AFTER_FAILURES = 5;

/**
 * 把宿主 `/config` 返回的成品聚合拍平成桌面窗口列表（与渲染端 flattenConfigPets 同序同口径）。
 *
 * @param merged - 成品配置 `{ <条目>: { pets: [...] } }`。
 * @returns `[{ id, size, index }]`，index 为桌面可见列表内的序号（渲染端按它取宠物）。
 */
function petsFromMerged(merged) {
  const out = [];
  if (!merged || typeof merged !== 'object') return out;
  for (const entry of Object.keys(merged)) {
    const conf = merged[entry];
    const list = conf && Array.isArray(conf.pets) ? conf.pets : [];
    for (const pet of list) {
      const display = pet && pet.display;
      if (display !== 'desktop' && display !== 'both') continue;
      const size = Number(pet && pet.size) > 0 ? Number(pet.size) : 462;
      out.push({ id: String(pet && pet.id != null ? pet.id : 'pet-' + out.length), size, index: out.length });
    }
  }
  return out;
}

/**
 * 造远端监督器。
 *
 * @param deps.bridge - 与宿主通信的通道（hostRequest 走 RPC）。
 * @param deps.petWindows - 窗口能力（rebuild 按新列表重建）。
 * @param deps.petRoute - 宠物路由前缀（来自远程配置）。
 * @param deps.onHostGone - 判定宿主消失时的收尾回调（通常 app.exit）。
 * @returns `{ start, stop }`。
 */
function createRemoteSupervisor(deps) {
  const { bridge, petWindows, petRoute, onHostGone } = deps;
  let lastSignature = null;
  let failures = 0;
  let timer = null;
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      // 先做一次短超时探活：宿主消失时跨 WSL 的连接可能被黑洞、不会立刻回 RST，
      // 直接拉 /config 会卡到 RPC 的 60s 超时，宠物窗口要几分钟才收得掉。
      await bridge.probe(3000);
      const resp = await bridge.hostRequest('GET', petRoute + '/config');
      failures = 0;
      const pets = petsFromMerged(JSON.parse((resp && resp.body) || '{}'));
      const signature = JSON.stringify(pets);
      if (signature !== lastSignature) {
        lastSignature = signature;
        petWindows.rebuild(pets);
      }
    } catch (error) {
      failures += 1;
      if (failures >= HOST_DEAD_AFTER_FAILURES) {
        stopped = true;
        console.error(
          '[dsh-pet] 连续 ' +
            failures +
            ' 次拉取配置失败，判定宿主已退出：' +
            String(error && error.message ? error.message : error),
        );
        onHostGone();
        return;
      }
    }
    if (!stopped) timer = setTimeout(() => void tick(), failures > 0 ? 1000 : 2000);
  }

  return {
    start() {
      void tick();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

module.exports = { createRemoteSupervisor, petsFromMerged };
