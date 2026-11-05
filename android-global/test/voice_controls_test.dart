import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:contentflow_global/core/providers.dart';
import 'package:contentflow_global/data/api_client.dart';
import 'package:contentflow_global/data/models.dart';
import 'package:contentflow_global/features/create/create_screen.dart';
import 'package:contentflow_global/features/voice/voice.dart';

/// Test note: the mic appends recognized speech and a second tap stops it.
/// The speaker starts playback and a second tap stops it.
/// Create puts a 56px mic on the topic and on the material field, and a 48px
/// speaker on the generated title, hook and script cards. The platform channel
/// is replaced here, so the test does not open a microphone.

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
    _events.add({'type': 'partial', 'text': 'lamp'});
    _events.add({'type': 'final', 'text': 'desk lamp'});
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
    String? targetMarket,
    String? material,
    List<String>? platforms,
  }) async {
    return ContentPack.fromJson({
      'titles': ['Desk lamp, three ways'],
      'hooks': ['Lead with the result'],
      'script': 'Spoken script for the lamp',
    });
  }
}

void main() {
  test('joinVoiceText keeps what was already typed', () {
    expect(joinVoiceText('', ' desk lamp '), 'desk lamp');
    expect(joinVoiceText('Topic', 'lamp'), 'Topic lamp');
  });

  testWidgets('mic writes the final phrase and a second tap stops', (tester) async {
    final transport = _Scripted()..emitFinal = false;
    final voice = VoiceController(transport: transport);
    final controller = TextEditingController(text: 'Topic');
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: VoiceMicButton(controller: controller, copy: voiceCopyEn, voice: voice, controlKey: 'voice-mic')),
    ));
    await tester.tap(find.byKey(const ValueKey('voice-mic')));
    await tester.pump();
    expect(voice.listening, isTrue);
    await tester.tap(find.byKey(const ValueKey('voice-mic')));
    await tester.pump();
    expect(transport.stops, 1);
    expect(controller.text, 'Topic');

    transport.emitFinal = true;
    await tester.tap(find.byKey(const ValueKey('voice-mic')));
    await tester.pump();
    expect(controller.text, 'Topic desk lamp');
  });

  testWidgets('speaker starts and a second tap stops', (tester) async {
    final transport = _Scripted();
    final voice = VoiceController(transport: transport);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: SpeakButton(text: 'Spoken script', copy: voiceCopyEn, voice: voice, controlKey: 'script')),
    ));
    await tester.tap(find.byKey(const ValueKey('script')));
    await tester.pump();
    expect(transport.spoken, ['Spoken script']);
    expect(voice.speaking, isTrue);
    await tester.tap(find.byKey(const ValueKey('script')));
    await tester.pump();
    expect(transport.speakStops, 1);
    expect(voice.speaking, isFalse);
  });

  testWidgets('a denied microphone explains the permission in English', (tester) async {
    final transport = _Scripted()..startError = PlatformException(code: 'permission');
    final voice = VoiceController(transport: transport);
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: VoiceMicButton(controller: TextEditingController(), copy: voiceCopyEn, voice: voice)),
    ));
    await tester.tap(find.byKey(const ValueKey('voice-mic')));
    await tester.pump();
    expect(find.text(voiceCopyEn.micDenied), findsOneWidget);
    expect(find.textContaining('麦克风'), findsNothing);
  });

  testWidgets('create screen puts the mic on the topic and a speaker on the script card', (tester) async {
    tester.view.physicalSize = const Size(900, 4000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(_FakeApi())],
      child: const MaterialApp(home: CreateScreen()),
    ));
    expect(find.byKey(const ValueKey('voice-mic-topic')), findsOneWidget);
    expect(find.byKey(const ValueKey('voice-mic-material')), findsOneWidget);
    expect(tester.getSize(find.byKey(const ValueKey('voice-mic-topic'))), const Size(56, 56));
    await tester.enterText(find.byType(TextField).first, 'desk lamp');
    await tester.tap(find.text('Generate content pack'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('voice-speak-Script')), findsOneWidget);
    expect(find.byKey(const ValueKey('voice-speak-Generated titles')), findsOneWidget);
    expect(find.byKey(const ValueKey('voice-speak-Hooks')), findsOneWidget);
    final speak = tester.getSize(find.byKey(const ValueKey('voice-speak-Script')));
    expect(speak.width, greaterThanOrEqualTo(48));
    expect(speak.height, greaterThanOrEqualTo(48));
  });
}
