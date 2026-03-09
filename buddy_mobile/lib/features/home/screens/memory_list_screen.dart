import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/shared/widgets/mobile_memory_card.dart';
import 'package:buddy_mobile/features/home/screens/memory_details_screen.dart';
import 'package:buddy_mobile/features/home/screens/memory_edit_screen.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';

class MemoryListScreen extends StatefulWidget {
  const MemoryListScreen({super.key});

  @override
  State<MemoryListScreen> createState() => _MemoryListScreenState();
}

class _MemoryListScreenState extends State<MemoryListScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => Provider.of<MemoriesProvider>(context, listen: false).loadMemories());
  }

  void _showViewDialog(BuildContext context, Map<String, dynamic> item) {
    Navigator.of(context).push(MaterialPageRoute(builder: (context) => MemoryDetailsScreen(item: item)));
  }

  void _showEditDialog(BuildContext context, Map<String, dynamic> item) {
    Navigator.of(context).push(MaterialPageRoute(builder: (context) => MemoryEditScreen(item: item)));
  }

  void _showDeleteDialog(BuildContext context, Map<String, dynamic> item) {
    final type = item['type'] ?? 'memory';
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(type == 'memory' ? "Forget Memory" : "Delete Document"),
        content: Text(type == 'memory' ? "Are you sure you want Buddy to forget this?" : "Are you sure?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          TextButton(
            onPressed: () {
              Provider.of<MemoriesProvider>(context, listen: false).deleteItem(item['_id'], type);
              Navigator.pop(context);
              ToastUtils.showSuccessToast(type == 'memory' ? "Memory forgotten" : "Document deleted");
            },
            child: const Text("Delete", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text("Memories", style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: SafeArea(
        child: Consumer<MemoriesProvider>(
          builder: (context, provider, child) {
            if (provider.isLoading) return const Center(child: CircularProgressIndicator());
            if (provider.memories.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(LucideIcons.brain, size: 64, color: Colors.grey[300]),
                    const SizedBox(height: 16),
                    Text("No memories found", style: GoogleFonts.outfit(color: Colors.grey[500])),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              onRefresh: () => provider.loadMemories(),
              child: ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: provider.memories.length,
                itemBuilder: (context, index) {
                  final memory = provider.memories[index];
                  return MobileMemoryCard(
                    item: memory,
                    index: index,
                    onView: () => _showViewDialog(context, memory),
                    onEdit: () => _showEditDialog(context, memory),
                    onDelete: () => _showDeleteDialog(context, memory),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}
