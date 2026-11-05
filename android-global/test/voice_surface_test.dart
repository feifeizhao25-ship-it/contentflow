import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Android declares the microphone and speech engine queries', () {
    final manifest = File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
    expect(manifest, contains('android.permission.RECORD_AUDIO'));
    expect(manifest, contains('android.speech.RecognitionService'));
    expect(manifest, contains('android.intent.action.TTS_SERVICE'));
  });
}
