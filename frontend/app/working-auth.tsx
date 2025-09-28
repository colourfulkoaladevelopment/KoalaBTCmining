import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
  SafeAreaView,
  Share,
  Clipboard,
  RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function WorkingAuthApp() {
  const [currentScreen, setCurrentScreen] = useState('loading');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    referralCode: ''
  });

  // User and app state
  const [user, setUser] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [miners, setMiners] = useState([]);
  const [storeMiners, setStoreMiners] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Loading screen
      
      const token = await AsyncStorage.getItem('session_token');
      const userData = await AsyncStorage.getItem('user_data');
      
      if (token && userData) {
        // Verify token
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const userInfo = await response.json();
            setUser(userInfo);
            await loadAppData();
            setCurrentScreen('app');
          } else {
            await AsyncStorage.removeItem('session_token');
            await AsyncStorage.removeItem('user_data');
            setCurrentScreen('auth');
          }
        } catch (error) {
          setCurrentScreen('auth');
        }
      } else {
        setCurrentScreen('auth');
      }
    } catch (error) {
      setCurrentScreen('auth');
    }
  };

  const loadAppData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      // Load wallet data
      const walletResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/wallet/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (walletResponse.ok) {
        const walletResult = await walletResponse.json();
        setWalletData(walletResult);
      }

      // Load miners
      const minersResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/miners/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (minersResponse.ok) {
        const minersResult = await minersResponse.json();
        setMiners(minersResult.miners);
      }

      // Load store miners
      const storeResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/miners`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (storeResponse.ok) {
        const storeResult = await storeResponse.json();
        setStoreMiners(storeResult.miners);
      }

      // Load referral stats
      const referralResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/referrals/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (referralResponse.ok) {
        const referralResult = await referralResponse.json();
        setReferralStats(referralResult);
      }
    } catch (error) {
      console.error('Error loading app data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAppData();
      // Add a small delay to show the refresh animation
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error refreshing data:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAuth = async () => {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('session_token', result.access_token);
        await AsyncStorage.setItem('user_data', JSON.stringify(result.user));
        setUser(result.user);
        await loadAppData();
        setCurrentScreen('app');
        setActiveTab('dashboard'); // Start on dashboard
        Alert.alert('Success', isLogin ? 'Welcome back!' : 'Account created successfully!');
      } else {
        Alert.alert('Error', result.detail || 'Authentication failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await AsyncStorage.removeItem('session_token');
      await AsyncStorage.removeItem('user_data');
      setUser(null);
      setWalletData(null);
      setMiners([]);
      setCurrentScreen('auth');
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const activateFreeMiner = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/miners/activate-free`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        Alert.alert('Success', 'Free miner activated for 24 hours!');
        await loadAppData();
      } else {
        const result = await response.json();
        Alert.alert('Error', result.detail || 'Failed to activate free miner');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const watchAdForMining = async () => {
    Alert.alert(
      'Watch Ad',
      'Watch a 30-second video ad to get 2 GH/s mining power for 30 minutes?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Watch Ad', onPress: async () => {
          try {
            // Simulate ad watching delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const token = await AsyncStorage.getItem('session_token');
            const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/miners/watch-ad`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              Alert.alert('Success', 'Ad miner boost activated! Duration extended by 30 minutes.');
              await loadAppData();
            } else {
              const result = await response.json();
              Alert.alert('Error', result.detail || 'Failed to activate ad miner');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          }
        }}
      ]
    );
  };

  const purchaseMiner = (miner) => {
    Alert.alert(
      'Purchase Miner',
      `Purchase ${miner.name} for $${miner.price}?\n\nHash Rate: ${miner.hash_rate >= 1000 ? (miner.hash_rate / 1000).toFixed(1) + ' TH/s' : miner.hash_rate + ' GH/s'}\nDuration: ${miner.duration_days} days`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Purchase', 
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/purchase`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  ...miner,
                  payment_method: 'credit_card'
                })
              });

              if (response.ok) {
                Alert.alert('Purchase Successful! 🎉', `${miner.name} has been added to your miners. Go to Dashboard to activate it.`);
                await loadAppData();
              } else {
                const result = await response.json();
                Alert.alert('Purchase Failed', result.detail || 'Payment processing failed');
              }
            } catch (error) {
              Alert.alert('Error', 'Network error occurred');
            }
          }
        }
      ]
    );
  };

  const shareReferralCode = async () => {
    if (referralStats?.referral_code) {
      const message = `Join me on Bitcoin Mining Simulator and start earning Bitcoin! Use my referral code: ${referralStats.referral_code}\n\n🎁 We both get a 100 GH/s miner for 30 days when you sign up!\n\nDownload: https://bitcoinmining.app`;
      
      try {
        await Share.share({ message, title: 'Join Bitcoin Mining Simulator' });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const submitContactForm = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/support/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(contactForm)
      });

      if (response.ok) {
        Alert.alert('Success', 'Your message has been sent! We\'ll get back to you within 24 hours.');
        setContactForm({ name: '', email: '', subject: '', message: '' });
        setShowContactForm(false);
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading Screen
  if (currentScreen === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingScreen}>
          <Text style={styles.logo}>₿</Text>
          <Text style={styles.appTitle}>Bitcoin Mining</Text>
          <ActivityIndicator size="large" color="#FF9800" style={styles.loader} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Auth Screen
  if (currentScreen === 'auth') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Bitcoin Mining</Text>
              <Text style={styles.subtitle}>Start Mining Today</Text>
            </View>

            <View style={styles.form}>
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
                onPress={handleAuth}
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

  // Tab Content Renderer
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <ScrollView 
            style={styles.tabContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF9800"
                colors={["#FF9800"]}
                progressBackgroundColor="#2a2a2a"
              />
            }
          >
            {/* Wallet Card */}
            <View style={styles.walletCard}>
              <Text style={styles.cardTitle}>Bitcoin Wallet</Text>
              <Text style={styles.balance}>₿ {walletData?.total_balance?.toFixed(11) || '0.00000000000'}</Text>
              <Text style={styles.usdValue}>≈ ${((walletData?.total_balance || 0) * 45000).toFixed(2)} USD</Text>
              
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Today's Earnings</Text>
                  <Text style={styles.statValue}>₿ {walletData?.today_earnings?.toFixed(11) || '0.00000000000'}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Active Miners</Text>
                  <Text style={styles.statValue}>{walletData?.active_miners || 0}/{walletData?.total_miners || 0}</Text>
                </View>
              </View>
            </View>

            {/* Mining Status */}
            <View style={styles.miningCard}>
              <Text style={styles.cardTitle}>Mining Status</Text>
              <View style={styles.hashRateContainer}>
                <Text style={styles.hashRateLabel}>Current Hash Rate</Text>
                <Text style={styles.hashRate}>{walletData?.current_hash_rate?.toFixed(1) || '0.0'} GH/s</Text>
                {(walletData?.current_hash_rate || 0) > 0 && <View style={styles.miningIndicator} />}
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsCard}>
              <Text style={styles.cardTitle}>Quick Start</Text>
              
              <TouchableOpacity style={styles.freeButton} onPress={activateFreeMiner}>
                <View style={styles.actionButtonContent}>
                  <Ionicons name="gift" size={24} color="#4CAF50" />
                  <View style={styles.actionButtonText}>
                    <Text style={styles.actionButtonTitle}>Free Daily Miner</Text>
                    <Text style={styles.actionButtonSubtitle}>1 GH/s for 24 hours</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.adButton} onPress={watchAdForMining}>
                <View style={styles.actionButtonContent}>
                  <Ionicons name="play-circle" size={24} color="#FF5722" />
                  <View style={styles.actionButtonText}>
                    <Text style={styles.actionButtonTitle}>Watch Ad for Boost</Text>
                    <Text style={styles.actionButtonSubtitle}>2 GH/s for 30 minutes</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FF5722" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Miners List */}
            <View style={styles.minersCard}>
              <Text style={styles.cardTitle}>Your Miners ({miners.length})</Text>
              {miners.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="hardware-chip" size={48} color="#666" />
                  <Text style={styles.emptyStateTitle}>No Miners Yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Activate your free daily miner to get started</Text>
                </View>
              ) : (
                miners.map((miner) => (
                  <View key={miner.id} style={styles.minerItem}>
                    <View style={styles.minerHeader}>
                      <Text style={styles.minerName}>{miner.name}</Text>
                      <View style={[styles.minerStatus, { backgroundColor: miner.status === 'active' ? '#4CAF50' : '#666' }]}>
                        <Text style={styles.statusText}>{miner.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.minerStats}>
                      <Text style={styles.minerStat}>Hash Rate: {miner.hash_rate} GH/s</Text>
                      <Text style={styles.minerStat}>Earned: ₿ {miner.total_earned?.toFixed(8)}</Text>
                      <Text style={styles.minerStat}>Time Left: {miner.time_remaining?.toFixed(1)}h</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        );

      case 'store':
        return (
          <ScrollView 
            style={styles.tabContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FF9800"
                colors={["#FF9800"]}
                progressBackgroundColor="#2a2a2a"
              />
            }
          >
            <View style={styles.storeHeader}>
              <Text style={styles.cardTitle}>Miner Store</Text>
              <Text style={styles.subtitle}>Rent premium mining hardware</Text>
            </View>

            <View style={styles.minersGrid}>
              {storeMiners.map((miner) => (
                <View key={miner.id} style={styles.storeMinerCard}>
                  <Text style={styles.storeMinerName}>{miner.name}</Text>
                  <Text style={styles.storeMinerHashRate}>
                    {miner.hash_rate >= 1000 ? `${(miner.hash_rate / 1000).toFixed(1)} TH/s` : `${miner.hash_rate} GH/s`}
                  </Text>
                  <Text style={styles.storeMinerPrice}>${miner.price}</Text>
                  <Text style={styles.storeMinerDuration}>{miner.duration_days} days</Text>
                  <TouchableOpacity 
                    style={styles.purchaseButton}
                    onPress={() => purchaseMiner(miner)}
                  >
                    <Text style={styles.purchaseButtonText}>Purchase</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        );

      case 'invites':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.invitesHeader}>
              <Text style={styles.cardTitle}>Invite Friends</Text>
              <Text style={styles.subtitle}>Earn rewards together</Text>
            </View>

            {/* Referral Code */}
            <View style={styles.referralCard}>
              <Text style={styles.cardTitle}>Your Referral Code</Text>
              <View style={styles.referralCodeContainer}>
                <Text style={styles.referralCode}>{referralStats?.referral_code || 'Loading...'}</Text>
                <TouchableOpacity onPress={() => {
                  if (referralStats?.referral_code) {
                    Clipboard.setString(referralStats.referral_code);
                    Alert.alert('Copied!', 'Referral code copied to clipboard');
                  }
                }}>
                  <Ionicons name="copy" size={20} color="#FF9800" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Referral Stats */}
            {referralStats && (
              <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>Your Stats</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{referralStats.total_referrals}</Text>
                    <Text style={styles.statLabel}>Total Referrals</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{referralStats.total_commission?.toFixed(1) || '0.0'}</Text>
                    <Text style={styles.statLabel}>Commission GH/s</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Share Button */}
            <TouchableOpacity style={styles.shareButton} onPress={shareReferralCode}>
              <Ionicons name="share" size={20} color="#FFF" />
              <Text style={styles.shareButtonText}>Share Referral Code</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      case 'profile':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.profileHeader}>
              <Text style={styles.cardTitle}>Profile</Text>
              <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
                <Ionicons name="log-out" size={20} color="#FF5722" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>

            {/* User Info */}
            <View style={styles.userCard}>
              <View style={styles.avatarContainer}>
                <Ionicons name="person" size={48} color="#FF9800" />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.name}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>
            </View>

            {/* Account Stats */}
            <View style={styles.statsCard}>
              <Text style={styles.cardTitle}>Account Stats</Text>
              <View style={styles.profileStats}>
                <Text style={styles.profileStat}>Balance: ₿ {walletData?.total_balance?.toFixed(11) || '0.00000000000'}</Text>
                <Text style={styles.profileStat}>Total Earnings: ₿ {user?.total_earnings?.toFixed(11) || '0.00000000000'}</Text>
                <Text style={styles.profileStat}>Referral Code: {user?.referral_code}</Text>
              </View>
            </View>

            {/* Support Actions */}
            <TouchableOpacity style={styles.supportButton} onPress={() => Alert.alert('Frequently Asked Questions', 
              '🔸 How does Bitcoin mining work?\nOur app simulates real Bitcoin mining using cloud-based mining hardware. You rent miners that generate Bitcoin over time.\n\n🔸 How do I start mining?\nActivate your free daily miner or purchase premium miners from the store. Each miner has different hash rates and durations.\n\n🔸 When do I get paid?\nEarnings are calculated every minute and added to your wallet balance. You can withdraw once you reach the minimum threshold.\n\n🔸 Are the earnings real?\nThis is a simulation app for educational purposes. Earnings shown are virtual and for demonstration only.\n\n🔸 How do referrals work?\nShare your referral code with friends. When they sign up, you both get bonus mining power!\n\n🔸 Can I withdraw my Bitcoin?\nThis is a demo app - withdrawals are simulated for educational purposes only.')}>
              <Ionicons name="help-circle" size={20} color="#2196F3" />
              <Text style={styles.supportButtonText}>FAQ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportButton} onPress={() => setShowContactForm(true)}>
              <Ionicons name="headset" size={20} color="#4CAF50" />
              <Text style={styles.supportButtonText}>Contact Support</Text>
            </TouchableOpacity>

            {/* Contact Support Form Modal */}
            {showContactForm && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Contact Support</Text>
                    <TouchableOpacity onPress={() => setShowContactForm(false)}>
                      <Ionicons name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.modalForm}>
                    <TextInput
                      style={styles.input}
                      placeholder="Your Name"
                      placeholderTextColor="#666"
                      value={contactForm.name}
                      onChangeText={(text) => setContactForm({...contactForm, name: text})}
                      editable={!isLoading}
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="Email Address"
                      placeholderTextColor="#666"
                      value={contactForm.email}
                      onChangeText={(text) => setContactForm({...contactForm, email: text.toLowerCase()})}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!isLoading}
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="Subject"
                      placeholderTextColor="#666"
                      value={contactForm.subject}
                      onChangeText={(text) => setContactForm({...contactForm, subject: text})}
                      editable={!isLoading}
                    />

                    <TextInput
                      style={[styles.input, styles.messageInput]}
                      placeholder="Describe your issue or question..."
                      placeholderTextColor="#666"
                      value={contactForm.message}
                      onChangeText={(text) => setContactForm({...contactForm, message: text})}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      editable={!isLoading}
                    />

                    <TouchableOpacity 
                      style={[styles.primaryButton, isLoading && styles.disabledButton]}
                      onPress={submitContactForm}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Send Message</Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            )}
          </ScrollView>
        );

      default:
        return <View />;
    }
  };

  // Main App with Tab Navigation
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appContainer}>
        {/* Header */}
        <View style={styles.appHeader}>
          <Text style={styles.appTitle}>
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'store' && 'Store'}
            {activeTab === 'invites' && 'Invites'}
            {activeTab === 'profile' && 'Profile'}
          </Text>
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {renderTabContent()}
        </View>

        {/* Bottom Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'dashboard' && styles.activeTab]}
            onPress={() => setActiveTab('dashboard')}
          >
            <Ionicons 
              name="home" 
              size={24} 
              color={activeTab === 'dashboard' ? '#FF9800' : '#666'} 
            />
            <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.activeTabLabel]}>
              Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'store' && styles.activeTab]}
            onPress={() => setActiveTab('store')}
          >
            <Ionicons 
              name="storefront" 
              size={24} 
              color={activeTab === 'store' ? '#FF9800' : '#666'} 
            />
            <Text style={[styles.tabLabel, activeTab === 'store' && styles.activeTabLabel]}>
              Store
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'invites' && styles.activeTab]}
            onPress={() => setActiveTab('invites')}
          >
            <Ionicons 
              name="people" 
              size={24} 
              color={activeTab === 'invites' ? '#FF9800' : '#666'} 
            />
            <Text style={[styles.tabLabel, activeTab === 'invites' && styles.activeTabLabel]}>
              Invites
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'profile' && styles.activeTab]}
            onPress={() => setActiveTab('profile')}
          >
            <Ionicons 
              name="person" 
              size={24} 
              color={activeTab === 'profile' ? '#FF9800' : '#666'} 
            />
            <Text style={[styles.tabLabel, activeTab === 'profile' && styles.activeTabLabel]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 60,
    color: '#FF9800',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 40,
  },
  loader: {
    marginBottom: 20,
  },
  loadingText: {
    color: '#AAA',
    fontSize: 16,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
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
  // Main App Styles
  appContainer: {
    flex: 1,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingBottom: 20,
  },
  // Tab Navigation Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderTopColor: '#333',
    borderTopWidth: 1,
    height: 80,
    paddingTop: 10,
    paddingBottom: 20,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    // Add any active tab specific styles if needed
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: 'bold',
  },
  activeTabLabel: {
    color: '#FF9800',
  },
  // Content Styles
  walletCard: {
    backgroundColor: '#2a2a2a',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
  },
  balance: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF9800',
    textAlign: 'center',
    marginVertical: 10,
  },
  usdValue: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  miningCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  hashRateContainer: {
    alignItems: 'center',
  },
  hashRateLabel: {
    fontSize: 14,
    color: '#AAA',
    marginBottom: 5,
  },
  hashRate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  miningIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    marginTop: 10,
  },
  quickActionsCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  freeButton: {
    backgroundColor: '#1B4332',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  adButton: {
    backgroundColor: '#331C1C',
    borderWidth: 1,
    borderColor: '#FF5722',
    borderRadius: 12,
    padding: 16,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    flex: 1,
    marginLeft: 12,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  actionButtonSubtitle: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 2,
  },
  minersCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  minerItem: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  minerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  minerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    flex: 1,
  },
  minerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  minerStats: {
    marginBottom: 10,
  },
  minerStat: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 2,
  },
  // Store Tab Styles
  storeHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  minersGrid: {
    paddingHorizontal: 15,
  },
  storeMinerCard: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  storeMinerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  storeMinerHashRate: {
    fontSize: 16,
    color: '#FF9800',
    marginBottom: 8,
  },
  storeMinerPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  storeMinerDuration: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 15,
  },
  purchaseButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Invites Tab Styles
  invitesHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  statsCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    marginHorizontal: 15,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  // Profile Tab Styles
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  signOutText: {
    color: '#FF5722',
    fontSize: 14,
    marginLeft: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    margin: 15,
    padding: 20,
    borderRadius: 12,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#AAA',
  },
  profileStats: {
    marginTop: 10,
  },
  profileStat: {
    fontSize: 14,
    color: '#FFF',
    marginBottom: 8,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
  },
  supportButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 12,
  },
  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalForm: {
    maxHeight: 400,
  },
  messageInput: {
    height: 120,
    paddingTop: 16,
  },
});