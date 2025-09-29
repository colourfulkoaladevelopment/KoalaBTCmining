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

  useEffect(() => {
    checkAuthStatus();
  }, []);

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
      // In a real app, this would send a password reset email
      Alert.alert(
        'Password Reset Sent! 📧',
        'If an account with this email exists, you will receive password reset instructions.',
        [{ text: 'OK', onPress: () => setShowForgotPassword(false) }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email');
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

  // Rest of the app implementation would continue here...
  // Due to space constraints, I'll continue in the next part
  return <Text>Main app continues...</Text>;
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
});