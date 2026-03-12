import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/services/family_service.dart';
import 'package:buddy_mobile/core/services/socket_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jwt_decoder/jwt_decoder.dart';

class FamilyProvider extends ChangeNotifier {
  final FamilyService _service = FamilyService();
  final SocketService _socketService;
  
  List<dynamic> members = [];
  List<dynamic> requests = [];
  List<dynamic> messages = [];
  bool isLoading = false;
  String? currentChatId;
  String? currentUserId;

  FamilyProvider(this._socketService) {
    _initUser();
    _socketService.chatStream.listen((data) {
      if (data['roomId'] == currentChatId) {
        messages.add(data);
        notifyListeners();
      }
    });
  }

  Future<void> _initUser() async {
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: 'jwt');
    if (token != null) {
      final decoded = JwtDecoder.decode(token);
      currentUserId = decoded['id'] ?? decoded['sub'];
    }
  }

  Future<void> loadData() async {
    isLoading = true;
    notifyListeners();
    try {
      members = await _service.getMembers();
      requests = await _service.getRequests();
    } catch (e) {
      print('Load Family Data Error: $e');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> sendRequest(String email) async {
    final res = await _service.sendRequest(email);
    if (res['success'] == true) {
      await loadData();
      return true;
    }
    return false;
  }

  Future<bool> respondToRequest(String requestId, String action) async {
    final res = await _service.respondToRequest(requestId, action);
    if (res['success'] == true) {
      await loadData();
      return true;
    }
    return false;
  }

  Future<bool> removeMember(String memberId) async {
    final res = await _service.removeMember(memberId);
    if (res['success'] == true) {
      await loadData();
      return true;
    }
    return false;
  }

  Future<bool> sendEmergencyAlert(String message) async {
    final res = await _service.sendEmergencyAlert(message);
    return res['success'] == true;
  }

  Future<void> openPrivateChat(String memberId) async {
    final res = await _service.startPrivateChat(memberId);
    if (res['success'] == true) {
      currentChatId = res['data']['chat_id'];
      _socketService.joinChatRoom(currentChatId!);
      messages = await _service.getMessages(currentChatId!);
      notifyListeners();
    }
  }

  Future<void> openGroupChat() async {
    final res = await _service.getGroupChat();
    if (res['success'] == true) {
      currentChatId = res['data']['chat_id'];
      _socketService.joinChatRoom(currentChatId!);
      messages = await _service.getMessages(currentChatId!);
      notifyListeners();
    }
  }

  void sendMessage(String content) {
    if (currentChatId != null && currentUserId != null) {
      _socketService.sendChatMessage(currentChatId!, currentUserId!, content);
      // Backend broadcasts 'new_message', listener handles UI update
    }
  }
}
