/**
 * 「测试弹窗」按钮的动作：走真实通知链路——请求宿主写一条 notify 帧进 /state，
 * 桌面宠物窗口（Electron）据此弹原生通知。网页端不再重复弹 Web 通知。
 * 不持有状态，反馈通过回调交给设置页。
 * @module dsh-pet/src/client/settings/notify-test
 */
import { ROUTE_PATH } from '../../shared/constants.ts';
import type { Feedback } from './actions.ts';

/** {@link runNotificationTest} 的依赖。 */
export interface NotificationTestDeps {
  /** 文案翻译。 */
  t: (key: string) => string;
  /** 把结果交给设置页显示；空文案表示清掉上一次的红字。 */
  report: (feedback: Feedback) => void;
}

/**
 * 跑一次「测试弹窗」。
 * @param deps - 翻译与反馈回调。
 */
export async function runNotificationTest(deps: NotificationTestDeps): Promise<void> {
  const { t, report } = deps;
  report({ kind: '', text: '' });
  try {
    const resp = await fetch(ROUTE_PATH + '/notify-test', { method: 'POST' });
    if (!resp.ok) throw new Error('notify-test HTTP ' + resp.status);
    report({ kind: 'ok', text: t('notifyTestOk') });
  } catch (e) {
    report({ kind: 'err', text: t('notifyDenyError') + (e instanceof Error ? '：' + e.message : String(e)) });
  }
}
