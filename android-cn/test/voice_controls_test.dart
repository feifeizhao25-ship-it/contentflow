import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_cn/core/providers.dart';
import 'package:contentflow_cn/data/api_client.dart';
import 'package:contentflow_cn/data/models.dart';
import 'package:contentflow_cn/features/create/create_screen.dart';
import 'package:contentflow_cn/features/voice/voice.dart';

/// 测试说明：麦克风把识别结果接在已有文字后面；再点一次停止。
/// 喇叭再点一次停止。创作页的主题旁有麦克风，生成后的标题和脚本卡片上有喇叭。
/// 设备通道在测试里被替换，不会真的打开麦克风。

class _Scripted implements VoiceTransport {
  final StreamController<Map<String, dynamic>> _events = StreamController<Map<String, dynamic>>.broadcast();
  int starts = 0;
  int stops = 0;
  int speakStops = 0;
  final List<String> spoken = [];
  bool emitFinal = true;
  Object? startError;

  @override
  Stream<Map<String, dynamic>> get events => _events.stream;

  @override
  Future<void> listenStart(String locale) async {
    if (startError != null) throw startError!;
    starts++;
    if (!emitFinal) return;
    _events.add({'type': 'partial', 'text': '台灯'});
    _events.add({'type': 'final', 'text': '台灯教程'});
  }

  @override
  Future<void> listenStop() async => stops++;

  @override
  Future<void> speak(String text, String locale) async => spoken.add(text);

  @override
  Future<void> speakStop() async => speakStops++;
}

class _FakeApi implements ApiClient {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<ContentPack> generateContentPack({
    required String topic,
    int titleCount = 5,
    List<String>? platforms,
    List<String>? avoidTerms,
  }) async {
    return ContentPack.fromJson({
      'titles': ['台灯的三种写法'],
      'hooks': ['先说结论'],
      'script': '这是一段口播脚本',
    });
  }
}

void main() {
  test('joinVoiceText keeps what was already typed', () {
    expect(joinVoiceText('', ' 台灯教程 '), '台灯教程');
    expect(joinVoiceText('主题', '教程'), '主题 教程');
    expect(joinVoiceText('主题 ', '教程'), '主题 教程');
  });

  testWidgets('mic writes the final phrase and a second tap stops', (tester) async {
    final transport = _Scripted()..emitFinal = false;
    final voice = VoiceController(transport: transport);
    final controller = TextEditingController(text: '主题');
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: VoiceMicButton(controller: controller, copy: voiceCopyZh, voice: voice, controlKey: 'voice-mic')),
    ));
    await tester.tap(find.byKey(const ValueKey('voice-mic')));
    await tester.pump();
    expect(voice.listening, isTrue);
    expect(transport.starts, 1);
    await tester.tap(find.byKey(const ValueKey('voice-mic')));
    await tester.pump();
    expect(transport.stops, 1);
    expect(voice.listening, isFalse);
    expect(controller.text, '主题');

    transport.emitFinal = true;
    await tester.tap(find.byKey(const ValueKey('voice-mic')));
    await tester.pump();
    expect(controller.text, '主题 台灯教程');
    expect(voice.listening, isFalse);
  });

  testWidgets('speaker starts and a second tap stops', (tester) async {
    final transport = _Scripted();
    final voice = VoiceController(transport: transport);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: SpeakButton(text: '口播脚本', copy: voiceCopyZh, voice: voice, controlKey: 'script')),
    ));
    await tester.tap(find.byKey(const ValueKey('script')));
    await tester.pump();
    expect(transport.spoken, ['口播脚本']);
    expect(voice.speaking, isTrue);
    await tester.tap(find.byKey(const ValueKey('script')));
    await tester.pump();
    expect(transport.speakStops, 1);
    expect(voice.speaking, isFalse);
  });

  testWidgets('a denied microphone explains the permission in Chinese', (tester) async {
    final transport = _Scripted()..startError = PlatformException(code: 'permission');
    final voice = VoiceController(transport: transport);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: VoiceMicButton(controller: TextEditingController(), copy: voiceCopyZh, voice: voice)),
    ));
    await tester.tap(find.byKey(const ValueKey('voice-mic')));
    await tester.pump();
    expect(find.text(voiceCopyZh.micDenied), findsOneWidget);
    expect(voice.listening, isFalse);
  });

  testWidgets('create screen puts the mic on the topic and a speaker on the script card', (tester) async {
    tester.view.physicalSize = const Size(900, 3600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(_FakeApi())],
      child: const MaterialApp(home: CreateScreen()),
    ));
    expect(find.byKey(const ValueKey('voice-mic-topic')), findsOneWidget);
    expect(tester.getSize(find.byKey(const ValueKey('voice-mic-topic'))), const Size(56, 56));
    await tester.enterText(find.byType(TextField).first, '台灯');
    await tester.tap(find.text('生成内容包'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('voice-speak-脚本')), findsOneWidget);
    expect(find.byKey(const ValueKey('voice-speak-生成的标题')), findsOneWidget);
    expect(find.byKey(const ValueKey('voice-speak-钩子')), findsOneWidget);
    final speak = tester.getSize(find.byKey(const ValueKey('voice-speak-脚本')));
    expect(speak.width, greaterThanOrEqualTo(48));
    expect(speak.height, greaterThanOrEqualTo(48));
  });
}
