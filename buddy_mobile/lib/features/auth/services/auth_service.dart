import 'package:dio/dio.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

class AuthService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: AppConfig.baseUrl,
    headers: {'x-platform': 'mobile'},
  ));

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _dio.post('auth/login', data: {
        'email': email,
        'password': password,
      });
      return response.data;
    } on DioException catch (e) {
      return _handleError(e, 'Login failed');
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    try {
      final response = await _dio.post('auth/signup', data: {
        'name': name,
        'email': email,
        'password': password,
      });
      return response.data;
    } on DioException catch (e) {
      return _handleError(e, 'Registration failed');
    }
  }

  Future<Map<String, dynamic>> googleLogin(String idToken, {String? serverAuthCode}) async {
    try {
      final response = await _dio.post('auth/google-login', data: {
        'idToken': idToken,
        'serverAuthCode': serverAuthCode,
      });
      return response.data;
    } on DioException catch (e) {
      return _handleError(e, 'Google Login failed');
    }
  }

  Future<Map<String, dynamic>> forgotPassword(String email) async {
    try {
      final response = await _dio.post('auth/forgot-password', data: {
        'email': email,
      });
      return response.data;
    } on DioException catch (e) {
      return _handleError(e, 'Failed to send OTP');
    }
  }

  Future<Map<String, dynamic>> verifyResetOtp(String email, String otp) async {
    try {
      final response = await _dio.post('auth/verify-reset-otp', data: {
        'email': email,
        'otp': otp,
      });
      return response.data;
    } on DioException catch (e) {
      return _handleError(e, 'Invalid OTP');
    }
  }

  Future<Map<String, dynamic>> resetPassword(String email, String otp, String newPassword) async {
    try {
      final response = await _dio.post('auth/reset-password', data: {
        'email': email,
        'otp': otp,
        'newPassword': newPassword,
      });
      return response.data;
    } on DioException catch (e) {
      return _handleError(e, 'Password reset failed');
    }
  }

  Map<String, dynamic> _handleError(DioException e, String defaultMessage) {
    String message = defaultMessage;
    if (e.response?.data != null && e.response?.data is Map) {
      message = e.response?.data['message'] ?? defaultMessage;
    } else if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
      message = 'Connection error. Please check your internet or if the server is running.';
    }
    return {'success': false, 'message': message};
  }
}
