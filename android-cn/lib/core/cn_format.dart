/// 国内版界面上的数字和平台名。一千以上不写成 1.2k。
String formatCount(int number) {
  if (number >= 10000) {
    final wan = number / 10000;
    final text = wan >= 10 ? wan.toStringAsFixed(0) : wan.toStringAsFixed(1);
    final trimmed = text.endsWith('.0') ? text.substring(0, text.length - 2) : text;
    return '$trimmed万';
  }
  return number.toString();
}

String platformName(String platform) {
  switch (platform.toLowerCase()) {
    case 'douyin':
    case 'tiktok':
      return '抖音';
    case 'xiaohongshu':
    case 'xhs':
    case 'redbook':
      return '小红书';
    case 'bilibili':
    case 'bili':
      return 'B站';
    case 'weibo':
      return '微博';
    case 'weixin':
    case 'channels':
    case 'wechat_channels':
      return '视频号';
    case 'wechat':
    case 'wechat_mp':
      return '公众号';
    case 'kuaishou':
      return '快手';
    case 'zhihu':
      return '知乎';
    default:
      return '其他平台';
  }
}
