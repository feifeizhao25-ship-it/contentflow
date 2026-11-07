import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Copy for the mic and speaker. Chinese on the domestic apps, English on the international apps.
class VoiceCopy {
  final String mic;
  final String listening;
  final String speak;
  final String stop;
  final String micDenied;
  final String unavailable;
  final String locale;

  const VoiceCopy({
    required this.mic,
    required this.listening,
    required this.speak,
    required this.stop,
    required this.micDenied,
    required this.unavailable,
    required this.locale,
  });
}

const voiceCopyEn = VoiceCopy(
  mic: 'Voice input',
  listening: 'Listening. Tap to stop',
  speak: 'Read aloud',
  stop: 'Stop reading',
  micDenied: 'Allow the microphone and speech recognition, then try again.',
  unavailable: 'Voice is not available on this device.',
  locale: 'en-US',
);

class VoiceException implements Exception {
  final String code;
  VoiceException(this.code);
}

/// Appends a recognized phrase without eating the words already in the field.
String joinVoiceText(String base, String spoken) {
  final extra = spoken.trim();
  if (extra.isEmpty) return base;
  if (base.trim().isEmpty) return extra;
  return '${base.trimRight()} $extra';
}

abstract class VoiceTransport {
  Future<void> listenStart(String locale);
  Future<void> listenStop();
  Future<void> speak(String text, String locale);
  Future<void> speakStop();
  Stream<Map<String, dynamic>> get events;
}

class ChannelVoiceTransport implements VoiceTransport {
  static const _method = MethodChannel('contentflow/voice');
  static const _events = EventChannel('contentflow/voice/events');
  Stream<Map<String, dynamic>>? _cached;

  @override
  Stream<Map<String, dynamic>> get events => _cached ??= _events.receiveBroadcastStream().map((event) {
        final raw = event is Map ? event : const <Object?, Object?>{};
        return Map<String, dynamic>.from(raw);
      });

  @override
  Future<void> listenStart(String locale) => _method.invokeMethod('listenStart', {'locale': locale});

  @override
  Future<void> listenStop() => _method.invokeMethod('listenStop');

  @override
  Future<void> speak(String text, String locale) => _method.invokeMethod('speak', {'text': text, 'locale': locale});

  @override
  Future<void> speakStop() => _method.invokeMethod('speakStop');
}

/// One session for the screen. The platform channel is not touched until a control is tapped.
class VoiceController extends ChangeNotifier {
  VoiceController({VoiceTransport? transport}) : _transport = transport;

  final VoiceTransport? _transport;
  VoiceTransport? _opened;
  VoiceTransport get transport => _opened ??= _transport ?? ChannelVoiceTransport();

  bool listening = false;
  bool speaking = false;
  String? speakingKey;
  String? lastError;
  StreamSubscription<Map<String, dynamic>>? _sub;
  void Function(String text, bool isFinal)? _onText;

  Future<void> _ensure() async {
    _sub ??= transport.events.listen(_onEvent, onError: (_) {
      listening = false;
      speaking = false;
      speakingKey = null;
      lastError = 'unavailable';
      notifyListeners();
    });
  }

  void _onEvent(Map<String, dynamic> event) {
    final type = event['type']?.toString() ?? '';
    final text = event['text']?.toString() ?? '';
    switch (type) {
      case 'partial':
        _onText?.call(text, false);
      case 'final':
        _onText?.call(text, true);
        listening = false;
        notifyListeners();
      case 'listen-end':
        listening = false;
        notifyListeners();
      case 'speak-start':
        speaking = true;
        notifyListeners();
      case 'speak-done':
        speaking = false;
        speakingKey = null;
        notifyListeners();
      case 'error':
        listening = false;
        speaking = false;
        speakingKey = null;
        lastError = text.isEmpty ? 'unavailable' : text;
        notifyListeners();
    }
  }

  Future<void> toggleListen({
    required String locale,
    required void Function(String text, bool isFinal) onText,
  }) async {
    await _ensure();
    lastError = null;
    if (listening) {
      listening = false;
      notifyListeners();
      await transport.listenStop();
      return;
    }
    if (speaking) {
      speaking = false;
      speakingKey = null;
      await transport.speakStop();
    }
    _onText = onText;
    listening = true;
    notifyListeners();
    try {
      await transport.listenStart(locale);
    } on PlatformException catch (error) {
      listening = false;
      lastError = error.code;
      notifyListeners();
      throw VoiceException(error.code);
    }
  }

  Future<void> toggleSpeak({required String key, required String text, required String locale}) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    await _ensure();
    lastError = null;
    if (speaking && speakingKey == key) {
      speaking = false;
      speakingKey = null;
      notifyListeners();
      await transport.speakStop();
      return;
    }
    if (listening) {
      listening = false;
      await transport.listenStop();
    }
    speakingKey = key;
    speaking = true;
    notifyListeners();
    try {
      await transport.speak(trimmed, locale);
    } on PlatformException catch (error) {
      speaking = false;
      speakingKey = null;
      lastError = error.code;
      notifyListeners();
      throw VoiceException(error.code);
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

/// Shared device session. Tests pass their own [VoiceController] into the buttons.
final VoiceController deviceVoice = VoiceController();

String _messageFor(VoiceException error, VoiceCopy copy) {
  if (error.code == 'permission') return copy.micDenied;
  return copy.unavailable;
}

/// Round mic at the trailing edge of a compose field. 56px so a thumb can hit it.
class VoiceMicButton extends StatefulWidget {
  final TextEditingController controller;
  final VoiceCopy copy;
  final VoiceController? voice;
  final String controlKey;

  const VoiceMicButton({
    super.key,
    required this.controller,
    required this.copy,
    this.voice,
    this.controlKey = 'voice-mic',
  });

  @override
  State<VoiceMicButton> createState() => _VoiceMicButtonState();
}

class _VoiceMicButtonState extends State<VoiceMicButton> {
  VoiceController get _voice => widget.voice ?? deviceVoice;
  String? _base;

  @override
  void initState() {
    super.initState();
    _voice.addListener(_rebuild);
  }

  @override
  void didUpdateWidget(VoiceMicButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.voice != widget.voice) {
      (oldWidget.voice ?? deviceVoice).removeListener(_rebuild);
      _voice.addListener(_rebuild);
    }
  }

  @override
  void dispose() {
    _voice.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  void _apply(String text, bool isFinal) {
    _base ??= widget.controller.text;
    final next = joinVoiceText(_base!, text);
    widget.controller.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
    if (isFinal) _base = next;
  }

  Future<void> _toggle() async {
    if (!_voice.listening) _base = widget.controller.text;
    try {
      await _voice.toggleListen(locale: widget.copy.locale, onText: _apply);
      if (!_voice.listening) _base = widget.controller.text;
    } on VoiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_messageFor(error, widget.copy))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final on = _voice.listening;
    final label = on ? widget.copy.listening : widget.copy.mic;
    final scheme = Theme.of(context).colorScheme;
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        label: label,
        child: Material(
          key: ValueKey(widget.controlKey),
          color: on ? scheme.primary : scheme.primaryContainer,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: _toggle,
            child: SizedBox(
              width: 56,
              height: 56,
              child: Icon(
                on ? Icons.stop_rounded : Icons.mic_none_rounded,
                size: 26,
                color: on ? scheme.onPrimary : scheme.onPrimaryContainer,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Speaker for one AI text block. The icon is small; the hit target is 48px for a thumb.
class SpeakButton extends StatefulWidget {
  final String text;
  final VoiceCopy copy;
  final VoiceController? voice;
  final String controlKey;

  const SpeakButton({
    super.key,
    required this.text,
    required this.copy,
    this.voice,
    required this.controlKey,
  });

  @override
  State<SpeakButton> createState() => _SpeakButtonState();
}

class _SpeakButtonState extends State<SpeakButton> {
  VoiceController get _voice => widget.voice ?? deviceVoice;

  @override
  void initState() {
    super.initState();
    _voice.addListener(_rebuild);
  }

  @override
  void didUpdateWidget(SpeakButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.voice != widget.voice) {
      (oldWidget.voice ?? deviceVoice).removeListener(_rebuild);
      _voice.addListener(_rebuild);
    }
  }

  @override
  void dispose() {
    _voice.removeListener(_rebuild);
    super.dispose();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  bool get _playing => _voice.speaking && _voice.speakingKey == widget.controlKey;

  Future<void> _toggle() async {
    try {
      await _voice.toggleSpeak(key: widget.controlKey, text: widget.text, locale: widget.copy.locale);
    } on VoiceException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_messageFor(error, widget.copy))));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.text.trim().isEmpty) return const SizedBox.shrink();
    final label = _playing ? widget.copy.stop : widget.copy.speak;
    return IconButton(
      key: ValueKey(widget.controlKey),
      tooltip: label,
      onPressed: _toggle,
      constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
      iconSize: 22,
      icon: Icon(_playing ? Icons.stop_rounded : Icons.volume_up_rounded),
    );
  }
}
