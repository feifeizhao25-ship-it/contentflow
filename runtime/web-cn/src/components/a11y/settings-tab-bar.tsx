import React, { useRef } from 'react';

/**
 * 设置页页签栏。
 * antd Tabs 在放不下时会把「更多」按钮插进 role=tablist（按钮不是 tab），
 * 窄屏还要把「账号与数据」滚到屏幕外才找得到。
 * 这里改成可换行的页签：tablist 里只有 tab，六个页签都留在视口里。
 * 页签 id 必须跟 rc-tabs 面板的 aria-labelledby 一致（`${id}-tab-${key}`）。
 */
type SettingsTabBarProps = {
  id?: string | null;
  activeKey?: string;
  onTabClick?: (key: string, event: React.MouseEvent | React.KeyboardEvent) => void;
  panes?: React.ReactNode;
};

type TabEntry = { key: string; label: React.ReactNode };

function tabEntries(panes: React.ReactNode): TabEntry[] {
  return React.Children.toArray(panes).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const props = child.props as { tab?: React.ReactNode; tabKey?: string };
    if (!props.tabKey) return [];
    return [{ key: props.tabKey, label: props.tab }];
  });
}

export function SettingsTabBar({ id, activeKey, onTabClick, panes }: SettingsTabBarProps) {
  const tabs = tabEntries(panes);
  const pendingFocus = useRef<string | null>(null);

  React.useEffect(() => {
    const key = pendingFocus.current;
    if (!key || !id) return;
    pendingFocus.current = null;
    document.getElementById(`${id}-tab-${key}`)?.focus();
  }, [activeKey, id]);

  const move = (event: React.KeyboardEvent<HTMLDivElement>, nextIndex: number) => {
    const next = tabs[nextIndex];
    if (!next || !onTabClick) return;
    event.preventDefault();
    pendingFocus.current = next.key;
    onTabClick(next.key, event);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.key === activeKey);
    if (current < 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(event, (current + 1) % tabs.length);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(event, (current - 1 + tabs.length) % tabs.length);
    else if (event.key === 'Home') move(event, 0);
    else if (event.key === 'End') move(event, tabs.length - 1);
  };

  return (
    <div role="tablist" aria-orientation="horizontal" className="settings-tablist" onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={id ? `${id}-tab-${tab.key}` : undefined}
            aria-selected={selected}
            aria-controls={id ? `${id}-panel-${tab.key}` : undefined}
            tabIndex={selected ? 0 : -1}
            className={selected ? 'settings-tab is-active' : 'settings-tab'}
            onClick={(event) => onTabClick?.(tab.key, event)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
