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
  int unreadMessagesCount = 0;
  bool isLoading = false;
  String? currentChatId;
  String? currentUserId;

  FamilyProvider(this._socketService) {
    _initUser();
    _socketService.chatStream.listen((data) {
      if (data['roomId'] == currentChatId) {
        messages.insert(0, data);
        notifyListeners();
      }
    });

    _socketService.messageUpdatedStream.listen((data) {
      if (data['roomId'] == currentChatId) {
        final mid = data['messageId'];
        final idx = messages.indexWhere((m) => m is Map && (m['id'] ?? m['_id']) == mid);
        if (idx != -1) {
          // Merge updated fields
          messages[idx] = {...messages[idx], ...data};
          notifyListeners();
        }
      }
    });
  }

  void reactToMessage(String messageId, String emoji) {
    if (currentChatId != null && currentUserId != null) {
      _socketService.reactToMessage(currentChatId!, currentUserId!, messageId, emoji);
    }
  }

  void starMessage(String messageId, bool isStarred) {
    if (currentChatId != null && currentUserId != null) {
      _socketService.starMessage(currentChatId!, currentUserId!, messageId, isStarred);
    }
  }

  void pinMessage(String messageId, bool isPinned) {
    if (currentChatId != null) {
      _socketService.pinMessage(currentChatId!, messageId, isPinned);
    }
  }

  void forwardMessage(String targetRoomId, String messageId) {
    if (currentUserId != null) {
      _socketService.forwardMessage(targetRoomId, currentUserId!, messageId);
    }
  }

  void clearUnreadCount() {
    unreadMessagesCount = 0;
    notifyListeners();
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
      debugPrint('Load Family Data Error: $e');
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
    messages = []; // Clear immediately to prevent flicker
    notifyListeners();
    final res = await _service.startPrivateChat(memberId);
    if (res['success'] == true) {
      currentChatId = res['data']['chat_id'];
      _socketService.joinChatRoom(currentChatId!);
      messages = await _service.getMessages(currentChatId!);
      notifyListeners();
    }
  }

  Future<void> openGroupChat() async {
    messages = []; // Clear immediately to prevent flicker
    notifyListeners();
    final res = await _service.getGroupChat();
    if (res['success'] == true) {
      currentChatId = res['data']['chat_id'];
      _socketService.joinChatRoom(currentChatId!);
      messages = await _service.getMessages(currentChatId!);
      notifyListeners();
    }
  }

  dynamic replyingTo;

  void setReplyingTo(dynamic msg) {
    replyingTo = msg;
    notifyListeners();
  }

  void sendMessage(String content, {Map<String, dynamic>? fileData}) {
    if (currentChatId != null && currentUserId != null) {
      _socketService.sendChatMessage(
        currentChatId!,
        currentUserId!,
        content,
        replyTo: replyingTo?['id'],
        fileUrl: fileData?['fileUrl'],
        fileName: fileData?['fileName'],
        fileType: fileData?['fileType'],
      );
      replyingTo = null;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> uploadChatFile(List<int> bytes, String fileName) async {
    final res = await _service.uploadFile(bytes, fileName);
    return res;
  }
}
