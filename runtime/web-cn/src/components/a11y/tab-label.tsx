import React from 'react';

/**
 * 页签标题。antd 图标默认把英文图标名写进 aria-label（safety、user、bell…）。
 * 标签面板用 aria-labelledby 指向页签按钮；iOS Safari 计算这个名字时
 * 仍会读出 aria-hidden 后代的 aria-label，于是「账号与数据」变成「safety 账号与数据」。
 * 装饰图标必须去掉 aria-label，可访问名称才只剩可见中文。
 */
type DecorativeIconProps = {
  'aria-hidden'?: boolean;
  'aria-label'?: string;
  role?: string;
};

export function tabLabel(icon: React.ReactElement<DecorativeIconProps>, text: string) {
  return (
    <span>
      {React.cloneElement(icon, {
        'aria-hidden': true,
        role: 'presentation',
        'aria-label': undefined,
      })}
      {text}
    </span>
  );
}
