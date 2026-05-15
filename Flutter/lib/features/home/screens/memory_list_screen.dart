import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/features/home/screens/memory_details_screen.dart';
import 'package:buddy_mobile/shared/utils/memory_icon_utils.dart';
import 'package:buddy_mobile/shared/widgets/pressable.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:flutter/cupertino.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/features/home/screens/memory_edit_screen.dart';

class MemoryListScreen extends StatefulWidget {
  const MemoryListScreen({super.key});

  @override
  State<MemoryListScreen> createState() => _MemoryListScreenState();
}

class _MemoryListScreenState extends State<MemoryListScreen> {
  String _activeFilter = 'All';
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  List<String> _buildFilters(List<Map<String, dynamic>> items) {
    final tagSet = <String>{};
    for (final item in items) {
      final raw = item['tags'];
      if (raw is List) {
        for (final t in raw) {
          final s = t.toString().trim();
          if (s.isNotEmpty) tagSet.add(s);
        }
      }
    }
    final sorted = tagSet.toList()..sort();
    return ['All', ...sorted];
  }

  // Rotating color palette matching JSX design
  static final _palette = [
    AppColors.accent,
    AppColors.teal,
    AppColors.orange,
    AppColors.pink,
    AppColors.purple,
    AppColors.green,
  ];

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () {
        if (mounted) {
          Provider.of<MemoriesProvider>(context, listen: false).loadMemories();
        }
      },
    );
    _searchCtrl.addListener(
      () => setState(() => _searchQuery = _searchCtrl.text.toLowerCase()),
    );
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleDelete(Map<String, dynamic> item) async {
    final type = item['type'] ?? 'memory';
    final confirmed = await showCupertinoDialog<bool>(
      context: context,
      builder:
          (context) => CupertinoAlertDialog(
            title: Text(type == 'memory' ? 'Forget Memory?' : 'Delete Document?'),
            content: Text(
              type == 'memory'
                  ? 'Are you sure you want Buddy to forget this memory?'
                  : 'Are you sure you want to delete this document?',
            ),
            actions: [
              CupertinoDialogAction(
                child: const Text('Cancel'),
                onPressed: () => Navigator.pop(context, false),
              ),
              CupertinoDialogAction(
                isDestructiveAction: true,
                child: const Text('Delete'),
                onPressed: () => Navigator.pop(context, true),
              ),
            ],
          ),
    );

    if (confirmed == true) {
      if (!mounted) return;
      final provider = Provider.of<MemoriesProvider>(context, listen: false);
      await provider.deleteItem(item['_id'], type);
      ToastUtils.showSuccessToast(
        type == 'memory' ? 'Memory forgotten' : 'Document deleted',
      );
    }
  }

  List<Map<String, dynamic>> _apply(List<Map<String, dynamic>> items) {
    var list = items;
    if (_activeFilter != 'All') {
      list = list
          .where(
            (m) =>
                (m['tags'] as List?)?.any(
                  (t) => t.toString().toLowerCase().contains(
                    _activeFilter.toLowerCase(),
                  ),
                ) ??
                false,
          )
          .toList();
    }
    if (_searchQuery.isNotEmpty) {
      list = list
          .where(
            (m) => (m['content'] as String? ?? '').toLowerCase().contains(
              _searchQuery,
            ),
          )
          .toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    final provider = Provider.of<MemoriesProvider>(context);
    final allItems = provider.memories.cast<Map<String, dynamic>>();
    final filters = _buildFilters(allItems);
    // Reset active filter if it no longer exists in data
    if (!filters.contains(_activeFilter)) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => setState(() => _activeFilter = 'All'),
      );
    }
    final filtered = _apply(allItems);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: null,
      body: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  clipBehavior: Clip.hardEdge,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(36),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                    ],
                    border: Border.all(
                      color: AppColors.border.withValues(alpha: 0.8),
                      width: 1,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Row(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.maybePop(context),
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: AppColors.bg,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.border.withValues(alpha: 0.5),
                              ),
                            ),
                            child: Icon(
                              LucideIcons.chevronLeft,
                              size: 20,
                              color: AppColors.text,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.bg,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppColors.border,
                                width: 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  LucideIcons.search,
                                  size: 16,
                                  color: AppColors.textDim,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: _searchCtrl,
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      color: AppColors.text,
                                    ),
                                    decoration: InputDecoration(
                                      hintText: 'Search...',
                                      hintStyle: GoogleFonts.inter(
                                        fontSize: 13,
                                        color: AppColors.textDim,
                                      ),
                                      border: InputBorder.none,
                                      enabledBorder: InputBorder.none,
                                      focusedBorder: InputBorder.none,
                                      disabledBorder: InputBorder.none,
                                      filled: false,
                                      isCollapsed: true,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 48,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    itemCount: filters.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final f = filters[i];
                      final active = f == _activeFilter;
                      return GestureDetector(
                        onTap: () => setState(() => _activeFilter = f),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: active ? AppColors.accent : AppColors.surface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: active ? AppColors.accent : AppColors.border,
                            ),
                            boxShadow: !active ? [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 6,
                                offset: const Offset(0, 1),
                              ),
                            ] : [
                              BoxShadow(
                                color: AppColors.accent.withValues(alpha: 0.25),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Text(
                            f,
                            style: GoogleFonts.nunito(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: active ? Colors.white : AppColors.textMid,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ),
          ),
          Expanded(
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
          ? _buildEmpty()
          : RefreshIndicator(
              onRefresh: () => provider.loadMemories(),
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
                itemCount: filtered.length,
                itemBuilder: (_, i) {
                  final item = filtered[i];
                  final color = _palette[i % _palette.length];
                  return _MemoryCard(
                    item: item,
                    color: color,
                    onEdit: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => MemoryEditScreen(item: item)),
                    ),
                    onDelete: () => _handleDelete(item),
                    onView: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            MemoryDetailsScreen(item: item, color: color),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.accentLight,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(
              LucideIcons.database,
              size: 28,
              color: AppColors.accent,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'No memories found',
            style: GoogleFonts.nunito(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Your memories will appear here once saved.',
            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMid),
          ),
        ],
      ),
    );
  }
}

// ── Memory card (JSX-style) ────────────────────────────────────────────────
class _MemoryCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final Color color;
  final VoidCallback onView;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _MemoryCard({
    required this.item,
    required this.color,
    required this.onView,
    required this.onEdit,
    required this.onDelete,
  });

  IconData get _icon => getMemoryIcon(item);

  String get _date {
    final raw = item['updatedAt'] ?? item['createdAt'];
    if (raw == null) return '';
    try {
      final dt = DateTime.parse(raw.toString()).toLocal();
      final diff = DateTime.now().difference(dt);
      if (diff.inDays == 0) return 'Today';
      if (diff.inDays == 1) return 'Yesterday';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }

  String get _title {
    final type = item['type'] ?? 'memory';
    return type == 'memory'
        ? (item['content'] as String? ?? 'Memory').split('\n').first.trim()
        : (item['fileName'] as String? ?? 'Document');
  }

  String get _preview {
    final content = item['content'] as String? ?? '';
    if (content.length > 80) return '${content.substring(0, 80)}…';
    return content;
  }

  List<String> get _tags {
    final raw = item['tags'];
    if (raw is List) return raw.map((t) => t.toString()).toList();
    return [];
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      child: Slidable(
        key: ValueKey(item['_id']),
        startActionPane: ActionPane(
          motion: const BehindMotion(),
          extentRatio: 0.25,
          children: [
            _SlidableAction(
              label: 'Edit',
              icon: LucideIcons.pencil,
              color: AppColors.accent,
              onTap: onEdit,
            ),
          ],
        ),
        endActionPane: ActionPane(
          motion: const BehindMotion(),
          extentRatio: 0.25,
          children: [
            _SlidableAction(
              label: 'Delete',
              icon: LucideIcons.trash2,
              color: AppColors.danger,
              onTap: onDelete,
            ),
          ],
        ),
        child: Pressable(
          onTap: onView,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.cardBorder),
              boxShadow: AppColors.cardShadow,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Left color stripe
                    Container(width: 4, color: color),
                    // Card content
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Icon container
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    color.withValues(alpha: 0.18),
                                    color.withValues(alpha: 0.08),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: color.withValues(alpha: 0.25)),
                              ),
                              child: Icon(_icon, color: color, size: 18),
                            ),
                            const SizedBox(width: 12),
                            // Content
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          _title,
                                          style: GoogleFonts.nunito(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 14,
                                            color: AppColors.text,
                                          ),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      Icon(
                                        LucideIcons.chevronRight,
                                        size: 13,
                                        color: color,
                                      ),
                                    ],
                                  ),
                                  if (_preview.isNotEmpty) ...[
                                    const SizedBox(height: 3),
                                    Text(
                                      _preview,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: AppColors.textMid,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                  if (_date.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        Icon(
                                          LucideIcons.clock,
                                          size: 11,
                                          color: AppColors.textDim,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          _date,
                                          style: GoogleFonts.inter(
                                            fontSize: 11,
                                            color: AppColors.textDim,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                  if (_tags.isNotEmpty) ...[
                                    const SizedBox(height: 9),
                                    Row(
                                      children: [
                                        ..._tags
                                            .take(2)
                                            .map(
                                              (t) => Padding(
                                                padding: const EdgeInsets.only(
                                                  right: 6,
                                                ),
                                                child: _Chip(
                                                  label: t,
                                                  color: color,
                                                  small: true,
                                                ),
                                              ),
                                            ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  final bool small;
  const _Chip({required this.label, required this.color, this.small = false});

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: small ? 8 : 11,
        vertical: small ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: small ? 10 : 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _SlidableAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _SlidableAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: GestureDetector(
          onTap: () {
            Slidable.of(context)?.close();
            onTap();
          },
          child: Container(
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: Colors.white, size: 22),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: GoogleFonts.nunito(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
