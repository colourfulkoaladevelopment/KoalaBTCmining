import React, { useState } from 'react';
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
import { BACKEND_URL } from '../utils/api';

type ResetPasswordScreenProps = {
  onBack?: () => void;
};

export default function ResetPasswordScreen({ onBack }: ResetPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your account email');
      return;
    }

    setIsLoading(true);
    try {
      if (!BACKEND_URL) {
        Alert.alert('Error', 'Backend URL not configured');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.detail || 'The reset email could not be sent. Please try again.');
      }

      setEmail('');
      Alert.alert(
        'Check Your Inbox',
        'If the account exists, a secure password reset link has been sent to your inbox.',
        [{ text: 'Back to Login', onPress: () => onBack?.() }]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The reset email could not be sent. Please try again.';
      Alert.alert('Unable to Send Reset Link', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Ionicons name="mail" size={64} color="#FFD700" />
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>Enter your email to receive a secure reset link</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#FFD700" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="User Email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleSendResetLink}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.resetButtonText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => onBack?.()}>
            <Text style={styles.backButtonText}>← Back to Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <Text style={styles.securityText}>A secure link will be emailed to you</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFD700', marginTop: 20, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#AAA', marginTop: 8, textAlign: 'center' },
  form: { marginBottom: 30 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 12, marginBottom: 20, paddingHorizontal: 15, borderWidth: 1, borderColor: '#333' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 50, color: '#FFF', fontSize: 16 },
  resetButton: { backgroundColor: '#FFD700', padding: 20, alignItems: 'center', marginTop: 20, borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  resetButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { color: '#FFD700', fontSize: 16, textDecorationLine: 'underline' },
  securityNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  securityText: { color: '#4CAF50', fontSize: 12, marginLeft: 5 },
});
