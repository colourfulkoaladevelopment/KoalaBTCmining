import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, clearSession } from '../../utils/api';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  bitcoin_balance: number;
  total_earnings: number;
  total_referral_rewards: number;
  created_at: string;
  avatar_url?: string;
}

export default function Profile() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [suggestForm, setSuggestForm] = useState({ name: '', email: '', feature: '', description: '' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        setUserProfile(res.data);
      } else {
        await clearSession();
        router.replace('/auth');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyReferralCode = async () => {
    if (userProfile?.referral_code) {
      try {
        await Share.share({ message: userProfile.referral_code });
      } catch {
        Alert.alert('Error', 'Could not copy to clipboard');
      }
    }
  };

  const showFAQ = () => {
    Alert.alert(
      'Frequently Asked Questions',
      'Q: How does mining work?\nA: Koala Mining App is a premium mining simulator that offers real Bitcoin withdrawal rewards subject to administrative verification and terms of service. You rent mining power and earn Bitcoin rewards.\n\nQ: How do I withdraw Bitcoin?\nA: Register your wallet address on the Dashboard, then use the Withdraw button once approved by our team.\n\nQ: Are the earnings real?\nA: Yes — Koala Mining App is a premium mining simulator that offers real Bitcoin withdrawal rewards subject to administrative verification and terms of service.\n\nQ: How do referrals work?\nA: Share your code, both you and your friend get bonus miners when they join.',
      [{ text: 'OK' }]
    );
  };

  const submitContactForm = async () => {
    if (!contactForm.message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }
    const subject = encodeURIComponent(contactForm.subject || 'Support Request');
    const body = encodeURIComponent(`Name: ${contactForm.name}\nEmail: ${contactForm.email}\n\n${contactForm.message}`);
    await Linking.openURL(`mailto:colourfulkoaladevelopment@gmail.com?subject=${subject}&body=${body}`);
    setShowContactForm(false);
    setContactForm({ name: '', email: '', subject: '', message: '' });
    Alert.alert('Sent', 'Your email app has been opened with your message.');
  };

  const submitSuggestForm = async () => {
    if (!suggestForm.feature.trim()) {
      Alert.alert('Error', 'Please enter a feature name');
      return;
    }
    const subject = encodeURIComponent(`Feature Suggestion: ${suggestForm.feature}`);
    const body = encodeURIComponent(`Name: ${suggestForm.name}\nEmail: ${suggestForm.email}\nFeature: ${suggestForm.feature}\n\n${suggestForm.description}`);
    await Linking.openURL(`mailto:colourfulkoaladevelopment@gmail.com?subject=${subject}&body=${body}`);
    setShowSuggestForm(false);
    setSuggestForm({ name: '', email: '', feature: '', description: '' });
    Alert.alert('Sent', 'Your email app has been opened with your suggestion.');
  };

  const handleAvatarPress = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not select image');
    }
  };

  const uploadAvatar = async (asset: any) => {
    setUploadingAvatar(true);
    try {
      const base64 = asset.base64;
      const mimeType = asset.mimeType || 'image/jpeg';
      const res = await apiFetch('/api/user/avatar', {
        method: 'PUT',
        body: JSON.stringify({ avatar_base64: base64, mime_type: mimeType }),
      });
      if (res.ok) {
        Alert.alert('Success', 'Avatar updated!');
        loadUserProfile();
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to upload avatar');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    try {
      const res = await apiFetch('/api/user/avatar', { method: 'DELETE' });
      if (res.ok) {
        Alert.alert('Success', 'Avatar removed');
        loadUserProfile();
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const contactSupport = () => {
    Alert.alert('Contact Support', 'How would you like to contact our support team?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Email', onPress: () => setShowContactForm(true) },
      { text: 'Telegram', onPress: () => Linking.openURL('https://t.me/koalamining') },
    ]);
  };

  const signOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsLoggingOut(true);
            await apiFetch('/api/auth/logout', { method: 'POST' });
            await clearSession();
            router.replace('/auth');
          } catch (error) {
            console.error('Logout error:', error);
            await clearSession();
            router.replace('/auth');
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  const getJoinedDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Loading Profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF5722" />
          <Text style={styles.errorText}>Unable to load profile</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Account & Settings</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.userCard}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleAvatarPress} disabled={uploadingAvatar}>
            {uploadingAvatar ? (
              <ActivityIndicator color="#FF9800" />
            ) : userProfile?.avatar_url ? (
              <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={48} color="#FF9800" />
            )}
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userProfile?.name ?? 'Unknown User'}</Text>
            <Text style={styles.userEmail}>{userProfile?.email ?? 'No email on file'}</Text>
            <Text style={styles.loginMethod}>Email & Password</Text>
            {userProfile?.avatar_url ? (
              <TouchableOpacity onPress={removeAvatar}>
                <Text style={styles.removeAvatarText}>Remove Avatar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>Account Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>₿ {(userProfile?.bitcoin_balance ?? 0).toFixed(12)}</Text>
              <Text style={styles.statLabel}>Current Balance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>₿ {(userProfile?.total_earnings ?? 0).toFixed(12)}</Text>
              <Text style={styles.statLabel}>Total Earned</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{(userProfile?.total_referral_rewards ?? 0).toFixed(1)}</Text>
              <Text style={styles.statLabel}>Referral Rewards GH/s</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{getJoinedDate(userProfile?.created_at ?? '')}</Text>
              <Text style={styles.statLabel}>Member Since</Text>
            </View>
          </View>
        </View>

        {/* Referral Code Card */}
        <View style={styles.referralCard}>
          <Text style={styles.cardTitle}>Your Referral Code</Text>
          <View style={styles.referralCodeContainer}>
            <Text style={styles.referralCode}>{userProfile?.referral_code ?? 'N/A'}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyReferralCode}>
              <Ionicons name="copy" size={20} color="#FF9800" />
            </TouchableOpacity>
          </View>
          <Text style={styles.referralDescription}>Share this code to earn rewards when friends join</Text>
        </View>

        {/* Actions Card */}
        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Support & Settings</Text>
          <TouchableOpacity style={styles.actionItem} onPress={showFAQ}>
            <View style={styles.actionIcon}>
              <Ionicons name="help-circle" size={24} color="#2196F3" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>FAQ</Text>
              <Text style={styles.actionDescription}>Frequently asked questions</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#AAA" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={contactSupport}>
            <View style={styles.actionIcon}>
              <Ionicons name="headset" size={24} color="#4CAF50" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Contact Support</Text>
              <Text style={styles.actionDescription}>Get help from our team</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#AAA" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => setShowSuggestForm(true)}>
            <View style={styles.actionIcon}>
              <Ionicons name="bulb" size={24} color="#FF9800" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Suggest a Feature</Text>
              <Text style={styles.actionDescription}>Tell us what you'd like to see</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#AAA" />
          </TouchableOpacity>
          {userProfile?.email === 'colourfulkoaladevelopment@gmail.com' && (
            <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/admin')}>
              <View style={styles.actionIcon}>
                <Ionicons name="shield" size={24} color="#FFD700" />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Admin Panel</Text>
                <Text style={styles.actionDescription}>Manage users and wallets</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFD700" />
            </TouchableOpacity>
          )}
        </View>

        {/* App Info */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>App Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Build</Text>
            <Text style={styles.infoValue}>2024.001</Text>
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.signOutContainer}>
          <TouchableOpacity
            style={[styles.signOutButton, isLoggingOut && styles.disabledButton]}
            onPress={signOut}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="log-out" size={20} color="#FFF" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Koala Mining{'\n'}Educational Mining Experience</Text>
        </View>
      </ScrollView>

      {/* Contact Form Modal */}
      <Modal visible={showContactForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Contact Support</Text>
            <TextInput style={styles.modalInput} placeholder="Your Name" placeholderTextColor="#666" value={contactForm.name} onChangeText={t => setContactForm({ ...contactForm, name: t })} />
            <TextInput style={styles.modalInput} placeholder="Your Email" placeholderTextColor="#666" value={contactForm.email} onChangeText={t => setContactForm({ ...contactForm, email: t })} keyboardType="email-address" />
            <TextInput style={styles.modalInput} placeholder="Subject" placeholderTextColor="#666" value={contactForm.subject} onChangeText={t => setContactForm({ ...contactForm, subject: t })} />
            <TextInput style={[styles.modalInput, styles.modalTextArea]} placeholder="Message" placeholderTextColor="#666" value={contactForm.message} onChangeText={t => setContactForm({ ...contactForm, message: t })} multiline numberOfLines={4} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowContactForm(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={submitContactForm}>
                <Text style={styles.modalConfirmText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Suggest Feature Modal */}
      <Modal visible={showSuggestForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Suggest a Feature</Text>
            <TextInput style={styles.modalInput} placeholder="Your Name" placeholderTextColor="#666" value={suggestForm.name} onChangeText={t => setSuggestForm({ ...suggestForm, name: t })} />
            <TextInput style={styles.modalInput} placeholder="Your Email" placeholderTextColor="#666" value={suggestForm.email} onChangeText={t => setSuggestForm({ ...suggestForm, email: t })} keyboardType="email-address" />
            <TextInput style={styles.modalInput} placeholder="Feature Name" placeholderTextColor="#666" value={suggestForm.feature} onChangeText={t => setSuggestForm({ ...suggestForm, feature: t })} />
            <TextInput style={[styles.modalInput, styles.modalTextArea]} placeholder="Description" placeholderTextColor="#666" value={suggestForm.description} onChangeText={t => setSuggestForm({ ...suggestForm, description: t })} multiline numberOfLines={4} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowSuggestForm(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={submitSuggestForm}>
                <Text style={styles.modalConfirmText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  scrollContainer: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', marginTop: 10, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  errorText: { color: '#FFF', fontSize: 18, marginTop: 16, marginBottom: 24, textAlign: 'center' },
  retryButton: { backgroundColor: '#FF9800', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  header: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitle: { fontSize: 16, color: '#AAA', marginTop: 4 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', margin: 15, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#FF9800' },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 20 },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  userInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
  userEmail: { fontSize: 16, color: '#AAA', marginBottom: 4 },
  loginMethod: { fontSize: 14, color: '#666' },
  removeAvatarText: { fontSize: 12, color: '#FF5722', marginTop: 4 },
  statsCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statItem: { width: '48%', alignItems: 'center', marginBottom: 20, padding: 16, backgroundColor: '#333', borderRadius: 8 },
  statNumber: { fontSize: 16, fontWeight: 'bold', color: '#FF9800', marginBottom: 4, textAlign: 'center' },
  statLabel: { fontSize: 12, color: '#AAA', textAlign: 'center' },
  referralCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  referralCodeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 16, borderRadius: 8, marginBottom: 12 },
  referralCode: { fontSize: 18, fontWeight: 'bold', color: '#FF9800', letterSpacing: 1, flex: 1, textAlign: 'center' },
  copyButton: { padding: 8 },
  referralDescription: { fontSize: 14, color: '#AAA', textAlign: 'center' },
  actionsCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF', marginBottom: 2 },
  actionDescription: { fontSize: 14, color: '#AAA' },
  infoCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#333' },
  infoLabel: { fontSize: 14, color: '#AAA' },
  infoValue: { fontSize: 14, color: '#FFF', fontWeight: 'bold' },
  signOutContainer: { marginHorizontal: 15, marginBottom: 15 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF5722', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12 },
  disabledButton: { backgroundColor: '#666' },
  signOutText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  footer: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 40 },
  footerText: { fontSize: 12, color: '#666', textAlign: 'center', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  modalContent: { width: '100%', backgroundColor: '#2a2a2a', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#FF9800' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: '#FFF', marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  modalTextArea: { minHeight: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  modalCancelButton: { flex: 1, backgroundColor: '#333', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginRight: 10 },
  modalCancelText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  modalConfirmButton: { flex: 1, backgroundColor: '#FF9800', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginLeft: 10 },
  modalConfirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
