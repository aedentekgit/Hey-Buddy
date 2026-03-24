import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/shared/utils/memory_icon_utils.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/features/home/screens/memory_edit_screen.dart';

class MemoryDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> item;
  final Color? color;

  const MemoryDetailsScreen({super.key, required this.item, this.color});

  // ── Helpers ──────────────────────────────────────────────────────────────

  Color get _color {
    if (color != null) return color!;
    final tags = _tags;
    if (tags.contains('Travel')) return AppColors.accent;
    if (tags.contains('Health')) return AppColors.teal;
    if (tags.contains('Work')) return AppColors.purple;
    if (tags.contains('Family')) return AppColors.pink;
    if (tags.contains('Vehicle')) return AppColors.orange;
    return AppColors.accent;
  }

  String get _title {
    final content = item['content'] as String? ?? '';
    return content.split('\n').first.trim().isNotEmpty
        ? content.split('\n').first.trim()
        : (item['fileName'] as String? ?? 'Memory');
  }

  String get _fullContent => item['content'] as String? ?? '';

  List<String> get _tags {
    final raw = item['tags'];
    if (raw is List) return raw.map((t) => t.toString()).toList();
    return [];
  }

  String get _updatedAt {
    final raw = item['updatedAt'] ?? item['createdAt'];
    if (raw == null) return '';
    try {
      final dt = DateTime.parse(raw.toString());
      final diff = DateTime.now().difference(dt);
      if (diff.inDays == 0) return 'Updated today';
      if (diff.inDays == 1) return 'Updated yesterday';
      return 'Updated ${diff.inDays} days ago';
    } catch (_) {
      return '';
    }
  }

  IconData get _icon => getMemoryIcon(item);

  /// Try to parse "Key: Value" lines from content into structured rows.
  /// Returns pairs; if fewer than 2 pairs, returns empty (use notes view instead).
  List<List<String>> get _parsedFields {
    final lines = _fullContent
        .split('\n')
        .where((l) => l.trim().isNotEmpty)
        .toList();
    final fields = <List<String>>[];
    for (final line in lines.skip(1)) {
      // skip title line
      final idx = line.indexOf(':');
      if (idx > 0 && idx < line.length - 1) {
        final key = line.substring(0, idx).trim();
        final val = line.substring(idx + 1).trim();
        if (key.length < 35 && val.isNotEmpty) {
          fields.add([key, val]);
        }
      }
    }
    return fields;
  }

  /// Notes = content lines that are NOT key:value pairs (after the title).
  String get _notes {
    final lines = _fullContent
        .split('\n')
        .where((l) => l.trim().isNotEmpty)
        .toList();
    if (lines.isEmpty) return '';
    // Skip title line; collect lines that aren't key:value
    final noteLines = lines.skip(1).where((line) {
      final idx = line.indexOf(':');
      if (idx > 0 && idx < line.length - 1) {
        final key = line.substring(0, idx).trim();
        if (key.length < 35) return false; // is a structured field
      }
      return true;
    }).toList();
    return noteLines.join('\n').trim();
  }

  String _getFileUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    return AppConfig.formatImageUrl(path) ?? '';
  }

  bool _isImage(String url) {
    final lower = url.toLowerCase();
    return lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.gif') ||
        lower.endsWith('.webp');
  }

  void _showDeleteDialog(BuildContext context) {
    final type = item['type'] ?? 'memory';
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: AppColors.surface,
        title: Text(
          type == 'memory' ? 'Forget Memory?' : 'Delete Document?',
          style: GoogleFonts.nunito(
            fontWeight: FontWeight.w900,
            color: AppColors.text,
          ),
        ),
        content: Text(
          type == 'memory'
              ? 'Are you sure you want Buddy to forget this memory?'
              : 'Are you sure you want to delete this document?',
          style: GoogleFonts.inter(fontSize: 13.5, color: AppColors.textMid),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: GoogleFonts.nunito(
                fontWeight: FontWeight.w700,
                color: AppColors.textMid,
              ),
            ),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context); // close dialog
              final provider = Provider.of<MemoriesProvider>(
                context,
                listen: false,
              );
              await provider.deleteItem(item['_id'], type);
              if (context.mounted) {
                ToastUtils.showSuccessToast(
                  type == 'memory' ? 'Memory forgotten' : 'Document deleted',
                );
                Navigator.pop(context); // go back to list
              }
            },
            child: Text(
              'Delete',
              style: GoogleFonts.nunito(
                fontWeight: FontWeight.w800,
                color: AppColors.danger,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    final c = _color;
    final fields = _parsedFields;
    final notes = _notes.isNotEmpty
        ? _notes
        : (_parsedFields.isEmpty ? _fullContent : '');
    final String fileUrl = _getFileUrl(item['fileUrl'] as String?);
    final bool hasFile = fileUrl.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          // ── Custom header ─────────────────────────────────────────────
          _Header(
            title: _title,
            color: c,
            onBack: () => Navigator.pop(context),
            onEdit: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => MemoryEditScreen(item: item)),
            ),
            onDelete: () => _showDeleteDialog(context),
          ),

          // ── Scrollable content ────────────────────────────────────────
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Hero card ─────────────────────────────────────────
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [c.withValues(alpha: 0.12), c.withValues(alpha: 0.04)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: c.withValues(alpha: 0.2), width: 1.5),
                    ),
                    child: Row(
                      children: [
                        // Icon box
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [c.withValues(alpha: 0.22), c.withValues(alpha: 0.1)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: c.withValues(alpha: 0.25),
                              width: 2,
                            ),
                          ),
                          child: Icon(_icon, color: c, size: 30),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _title,
                                style: GoogleFonts.nunito(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.text,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (_tags.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Wrap(
                                  spacing: 6,
                                  children: _tags
                                      .take(3)
                                      .map((t) => _TagChip(label: t, color: c))
                                      .toList(),
                                ),
                              ],
                              if (_updatedAt.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  _updatedAt,
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: AppColors.textMid,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 18),

                  // ── Structured fields ─────────────────────────────────
                  if (fields.isNotEmpty) ...[
                    _SectionLabel(label: 'Details'),
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                        boxShadow: AppColors.cardShadow,
                      ),
                      child: Column(
                        children: [
                          for (int i = 0; i < fields.length; i++) ...[
                            _FieldRow(label: fields[i][0], value: fields[i][1]),
                            if (i < fields.length - 1)
                              Container(height: 1, color: AppColors.border),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ── Notes / full content ──────────────────────────────
                  if (notes.isNotEmpty) ...[
                    if (fields.isNotEmpty) _SectionLabel(label: 'Notes'),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                        boxShadow: AppColors.cardShadow,
                      ),
                      child: Text(
                        notes,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: AppColors.textMid,
                          height: 1.65,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ── Attachment ────────────────────────────────────────
                  if (hasFile) ...[
                    _SectionLabel(label: 'Attachment'),
                    _FileCard(
                      fileUrl: fileUrl,
                      color: c,
                      isImage: _isImage(fileUrl),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final String title;
  final Color color;
  final VoidCallback onBack;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _Header({
    required this.title,
    required this.color,
    required this.onBack,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Container(
      color: AppColors.surface,
      child: SafeArea(
        bottom: false,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
          child: Row(
            children: [
              GestureDetector(
                onTap: onBack,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(
                    LucideIcons.arrowLeft,
                    size: 18,
                    color: AppColors.text,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.nunito(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: AppColors.text,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      'Memory Details',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: AppColors.textMid,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Edit button
              GestureDetector(
                onTap: onEdit,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(color: color.withValues(alpha: 0.2)),
                  ),
                  child: Icon(LucideIcons.pencil, size: 16, color: color),
                ),
              ),
              const SizedBox(width: 8),
              // Delete button
              GestureDetector(
                onTap: onDelete,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.dangerLight,
                    borderRadius: BorderRadius.circular(11),
                    border: Border.all(
                      color: AppColors.danger.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Icon(
                    LucideIcons.trash2,
                    size: 16,
                    color: AppColors.danger,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Section label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.nunito(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          color: AppColors.textDim,
          letterSpacing: 0.7,
        ),
      ),
    );
  }
}

// ── Field row ─────────────────────────────────────────────────────────────────

class _FieldRow extends StatelessWidget {
  final String label;
  final String value;
  const _FieldRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: AppColors.textMid,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: GoogleFonts.nunito(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.text,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tag chip ──────────────────────────────────────────────────────────────────

class _TagChip extends StatelessWidget {
  final String label;
  final Color color;
  const _TagChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

// ── File card ─────────────────────────────────────────────────────────────────

class _FileCard extends StatelessWidget {
  final String fileUrl;
  final Color color;
  final bool isImage;
  const _FileCard({
    required this.fileUrl,
    required this.color,
    required this.isImage,
  });

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow,
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isImage)
            CachedNetworkImage(
              imageUrl: fileUrl,
              width: double.infinity,
              height: 200,
              fit: BoxFit.cover,
              placeholder: (_, _) => Container(
                height: 200,
                color: AppColors.bg,
                child: const Center(child: CircularProgressIndicator()),
              ),
              errorWidget: (_, _, _) => Container(
                height: 120,
                color: AppColors.bg,
                child: Center(
                  child: Icon(
                    LucideIcons.imageOff,
                    color: AppColors.textDim,
                    size: 32,
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(LucideIcons.fileText, color: color, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      fileUrl.split('/').last,
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          // Open full view link
          GestureDetector(
            onTap: () async {
              final uri = Uri.tryParse(fileUrl);
              if (uri != null && await canLaunchUrl(uri)) {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              }
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.externalLink, size: 13, color: color),
                  const SizedBox(width: 6),
                  Text(
                    'Open Full View',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: color,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
