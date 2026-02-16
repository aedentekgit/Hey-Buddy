import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _agreedToTerms = false;

  void _handleSignup() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    final confirmPassword = _confirmPasswordController.text.trim();
    
    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in all fields')),
      );
      return;
    }

    if (password != confirmPassword) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Passwords do not match')),
      );
      return;
    }

    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please agree to the terms and policy')),
      );
      return;
    }

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.register(name, email, password);
    
    if (!mounted) return;
    
    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Account created! Please sign in.')),
      );
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration failed. Email might be taken.')),
      );
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
            const SizedBox(height: 32),
            Text(
              'Create new account',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: branding.primaryColor.withOpacity(0.8),
              ),
            ),
            const SizedBox(height: 32),
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Full Name',
                hintText: 'Enter your full name',
              ),
            ),
            const SizedBox(height: 20),
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
            const SizedBox(height: 20),
            TextField(
              controller: _confirmPasswordController,
              obscureText: _obscureConfirmPassword,
              decoration: InputDecoration(
                labelText: 'Confirm Password',
                hintText: 'Enter your confirm password',
                suffixIcon: IconButton(
                  icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Checkbox(
                  value: _agreedToTerms,
                  onChanged: (val) => setState(() => _agreedToTerms = val ?? false),
                  activeColor: branding.primaryColor,
                ),
                const Expanded(
                  child: Text.rich(
                    TextSpan(
                      text: "I've read and agreed to ",
                      children: [
                        TextSpan(
                          text: "User Agreement",
                          style: TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                        ),
                        TextSpan(text: " and "),
                        TextSpan(
                          text: "Privacy Policy",
                          style: TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                        ),
                      ],
                    ),
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _handleSignup,
              child: Provider.of<AuthProvider>(context).isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Sign up'),
            ),
            const SizedBox(height: 24),
            const Text('other way to sign in', style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _socialButton(Icons.g_mobiledata, Colors.red),
                const SizedBox(width: 20),
                _socialButton(Icons.facebook, Colors.blue),
              ],
            ),
            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text("Already have an account?"),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Back to Sign In', style: TextStyle(fontWeight: FontWeight.bold)),
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
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey[300]!),
        borderRadius: BorderRadius.circular(50),
      ),
      child: Icon(icon, color: color, size: 24),
    );
  }
}
