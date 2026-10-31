import 'package:flutter/material.dart';

/// International edition only. Where the audience is decides which ad-disclosure wording applies.
/// Only markets the server has a sourced hint for are offered (Singapore, not "Southeast Asia").
const List<MapEntry<String, String>> kTargetMarkets = [
  MapEntry('', 'No specific market'),
  MapEntry('US', 'United States'),
  MapEntry('UK', 'United Kingdom'),
  MapEntry('IN', 'India'),
  MapEntry('SG', 'Singapore'),
];

class TargetMarketField extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  const TargetMarketField({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Where is your audience? (optional)',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          key: const ValueKey('target-market'),
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          items: [
            for (final m in kTargetMarkets)
              DropdownMenuItem(value: m.key, child: Text(m.value)),
          ],
          onChanged: (v) => onChanged(v ?? ''),
        ),
        const SizedBox(height: 4),
        const Text(
          'Shows the ad-disclosure wording that market accepts. Other regions are not covered yet.',
          style: TextStyle(fontSize: 12, color: Colors.black54),
        ),
      ],
    );
  }
}

class MaterialField extends StatelessWidget {
  final TextEditingController controller;
  const MaterialField({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Brand or product material (optional)',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        TextField(
          key: const ValueKey('brand-material'),
          controller: controller,
          maxLines: 4,
          maxLength: 4000,
          decoration: InputDecoration(
            hintText:
                'Paste specs, claims or facts you can stand behind. Figures and brand names are only taken from here.',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }
}

List<String> _strings(dynamic v) =>
    v is List ? v.map((e) => '$e').toList() : const [];

/// What the server did with the options, in plain words. Nothing here is computed on the device.
class GenerationNotes extends StatelessWidget {
  final Map<String, dynamic> notes;
  const GenerationNotes({super.key, required this.notes});

  Widget _title(String t) => Padding(
    padding: const EdgeInsets.only(top: 12, bottom: 4),
    child: Text(t, style: const TextStyle(fontWeight: FontWeight.bold)),
  );

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];

    final hint = notes['disclosure_hint'];
    if (hint is Map) {
      final labels = _strings(hint['labelExamples']);
      final avoid = _strings(hint['avoid']);
      final sources = hint['sources'] is List
          ? (hint['sources'] as List)
                .whereType<Map>()
                .map((s) => '${s['name']}')
                .toList()
          : <String>[];
      children
        ..add(_title('Ad disclosure for ${hint['marketName']}'))
        ..add(Text('Acceptable wording: ${labels.join(', ')}'))
        ..add(if_(avoid.isNotEmpty, Text('Avoid: ${avoid.join('; ')}')))
        ..add(Text('${hint['placement']}'))
        ..add(
          Text(
            'Sources: ${sources.join('; ')}. Guidance only, not legal advice.',
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
        );
    }

    final grounding = notes['grounding'];
    if (grounding is Map) {
      final supported = _strings(grounding['supported_by_material']);
      final unverified = _strings(grounding['unverified']);
      if (supported.isNotEmpty ||
          unverified.isNotEmpty ||
          grounding['material_supplied'] == true) {
        children.add(_title('Figures and brand names'));
        if (supported.isNotEmpty) {
          children.add(Text('Found in your material: ${supported.join(', ')}'));
        }
        if (unverified.isNotEmpty) {
          children.add(
            Text(
              'Not found in your topic or material: ${unverified.join(', ')}. Confirm or remove before publishing.',
              style: const TextStyle(color: Colors.red),
            ),
          );
        }
        if (unverified.isEmpty) {
          children.add(
            const Text(
              'Everything specific in the draft appears in what you supplied.',
            ),
          );
        }
        children.add(
          Text(
            '${grounding['notice'] ?? ''}',
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
        );
      }
    }

    final compliance = notes['compliance'];
    if (compliance is Map && compliance['rules_checked'] != null) {
      final counts = compliance['hit_counts'];
      final block = counts is Map ? counts['block'] : 0;
      final review = counts is Map ? counts['review'] : 0;
      children
        ..add(_title('Compliance screen'))
        ..add(
          Text(
            '${compliance['rules_checked']} rules checked: $block blocking, $review to review.',
          ),
        )
        ..add(
          Text(
            'Not checked: ${_strings(compliance['not_checked']).join('; ')}',
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
        )
        ..add(
          Text(
            '${compliance['disclaimer'] ?? ''}',
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
        );
    }

    final pos = notes['positioning_used'];
    if (pos is Map) {
      final personaUsed = pos['persona'] == true;
      final n = pos['top_titles'] is num
          ? (pos['top_titles'] as num).toInt()
          : 0;
      children
        ..add(_title('Personalisation'))
        ..add(
          Text(
            personaUsed || n > 0
                ? 'Used ${personaUsed ? 'your persona "${pos['persona_name']}"' : 'no persona'}${n > 0 ? ' and your $n best-scoring past titles' : ''} as reference only.'
                : 'No persona text or scored titles found, so this draft is not personalised.',
          ),
        );
    }

    if (children.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }
}

Widget if_(bool cond, Widget w) => cond ? w : const SizedBox.shrink();
