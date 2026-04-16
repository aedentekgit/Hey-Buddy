import 'dart:async';
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
  StreamSubscription<Map<String, dynamic>>? _chatSubscription;
  StreamSubscription<Map<String, dynamic>>? _messageUpdatedSubscription;

  FamilyProvider(this._socketService) {
    initUser();
    _chatSubscription = _socketService.chatStream.listen((data) {
      // 1. Update active chat messages
      if (data['roomId'] == currentChatId) {
        messages.insert(0, data);
        notifyListeners();
        
        if (currentUserId != null && data['sender_id'] != currentUserId) {
           _socketService.markMessagesRead(currentChatId!, currentUserId!);
        }
      } else {
        // 2. Global notification: Update unread status
        final roomId = data['roomId'];
        
        // Notify server that message was delivered to THIS device
        if (currentUserId != null && data['sender_id'] != currentUserId && roomId != null) {
           _socketService.markMessagesDelivered(roomId, currentUserId!);
        }

        final isGroup = roomId?.contains('group') ?? false; // RoomId usually contains 'group' for family groups
        
        if (isGroup) {
          unreadMessagesCount++;
        } else {
          final senderId = data['sender_id']?.toString();
          if (senderId != null && senderId != currentUserId) {
            unreadMemberIds.add(senderId);
            _storage.write(key: 'unread_members', value: unreadMemberIds.join(','));
          }
        }
        notifyListeners();
      }
    });

    _messageUpdatedSubscription = _socketService.messageUpdatedStream.listen((data) {
      if (data['roomId'] == currentChatId) {
        final updateUserId = data['userId'];
        final updateType = data['type']; // 'read' or 'delivered'
        bool updated = false;

        for (int i = 0; i < messages.length; i++) {
          if (messages[i] is Map) {
            final msg = messages[i] as Map<String, dynamic>;
            // Only update counts if the message was NOT sent by the person who just read/received it
            if (msg['sender_id'] != updateUserId) {
              if (updateType == 'read') {
                final readBy = List<dynamic>.from(msg['readBy'] ?? []);
                if (!readBy.contains(updateUserId)) {
                  readBy.add(updateUserId);
                  // Read implies delivered too
                  final deliveredTo = List<dynamic>.from(msg['deliveredTo'] ?? []);
                  if (!deliveredTo.contains(updateUserId)) deliveredTo.add(updateUserId);
                  
                  messages[i] = {...msg, 'readBy': readBy, 'deliveredTo': deliveredTo};
                  updated = true;
                }
              } else if (updateType == 'delivered') {
                final deliveredTo = List<dynamic>.from(msg['deliveredTo'] ?? []);
                if (!deliveredTo.contains(updateUserId)) {
                  deliveredTo.add(updateUserId);
                  messages[i] = {...msg, 'deliveredTo': deliveredTo};
                  updated = true;
                }
              }
            }
          }
        }
        if (updated) notifyListeners();
      }
    });
  }

  @override
  void dispose() {
    _chatSubscription?.cancel();
    _messageUpdatedSubscription?.cancel();
    super.dispose();
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

  Future<void> initUser() async {
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: 'jwt');
    if (token != null) {
      try {
        final decoded = JwtDecoder.decode(token);
        currentUserId = (decoded['id'] ?? decoded['sub'])?.toString();
        debugPrint('FamilyProvider: Initialized currentUserId: $currentUserId');
      } catch (e) {
        debugPrint('FamilyProvider: Error decoding token: $e');
      }
    } else {
      currentUserId = null;
    }
  }

  Future<void> loadLocalStatuses() async {
    archivedMemberIds.clear();
    unreadMemberIds.clear();

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
      await initUser(); // Ensure user is fresh
      await loadLocalStatuses();
      members = await _service.getMembers();
      // Initialize unread IDs from backend data
      for (var m in members) {
        if (m is Map) {
          final unreadCount = m['unreadCount'];
          final userId = m['user_id']?.toString();
          if (unreadCount is num &&
              unreadCount > 0 &&
              userId != null &&
              userId.isNotEmpty) {
            unreadMemberIds.add(userId);
          }
        }
      }
      _storage.write(key: 'unread_members', value: unreadMemberIds.join(','));
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

  Future<Map<String, dynamic>> sendRequestWithResponse(String email) async {
    final res = await _service.sendRequest(email);
    if (res['success'] == true) {
      await loadData();
    }
    return res;
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

  Future<bool> cancelRequest(String requestId) async {
    final res = await _service.cancelRequest(requestId);
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
    isLoading = true; // Use the existing isLoading property
    notifyListeners();
    try {
      await initUser(); // Ensure user ID is fresh
      final res = await _service.startPrivateChat(memberId);
      if (res['success'] == true) {
        currentChatId = res['data']['chat_id'];
        _socketService.joinChatRoom(currentChatId!);
        final fetchedMessages = await _service.getMessages(currentChatId!);
        // Reverse messages so index 0 is the newest for WhatsApp-style reverse ListView
        // Standardize list creation to prevent typing/iterable issues
        messages = List<dynamic>.from(fetchedMessages.reversed);
        notifyListeners();
        if (currentUserId != null) {
          _socketService.markMessagesRead(currentChatId!, currentUserId!);
        }
      }
    } catch (e) {
      debugPrint('Error opening private chat: $e');
      messages = [];
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> openGroupChat() async {
    messages = []; // Clear immediately to prevent flicker
    isLoading = true;
    notifyListeners();
    try {
      await initUser(); // Ensure user ID is fresh
      final res = await _service.getGroupChat();
      if (res['success'] == true) {
        currentChatId = res['data']['chat_id'];
        _socketService.joinChatRoom(currentChatId!);
        final fetchedMessages = await _service.getMessages(currentChatId!);
        // Reverse messages so index 0 is the newest for WhatsApp-style reverse ListView
        messages = List<dynamic>.from(fetchedMessages.reversed);
        notifyListeners();
        if (currentUserId != null) {
          _socketService.markMessagesRead(currentChatId!, currentUserId!);
        }
      }
    } catch (e) {
      debugPrint('Error opening group chat: $e');
      messages = [];
    } finally {
      isLoading = false;
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
