import 'package:flutter/material.dart';
import '../services/task_service.dart';

class TasksProvider with ChangeNotifier {
  final TaskService _taskService = TaskService();
  List<dynamic> _tasks = [];
  bool _isLoading = false;
  
  List<dynamic> get tasks => _tasks;
  bool get isLoading => _isLoading;

  Future<void> loadTasks() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _taskService.fetchReminders();
      if (res['success'] == true) {
        _tasks = res['data'];
      }
    } catch (e) {
      print("Error loading tasks: $e");
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> deleteTask(String id) async {
    final original = List.from(_tasks);
    _tasks.removeWhere((t) => t['_id'] == id);
    notifyListeners();

    try {
      final success = await _taskService.deleteReminder(id);
      if (!success) {
        _tasks = original;
        notifyListeners();
      }
      return success;
    } catch (e) {
      _tasks = original;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateTask(String id, Map<String, dynamic> data) async {
    try {
      final success = await _taskService.updateReminder(id, data);
      if (success) {
        await loadTasks();
      }
      return success;
    } catch (e) {
      return false;
    }
  }

  Future<bool> createTask(Map<String, dynamic> data) async {
    try {
      final success = await _taskService.createReminder(data);
      if (success) {
        await loadTasks();
      }
      return success;
    } catch (e) {
      return false;
    }
  }
}
