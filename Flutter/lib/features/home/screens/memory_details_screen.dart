
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:buddy_mobile/core/config/app_config.dart';

class MemoryDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> item;

  const MemoryDetailsScreen({super.key, required this.item});

  /// Builds a fully qualified URL from a stored path, correctly handling
  /// relative paths, localhost leakage, and protocol mismatches.
  String _getFileUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    final formatted = AppConfig.formatImageUrl(path);
    return formatted ?? '';
  }

  bool _isImage(String url) {
    final lower = url.toLowerCase();
    return lower.endsWith('.jpg') || lower.endsWith('.jpeg') ||
           lower.endsWith('.png') || lower.endsWith('.gif') ||
           lower.endsWith('.webp') || lower.endsWith('.bmp');
  }

  @override
  Widget build(BuildContext context) {
    final type = item['type'] ?? 'memory';
    final bool isMemory = type == 'memory';
    final Color themeColor = isMemory ? const Color(0xFF9333EA) : const Color(0xFF059669);
    final String? rawFileUrl = item['fileUrl'] as String?;
    final String fileUrl = _getFileUrl(rawFileUrl);
    final bool hasFile = fileUrl.isNotEmpty;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          isMemory ? "Memory Details" : "Document Details",
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.pop(context),
        ),
        shape: Border(bottom: BorderSide(color: Colors.grey[200]!, width: 1)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            if (isMemory) ...[
              _DetailCard(
                title: "Insight",
                icon: LucideIcons.brain,
                color: themeColor,
                child: Text(
                  item['content'] ?? '',
                  style: GoogleFonts.outfit(fontSize: 16, height: 1.5, color: const Color(0xFF1E293B)),
                ),
              ),
              // ✅ FIX: Show attachment for memory type if fileUrl exists
              if (hasFile)
                _DetailCard(
                  title: "Attachment",
                  icon: LucideIcons.paperclip,
                  color: themeColor,
                  child: _FilePreview(fileUrl: fileUrl, isImage: _isImage(fileUrl)),
                ),
            ] else ...[
              _DetailCard(
                title: "Information",
                icon: LucideIcons.fileText,
                color: themeColor,
                child: Column(
                  children: [
                    _InfoRow(label: "Patient", value: item['extractedData']?['patientName'] ?? 'Unknown'),
                    _InfoRow(label: "Doctor", value: "Dr. ${item['extractedData']?['doctorName'] ?? 'Unspecified'}"),
                    _InfoRow(label: "Uploaded", value: item['createdAt']?.toString().split('T')[0] ?? ''),
                  ],
                ),
              ),
              if (item['extractedData']?['medicines'] != null)
                _DetailCard(
                  title: "Medicines",
                  icon: LucideIcons.pill,
                  color: themeColor,
                  child: Column(
                    children: ((item['extractedData']?['medicines'] ?? []) as List).map<Widget>((med) => 
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          border: Border(bottom: BorderSide(color: Colors.grey[100]!)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(med['name'] ?? '', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                                  Text("${med['dosage'] ?? ''} • ${med['timing'] ?? ''}", 
                                      style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    ).toList(),
                  ),
                ),
              if (hasFile)
                _DetailCard(
                  title: "Document Preview",
                  icon: LucideIcons.image,
                  color: themeColor,
                  child: _FilePreview(fileUrl: fileUrl, isImage: _isImage(fileUrl)),
                ),
            ],
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

/// Renders an image or a document download chip depending on the file type.
class _FilePreview extends StatelessWidget {
  final String fileUrl;
  final bool isImage;
  const _FilePreview({required this.fileUrl, required this.isImage});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isImage)
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CachedNetworkImage(
              imageUrl: fileUrl,
              width: double.infinity,
              fit: BoxFit.cover,
              placeholder: (ctx, url) => Container(
                height: 200,
                color: Colors.grey[100],
                child: const Center(child: CircularProgressIndicator()),
              ),
              errorWidget: (ctx, url, err) => Container(
                height: 120,
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.imageOff, color: Colors.grey[400], size: 32),
                    const SizedBox(height: 8),
                    Text('Could not load image', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
                  ],
                ),
              ),
            ),
          )
        else
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.fileText, color: Color(0xFF6366F1), size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    fileUrl.split('/').last,
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 13),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        // Open in browser link
        const SizedBox(height: 12),
        GestureDetector(
          onTap: () async {
            final uri = Uri.tryParse(fileUrl);
            if (uri != null && await canLaunchUrl(uri)) {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: const Color(0xFF6366F1).withOpacity(0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.externalLink, size: 13, color: Color(0xFF6366F1)),
                const SizedBox(width: 6),
                Text(
                  'Open Full View',
                  style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF6366F1)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _DetailCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final Widget child;

  const _DetailCard({required this.title, required this.icon, required this.color, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(width: 12),
              Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label.toUpperCase(), 
              style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[400])
            ),
          ),
          Expanded(
            child: Text(
              value, 
              style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: const Color(0xFF1E293B))
            ),
          ),
        ],
      ),
    );
  }
}

