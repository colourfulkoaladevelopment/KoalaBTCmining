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
  Clipboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  bitcoin_balance: number;
  total_earnings: number;
  total_referral_rewards: number;
  created_at: string;
}

export default function Profile() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        setUserProfile(result);
      } else {
        // Token might be invalid, redirect to auth
        await AsyncStorage.removeItem('session_token');
        await AsyncStorage.removeItem('user_data');
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
      await Clipboard.setString(userProfile.referral_code);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    }
  };

  const showFAQ = () => {
    Alert.alert(
      'Frequently Asked Questions',
      'FAQ\n\nQ: How does mining work?\nA: Our app simulates Bitcoin mining using cloud servers. You rent mining power and earn real Bitcoin rewards.\n\nQ: How do I withdraw Bitcoin?\nA: Contact support to process withdrawals to your external wallet.\n\nQ: Are the earnings real?\nA: This is a simulation app for educational purposes.\n\nQ: How do referrals work?\nA: Share your code, both you and your friend get bonus miners when they join.',
      [{ text: 'OK' }]
    );
  };

  const contactSupport = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact our support team?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Email', 
          onPress: () => Linking.openURL('mailto:support@bitcoinmining.com?subject=Support Request')
        },
        { 
          text: 'Telegram', 
          onPress: () => Linking.openURL('https://t.me/bitcoinminingsupport')
        }
      ]
    );
  };

  const signOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              
              const token = await AsyncStorage.getItem('session_token');
              
              // Call logout API
              await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              // Clear local storage
              await AsyncStorage.removeItem('session_token');
              await AsyncStorage.removeItem('user_data');
              
              // Redirect to auth
              router.replace('/auth');
              
            } catch (error) {
              console.error('Logout error:', error);
            } finally {
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
  };

  const getJoinedDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return 'Unknown';
    }
  };

  const getLoginMethod = (): string => {
    // In a real app, you'd track this during authentication
    // For now, we'll assume email login
    return 'Email & Password';
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Account & Settings</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#FF9800" />
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userProfile.name}</Text>
            <Text style={styles.userEmail}>{userProfile.email}</Text>
            <Text style={styles.loginMethod}>{getLoginMethod()}</Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>Account Stats</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>₿ {userProfile.bitcoin_balance.toFixed(8)}</Text>
              <Text style={styles.statLabel}>Current Balance</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>₿ {userProfile.total_earnings.toFixed(8)}</Text>
              <Text style={styles.statLabel}>Total Earned</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile.total_referral_rewards.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Referral Rewards GH/s</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{getJoinedDate(userProfile.created_at)}</Text>
              <Text style={styles.statLabel}>Member Since</Text>
            </View>
          </View>
        </View>

        {/* Referral Code Card */}
        <View style={styles.referralCard}>
          <Text style={styles.cardTitle}>Your Referral Code</Text>
          <View style={styles.referralCodeContainer}>
            <Text style={styles.referralCode}>{userProfile.referral_code}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyReferralCode}>
              <Ionicons name="copy" size={20} color="#FF9800" />
            </TouchableOpacity>
          </View>
          <Text style={styles.referralDescription}>
            Share this code to earn rewards when friends join
          </Text>
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
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>Expo React Native</Text>
          </View>
        </View>

        {/* Sign Out Button */}
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

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Koala Mining {'\n'}
            Educational Mining Experience
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: '#FFF',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#AAA',
    marginTop: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#AAA',
    marginBottom: 4,
  },
  loginMethod: {
    fontSize: 14,
    color: '#666',
  },
  statsCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#AAA',
    textAlign: 'center',
  },
  referralCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  referralCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  referralCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
    letterSpacing: 1,
    flex: 1,
    textAlign: 'center',
  },
  copyButton: {
    padding: 8,
  },
  referralDescription: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
  },
  actionsCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: '#AAA',
  },
  infoCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  infoLabel: {
    fontSize: 14,
    color: '#AAA',
  },
  infoValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: 'bold',
  },
  signOutContainer: {
    marginHorizontal: 15,
    marginBottom: 15,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5722',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  signOutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});