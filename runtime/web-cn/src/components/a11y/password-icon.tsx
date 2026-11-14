import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';

/** 密码框的显示/隐藏开关。antd 默认把英文图标名 eye / eye-invisible 当成可访问名称。 */
export function passwordVisibilityIcon(visible: boolean) {
  return visible
    ? <EyeOutlined aria-label="隐藏密码" />
    : <EyeInvisibleOutlined aria-label="显示密码" />;
}
