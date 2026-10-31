import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../data/models.dart';

/// International edition. The platforms the server knows how to rewrite a post for (it has a rule per key).
const List<MapEntry<String, String>> kPlatforms = [
  MapEntry('instagram', 'Instagram'),
  MapEntry('tiktok', 'TikTok'),
  MapEntry('x', 'X'),
  MapEntry('linkedin', 'LinkedIn'),
  MapEntry('youtube', 'YouTube'),
  MapEntry('facebook', 'Facebook'),
];

const List<String> kDefaultPlatforms = ['instagram', 'tiktok', 'x'];

String platformLabel(String key) {
  for (final p in kPlatforms) {
    if (p.key == key.toLowerCase()) return p.value;
  }
  return key.isEmpty ? 'Other' : key[0].toUpperCase() + key.substring(1);
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
        const Text('Platforms to adapt for', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
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
                    next.remove(p.key); // at least one platform stays selected
                  }
                  onChanged(next);
                },
              ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'The server rewrites the draft once per platform: length, structure and hashtags. It does not change the facts.',
          style: TextStyle(fontSize: 12, color: Colors.black54),
        ),
      ],
    );
  }
}

/// One rewrite per platform, as the server returned it, with a copy button. Nothing is computed on the device.
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
                'This generation did not return platform versions. Generate again, or save the draft first.',
                key: ValueKey('adapter-empty'),
              )
            : ListView(
                shrinkWrap: true,
                children: [
                  const Text('Platform versions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  const Text(
                    'Read each one before you publish. The AI-generated label stays on the first line.',
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
                                  Text('${entry.value.charCount} characters', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                                IconButton(
                                  key: ValueKey('copy-${entry.key}'),
                                  tooltip: 'Copy',
                                  icon: const Icon(Icons.copy, size: 18),
                                  onPressed: () async {
                                    await Clipboard.setData(ClipboardData(text: entry.value.adaptedContent ?? ''));
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Copied the ${platformLabel(entry.key)} version')),
                                      );
                                    }
                                  },
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            SelectableText(entry.value.adaptedContent ?? 'No adapted text'),
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
