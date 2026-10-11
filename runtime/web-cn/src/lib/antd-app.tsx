'use client';

/**
 * antd 的提示与对话框（message / modal / notification）统一从这里取。
 *
 * 为什么：本工程是 React 19 + antd 5。antd 5 的静态方法（message.success、Modal.confirm、
 * notification.info …）在 React 19 下默认渲染不出来——生产构建里「批量重试」「通过」「提交审核」
 * 点了没反应、导出成功提示与报错提示都看不到。antd 官方给的两种做法之一是用 <App> + App.useApp()
 * 取得挂在组件树上的实例（还能继承 ConfigProvider 的中文语言包与主题）。
 *
 * 用法：页面、组件、store 里一律 `import { message, modal, notification } from '@/lib/antd-app'`，
 * 调用方式与 antd 静态方法相同（modal.confirm 替代 Modal.confirm）。
 * <AntdAppBridge /> 必须放在 ConfigProvider 里面、所有页面外面（见 app/client-providers.tsx）。
 * 门禁：scripts/test-antd-static.mjs 禁止再从 'antd' 直接引入 message / notification 或调用 Modal.confirm 等。
 */
import { useEffect } from 'react';
import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { HookAPI as ModalApi } from 'antd/es/modal/useModal';
import type { NotificationInstance } from 'antd/es/notification/interface';

const holder: { message: MessageInstance | null; modal: ModalApi | null; notification: NotificationInstance | null } = {
  message: null,
  modal: null,
  notification: null,
};

/** 挂在 <App> 里，把实例交给模块级代理（挂载后立即生效，早于任何用户操作）。 */
export function AntdAppBridge() {
  const app = App.useApp();
  useEffect(() => {
    holder.message = app.message;
    holder.modal = app.modal;
    holder.notification = app.notification;
  }, [app]);
  return null;
}

function need<T>(api: T | null, name: string): T {
  if (!api) {
    // 只会在 <AntdAppBridge /> 还没挂载时发生（例如组件树外的早期调用）；宁可在控制台说清楚，也不要静默不显示。
    throw new Error(`antd ${name} 尚未就绪：<AntdAppBridge /> 没有挂载在 ConfigProvider 里`);
  }
  return api;
}

export const message: MessageInstance = {
  open: (...args) => need(holder.message, 'message').open(...args),
  success: (...args) => need(holder.message, 'message').success(...args),
  error: (...args) => need(holder.message, 'message').error(...args),
  info: (...args) => need(holder.message, 'message').info(...args),
  warning: (...args) => need(holder.message, 'message').warning(...args),
  loading: (...args) => need(holder.message, 'message').loading(...args),
  destroy: (...args) => need(holder.message, 'message').destroy(...args),
};

export const modal: ModalApi = {
  info: (...args) => need(holder.modal, 'modal').info(...args),
  success: (...args) => need(holder.modal, 'modal').success(...args),
  error: (...args) => need(holder.modal, 'modal').error(...args),
  warning: (...args) => need(holder.modal, 'modal').warning(...args),
  confirm: (...args) => need(holder.modal, 'modal').confirm(...args),
};

export const notification: NotificationInstance = {
  open: (...args) => need(holder.notification, 'notification').open(...args),
  success: (...args) => need(holder.notification, 'notification').success(...args),
  error: (...args) => need(holder.notification, 'notification').error(...args),
  info: (...args) => need(holder.notification, 'notification').info(...args),
  warning: (...args) => need(holder.notification, 'notification').warning(...args),
  destroy: (...args) => need(holder.notification, 'notification').destroy(...args),
};
