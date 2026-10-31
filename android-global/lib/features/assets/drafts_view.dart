import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/providers.dart';
import '../../data/models.dart';
import '../../data/api_exception.dart';

/// Saved content-pack drafts (what "Save to content pack" creates), shown on the Assets tab.
class DraftsView extends ConsumerWidget {
  const DraftsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final drafts = ref.watch(contentDraftsProvider);
    return drafts.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        key: const ValueKey('drafts-error'),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text((e is ApiException ? e.message : 'Could not load your drafts.'), style: TextStyle(color: Colors.grey.shade700)),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => ref.invalidate(contentDraftsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(contentDraftsProvider),
            child: ListView(
              key: const ValueKey('drafts-empty'),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 90),
                Icon(Icons.edit_note, size: 64, color: Colors.grey.shade400),
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    'No saved drafts yet',
                    style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: Text(
                    'Generate a content pack in Create and tap "Save to content pack". It will show up here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
                  ),
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(contentDraftsProvider),
          child: ListView.separated(
            key: const ValueKey('drafts-list'),
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _DraftCard(draft: items[i]),
          ),
        );
      },
    );
  }
}

String _plain(String text) => text
    .replaceAll(RegExp(r'[#*_`>]+'), '')
    .replaceAll(RegExp(r'-{3,}'), ' ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim();

String _when(DateTime d) => DateFormat.yMMMd().add_jm().format(d.toLocal());

class _DraftCard extends StatelessWidget {
  final ContentDraft draft;
  const _DraftCard({required this.draft});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = draft.title.trim().isEmpty ? '(Untitled)' : draft.title.trim();
    final snippet = _plain(draft.body);
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      elevation: 1,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _openDetail(context, draft),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              if (snippet.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  snippet,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: theme.primaryColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      draft.source == 'ai' ? 'AI generated' : 'Created manually',
                      style: TextStyle(fontSize: 11, color: theme.primaryColor),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _when(draft.createdAt),
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

void _openDetail(BuildContext context, ContentDraft draft) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(sheetContext).size.height * 0.85),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                draft.title.trim().isEmpty ? '(Untitled)' : draft.title.trim(),
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                _when(draft.createdAt),
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: SingleChildScrollView(
                  child: SelectableText(
                    draft.body.isEmpty ? '(No text)' : draft.body,
                    style: const TextStyle(fontSize: 14, height: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: draft.body));
                        if (sheetContext.mounted) {
                          ScaffoldMessenger.of(sheetContext).showSnackBar(
                            const SnackBar(content: Text('Copied')),
                          );
                        }
                      },
                      icon: const Icon(Icons.copy, size: 18),
                      label: const Text('Copy'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(sheetContext).pop(),
                      child: const Text('Close'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
