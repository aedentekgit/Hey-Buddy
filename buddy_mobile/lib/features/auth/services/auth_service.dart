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
      return {'success': false, 'message': e.response?.data['message'] ?? 'Login failed'};
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    try {
      final response = await _dio.post('auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
      });
      return response.data;
    } on DioException catch (e) {
      return {'success': false, 'message': e.response?.data['message'] ?? 'Registration failed'};
    }
  }

  Future<Map<String, dynamic>> googleLogin(String idToken) async {
    try {
      final response = await _dio.post('auth/google-login', data: {
        'idToken': idToken,
      });
      return response.data;
    } on DioException catch (e) {
      return {'success': false, 'message': e.response?.data['message'] ?? 'Google Login failed'};
    }
  }
}
