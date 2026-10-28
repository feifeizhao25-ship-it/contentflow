import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('安卓桌面名称是分发侠，不是英文包名', () {
    final manifest = File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
    expect(manifest, contains('android:label="分发侠"'));
    expect(manifest, isNot(contains('contentflow_mobile')));
    expect(manifest, contains('adjustResize'));
  });

  test('数字和平台名不使用英文缩写', () {
    final format = File('lib/core/cn_format.dart').readAsStringSync();
    expect(format, contains('万'));
    expect(format, isNot(contains("'}k'")));
    expect(format, contains("return '其他平台'"));
  });
}
