import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
    token: {
        // Primary colors - 活力紫 (Vibrant Purple)
        colorPrimary: '#6366f1',
        colorSuccess: '#10b981',
        colorWarning: '#f59e0b',
        colorError: '#ef4444',
        colorInfo: '#3b82f6',

        // Background & Surface
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBgLayout: '#f8fafc',

        // Border
        borderRadius: 8,

        // Typography
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 14,

        // Spacing
        padding: 16,
        margin: 16,
    },
    components: {
        Layout: {
            headerBg: '#ffffff',
            siderBg: '#1e1b4b', // 深靛蓝
            bodyBg: '#f8fafc',
            headerPadding: '0 24px',
        },
        Menu: {
            darkItemBg: '#1e1b4b',
            darkItemSelectedBg: '#4f46e5',
            darkItemHoverBg: '#312e81',
            itemBorderRadius: 8,
        },
        Button: {
            borderRadius: 8,
            controlHeight: 40,
            fontWeight: 500,
        },
        Card: {
            borderRadius: 12,
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        },
        Input: {
            borderRadius: 8,
            controlHeight: 40,
        },
        Select: {
            borderRadius: 8,
            controlHeight: 40,
        },
    },
};

// Dark mode theme (optional)
export const darkTheme: ThemeConfig = {
    ...theme,
    token: {
        ...theme.token,
        colorBgContainer: '#1f2937',
        colorBgElevated: '#111827',
        colorBgLayout: '#0f172a',
    },
};
