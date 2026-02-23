
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:io' show Platform;

import 'package:buddy_mobile/core/config/app_config.dart';

class MemoryDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> item;

  const MemoryDetailsScreen({super.key, required this.item});

  String _getFileUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http')) return path;
    
    final formattedPath = path.startsWith('/') ? path : '/$path';
    return '${AppConfig.assetBaseUrl}$formattedPath';
  }

  @override
  Widget build(BuildContext context) {
    final type = item['type'] ?? 'memory';
    final bool isMemory = type == 'memory';
    final Color themeColor = isMemory ? const Color(0xFF9333EA) : const Color(0xFF059669);

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
              if (item['fileUrl'] != null)
                _DetailCard(
                  title: "Document Preview",
                  icon: LucideIcons.image,
                  color: themeColor,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: CachedNetworkImage(
                      imageUrl: _getFileUrl(item['fileUrl']),
                      placeholder: (context, url) => Container(
                        height: 200, 
                        color: Colors.grey[100], 
                        child: const Center(child: CircularProgressIndicator())
                      ),
                      errorWidget: (context, url, error) => Container(
                        height: 100, 
                        color: Colors.grey[100], 
                        child: const Icon(LucideIcons.imageOff)
                      ),
                    ),
                  ),
                ),
            ],
            const SizedBox(height: 40),
          ],
        ),
      ),
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
