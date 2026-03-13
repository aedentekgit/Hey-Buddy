import 'package:flutter/foundation.dart';
import '../services/location_reminder_service.dart';

class LocationRemindersProvider with ChangeNotifier {
  final LocationReminderService _service = LocationReminderService();
  List<dynamic> _reminders = [];
  bool _isLoading = false;

  List<dynamic> get reminders => _reminders;
  bool get isLoading => _isLoading;

  Future<void> loadReminders() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _service.fetchLocationReminders();
      if (res['success'] == true) {
        _reminders = res['data'];
      }
    } catch (e) {
      print("Error loading location reminders: $e");
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createReminder(Map<String, dynamic> data) async {
    try {
      final success = await _service.createLocationReminder(data);
      if (success) {
        await loadReminders();
      }
      return success;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateReminder(String id, Map<String, dynamic> data) async {
    try {
      final success = await _service.updateLocationReminder(id, data);
      if (success) {
        // Optimistically update memory
        final index = _reminders.indexWhere((r) => r['_id'] == id);
        if (index != -1) {
          _reminders[index] = {..._reminders[index], ...data};
          notifyListeners();
        }
        // Background reload without await or loading state
        _service.fetchLocationReminders().then((res) {
          if (res['success'] == true) {
            _reminders = res['data'];
            notifyListeners();
          }
        });
      }
      return success;
    } catch (e) {
      return false;
    }
  }

  Future<bool> deleteReminder(String id) async {
    try {
      final success = await _service.deleteLocationReminder(id);
      if (success) {
        _reminders.removeWhere((r) => r['_id'] == id);
        notifyListeners();
      }
      return success;
    } catch (e) {
      return false;
    }
  }

  Future<bool> setEarlyWarning(String id, Map<String, dynamic> data) async {
    try {
      final success = await _service.setEarlyWarning(id, data);
      if (success) {
        await loadReminders();
      }
      return success;
    } catch (e) {
      return false;
    }
  }

  Future<bool> setFamilyBackup(String id) async {
    try {
      final success = await _service.setFamilyBackup(id);
      if (success) {
        await loadReminders();
      }
      return success;
    } catch (e) {
      return false;
    }
  }
}
