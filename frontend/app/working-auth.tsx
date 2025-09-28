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
  SafeAreaView
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
  const [activeTab, setActiveTab] = useState('dashboard');

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
    } catch (error) {
      console.error('Error loading app data:', error);
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

  // Main App Screen
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.appHeader}>
          <Text style={styles.appTitle}>Bitcoin Mining Dashboard</Text>
          <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
            <Ionicons name="log-out" size={20} color="#FF5722" />
          </TouchableOpacity>
        </View>

        {/* Wallet Card */}
        <View style={styles.walletCard}>
          <Text style={styles.cardTitle}>Bitcoin Wallet</Text>
          <Text style={styles.balance}>₿ {walletData?.total_balance?.toFixed(8) || '0.00000000'}</Text>
          <Text style={styles.usdValue}>≈ ${((walletData?.total_balance || 0) * 45000).toFixed(2)} USD</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Today's Earnings</Text>
              <Text style={styles.statValue}>₿ {walletData?.today_earnings?.toFixed(8) || '0.00000000'}</Text>
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

        {/* Free Miner */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.cardTitle}>Free Daily Miner</Text>
          <TouchableOpacity 
            style={styles.freeButton}
            onPress={activateFreeMiner}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="gift" size={24} color="#4CAF50" />
              <View style={styles.actionButtonText}>
                <Text style={styles.actionButtonTitle}>Activate Free Miner</Text>
                <Text style={styles.actionButtonSubtitle}>1 GH/s for 24 hours</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
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
              <Text style={styles.emptyStateSubtitle}>
                Activate your free daily miner to get started
              </Text>
            </View>
          ) : (
            miners.map((miner) => (
              <View key={miner.id} style={styles.minerItem}>
                <View style={styles.minerHeader}>
                  <Text style={styles.minerName}>{miner.name}</Text>
                  <View style={[
                    styles.minerStatus, 
                    { backgroundColor: miner.status === 'active' ? '#4CAF50' : '#666' }
                  ]}>
                    <Text style={styles.statusText}>
                      {miner.status.toUpperCase()}
                    </Text>
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

        {/* User Info */}
        <View style={styles.userCard}>
          <Text style={styles.cardTitle}>Account Info</Text>
          <Text style={styles.userInfo}>Name: {user?.name}</Text>
          <Text style={styles.userInfo}>Email: {user?.email}</Text>
          <Text style={styles.userInfo}>Referral Code: {user?.referral_code}</Text>
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
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  signOutBtn: {
    padding: 8,
  },
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
  userCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  userInfo: {
    fontSize: 14,
    color: '#FFF',
    marginBottom: 8,
  },
});