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
  RefreshControl,
  Modal,
  Linking,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function PremiumBitcoinMiningApp() {
  const [currentScreen, setCurrentScreen] = useState('loading');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
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
  const [expiredMiners, setExpiredMiners] = useState([]);
  const [storeMiners, setStoreMiners] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showContactForm, setShowContactForm] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  
  // Form states
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  
  const [withdrawForm, setWithdrawForm] = useState({
    address: '',
    amount: '',
    network: 'bitcoin'
  });
  
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  // Calculate estimated BTC per day for a given hash rate
  const calculateDailyEarnings = (hashRate) => {
    // Base rate: 0.000000000000083 BTC per GH/s per 5 seconds (10x lower than previous)
    const baseRate = 0.000000000000083;
    const secondsPerDay = 86400;
    const intervalSeconds = 5;
    const cyclesPerDay = secondsPerDay / intervalSeconds; // 17280 cycles per day
    
    return (hashRate * baseRate * cyclesPerDay).toFixed(14);
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Real-time balance updates (1-second interval)
  useEffect(() => {
    let intervalId;
    
    if (currentScreen === 'app' && user) {
      // Start real-time balance updates after successful login
      intervalId = setInterval(async () => {
        try {
          await loadWalletData(); // Only refresh wallet balance - faster and non-intrusive
        } catch (error) {
          console.error('Real-time balance update failed:', error);
        }
      }, 1000); // Update balance every 1 second
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentScreen, user]);

  const checkAuthStatus = async () => {
    try {
      // Animated progress bar
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + Math.random() * 15;
        });
      }, 150);

      const token = await AsyncStorage.getItem('session_token');
      const userData = await AsyncStorage.getItem('user_data');
      
      if (token && userData) {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          setLoadingProgress(100);
          await new Promise(resolve => setTimeout(resolve, 800));
          
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
          setLoadingProgress(100);
          await new Promise(resolve => setTimeout(resolve, 800));
          setCurrentScreen('auth');
        }
      } else {
        setLoadingProgress(100);
        await new Promise(resolve => setTimeout(resolve, 800));
        setCurrentScreen('auth');
      }
    } catch (error) {
      setLoadingProgress(100);
      await new Promise(resolve => setTimeout(resolve, 800));
      setCurrentScreen('auth');
    }
  };

  const loadWalletData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      // Only load wallet balance - much faster and lighter than full app data
      const walletResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/wallet/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (walletResponse.ok) {
        const walletResult = await walletResponse.json();
        setWalletData(walletResult);
      }
    } catch (error) {
      // Silently fail for real-time updates to avoid disrupting user experience
      console.error('Balance update failed:', error);
    }
  };

  const loadAppData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      // Load all data in parallel
      const [walletResponse, minersResponse, storeResponse, referralResponse] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/wallet/balance`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/miners/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/miners`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/referrals/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (walletResponse.ok) {
        const walletResult = await walletResponse.json();
        setWalletData(walletResult);
      }

      if (minersResponse.ok) {
        const minersResult = await minersResponse.json();
        const allMiners = minersResult.miners;
        
        // Separate active/inactive and expired miners
        const activeMiners = allMiners.filter(miner => 
          miner.status !== 'expired' || miner.miner_type === 'premium'
        );
        const expiredMiners = allMiners.filter(miner => 
          miner.status === 'expired' && miner.miner_type !== 'premium'
        );
        
        setMiners(activeMiners);
        setExpiredMiners(expiredMiners);
      }

      if (storeResponse.ok) {
        const storeResult = await storeResponse.json();
        setStoreMiners(storeResult.miners);
      }

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
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
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
        setActiveTab('dashboard');
        Alert.alert('Success! 🎉', isLogin ? 'Welcome back to Bitcoin Mining!' : 'Account created successfully!');
      } else {
        Alert.alert('Error', result.detail || 'Authentication failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          'Password Reset Sent! 📧',
          result.message || 'If an account with this email exists, you will receive password reset instructions.',
          [{ text: 'OK', onPress: () => {
            setShowForgotPassword(false);
            setForgotPasswordEmail('');
          }}]
        );
      } else {
        Alert.alert('Error', result.detail || 'Failed to send reset email');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred. Please try again.');
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
        Alert.alert('Success! 🎉', 'Free daily miner activated for 24 hours!');
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
    try {
      // No confirmation - direct activation as requested
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/miners/watch-ad`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        Alert.alert('Ad Boost Activated! ⚡', 'Your mining power has been increased for 30 minutes!');
        await loadAppData();
      } else {
        const result = await response.json();
        Alert.alert('Error', result.detail || 'Failed to activate ad boost');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const purchaseMiner = async (miner) => {
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
          payment_method: 'credit_card',
          auto_activate: true // Auto-activate as requested
        })
      });

      if (response.ok) {
        Alert.alert('Purchase Successful! 🎉', `${miner.name} has been purchased and automatically activated!`);
        await loadAppData();
      } else {
        const result = await response.json();
        Alert.alert('Purchase Failed', result.detail || 'Payment processing failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const renewMiner = (miner) => {
    Alert.alert(
      'Renew Miner',
      `Renew ${miner.name} for another 30 days?\n\nPrice: $${miner.purchase_price.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Renew', onPress: () => purchaseMiner({
          ...miner,
          name: miner.name + ' (Renewed)',
          price: miner.purchase_price
        })}
      ]
    );
  };

  const handleWithdraw = async () => {
    if (!withdrawForm.address || !withdrawForm.amount) {
      Alert.alert('Error', 'Please fill in all withdrawal fields');
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw ${withdrawForm.amount} BTC to:\n${withdrawForm.address}\n\nNetwork: ${withdrawForm.network === 'bitcoin' ? 'Bitcoin Network' : 'Lightning Network'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('session_token');
            const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/withdraw/bitcoin`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(withdrawForm)
            });

            if (response.ok) {
              Alert.alert('Withdrawal Initiated! 🚀', 'Your withdrawal is being processed. This may take a few minutes to complete.');
              setShowWithdrawModal(false);
              setWithdrawForm({ address: '', amount: '', network: 'bitcoin' });
              await loadAppData();
            } else {
              const result = await response.json();
              Alert.alert('Withdrawal Failed', result.detail || 'Failed to process withdrawal');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          }
        }}
      ]
    );
  };

  const submitContactForm = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
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
        Alert.alert('Message Sent! 📧', 'Your support request has been submitted. We\'ll get back to you soon!');
        setShowContactForm(false);
        setContactForm({ name: '', email: '', subject: '', message: '' });
      } else {
        Alert.alert('Error', 'Failed to submit support request');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const signOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: async () => {
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
        }}
      ]
    );
  };

  const resetTestAccount = async () => {
    Alert.alert(
      '🔄 Reset Test Account',
      'This will reset your account balance to 0, remove all miners, and clear all transaction history. This action cannot be undone.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset Account', style: 'destructive', onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('session_token');
            const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/test/reset-account`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            const result = await response.json();

            if (response.ok) {
              Alert.alert('✅ Account Reset Complete', 'Your test account has been reset successfully. All balances, miners, and history have been cleared.');
              // Refresh all data to show the reset state
              await loadAppData();
            } else {
              Alert.alert('❌ Reset Failed', result.detail || 'Failed to reset test account');
            }
          } catch (error) {
            Alert.alert('❌ Error', 'Network error occurred while resetting account');
            console.error('Reset error:', error);
          }
        }}
      ]
    );
  };

  // Loading Screen with Progress Bar
  if (currentScreen === 'loading') {
    return (
      <LinearGradient colors={['#000000', '#1a1a1a', '#2a2a2a']} style={styles.container}>
        <View style={styles.loadingScreen}>
          <View style={styles.logoContainer}>
            <LinearGradient colors={['#FFD700', '#FFC000', '#B8860B']} style={styles.logoGradient}>
              <Text style={styles.logo}>₿</Text>
            </LinearGradient>
            <Text style={styles.appTitle}>Bitcoin Mining</Text>
            <Text style={styles.appSubtitle}>Professional Mining Platform</Text>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient 
                colors={['#FFD700', '#FFC000']} 
                style={[styles.progressFill, { width: `${loadingProgress}%` }]} 
              />
            </View>
            <Text style={styles.progressText}>{Math.round(loadingProgress)}%</Text>
          </View>
          
          <Text style={styles.loadingText}>Initializing secure blockchain connection...</Text>
        </View>
      </LinearGradient>
    );
  }

  // Auth Screen
  if (currentScreen === 'auth') {
    return (
      <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.header}>
              <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.titleGradient}>
                <Text style={styles.titleText}>Bitcoin Mining</Text>
              </LinearGradient>
              <Text style={styles.subtitle}>Elite Mining Platform</Text>
            </View>

            <View style={styles.authCard}>
              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Ionicons name="person" size={20} color="#FFD700" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#666"
                    value={formData.name}
                    onChangeText={(text) => setFormData({...formData, name: text})}
                    autoCapitalize="words"
                    editable={!isLoading}
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#FFD700" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#666"
                  value={formData.email}
                  onChangeText={(text) => setFormData({...formData, email: text.toLowerCase()})}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#FFD700" style={styles.inputIcon} />
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
              </View>

              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Ionicons name="gift" size={20} color="#FFD700" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Referral Code (Optional)"
                    placeholderTextColor="#666"
                    value={formData.referralCode}
                    onChangeText={(text) => setFormData({...formData, referralCode: text.toUpperCase()})}
                    autoCapitalize="characters"
                    editable={!isLoading}
                  />
                </View>
              )}

              <TouchableOpacity 
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={handleAuth}
                disabled={isLoading}
              >
                <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                  {isLoading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isLogin ? 'SIGN IN' : 'CREATE ACCOUNT'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {isLogin && (
                <TouchableOpacity 
                  style={styles.forgotPasswordButton}
                  onPress={() => setShowForgotPassword(true)}
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

        {/* Forgot Password Modal */}
        <Modal visible={showForgotPassword} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSubtitle}>Enter your email to receive reset instructions</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#FFD700" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#666"
                  value={forgotPasswordEmail}
                  onChangeText={setForgotPasswordEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setShowForgotPassword(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={handleForgotPassword}>
                  <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                    <Text style={styles.confirmButtonText}>Send Reset</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>
      </LinearGradient>
    );
  }

  // Main App with Tab Navigation
  return (
    <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.container}>
      {/* Header for safe area - similar to bottom clearance */}
      <View style={styles.topHeader} />
      
      <View style={styles.appContainer}>
        {/* Header */}
        <View style={styles.appHeader}>
          <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.headerGradient}>
            <Text style={styles.headerTitle}>
              {activeTab === 'dashboard' && '⚡ Dashboard'}
              {activeTab === 'store' && '🛒 Store'}
              {activeTab === 'invites' && '👥 Invites'}
              {activeTab === 'profile' && '👤 Profile'}
            </Text>
          </LinearGradient>
        </View>

        {/* Tab Content */}
        <View style={styles.contentContainer}>
          {renderTabContent()}
        </View>

        {/* Bottom Tab Navigation */}
        <View style={styles.tabBarContainer}>
          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'dashboard' && styles.activeTab]}
              onPress={() => setActiveTab('dashboard')}
            >
              <Ionicons 
                name="home" 
                size={24} 
                color={activeTab === 'dashboard' ? '#FFD700' : '#666'} 
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
                color={activeTab === 'store' ? '#FFD700' : '#666'} 
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
                color={activeTab === 'invites' ? '#FFD700' : '#666'} 
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
                color={activeTab === 'profile' ? '#FFD700' : '#666'} 
              />
              <Text style={[styles.tabLabel, activeTab === 'profile' && styles.activeTabLabel]}>
                Profile
              </Text>
            </TouchableOpacity>
          </LinearGradient>
          
          {/* Bottom Clearance */}
          <View style={styles.bottomClearance} />
        </View>

        {/* Modals */}
        {renderModals()}
      </View>
    </LinearGradient>
  );

  // Tab Content Renderer
  function renderTabContent() {
    switch (activeTab) {
      case 'dashboard':
        return (
          <ScrollView 
            style={styles.tabContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFD700"
                colors={["#FFD700"]}
                progressBackgroundColor="#2a2a2a"
              />
            }
          >
            {/* Wallet Overview */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.walletCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="wallet" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Bitcoin Wallet</Text>
              </View>
              <Text style={styles.balance}>₿ {walletData?.total_balance?.toFixed(14) || '0.00000000000000'}</Text>
              <Text style={styles.usdValue}>≈ ${((walletData?.total_balance || 0) * 45000).toFixed(2)} USD</Text>
              
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Today's Earnings</Text>
                  <Text style={styles.statValue}>₿ {walletData?.today_earnings?.toFixed(14) || '0.00000000000000'}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Active Miners</Text>
                  <Text style={styles.statValue}>{walletData?.active_miners || 0}/{walletData?.total_miners || 0}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Withdraw Button */}
            <TouchableOpacity 
              style={styles.withdrawButton}
              onPress={() => setShowWithdrawModal(true)}
            >
              <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                <Ionicons name="send" size={20} color="#000" />
                <Text style={styles.withdrawButtonText}>Withdraw BTC</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Mining Status */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.miningCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="flash" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Mining Status</Text>
              </View>
              <View style={styles.hashRateContainer}>
                <Text style={styles.hashRateLabel}>Current Hash Rate</Text>
                <Text style={styles.hashRate}>{walletData?.current_hash_rate?.toFixed(1) || '0.0'} GH/s</Text>
                {(walletData?.current_hash_rate || 0) > 0 && (
                  <LinearGradient colors={['#4CAF50', '#45a049']} style={styles.miningIndicator} />
                )}
              </View>
            </LinearGradient>

            {/* Quick Actions */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.quickActionsCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="rocket" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Quick Start</Text>
              </View>
              
              <TouchableOpacity style={styles.actionButton} onPress={activateFreeMiner}>
                <LinearGradient colors={['#1B4332', '#2D5A3D']} style={styles.actionButtonGradient}>
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="gift" size={24} color="#4CAF50" />
                    <View style={styles.actionButtonText}>
                      <Text style={styles.actionButtonTitle}>Free Daily Miner</Text>
                      <Text style={styles.actionButtonSubtitle}>1 GH/s for 24 hours</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={watchAdForMining}>
                <LinearGradient colors={['#331C1C', '#4A2728']} style={styles.actionButtonGradient}>
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="play-circle" size={24} color="#FF5722" />
                    <View style={styles.actionButtonText}>
                      <Text style={styles.actionButtonTitle}>Watch Ad for Boost</Text>
                      <Text style={styles.actionButtonSubtitle}>2 GH/s for 30 minutes</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#FF5722" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>

            {/* Your Miners */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.minersCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="hardware-chip" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Your Miners ({miners.length})</Text>
              </View>
              
              {miners.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="hardware-chip" size={48} color="#666" />
                  <Text style={styles.emptyStateTitle}>No Miners Yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Activate your free daily miner to get started</Text>
                </View>
              ) : (
                miners.map((miner) => (
                  <LinearGradient key={miner.id} colors={['#333', '#2a2a2a']} style={styles.minerItem}>
                    <View style={styles.minerHeader}>
                      <Text style={styles.minerName}>{miner.name}</Text>
                      <LinearGradient 
                        colors={miner.status === 'active' ? ['#4CAF50', '#45a049'] : ['#666', '#555']}
                        style={styles.minerStatus}
                      >
                        <Text style={styles.statusText}>{miner.status.toUpperCase()}</Text>
                      </LinearGradient>
                    </View>
                    
                    <View style={styles.minerStats}>
                      <Text style={styles.minerStat}>Hash Rate: {miner.hash_rate} GH/s</Text>
                      <Text style={styles.minerStat}>Earned: ₿ {miner.total_earned?.toFixed(14)}</Text>
                      <Text style={styles.minerStat}>Est. Daily: ₿ {calculateDailyEarnings(miner.hash_rate)}/day</Text>
                      <Text style={styles.minerStat}>Time Left: {miner.time_remaining?.toFixed(1)}h</Text>
                    </View>

                    {miner.miner_type === 'premium' && miner.status === 'expired' && (
                      <TouchableOpacity 
                        style={styles.renewButton}
                        onPress={() => renewMiner(miner)}
                      >
                        <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                          <Text style={styles.renewButtonText}>Renew for 30 Days</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </LinearGradient>
                ))
              )}
            </LinearGradient>

            {/* Expired Miners Section */}
            {expiredMiners.length > 0 && (
              <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.expiredMinersCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="time" size={24} color="#666" />
                  <Text style={styles.cardTitle}>Expired Miners ({expiredMiners.length})</Text>
                </View>
                
                {expiredMiners.map((miner) => (
                  <View key={miner.id} style={styles.expiredMinerItem}>
                    <Text style={styles.expiredMinerName}>{miner.name}</Text>
                    <Text style={styles.expiredMinerDetails}>
                      Earned: ₿ {miner.total_earned?.toFixed(14)} | {miner.hash_rate} GH/s | ₿ {calculateDailyEarnings(miner.hash_rate)}/day
                    </Text>
                  </View>
                ))}
              </LinearGradient>
            )}
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
                tintColor="#FFD700"
                colors={["#FFD700"]}
                progressBackgroundColor="#2a2a2a"
              />
            }
          >
            <View style={styles.storeHeader}>
              <Text style={styles.storeTitle}>Premium Miners</Text>
              <Text style={styles.storeSubtitle}>Professional mining hardware rentals</Text>
            </View>

            <View style={styles.minersGrid}>
              {storeMiners.map((miner) => (
                <LinearGradient key={miner.id} colors={['#2a2a2a', '#1a1a1a']} style={styles.storeMinerCard}>
                  <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.minerTier}>
                    <Text style={styles.tierText}>PREMIUM</Text>
                  </LinearGradient>
                  
                  <View style={styles.minerContent}>
                    <Ionicons name="hardware-chip" size={32} color="#FFD700" style={styles.minerIcon} />
                    <Text style={styles.storeMinerName}>{miner.name}</Text>
                    <Text style={styles.storeMinerHashRate}>
                      {miner.hash_rate >= 1000 ? `${(miner.hash_rate / 1000).toFixed(1)} TH/s` : `${miner.hash_rate} GH/s`}
                    </Text>
                    <Text style={styles.storeMinerEarnings}>₿ {calculateDailyEarnings(miner.hash_rate)}/day</Text>
                    <Text style={styles.storeMinerPrice}>${miner.price}</Text>
                    <Text style={styles.storeMinerDuration}>30 days rental</Text>
                    
                    <TouchableOpacity 
                      style={styles.purchaseButton}
                      onPress={() => purchaseMiner(miner)}
                    >
                      <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                        <Text style={styles.purchaseButtonText}>Purchase & Activate</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              ))}
            </View>
          </ScrollView>
        );

      case 'invites':
        return (
          <ScrollView 
            style={styles.tabContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFD700"
                colors={["#FFD700"]}
                progressBackgroundColor="#2a2a2a"
              />
            }
          >
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.referralCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="gift" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Your Referral Code</Text>
              </View>
              
              <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.referralCodeContainer}>
                <Text style={styles.referralCode}>{referralStats?.referral_code || 'Loading...'}</Text>
                <TouchableOpacity onPress={() => {
                  if (referralStats?.referral_code) {
                    Clipboard.setString(referralStats.referral_code);
                    Alert.alert('Copied! 📋', 'Referral code copied to clipboard');
                  }
                }}>
                  <Ionicons name="copy" size={20} color="#FFD700" />
                </TouchableOpacity>
              </LinearGradient>
            </LinearGradient>

            {referralStats && (
              <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statsCard}>
                <View style={styles.cardHeader}>
                  <Ionicons name="trophy" size={24} color="#FFD700" />
                  <Text style={styles.cardTitle}>Referral Stats</Text>
                </View>
                
                <View style={styles.statsGrid}>
                  <LinearGradient colors={['#333', '#2a2a2a']} style={styles.statItem}>
                    <Text style={styles.statNumber}>{referralStats.total_referrals}</Text>
                    <Text style={styles.statLabel}>Total Referrals</Text>
                  </LinearGradient>
                  
                  <LinearGradient colors={['#333', '#2a2a2a']} style={styles.statItem}>
                    <Text style={styles.statNumber}>{referralStats.total_commission?.toFixed(1) || '0.0'}</Text>
                    <Text style={styles.statLabel}>Commission GH/s</Text>
                  </LinearGradient>
                </View>
              </LinearGradient>
            )}

            <TouchableOpacity style={styles.shareButton} onPress={() => {
              const message = `🚀 Join me on Bitcoin Mining Simulator!\n\n💰 Use my code: ${referralStats?.referral_code}\n🎁 We both get 100 GH/s bonus!\n\nDownload: https://bitcoinmining.app`;
              Share.share({ message });
            }}>
              <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                <Ionicons name="share" size={20} color="#000" />
                <Text style={styles.shareButtonText}>Share Referral Code</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        );

      case 'profile':
        return (
          <ScrollView 
            style={styles.tabContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFD700"
                colors={["#FFD700"]}
                progressBackgroundColor="#2a2a2a"
              />
            }
          >
            {/* User Profile */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.userCard}>
              <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.avatarContainer}>
                <Ionicons name="person" size={48} color="#000" />
              </LinearGradient>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.name}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
                <Text style={styles.userCode}>Code: {user?.referral_code}</Text>
              </View>
            </LinearGradient>

            {/* Account Stats */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statsCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="stats-chart" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Account Statistics</Text>
              </View>
              
              <View style={styles.profileStats}>
                <Text style={styles.profileStat}>Balance: ₿ {walletData?.total_balance?.toFixed(14) || '0.00000000000000'}</Text>
                <Text style={styles.profileStat}>Total Earned: ₿ {user?.total_earnings?.toFixed(14) || '0.00000000000000'}</Text>
                <Text style={styles.profileStat}>Total Cashed Out: ₿ {user?.total_cashed_out?.toFixed(14) || '0.00000000000000'}</Text>
                <Text style={styles.profileStat}>Referral Rewards: {user?.total_referral_rewards?.toFixed(1) || '0.0'} GH/s</Text>
              </View>
            </LinearGradient>

            {/* Support Actions */}
            <TouchableOpacity style={styles.supportButton} onPress={() => setShowFAQ(true)}>
              <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.supportButtonGradient}>
                <Ionicons name="help-circle" size={20} color="#2196F3" />
                <Text style={styles.supportButtonText}>FAQ</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportButton} onPress={() => setShowContactForm(true)}>
              <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.supportButtonGradient}>
                <Ionicons name="headset" size={20} color="#4CAF50" />
                <Text style={styles.supportButtonText}>Contact Support</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportButton} onPress={resetTestAccount}>
              <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.supportButtonGradient}>
                <Ionicons name="refresh" size={20} color="#FF5722" />
                <Text style={styles.supportButtonText}>Reset Test Account</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
              <LinearGradient colors={['#FF5722', '#E53935']} style={styles.buttonGradient}>
                <Ionicons name="log-out" size={20} color="#FFF" />
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        );

      default:
        return <View />;
    }
  }

  // Render all modals
  function renderModals() {
    return (
      <>
        {/* Withdraw Modal */}
        <Modal visible={showWithdrawModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Withdraw Bitcoin</Text>
              <Text style={styles.modalSubtitle}>Send BTC to your wallet</Text>
              
              {/* Network Selection */}
              <View style={styles.networkSelection}>
                <TouchableOpacity 
                  style={[styles.networkButton, withdrawForm.network === 'bitcoin' && styles.selectedNetwork]}
                  onPress={() => setWithdrawForm({...withdrawForm, network: 'bitcoin'})}
                >
                  <Text style={styles.networkText}>Bitcoin Network</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.networkButton, withdrawForm.network === 'lightning' && styles.selectedNetwork]}
                  onPress={() => setWithdrawForm({...withdrawForm, network: 'lightning'})}
                >
                  <Text style={styles.networkText}>Lightning Network</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="wallet" size={20} color="#FFD700" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Bitcoin Address"
                  placeholderTextColor="#666"
                  value={withdrawForm.address}
                  onChangeText={(text) => setWithdrawForm({...withdrawForm, address: text})}
                  multiline
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="cash" size={20} color="#FFD700" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Amount (BTC)"
                  placeholderTextColor="#666"
                  value={withdrawForm.amount}
                  onChangeText={(text) => setWithdrawForm({...withdrawForm, amount: text})}
                  keyboardType="decimal-pad"
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setShowWithdrawModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={handleWithdraw}>
                  <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                    <Text style={styles.confirmButtonText}>Withdraw</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>

        {/* Contact Form Modal */}
        <Modal visible={showContactForm} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              <Text style={styles.modalTitle}>Contact Support</Text>
              <Text style={styles.modalSubtitle}>We're here to help you</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color="#FFD700" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Your Name"
                  placeholderTextColor="#666"
                  value={contactForm.name}
                  onChangeText={(text) => setContactForm({...contactForm, name: text})}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={20} color="#FFD700" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor="#666"
                  value={contactForm.email}
                  onChangeText={(text) => setContactForm({...contactForm, email: text})}
                  keyboardType="email-address"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="text" size={20} color="#FFD700" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Subject"
                  placeholderTextColor="#666"
                  value={contactForm.subject}
                  onChangeText={(text) => setContactForm({...contactForm, subject: text})}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="chatbubble" size={20} color="#FFD700" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  placeholder="Your Message"
                  placeholderTextColor="#666"
                  value={contactForm.message}
                  onChangeText={(text) => setContactForm({...contactForm, message: text})}
                  multiline
                  numberOfLines={4}
                />
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setShowContactForm(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={submitContactForm}>
                  <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                    <Text style={styles.confirmButtonText}>Send Message</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>

        {/* FAQ Modal */}
        <Modal visible={showFAQ} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={[styles.modalContent, styles.faqModal]}>
              <Text style={styles.modalTitle}>Frequently Asked Questions</Text>
              
              <ScrollView style={styles.faqContent}>
                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>🚀 How does the mining simulation work?</Text>
                  <Text style={styles.faqAnswer}>Our platform simulates Bitcoin mining using cloud computing power. You rent virtual mining hardware that generates Bitcoin rewards over time based on hash rates and mining difficulty.</Text>
                </View>
                
                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>💰 How do I start earning Bitcoin?</Text>
                  <Text style={styles.faqAnswer}>Begin with the free daily miner (1 GH/s for 24 hours), watch ads for mining boosts, or purchase premium miners from our store for higher earning potential.</Text>
                </View>
                
                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>🎯 Are the Bitcoin earnings real?</Text>
                  <Text style={styles.faqAnswer}>This is an educational mining simulation. While the app teaches real mining concepts, all transactions are simulated for learning purposes.</Text>
                </View>
                
                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>👥 How does the referral system work?</Text>
                  <Text style={styles.faqAnswer}>Share your unique referral code with friends. When they sign up, both of you receive a 100 GH/s bonus miner for 30 days. Plus, you earn 10% commission on their purchases!</Text>
                </View>
                
                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>💸 How do withdrawals work?</Text>
                  <Text style={styles.faqAnswer}>Use the Withdraw BTC feature to send Bitcoin to any wallet address via Bitcoin Network or Lightning Network. Processing typically takes a few minutes.</Text>
                </View>
                
                <View style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>📱 Can I use this on multiple devices?</Text>
                  <Text style={styles.faqAnswer}>Yes! Your account syncs across all devices. Just log in with the same credentials to access your miners and earnings anywhere.</Text>
                </View>
              </ScrollView>
              
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setShowFAQ(false)}
              >
                <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>
      </>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  logo: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#000',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
    textShadowColor: '#FFC000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  loadingText: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
    marginTop: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  titleGradient: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 15,
  },
  titleText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: 'rgba(42, 42, 42, 0.95)',
    borderRadius: 20,
    padding: 30,
    borderWidth: 1,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    fontSize: 16,
    color: '#FFF',
  },
  primaryButton: {
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  buttonGradient: {
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '500',
  },
  switchAuth: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  switchText: {
    color: '#AAA',
    fontSize: 16,
  },
  switchButton: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 30,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 30,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 12,
    paddingVertical: 15,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    marginLeft: 10,
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Main App Styles
  appContainer: {
    flex: 1,
  },
  appHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 15,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  
  // Tab Navigation
  tabBarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  tabBar: {
    flexDirection: 'row',
    height: 70,
    paddingTop: 10,
    paddingBottom: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    transform: [{ scale: 1.1 }],
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: 'bold',
  },
  activeTabLabel: {
    color: '#FFD700',
  },
  topHeader: {
    height: 35,
    backgroundColor: '#1a1a1a',
  },
  bottomClearance: {
    height: 35,
    backgroundColor: '#1a1a1a',
  },
  
  // Card Styles
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 10,
  },
  
  // Wallet Card
  walletCard: {
    margin: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  balance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginVertical: 10,
    fontFamily: 'monospace',
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
  
  // Withdraw Button
  withdrawButton: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
  },
  withdrawButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Mining Card
  miningCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  miningIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 10,
  },
  
  // Quick Actions
  quickActionsCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
  },
  actionButton: {
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonGradient: {
    padding: 16,
    borderRadius: 12,
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
  
  // Miners Cards
  minersCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
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
  renewButton: {
    borderRadius: 8,
    marginTop: 10,
  },
  renewButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // Expired Miners
  expiredMinersCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
  },
  expiredMinerItem: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expiredMinerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  expiredMinerDetails: {
    fontSize: 12,
    color: '#999',
  },
  
  // Store Styles
  storeHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  storeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  storeSubtitle: {
    fontSize: 16,
    color: '#AAA',
  },
  minersGrid: {
    paddingHorizontal: 15,
  },
  storeMinerCard: {
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
    overflow: 'hidden',
  },
  minerTier: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  tierText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 2,
  },
  minerContent: {
    padding: 20,
    alignItems: 'center',
  },
  minerIcon: {
    marginBottom: 12,
  },
  storeMinerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  storeMinerHashRate: {
    fontSize: 18,
    color: '#FFD700',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  storeMinerEarnings: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  storeMinerPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  storeMinerDuration: {
    fontSize: 14,
    color: '#AAA',
    marginBottom: 20,
  },
  purchaseButton: {
    borderRadius: 12,
    minWidth: 160,
  },
  purchaseButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Referral Styles
  referralCard: {
    margin: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  referralCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  referralCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
  },
  statsCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  shareButton: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 12,
  },
  shareButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  
  // Profile Styles
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  userCode: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: 'bold',
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
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 12,
  },
  supportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  supportButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  signOutButton: {
    marginHorizontal: 15,
    marginTop: 20,
    marginBottom: 15,
    borderRadius: 12,
  },
  signOutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  
  // Withdraw Modal Styles
  networkSelection: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  networkButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  selectedNetwork: {
    backgroundColor: '#FFD700',
  },
  networkText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  
  // FAQ Modal Styles
  faqModal: {
    maxHeight: height * 0.8,
  },
  faqContent: {
    flex: 1,
    marginVertical: 20,
  },
  faqItem: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
  },
  closeButton: {
    borderRadius: 12,
    marginTop: 10,
  },
  closeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});