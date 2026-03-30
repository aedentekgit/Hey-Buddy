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
  Set<String> archivedMemberIds = {};
  Set<String> unreadMemberIds = {};
  final _storage = const FlutterSecureStorage();

  FamilyProvider(this._socketService) {
    _initUser();
    _socketService.chatStream.listen((data) {
      if (data['roomId'] == currentChatId) {
        messages.insert(0, data);
        notifyListeners();
        
        if (currentUserId != null && data['sender_id'] != currentUserId) {
           _socketService.markMessagesRead(currentChatId!, currentUserId!);
        }
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

    _socketService.messagesReadStream.listen((data) {
      if (data['roomId'] == currentChatId) {
        final readUserId = data['userId'];
        bool updated = false;
        
        for (int i = 0; i < messages.length; i++) {
          if (messages[i] is Map) {
            final msg = messages[i] as Map<String, dynamic>;
            if (msg['sender_id'] != readUserId) {
                final readBy = List<dynamic>.from(msg['readBy'] ?? []);
                if (!readBy.contains(readUserId)) {
                    readBy.add(readUserId);
                    messages[i] = {...msg, 'readBy': readBy};
                    updated = true;
                }
            }
          }
        }
        if (updated) notifyListeners();
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

  Future<void> loadLocalStatuses() async {
    final archivedStr = await _storage.read(key: 'archived_members');
    final unreadStr = await _storage.read(key: 'unread_members');
    if (archivedStr != null) {
      archivedMemberIds = Set<String>.from(archivedStr.split(',').where((s) => s.isNotEmpty));
    }
    if (unreadStr != null) {
      unreadMemberIds = Set<String>.from(unreadStr.split(',').where((s) => s.isNotEmpty));
    }
    notifyListeners();
  }

  Future<void> toggleArchive(String memberId) async {
    if (archivedMemberIds.contains(memberId)) {
      archivedMemberIds.remove(memberId);
    } else {
      archivedMemberIds.add(memberId);
      unreadMemberIds.remove(memberId); // clear unread if archived
      await _storage.write(key: 'unread_members', value: unreadMemberIds.join(','));
    }
    await _storage.write(key: 'archived_members', value: archivedMemberIds.join(','));
    notifyListeners();
  }

  Future<void> toggleUnread(String memberId) async {
    if (unreadMemberIds.contains(memberId)) {
      unreadMemberIds.remove(memberId);
    } else {
      unreadMemberIds.add(memberId);
      archivedMemberIds.remove(memberId); // clear archive if unread
      await _storage.write(key: 'archived_members', value: archivedMemberIds.join(','));
    }
    await _storage.write(key: 'unread_members', value: unreadMemberIds.join(','));
    notifyListeners();
  }

  Future<void> clearUnreadStatus(String memberId) async {
    if (unreadMemberIds.contains(memberId)) {
      unreadMemberIds.remove(memberId);
      await _storage.write(key: 'unread_members', value: unreadMemberIds.join(','));
      notifyListeners();
    }
  }

  Future<void> loadData() async {
    isLoading = true;
    notifyListeners();
    try {
      await loadLocalStatuses();
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

  Future<List<dynamic>> searchUsers(String query) async {
    return await _service.searchUsers(query);
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

  Future<bool> deleteCurrentChatHistory() async {
    if (currentChatId == null) return false;
    final res = await _service.deleteChatHistory(currentChatId!);
    if (res['success'] == true) {
      messages.clear();
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<bool> muteCurrentChat() async {
    if (currentChatId == null) return false;
    final res = await _service.muteChat(currentChatId!);
    return res['success'] == true;
  }

  Future<bool> archiveCurrentChat() async {
    if (currentChatId == null) return false;
    final res = await _service.archiveChat(currentChatId!);
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
      if (currentUserId != null) {
        _socketService.markMessagesRead(currentChatId!, currentUserId!);
      }
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
      if (currentUserId != null) {
        _socketService.markMessagesRead(currentChatId!, currentUserId!);
      }
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
