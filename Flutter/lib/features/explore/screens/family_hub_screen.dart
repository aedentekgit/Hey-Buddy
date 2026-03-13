import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/explore/providers/family_provider.dart';
import 'package:buddy_mobile/features/explore/screens/family_chat_screen.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:cached_network_image/cached_network_image.dart';

class FamilyHubScreen extends StatefulWidget {
  const FamilyHubScreen({super.key});

  @override
  State<FamilyHubScreen> createState() => _FamilyHubScreenState();
}

class _FamilyHubScreenState extends State<FamilyHubScreen>
    with SingleTickerProviderStateMixin {
  final TextEditingController _emailCtrl = TextEditingController();
  bool _isInviting = false;

  // Pulse animation for emergency icon
  late final AnimationController _pulse;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(
      begin: 1.0,
      end: 0.82,
    ).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut));

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<FamilyProvider>().loadData();
    });
  }

  @override
  void dispose() {
    _pulse.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  // ── build ──────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      // ── sub-screen header (back + title) ──────────────────────────
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Container(
          color: AppColors.surface,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
              child: Row(
                children: [
                  _iconBtn(
                    icon: LucideIcons.arrowLeft,
                    onTap: () => Navigator.maybePop(context),
                  ),
                  const SizedBox(width: 14),
                  Text(
                    'Family Hub',
                    style: GoogleFonts.nunito(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppColors.text,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Consumer<FamilyProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.members.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          return RefreshIndicator(
            onRefresh: provider.loadData,
            color: AppColors.accent,
            child: ListView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 48),
              children: [
                // ── Emergency card ─────────────────────────────────
                _EmergencyCard(
                  pulseAnim: _pulseAnim,
                  onSend: () => _confirmEmergency(provider),
                ),
                const SizedBox(height: 24),

                // ── Connectivity & Invites ─────────────────────────
                _SecLabel('Connectivity & Invites'),
                const SizedBox(height: 10),
                _InviteCard(
                  ctrl: _emailCtrl,
                  isLoading: _isInviting,
                  onSend: () => _sendInvite(provider),
                ),
                const SizedBox(height: 16),

                // ── Pending requests ───────────────────────────────
                if (provider.requests.isNotEmpty) ...[
                  ...provider.requests.map(
                    (req) => _PendingCard(
                      req: req,
                      onAccept: () => provider.respondToRequest(
                        req['request_id'],
                        'accept',
                      ),
                      onDecline: () => provider.respondToRequest(
                        req['request_id'],
                        'decline',
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],

                // ── Active connections header ───────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _SecLabel('Active Connections'),
                    GestureDetector(
                      onTap: () {
                        provider.openGroupChat();
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                const FamilyChatScreen(isGroup: true),
                          ),
                        );
                      },
                      child: Row(
                        children: [
                          Icon(
                            LucideIcons.messageCircle,
                            size: 16,
                            color: AppColors.accent,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Group Chat',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.accent,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // ── Member cards ───────────────────────────────────
                if (provider.members.isEmpty)
                  _buildEmpty()
                else
                  ...provider.members.map(
                    (m) => _MemberCard(
                      member: m,
                      isYou: m['user_id'] == provider.currentUserId,
                      onChat: () {
                        provider.openPrivateChat(m['user_id']);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => FamilyChatScreen(title: m['name']),
                          ),
                        );
                      },
                      onRemove: () => _confirmRemove(provider, m),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  Widget _buildEmpty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.pinkLight,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              LucideIcons.users,
              size: 28,
              color: AppColors.pink,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'No family connected yet',
            style: GoogleFonts.nunito(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Invite someone using their email above',
            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMid),
          ),
        ],
      ),
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────
  Future<void> _sendInvite(FamilyProvider provider) async {
    if (_emailCtrl.text.isEmpty) return;
    setState(() => _isInviting = true);
    final ok = await provider.sendRequest(_emailCtrl.text.trim());
    setState(() => _isInviting = false);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Invitation sent!' : 'Check email or connection.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    if (ok) _emailCtrl.clear();
  }

  void _confirmEmergency(FamilyProvider provider) {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: '',
      pageBuilder: (_, __, ___) => const SizedBox.shrink(),
      transitionBuilder: (ctx, a1, _, __) => Transform.scale(
        scale: a1.value,
        child: Opacity(
          opacity: a1.value,
          child: AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            contentPadding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.dangerLight,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    LucideIcons.alertTriangle,
                    size: 24,
                    color: AppColors.danger,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Send Emergency Alert?',
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppColors.text,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'This will instantly notify all family members. Use for real emergencies only.',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: AppColors.textMid,
                    height: 1.6,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                GestureDetector(
                  onTap: () {
                    Navigator.pop(ctx);
                    provider.sendEmergencyAlert(
                      'I need help! Immediate assistance required.',
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        backgroundColor: AppColors.danger,
                        behavior: SnackBarBehavior.floating,
                        content: Text('Emergency alert broadcasted!'),
                      ),
                    );
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.accent, AppColors.purple],
                      ),
                      borderRadius: BorderRadius.circular(15),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.accent.withOpacity(0.4),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Text(
                      'Understood',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.nunito(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _confirmRemove(FamilyProvider provider, dynamic member) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Remove Member',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        content: Text(
          'Remove ${member['name']} from family?',
          style: GoogleFonts.outfit(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.outfit()),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              provider.removeMember(member['user_id']);
            },
            child: Text(
              'Remove',
              style: GoogleFonts.outfit(
                color: AppColors.danger,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Small icon button ──────────────────────────────────────────────────
  Widget _iconBtn({required IconData icon, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Icon(icon, size: 20, color: AppColors.text),
      ),
    );
  }
}

// ── Emergency card ─────────────────────────────────────────────────────────
class _EmergencyCard extends StatelessWidget {
  final Animation<double> pulseAnim;
  final VoidCallback onSend;

  const _EmergencyCard({required this.pulseAnim, required this.onSend});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.45),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.danger.withOpacity(0.2)),
            boxShadow: [
              BoxShadow(
                color: AppColors.danger.withOpacity(0.08),
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                children: [
                  // Pulsing icon
                  AnimatedBuilder(
                    animation: pulseAnim,
                    builder: (_, __) => Transform.scale(
                      scale: pulseAnim.value,
                      child: Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: AppColors.danger,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.danger.withOpacity(0.5),
                              blurRadius: 20,
                              spreadRadius: 0,
                            ),
                          ],
                        ),
                        child: const Icon(
                          LucideIcons.alertTriangle,
                          size: 26,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Emergency Help',
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.text,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Alert everyone instantly',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textMid,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),
              // Red alert button
              GestureDetector(
                onTap: onSend,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.danger.withOpacity(0.4),
                        blurRadius: 20,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Text(
                    'SEND EMERGENCY ALERT',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Invite card ────────────────────────────────────────────────────────────
class _InviteCard extends StatefulWidget {
  final TextEditingController ctrl;
  final bool isLoading;
  final VoidCallback onSend;

  const _InviteCard({
    required this.ctrl,
    required this.isLoading,
    required this.onSend,
  });

  @override
  State<_InviteCard> createState() => _InviteCardState();
}

class _InviteCardState extends State<_InviteCard> {
  bool _isFocused = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 12),
            child: Text(
              'Invite New Member',
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.text,
              ),
            ),
          ),
          Row(
            children: [
              Expanded(
                child: Focus(
                  onFocusChange: (focused) => setState(() => _isFocused = focused),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: _isFocused ? AppColors.surface : AppColors.bg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _isFocused ? AppColors.accent : AppColors.border,
                        width: _isFocused ? 1.5 : 1.0,
                      ),
                      boxShadow: _isFocused
                          ? [
                              BoxShadow(
                                color: AppColors.accent.withOpacity(0.12),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ]
                          : [],
                    ),
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.mail,
                          size: 18,
                          color: _isFocused ? AppColors.accent : AppColors.textDim,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: widget.ctrl,
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: AppColors.text,
                              fontWeight: FontWeight.w500,
                            ),
                            onSubmitted: (_) => widget.onSend(),
                            decoration: InputDecoration(
                              hintText: 'Email or Apple ID',
                              hintStyle: GoogleFonts.inter(
                                fontSize: 13,
                                color: AppColors.textDim,
                                fontWeight: FontWeight.w400,
                              ),
                              border: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(vertical: 14),
                              isCollapsed: true,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: widget.isLoading ? null : widget.onSend,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: widget.isLoading ? AppColors.accent.withOpacity(0.5) : AppColors.accent,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.accent.withOpacity(0.35),
                        blurRadius: 15,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: widget.isLoading
                      ? const Padding(
                          padding: EdgeInsets.all(14),
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(
                          LucideIcons.send,
                          size: 20,
                          color: Colors.white,
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}


// ── Pending request card ───────────────────────────────────────────────────
class _PendingCard extends StatelessWidget {
  final dynamic req;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const _PendingCard({
    required this.req,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    final name = req['sender_name']?.toString() ?? 'Unknown';
    final email = req['sender_email']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Pending: $name',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text,
                  ),
                ),
                if (email.isNotEmpty)
                  Text(
                    email,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: AppColors.textMid,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Accept
          _ActionBtn(
            icon: LucideIcons.check,
            color: AppColors.green,
            onTap: onAccept,
          ),
          const SizedBox(width: 8),
          // Decline
          _ActionBtn(
            icon: LucideIcons.x,
            color: AppColors.danger,
            onTap: onDecline,
          ),
        ],
      ),
    );
  }
}

// ── Member card ────────────────────────────────────────────────────────────
class _MemberCard extends StatelessWidget {
  final dynamic member;
  final bool isYou;
  final VoidCallback onChat;
  final VoidCallback onRemove;

  const _MemberCard({
    required this.member,
    required this.isYou,
    required this.onChat,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final name = member['name']?.toString() ?? '?';
    final role =
        member['role']?.toString() ?? member['email']?.toString() ?? '';
    final profilePic = AppConfig.formatImageUrl(
      member['profilePicture'] as String?,
    );

    // Rotating avatar bg colors
    const avatarColors = [
      AppColors.accent,
      AppColors.teal,
      AppColors.orange,
      AppColors.pink,
      AppColors.purple,
    ];
    // Use hash to pick consistent color per user
    final colorIdx =
        name.codeUnits.fold(0, (a, b) => a + b) % avatarColors.length;
    final avatarColor = avatarColors[colorIdx];

    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.7),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              // Avatar with optional YOU badge
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [avatarColor, avatarColor.withOpacity(0.8)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(50 / 2.4),
                      boxShadow: [
                        BoxShadow(
                          color: avatarColor.withOpacity(0.4),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: profilePic != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(50 / 2.4),
                            child: CachedNetworkImage(
                              imageUrl: profilePic,
                              fit: BoxFit.cover,
                              placeholder: (_, __) => _fallbackAvatar(name),
                              errorWidget: (_, __, ___) =>
                                  _fallbackAvatar(name),
                            ),
                          )
                        : _fallbackAvatar(name),
                  ),
                  if (isYou)
                    Positioned(
                      bottom: -2,
                      right: -2,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        child: Text(
                          'YOU',
                          style: GoogleFonts.nunito(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 14),
              // Name + role
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isYou ? '$name (You)' : name,
                      style: GoogleFonts.outfit(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.text,
                      ),
                    ),
                    if (role.isNotEmpty)
                      Text(
                        role,
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textMid,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              // Action buttons
              Row(
                children: [
                  _ActionBtn(
                    icon: LucideIcons.messageCircle,
                    color: AppColors.textMid,
                    onTap: onChat,
                  ),
                  if (!isYou) ...[
                    const SizedBox(width: 10),
                    _ActionBtn(
                      icon: LucideIcons.userMinus,
                      color: AppColors.danger,
                      onTap: onRemove,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _fallbackAvatar(String name) {
    return Center(
      child: Text(
        name[0].toUpperCase(),
        style: GoogleFonts.nunito(
          fontSize: 19,
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
      ),
    );
  }
}

// ── Shared small action button (38×38) ────────────────────────────────────
class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionBtn({
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Icon(icon, size: 18, color: color),
      ),
    );
  }
}

// ── Section label ──────────────────────────────────────────────────────────
class _SecLabel extends StatelessWidget {
  final String text;
  const _SecLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.textDim,
        letterSpacing: 0.8,
      ),
    );
  }
}
