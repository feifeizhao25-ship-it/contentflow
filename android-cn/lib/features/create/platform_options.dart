import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../data/models.dart';

/// 国内版：服务端有改写规则的平台（每个平台一条规则）。
const List<MapEntry<String, String>> kPlatforms = [
  MapEntry('xhs', '小红书'),
  MapEntry('douyin', '抖音'),
  MapEntry('wechat_mp', '公众号'),
  MapEntry('weixin', '视频号'),
  MapEntry('bilibili', 'B站'),
  MapEntry('weibo', '微博'),
  MapEntry('zhihu', '知乎'),
];

const List<String> kDefaultPlatforms = ['xhs', 'douyin', 'wechat_mp'];

String platformLabel(String key) {
  for (final p in kPlatforms) {
    if (p.key == key.toLowerCase()) return p.value;
  }
  return '其他平台';
}

class PlatformPicker extends StatelessWidget {
  final Set<String> selected;
  final ValueChanged<Set<String>> onChanged;
  const PlatformPicker({super.key, required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('要适配的平台', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final p in kPlatforms)
              FilterChip(
                key: ValueKey('platform-${p.key}'),
                label: Text(p.value),
                selected: selected.contains(p.key),
                onSelected: (on) {
                  final next = {...selected};
                  if (on) {
                    next.add(p.key);
                  } else if (next.length > 1) {
                    next.remove(p.key); // 至少保留一个平台
                  }
                  onChanged(next);
                },
              ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          '服务端会按平台改写长度、结构和话题标签，不会改动事实内容。',
          style: TextStyle(fontSize: 12, color: Colors.black54),
        ),
      ],
    );
  }
}

/// 每个平台一份改写，按服务端返回的内容显示，可复制；设备上不做任何改写。
class PlatformAdapterSheet extends StatelessWidget {
  final Map<String, PlatformPayload> payloads;
  const PlatformAdapterSheet({super.key, required this.payloads});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: payloads.isEmpty
            ? const Text(
                '本次生成未返回平台适配内容，请重新生成或先保存草稿。',
                key: ValueKey('adapter-empty'),
              )
            : ListView(
                shrinkWrap: true,
                children: [
                  const Text('各平台版本', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  const Text(
                    '发布前请逐条阅读；AI 生成标识保留在第一行。',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const SizedBox(height: 12),
                  for (final entry in payloads.entries)
                    Card(
                      key: ValueKey('adapter-${entry.key}'),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    platformLabel(entry.key),
                                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                                  ),
                                ),
                                if (entry.value.charCount != null)
                                  Text('${entry.value.charCount} 字', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                                IconButton(
                                  key: ValueKey('copy-${entry.key}'),
                                  tooltip: '复制',
                                  icon: const Icon(Icons.copy, size: 18),
                                  onPressed: () async {
                                    await Clipboard.setData(ClipboardData(text: entry.value.adaptedContent ?? ''));
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('已复制${platformLabel(entry.key)}版本')),
                                      );
                                    }
                                  },
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            SelectableText(entry.value.adaptedContent ?? '暂无适配正文'),
                            for (final n in entry.value.notes)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text('• $n', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                              ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}
