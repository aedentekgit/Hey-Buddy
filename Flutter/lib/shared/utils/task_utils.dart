import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter/material.dart';

class TaskUtils {
  static String formatDate(String? dateStr, {String format = 'DD/MM/YYYY'}) {
    if (dateStr == null) return 'No date';
    try {
      final date = DateTime.parse(dateStr).toLocal();
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final d = DateTime(date.year, date.month, date.day);

      final diff = d.difference(today).inDays;
      if (diff == 0) return 'Today';
      if (diff == 1) return 'Tomorrow';
      if (diff == -1) return 'Yesterday';

      // Simple format conversion if needed or use intl
      return DateFormat('dd/MM/yyyy').format(date);
    } catch (e) {
      return dateStr;
    }
  }

  static DateTime? parseTime(DateTime baseDate, String? timeStr) {
    if (timeStr == null || timeStr.isEmpty) return null;
    try {
      timeStr = timeStr.trim().toUpperCase();
      int hour = 0;
      int minute = 0;

      if (timeStr.contains('AM') || timeStr.contains('PM')) {
        final isPM = timeStr.contains('PM');
        final cleanTime = timeStr
            .replaceAll('AM', '')
            .replaceAll('PM', '')
            .trim();
        final parts = cleanTime.split(':');
        hour = int.parse(parts[0]);
        if (parts.length > 1) minute = int.parse(parts[1]);

        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour == 12) hour = 0;
      } else if (timeStr.contains(':')) {
        final parts = timeStr.split(':');
        hour = int.parse(parts[0]);
        minute = int.parse(parts[1]);
      } else {
        hour = int.parse(timeStr);
      }

      return DateTime(
        baseDate.year,
        baseDate.month,
        baseDate.day,
        hour,
        minute,
      );
    } catch (e) {
      return null;
    }
  }

  static dynamic getTaskIcon(String? title, String? intent) {
    // Priority 1: Intent based
    if (intent != null) {
      switch (intent.toLowerCase()) {
        case 'work':
          return LucideIcons.briefcase;
        case 'health':
          return LucideIcons.heartPulse;
        case 'medical':
          return LucideIcons.stethoscope;
        case 'fitness':
          return LucideIcons.activity;
        case 'personal':
          return LucideIcons.user;
        case 'education':
          return LucideIcons.graduationCap;
        case 'travel':
          return LucideIcons.plane;
        case 'shopping':
          return LucideIcons.shoppingBag;
        case 'finance':
          return LucideIcons.wallet;
        case 'family':
          return LucideIcons.users;
        case 'vehicle':
          return LucideIcons.car;
        case 'home':
          return LucideIcons.home;
        case 'food':
          return LucideIcons.utensils;
        case 'pet':
          return LucideIcons.dog;
        case 'tech':
          return LucideIcons.monitor;
        case 'security':
          return LucideIcons.shield;
        case 'birthday':
          return LucideIcons.gift;
      }
    }

    // Priority 2: Keyword scan on title
    if (title != null) {
      final t = title.toLowerCase();
      bool kw(List<String> words) => words.any((w) => t.contains(w));

      // Travel & Transport
      if (kw([
        'flight',
        'plane',
        'trip',
        'hotel',
        'passport',
        'airport',
        'travel',
        'visa',
        'holiday',
        'vacation',
        'booking',
        'train',
        'bus',
        'cruise',
        'itinerary',
        'luggage',
        'destination',
        'check-in',
        'boarding',
      ]))
        return LucideIcons.plane;

      // Medical & Health
      if (kw([
        'doctor',
        'dentist',
        'hospital',
        'clinic',
        'appointment',
        'prescription',
        'medicine',
        'tablet',
        'capsule',
        'dosage',
        'blood',
        'xray',
        'surgery',
        'therapy',
        'health',
        'diagnosis',
        'specialist',
        'ophthalmologist',
        'cardiologist',
        'vaccination',
        'injection',
        'checkup',
        'physiotherapy',
      ]))
        return LucideIcons.stethoscope;

      // Vehicle & Auto
      if (kw([
        'car',
        'bike',
        'scooter',
        'vehicle',
        'service',
        'tyre',
        'oil change',
        'mileage',
        'fuel',
        'petrol',
        'registration',
        'insurance',
        'battery',
        'brake',
        'engine',
        'mechanic',
        'garage',
        'parking',
        'driving',
        'license',
      ]))
        return LucideIcons.car;

      // Birthday & Celebrations
      if (kw([
        'birthday',
        'anniversary',
        'wedding',
        'engagement',
        'graduation',
        'celebration',
        'party',
        'gift',
        'cake',
        'surprise',
        'festival',
        'diwali',
        'christmas',
        'eid',
        'holi',
        'ceremony',
        'invite',
      ]))
        return LucideIcons.gift;

      // Work & Office
      if (kw([
        'meeting',
        'office',
        'work',
        'project',
        'deadline',
        'client',
        'presentation',
        'report',
        'sprint',
        'standup',
        'hr',
        'interview',
        'appraisal',
        'salary',
        'invoice',
        'contract',
        'conference',
        'zoom',
        'teams',
        'kpi',
        'target',
      ]))
        return LucideIcons.briefcase;

      // Finance & Banking
      if (kw([
        'money',
        'budget',
        'bank',
        'payment',
        'expense',
        'emi',
        'loan',
        'credit',
        'debit',
        'transaction',
        'account',
        'upi',
        'gpay',
        'paytm',
        'neft',
        'investment',
        'mutual fund',
        'stock',
        'tax',
        'gst',
        'bill',
        'insurance',
        'receipt',
        '₹',
        '\$',
        '€',
        '£',
        'pay',
        'fee',
      ]))
        return LucideIcons.wallet;

      // Food & Dining
      if (kw([
        'food',
        'snack',
        'recipe',
        'restaurant',
        'dinner',
        'lunch',
        'breakfast',
        'meal',
        'cook',
        'kitchen',
        'ingredient',
        'menu',
        'order',
        'delivery',
        'swiggy',
        'zomato',
        'cafe',
        'bakery',
        'diet',
        'eat',
        'grocery',
      ]))
        return LucideIcons.utensils;

      // Fitness & Gym
      if (kw([
        'gym',
        'workout',
        'exercise',
        'routine',
        'fitness',
        'push',
        'pull',
        'squat',
        'bench',
        'deadlift',
        'cardio',
        'running',
        'jogging',
        'cycling',
        'swimming',
        'yoga',
        'meditation',
        'stretch',
        'trainer',
        'protein',
        'supplement',
        'bmi',
        'calories',
        'steps',
        'walk',
        'run',
      ]))
        return LucideIcons.activity;

      // Education & Learning
      if (kw([
        'study',
        'exam',
        'class',
        'college',
        'school',
        'university',
        'course',
        'assignment',
        'homework',
        'marks',
        'grade',
        'subject',
        'teacher',
        'lecture',
        'tutorial',
        'certificate',
        'degree',
        'skill',
        'learning',
        'udemy',
        'coursera',
        'test',
        'quiz',
      ]))
        return LucideIcons.graduationCap;

      // Family & Relationships
      if (kw([
        'family',
        'mom',
        'dad',
        'mother',
        'father',
        'sister',
        'brother',
        'son',
        'daughter',
        'wife',
        'husband',
        'grandma',
        'grandpa',
        'parent',
        'child',
        'relative',
        'uncle',
        'aunt',
        'nephew',
        'niece',
        'kids',
      ]))
        return LucideIcons.users;

      // Home & Property
      if (kw([
        'house',
        'home',
        'flat',
        'apartment',
        'rent',
        'lease',
        'landlord',
        'maintenance',
        'repair',
        'plumber',
        'electrician',
        'ac',
        'furniture',
        'interior',
        'paint',
        'mortgage',
        'property',
        'society',
      ]))
        return LucideIcons.home;

      // Shopping
      if (kw([
        'buy',
        'purchase',
        'order',
        'shopping',
        'amazon',
        'flipkart',
        'myntra',
        'product',
        'discount',
        'coupon',
        'sale',
        'cart',
        'shop',
      ]))
        return LucideIcons.shoppingBag;

      // Phone & Contacts
      if (kw([
        'phone',
        'call',
        'mobile',
        'contact',
        'whatsapp',
        'telegram',
        'reminder call',
        'ring',
      ]))
        return LucideIcons.phone;

      // Pet & Animals
      if (kw([
        'dog',
        'cat',
        'pet',
        'vet',
        'veterinary',
        'animal',
        'puppy',
        'kitten',
        'vaccination',
        'deworming',
        'grooming',
      ]))
        return LucideIcons.dog;

      // Tech & Devices
      if (kw([
        'laptop',
        'computer',
        'software',
        'app',
        'code',
        'programming',
        'tech',
        'gadget',
        'charger',
        'warranty',
        'server',
        'wifi',
        'internet',
      ]))
        return LucideIcons.monitor;

      // Love & Personal
      if (kw([
        'love',
        'date',
        'girlfriend',
        'boyfriend',
        'partner',
        'anniversary',
        'valentine',
        'romance',
      ]))
        return LucideIcons.heart;
    }

    return LucideIcons.bell; // Default
  }

  static dynamic getTaskColor(String? title, String? intent) {
    // Priority 1: Intent based
    if (intent != null) {
      switch (intent.toLowerCase()) {
        case 'work':
          return const Color(0xFF6366F1); // Indigo
        case 'health':
          return const Color(0xFFEF4444); // Red
        case 'medical':
          return const Color(0xFFEF4444); // Red
        case 'fitness':
          return const Color(0xFFF97316); // Orange
        case 'personal':
          return const Color(0xFFEC4899); // Pink
        case 'education':
          return const Color(0xFF8B5CF6); // Violet
        case 'travel':
          return const Color(0xFF0EA5E9); // Sky
        case 'shopping':
          return const Color(0xFF10B981); // Emerald
        case 'finance':
          return const Color(0xFFF59E0B); // Amber
        case 'family':
          return const Color(0xFFEC4899); // Pink
        case 'vehicle':
          return const Color(0xFFF97316); // Orange
        case 'home':
          return const Color(0xFF10B981); // Emerald
        case 'food':
          return const Color(0xFFF97316); // Orange
        case 'pet':
          return const Color(0xFF10B981); // Emerald
        case 'tech':
          return const Color(0xFF6366F1); // Indigo
        case 'security':
          return const Color(0xFF64748B); // Slate
        case 'birthday':
          return const Color(0xFFEC4899); // Pink
      }
    }

    // Priority 2: Keyword based
    if (title != null) {
      final t = title.toLowerCase();
      bool kw(List<String> words) => words.any((w) => t.contains(w));

      if (kw([
        'flight',
        'trip',
        'hotel',
        'travel',
        'airport',
        'vacation',
        'holiday',
      ]))
        return const Color(0xFF0EA5E9);
      if (kw([
        'doctor',
        'dentist',
        'hospital',
        'medicine',
        'health',
        'clinic',
        'surgery',
        'vaccination',
      ]))
        return const Color(0xFFEF4444);
      if (kw([
        'car',
        'bike',
        'vehicle',
        'service',
        'fuel',
        'petrol',
        'mechanic',
      ]))
        return const Color(0xFFF97316);
      if (kw([
        'birthday',
        'anniversary',
        'wedding',
        'party',
        'gift',
        'celebration',
      ]))
        return const Color(0xFFEC4899);
      if (kw([
        'meeting',
        'office',
        'work',
        'project',
        'deadline',
        'presentation',
        'interview',
      ]))
        return const Color(0xFF6366F1);
      if (kw([
        'money',
        'bank',
        'payment',
        'bill',
        'emi',
        'loan',
        'tax',
        'pay',
        'fee',
      ]))
        return const Color(0xFFF59E0B);
      if (kw([
        'food',
        'dinner',
        'lunch',
        'breakfast',
        'restaurant',
        'eat',
        'grocery',
      ]))
        return const Color(0xFFF97316);
      if (kw([
        'gym',
        'workout',
        'exercise',
        'yoga',
        'fitness',
        'run',
        'walk',
        'cardio',
      ]))
        return const Color(0xFFF97316);
      if (kw([
        'study',
        'exam',
        'class',
        'college',
        'school',
        'course',
        'assignment',
      ]))
        return const Color(0xFF8B5CF6);
      if (kw([
        'family',
        'mom',
        'dad',
        'mother',
        'father',
        'sister',
        'brother',
        'kids',
      ]))
        return const Color(0xFFEC4899);
      if (kw(['buy', 'shop', 'purchase', 'amazon', 'order', 'shopping']))
        return const Color(0xFF10B981);
      if (kw(['home', 'house', 'rent', 'repair', 'plumber', 'electrician']))
        return const Color(0xFF10B981);
      if (kw(['love', 'date', 'girlfriend', 'boyfriend', 'valentine']))
        return const Color(0xFFEC4899);
      if (kw(['dog', 'cat', 'pet', 'vet', 'animal']))
        return const Color(0xFF10B981);
      if (kw(['laptop', 'computer', 'tech', 'software', 'app', 'wifi']))
        return const Color(0xFF6366F1);
    }

    return const Color(0xFF64748B); // Slate
  }
}
