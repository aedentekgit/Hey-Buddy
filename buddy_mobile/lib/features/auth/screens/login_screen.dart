import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/auth/screens/signup_screen.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/features/home/screens/main_screen.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  void _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    
    if (email.isEmpty || password.isEmpty) {
      ToastUtils.showErrorToast('Please fill in all fields');
      return;
    }

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.login(email, password);
    
    if (!mounted) return;
    
    if (success) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainScreen()),
      );
    } else {
      ToastUtils.showErrorToast('Invalid email or password');
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = Provider.of<BrandingProvider>(context);
    
    return Scaffold(
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 60),
        child: Column(
          children: [
            if (branding.logoUrl != null)
              CachedNetworkImage(
                imageUrl: branding.logoUrl!,
                height: 80,
                errorWidget: (context, url, error) => Icon(Icons.eco, size: 60, color: branding.primaryColor),
              )
            else
              Icon(Icons.eco, size: 60, color: branding.primaryColor),
            Text(
              branding.appName,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: branding.primaryColor,
              ),
            ),
            const SizedBox(height: 40),
            Text(
              'Sign in',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: branding.primaryColor.withOpacity(0.8),
              ),
            ),
            const SizedBox(height: 32),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(
                labelText: 'Email Address',
                hintText: 'Enter your email address',
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              decoration: InputDecoration(
                labelText: 'Password',
                hintText: 'Enter your password',
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () {},
                child: const Text('Forgot Password?'),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _handleLogin,
              child: Provider.of<AuthProvider>(context).isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Sign in'),
            ),
            const SizedBox(height: 32),
            const Text('other way to sign in', style: TextStyle(color: Colors.grey)),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _socialButton(Icons.g_mobiledata, Colors.red),
                const SizedBox(width: 20),
                _socialButton(Icons.facebook, Colors.blue),
              ],
            ),
            const SizedBox(height: 40),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text("Don't have an account?"),
                TextButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SignupScreen()),
                    );
                  },
                  child: const Text('Sign up', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _socialButton(IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey[300]!),
        borderRadius: BorderRadius.circular(50),
      ),
      child: Icon(icon, color: color, size: 30),
    );
  }
}
