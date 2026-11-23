/// 获取验证码后的本地冷却。服务端默认 60 秒（SMS_RESEND_COOLDOWN_SECONDS），
/// 成功响应里的 resendAfterSeconds 优先；没给出正数时仍用 60 秒，避免连点。
class SmsResendCountdown {
  static const int defaultSeconds = 60;

  int remaining = 0;

  bool get coolingDown => remaining > 0;

  String get buttonLabel => coolingDown ? '$remaining 秒后重试' : '获取验证码';

  void start(int seconds) {
    remaining = seconds < 0 ? 0 : seconds;
  }

  /// 前进一秒。冷却仍在进行时返回 true。
  bool tick() {
    if (remaining <= 0) return false;
    remaining -= 1;
    return remaining > 0;
  }

  void clear() => remaining = 0;
}

int resolveResendSeconds(int? seconds) {
  if (seconds == null || seconds <= 0) return SmsResendCountdown.defaultSeconds;
  return seconds;
}

/// 从 429 文案「请 N 秒后再试」里取出 N。没有秒数时返回 null（例如日限额）。
int? cooldownSecondsFromMessage(String message) {
  final match = RegExp(r'(\d+)\s*秒').firstMatch(message);
  if (match == null) return null;
  return int.tryParse(match.group(1)!);
}
