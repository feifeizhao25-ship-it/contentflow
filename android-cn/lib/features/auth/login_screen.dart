import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/app_theme.dart';
import '../../core/providers.dart';
import '../../core/error_text.dart';
import '../../data/api_exception.dart';
import 'china_mobile.dart';
import 'sms_resend_countdown.dart';

enum _LoginMode { sms, email }

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _tenantController = TextEditingController();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  final _cooldown = SmsResendCountdown();

  _LoginMode _mode = _LoginMode.sms;
  bool _loading = false;
  bool _sendingCode = false;
  bool _showTeamCode = false;
  String? _error;
  Timer? _ticker;

  @override
  void dispose() {
    _ticker?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    _tenantController.dispose();
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  void _switchMode(_LoginMode mode) {
    if (_mode == mode) return;
    setState(() {
      _mode = mode;
      _error = null;
    });
  }

  void _armTicker() {
    _ticker?.cancel();
    if (!_cooldown.coolingDown) {
      _ticker = null;
      return;
    }
    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (!_cooldown.tick()) {
          timer.cancel();
          _ticker = null;
        }
      });
    });
  }

  void _startCooldown(int seconds) {
    _cooldown.start(resolveResendSeconds(seconds));
    _armTicker();
  }

  Future<void> _sendCode() async {
    if (_sendingCode || _loading || _cooldown.coolingDown) return;
    final phone = normalizeChinaMobile(_phoneController.text);
    if (phone == null) {
      setState(() => _error = kChinaMobileError);
      return;
    }
    setState(() {
      _sendingCode = true;
      _error = null;
    });
    try {
      final ticket = await ref
          .read(apiClientProvider)
          .sendLoginSmsCode(phone: phone);
      if (!mounted) return;
      setState(() => _startCooldown(ticket.resendAfterSeconds));
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('验证码已发送，请注意查收短信')));
    } catch (e) {
      if (!mounted) return;
      final text = friendlyError(e, fallback: '验证码发送失败，请稍后重试');
      final wait = e is ApiException && e.statusCode == 429
          ? cooldownSecondsFromMessage(text)
          : null;
      setState(() {
        _error = text;
        if (wait != null && wait > 0) _startCooldown(wait);
      });
    } finally {
      if (mounted) setState(() => _sendingCode = false);
    }
  }

  Future<void> _loginWithSms() async {
    final phone = normalizeChinaMobile(_phoneController.text);
    if (phone == null) {
      setState(() => _error = kChinaMobileError);
      return;
    }
    final code = _codeController.text.trim();
    if (!isSixDigitCode(code)) {
      setState(() => _error = kSmsCodeError);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).loginWithSms(phone: phone, code: code);
      if (!mounted) return;
      ref.invalidate(authStateProvider);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('登录成功')));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyError(e, fallback: '登录失败，请检查验证码后重试');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleLogin() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final email = _emailController.text.trim();
      final password = _passwordController.text.trim();
      if (email.isEmpty || password.isEmpty) {
        setState(() {
          _error = '请输入邮箱和密码';
          _loading = false;
        });
        return;
      }

      await ref
          .read(apiClientProvider)
          .login(
            email: email,
            password: password,
            tenantSlug: _tenantController.text.trim(),
          );

      if (!mounted) return;
      ref.invalidate(authStateProvider);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('登录成功')));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyError(e, fallback: '登录失败，请检查邮箱和密码后重试');
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _submit() {
    if (_loading) return Future.value();
    return _mode == _LoginMode.sms ? _loginWithSms() : _handleLogin();
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).shortestSide >= 600;
    final busy = _loading || _sendingCode;
    return Scaffold(
      backgroundColor: AppColors.page(context),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              // iPad / 宽屏：表单收进一张居中的卡片，不再把输入框直接铺在页面上。
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: wide ? AppColors.card(context) : null,
                  borderRadius: BorderRadius.circular(16),
                  border: wide
                      ? Border.all(
                          color: Theme.of(context).colorScheme.outlineVariant,
                        )
                      : null,
                ),
                child: Padding(
                  padding: EdgeInsets.all(wide ? 32 : 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Image.asset(
                          'assets/images/cf_login_hero.webp',
                          height: 150,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const SizedBox(height: 150),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '分发侠',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: wide ? 18 : 14,
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '欢迎登录',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: wide ? 32 : 24,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _mode == _LoginMode.sms ? '使用手机号验证码登录' : '使用邮箱和密码登录',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.muted(context),
                          fontSize: wide ? 16 : 14,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ChoiceChip(
                            key: const ValueKey('login-mode-sms'),
                            label: const Text('手机号验证码登录'),
                            selected: _mode == _LoginMode.sms,
                            onSelected: busy
                                ? null
                                : (_) => _switchMode(_LoginMode.sms),
                          ),
                          ChoiceChip(
                            key: const ValueKey('login-mode-email'),
                            label: const Text('邮箱密码登录'),
                            selected: _mode == _LoginMode.email,
                            onSelected: busy
                                ? null
                                : (_) => _switchMode(_LoginMode.email),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (_mode == _LoginMode.sms)
                        ..._smsFields()
                      else
                        ..._emailFields(),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            _error!,
                            key: const ValueKey('login-error'),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                      FilledButton(
                        key: const ValueKey('login-submit'),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                        ),
                        onPressed: _loading ? null : _submit,
                        child: _loading
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onPrimary,
                                ),
                              )
                            : const Text('登录'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _smsFields() {
    final sendDisabled = _sendingCode || _loading || _cooldown.coolingDown;
    return [
      TextField(
        key: const ValueKey('login-phone'),
        controller: _phoneController,
        keyboardType: TextInputType.phone,
        textInputAction: TextInputAction.next,
        decoration: const InputDecoration(
          labelText: '手机号',
          helperText: '11 位中国大陆手机号，可带 +86',
          helperMaxLines: 2,
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 16),
      TextField(
        key: const ValueKey('login-code'),
        controller: _codeController,
        keyboardType: TextInputType.number,
        textInputAction: TextInputAction.done,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(6),
        ],
        decoration: const InputDecoration(
          labelText: '验证码',
          helperText: '6 位数字验证码',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 12),
      OutlinedButton(
        key: const ValueKey('login-send-code'),
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        onPressed: sendDisabled ? null : _sendCode,
        child: _sendingCode
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(_cooldown.buttonLabel),
      ),
    ];
  }

  List<Widget> _emailFields() {
    return [
      TextField(
        key: const ValueKey('login-email'),
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        decoration: const InputDecoration(
          labelText: '邮箱',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 16),
      TextField(
        key: const ValueKey('login-password'),
        controller: _passwordController,
        obscureText: true,
        decoration: const InputDecoration(
          labelText: '密码',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 8),
      // 复测 B14：「工作室标识」普通创作者看不懂。默认收起，只有加入了团队的人才需要展开。
      if (!_showTeamCode)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            key: const ValueKey('show-team-code'),
            onPressed: () => setState(() => _showTeamCode = true),
            child: const Text('我加入了团队，有团队代码'),
          ),
        )
      else ...[
        const SizedBox(height: 8),
        TextField(
          key: const ValueKey('team-code-field'),
          controller: _tenantController,
          decoration: const InputDecoration(
            labelText: '团队代码',
            helperText: '团队管理员发给你的代码。个人使用不需要填写。',
            helperMaxLines: 2,
            border: OutlineInputBorder(),
          ),
        ),
      ],
    ];
  }
}
