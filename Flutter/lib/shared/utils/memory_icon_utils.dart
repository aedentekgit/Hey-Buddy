import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

/// Returns the best-matching icon for a memory item based on tags + content keywords.
/// All icons are from the locally-bundled `lucide_icons` package — no internet needed.
IconData getMemoryIcon(Map<String, dynamic> item) {
  final type = item['type'] ?? 'memory';
  if (type != 'memory') return LucideIcons.fileText;

  // ── 1. Check tags (user-assigned, most reliable) ──────────────────────────
  final rawTags = item['tags'];
  final tags = rawTags is List
      ? rawTags.map((t) => t.toString().toLowerCase()).toList()
      : <String>[];

  if (tags.contains('travel')) return LucideIcons.plane;
  if (tags.contains('health')) return LucideIcons.heartPulse;
  if (tags.contains('medical')) return LucideIcons.stethoscope;
  if (tags.contains('vehicle')) return LucideIcons.car;
  if (tags.contains('family')) return LucideIcons.users;
  if (tags.contains('work')) return LucideIcons.briefcase;
  if (tags.contains('finance')) return LucideIcons.wallet;
  if (tags.contains('food')) return LucideIcons.utensils;
  if (tags.contains('education')) return LucideIcons.graduationCap;
  if (tags.contains('sports')) return LucideIcons.activity;
  if (tags.contains('personal')) return LucideIcons.user;
  if (tags.contains('shopping')) return LucideIcons.shoppingBag;
  if (tags.contains('home')) return LucideIcons.home;
  if (tags.contains('pet')) return LucideIcons.dog;
  if (tags.contains('security')) return LucideIcons.shield;
  if (tags.contains('tech')) return LucideIcons.monitor;

  // ── 2. Keyword scan on title + full content ────────────────────────────────
  final content = (item['content'] ?? '').toString();
  final title = content.split('\n').first.trim();
  final text = '$content $title'.toLowerCase();

  bool kw(List<String> words) => words.any((w) => text.contains(w));

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
    'itinerary',
    'train',
    'bus',
    'cruise',
    'boarding pass',
    'check-in',
    'luggage',
    'backpack',
    'destination',
  ])) {
    return LucideIcons.plane;
  }

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
    'test report',
    'xray',
    'surgery',
    'therapy',
    'physiotherapy',
    'health',
    'diagnosis',
    'symptom',
    'ambulance',
    'emergency',
    'specialist',
    'ophthalmologist',
    'ent',
    'cardiologist',
    'gynecologist',
    'neurologist',
    'pediatrician',
    'vaccination',
    'injection',
  ])) {
    return LucideIcons.stethoscope;
  }

  // Vehicle & Auto
  if (kw([
    'car',
    'bike',
    'scooter',
    'vehicle',
    'service',
    'tyre',
    'oil change',
    'km',
    'mileage',
    'fuel',
    'petrol',
    'registration',
    'rc book',
    'insurance renewal',
    'battery',
    'brake',
    'clutch',
    'gear',
    'engine',
    'mechanic',
    'garage',
    'parking',
    'toll',
    'driving',
    'license',
    'rto',
  ])) {
    return LucideIcons.car;
  }

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
    'event',
    'invite',
    'festival',
    'diwali',
    'christmas',
    'eid',
    'holi',
    'puja',
    'ceremony',
  ])) {
    return LucideIcons.gift;
  }

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
    'task',
    'sprint',
    'standup',
    'hr',
    'interview',
    'appraisal',
    'salary',
    'invoice',
    'contract',
    'colleague',
    'manager',
    'conference',
    'zoom',
    'teams',
    'slack',
    'email',
    'deadline',
    'kpi',
    'target',
  ])) {
    return LucideIcons.briefcase;
  }

  // Finance & Banking
  if (kw([
    'money',
    'budget',
    'bank',
    'payment',
    'expense',
    'salary',
    'emi',
    'loan',
    'credit',
    'debit',
    'transaction',
    'account',
    'ifsc',
    'upi',
    'gpay',
    'paytm',
    'neft',
    'rtgs',
    'investment',
    'mutual fund',
    'stock',
    'tax',
    'gst',
    'invoice',
    'receipt',
    'bill',
    'insurance premium',
    '₹',
    '\$',
    '€',
    '£',
  ])) {
    return LucideIcons.wallet;
  }

  // Food & Recipes
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
    'calories',
    'nutrition',
  ])) {
    return LucideIcons.utensils;
  }

  // WiFi & Tech & Passwords
  if (kw([
    'wifi',
    'ssid',
    'password',
    'network',
    'router',
    'internet',
    'broadband',
    'vpn',
    'server',
    'ip address',
    'username',
    'login',
    'credentials',
    'two factor',
    'otp',
    'pin',
    '2fa',
  ])) {
    return LucideIcons.wifi;
  }

  // Fitness & Gym
  if (kw([
    'gym',
    'workout',
    'exercise',
    'routine',
    'fitness',
    'push',
    'pull',
    'legs',
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
    'rep',
    'set',
    'trainer',
    'weight',
    'protein',
    'supplement',
    'bmi',
    'calories burned',
  ])) {
    return LucideIcons.activity;
  }

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
    'online course',
    'udemy',
    'coursera',
  ])) {
    return LucideIcons.graduationCap;
  }

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
  ])) {
    return LucideIcons.users;
  }

  // Home & Property
  if (kw([
    'house',
    'home',
    'flat',
    'apartment',
    'rent',
    'lease',
    'owner',
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
  ])) {
    return LucideIcons.home;
  }

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
    'offer',
    'sale',
    'cart',
    'delivery',
  ])) {
    return LucideIcons.shoppingBag;
  }

  // Security & Passwords
  if (kw([
    'security',
    'shield',
    'protect',
    'backup',
    'safe',
    'lock',
    'key',
    'emergency contact',
    'insurance',
    'policy',
  ])) {
    return LucideIcons.shield;
  }

  // Phone & Contacts
  if (kw([
    'phone',
    'contact',
    'mobile',
    'number',
    'call',
    'whatsapp',
    'telegram',
    'address',
    'location',
    'map',
    'directory',
  ])) {
    return LucideIcons.contact;
  }

  // Ideas & Notes
  if (kw([
    'note',
    'idea',
    'thought',
    'reminder',
    'remember',
    'plan',
    'goal',
    'resolution',
    'bucket list',
    'wish',
    'dream',
    'todo',
  ])) {
    return LucideIcons.lightbulb;
  }

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
  ])) {
    return LucideIcons.dog;
  }

  // Tech & Devices
  if (kw([
    'laptop',
    'phone',
    'device',
    'computer',
    'software',
    'app',
    'code',
    'programming',
    'tech',
    'gadget',
    'charger',
    'warranty',
    'serial number',
  ])) {
    return LucideIcons.monitor;
  }

  // Default
  return LucideIcons.database;
}
