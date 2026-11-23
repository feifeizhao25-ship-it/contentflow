/// 与后端 `normalizeChinaMobile`（runtime/api/src/modules/auth/sms/phone.ts）同一规则：
/// 只接受中国大陆手机号（11 位，1[3-9] 开头），允许 +86 / 86 前缀以及空格、横线。
String? normalizeChinaMobile(String? input) {
  if (input == null) return null;
  var value = input.replaceAll(RegExp(r'[\s-]'), '');
  if (value.startsWith('+86')) {
    value = value.substring(3);
  } else if (value.length == 13 && value.startsWith('86')) {
    value = value.substring(2);
  }
  if (RegExp(r'^1[3-9]\d{9}$').hasMatch(value)) return value;
  return null;
}

const String kChinaMobileError = '请输入正确的 11 位中国大陆手机号';
const String kSmsCodeError = '请输入 6 位数字验证码';

bool isSixDigitCode(String input) => RegExp(r'^\d{6}$').hasMatch(input);
