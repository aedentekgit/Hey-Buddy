import 'package:flutter/material.dart';
import 'package:buddy_mobile/features/home/services/memory_service.dart';
import 'dart:io';

class MemoriesProvider extends ChangeNotifier {
  final MemoryService _memoryService = MemoryService();

  List<dynamic> _memories = [];
  bool _isLoading = false;

  List<dynamic> get memories => _memories;
  bool get isLoading => _isLoading;

  Future<void> loadMemories({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      notifyListeners();
    }

    try {
      final fetched = await _memoryService.fetchMemories();
      _memories = fetched;
    } catch (e) {
      debugPrint("Error loading memories: $e");
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> deleteItem(String id, String type) async {
    final original = List.from(_memories);
    _memories.removeWhere((m) => m['_id'] == id);
    notifyListeners();

    try {
      bool success;
      if (type == 'memory') {
        success = await _memoryService.deleteMemory(id);
      } else {
        success = await _memoryService.deletePrescription(id);
      }

      if (!success) {
        _memories = original;
        notifyListeners();
      }
    } catch (e) {
      _memories = original;
      notifyListeners();
    }
  }

  Future<bool> updateMemory(String id, String content, {File? file}) async {
    final index = _memories.indexWhere((m) => m['_id'] == id);
    Map<String, dynamic>? oldMemory;
    if (index != -1) {
      oldMemory = Map<String, dynamic>.from(_memories[index]);
      _memories[index] = {..._memories[index], 'content': content};
      notifyListeners();
    }

    try {
      final success = await _memoryService.updateMemory(
        id,
        content,
        file: file,
      );
      if (success) {
        Future.delayed(const Duration(milliseconds: 300), () => loadMemories(silent: true));
      } else if (index != -1 && oldMemory != null) {
         _memories[index] = oldMemory;
         notifyListeners();
      }
      return success;
    } catch (e) {
      if (index != -1 && oldMemory != null) {
         _memories[index] = oldMemory;
         notifyListeners();
      }
      return false;
    }
  }

  Future<bool> updatePrescription(String id, Map<String, dynamic> data) async {
    final index = _memories.indexWhere((m) => m['_id'] == id);
    Map<String, dynamic>? oldMemory;
    if (index != -1) {
      oldMemory = Map<String, dynamic>.from(_memories[index]);
      _memories[index] = {
        ..._memories[index],
        'extractedData': {
          ...(_memories[index]['extractedData'] ?? {}),
          ...data,
        }
      };
      notifyListeners();
    }

    try {
      final success = await _memoryService.updatePrescription(id, data);
      if (success) {
        Future.delayed(const Duration(milliseconds: 300), () => loadMemories(silent: true));
      } else if (index != -1 && oldMemory != null) {
         _memories[index] = oldMemory;
         notifyListeners();
      }
      return success;
    } catch (e) {
      if (index != -1 && oldMemory != null) {
         _memories[index] = oldMemory;
         notifyListeners();
      }
      return false;
    }
  }
}
