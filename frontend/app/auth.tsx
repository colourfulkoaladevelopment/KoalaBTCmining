import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    referralCode: ''
  });

  const handleGoogleLogin = () => {
    const redirectUrl = encodeURIComponent(`${process.env.EXPO_PUBLIC_BACKEND_URL}/(tabs)/dashboard`);
    const authUrl = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
    
    // In a real app, this would open the Google OAuth flow
    // For now, we'll simulate it
    Alert.alert(
      'Google Login',
      'Google OAuth integration would open here. For demo, this will create a test user.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Simulate Google OAuth response
              const mockGoogleData = {
                name: 'Demo User',
                email: 'demo@example.com',
                password: 'demopassword123'
              };
              
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(mockGoogleData),
              });
              
              const result = await response.json();
              
              if (response.ok) {
                await AsyncStorage.setItem('session_token', result.access_token);
                await AsyncStorage.setItem('user_data', JSON.stringify(result.user));
                router.replace('/(tabs)/dashboard');
              } else {
                // If user exists, try login
                const loginResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/login`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email: mockGoogleData.email,
                    password: mockGoogleData.password
                  }),
                });
                
                const loginResult = await loginResponse.json();
                
                if (loginResponse.ok) {
                  await AsyncStorage.setItem('session_token', loginResult.access_token);
                  await AsyncStorage.setItem('user_data', JSON.stringify(loginResult.user));
                  router.replace('/(tabs)/dashboard');
                } else {
                  Alert.alert('Error', loginResult.detail || 'Authentication failed');
                }
              }
            } catch (error) {
              Alert.alert('Error', 'Network error occurred');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEmailAuth = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isLogin && !formData.name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    try {
      setIsLoading(true);
      
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { email: formData.email, password: formData.password }
        : {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            referral_code: formData.referralCode || null
          };

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('session_token', result.access_token);
        await AsyncStorage.setItem('user_data', JSON.stringify(result.user));
        
        Alert.alert(
          'Success',
          isLogin ? 'Welcome back!' : 'Account created successfully!',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
        );
      } else {
        Alert.alert('Error', result.detail || 'Authentication failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      'Please contact support at support@bitcoinmining.com to reset your password.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Koala Mining</Text>
            <Text style={styles.subtitle}>Start Mining Today</Text>
          </View>

          <View style={styles.form}>
            <TouchableOpacity 
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              disabled={isLoading}
            >
              <Ionicons name="logo-google" size={20} color="#FFF" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#666"
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                autoCapitalize="words"
                editable={!isLoading}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#666"
              value={formData.email}
              onChangeText={(text) => setFormData({...formData, email: text.toLowerCase()})}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
              value={formData.password}
              onChangeText={(text) => setFormData({...formData, password: text})}
              secureTextEntry
              autoCapitalize="none"
              editable={!isLoading}
            />

            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="Referral Code (Optional)"
                placeholderTextColor="#666"
                value={formData.referralCode}
                onChangeText={(text) => setFormData({...formData, referralCode: text.toUpperCase()})}
                autoCapitalize="characters"
                editable={!isLoading}
              />
            )}

            <TouchableOpacity 
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleEmailAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity 
                style={styles.forgotPasswordButton}
                onPress={handleForgotPassword}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <View style={styles.switchAuth}>
              <Text style={styles.switchText}>
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </Text>
              <TouchableOpacity 
                onPress={() => setIsLogin(!isLogin)}
                disabled={isLoading}
              >
                <Text style={styles.switchButton}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#AAA',
  },
  form: {
    width: '100%',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  googleButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    paddingHorizontal: 20,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#FFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  primaryButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#FF9800',
    fontSize: 14,
  },
  switchAuth: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  switchText: {
    color: '#AAA',
    fontSize: 14,
  },
  switchButton: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});