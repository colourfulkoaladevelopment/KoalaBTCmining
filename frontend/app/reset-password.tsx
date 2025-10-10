import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      Alert.alert(
        'Invalid Reset Link',
        'This password reset link is invalid or missing a token. Please request a new password reset.',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    }
  }, [token]);

  const handleResetPassword = async () => {
    try {
      console.log('=== RESET PASSWORD FUNCTION CALLED ===');
      console.log('Token:', token);
      console.log('New Password Length:', newPassword.length);
      
      Alert.alert('Debug', `Function called! Password length: ${newPassword.length}`, [
        { 
          text: 'Continue', 
          onPress: async () => {
            if (!newPassword.trim()) {
              Alert.alert('Error', 'Please enter a new password');
              return;
            }

            if (newPassword.length < 6) {
              Alert.alert('Error', 'Password must be at least 6 characters long');
              return;
            }

            if (newPassword !== confirmPassword) {
              Alert.alert('Error', 'Passwords do not match');
              return;
            }

            if (!token) {
              Alert.alert('Error', 'Invalid reset token. Please request a new password reset.');
              return;
            }

            setIsLoading(true);

            try {
              const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://coinharvest-2.preview.emergentagent.com';
              const url = `${backendUrl}/api/auth/reset-password`;
              
              console.log('Making API call to:', url);

              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  token: token,
                  new_password: newPassword,
                }),
              });

              console.log('Response status:', response.status);
              const data = await response.json();
              console.log('Response data:', data);

              if (response.ok) {
                Alert.alert(
                  '✅ Password Reset Successful!',
                  'Your password has been reset successfully. You can now log in with your new password.',
                  [
                    {
                      text: 'Login Now',
                      onPress: () => router.replace('/'),
                    },
                  ]
                );
              } else {
                Alert.alert('Error', data.detail || 'Failed to reset password');
              }
            } catch (error) {
              console.error('Reset password error:', error);
              Alert.alert('Error', `Network error: ${error.message}`);
            } finally {
              setIsLoading(false);
            }
          }
        },
        { text: 'Cancel' }
      ]);
    } catch (error) {
      console.error('Function execution error:', error);
      Alert.alert('Function Error', `Error in handleResetPassword: ${error.message}`);
    }
  };

  if (!token) {
    return (
      <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF5722" />
          <Text style={styles.errorTitle}>Invalid Reset Link</Text>
          <Text style={styles.errorText}>This password reset link is invalid or expired.</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Ionicons name="key" size={64} color="#FFD700" />
          <Text style={styles.title}>Reset Your Password</Text>
          <Text style={styles.subtitle}>Enter your new password below</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#FFD700" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="New Password"
              placeholderTextColor="#666"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye' : 'eye-off'}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#FFD700" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              placeholderTextColor="#666"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>

          {/* Simple test button */}
          <TouchableOpacity
            style={{
              backgroundColor: '#FF5722',
              padding: 20,
              borderRadius: 12,
              marginTop: 20,
              alignItems: 'center',
              zIndex: 1000,
            }}
            onPress={() => {
              Alert.alert('TEST', 'Simple button clicked!');
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
              TEST BUTTON
            </Text>
          </TouchableOpacity>

          {/* Original button with fixes */}
          <TouchableOpacity
            style={[styles.resetButton, { zIndex: 999 }]}
            onPress={() => {
              console.log('Reset button pressed!');
              Alert.alert('Debug', 'Button was clicked!', [
                { 
                  text: 'Continue', 
                  onPress: () => handleResetPassword() 
                },
                { text: 'Cancel' }
              ]);
            }}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#000" />
                  <Text style={styles.resetButtonText}>Reset Password</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonText}>← Back to Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <Text style={styles.securityText}>
            Your password will be encrypted and stored securely
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#AAA',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#FFF',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 5,
  },
  resetButton: {
    marginTop: 20,
    borderRadius: 12,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  resetButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFD700',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  securityText: {
    color: '#4CAF50',
    fontSize: 12,
    marginLeft: 5,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF5722',
    marginTop: 20,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
  },
});