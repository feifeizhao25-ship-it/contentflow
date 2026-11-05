import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('iOS explains the microphone and speech recognition in English', () {
    final plist = File('ios/Runner/Info.plist').readAsStringSync();
    expect(plist, contains('NSMicrophoneUsageDescription'));
    expect(plist, contains('NSSpeechRecognitionUsageDescription'));
    expect(plist, contains('when you tap the mic'));
    expect(plist, isNot(contains('只在你点击麦克风时使用')));
  });
}
