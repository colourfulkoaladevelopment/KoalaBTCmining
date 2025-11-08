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
  Image,
  Linking,
  RefreshControl,
  Modal,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

const { width, height } = Dimensions.get('window');

// Admin Panel Component
function AdminPanelComponent({ user, setUser, setWalletData, setMiners, setCurrentScreen, setIsAdmin, showCustomAlert, loadAppData, giveBtcModal, setGiveBtcModal }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [timeRange, setTimeRange] = useState('30_days'); // '30_days' or 'all_time'
  const [debugInfo, setDebugInfo] = useState(''); // For showing debug info on screen
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [pendingWallets, setPendingWallets] = useState([]);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showPendingWallets, setShowPendingWallets] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, [timeRange]); // Reload when time range changes

  const loadAdminData = async () => {
    let debugLog = '=== ADMIN DATA LOADING DEBUG ===\n';
    
    try {
      const token = await AsyncStorage.getItem('session_token');
      debugLog += `\n1. Token: ${token ? 'Present (length: ' + token.length + ')' : 'MISSING!'}\n`;
      
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      debugLog += `2. Backend URL: ${backendUrl}\n`;
      
      // Load statistics with time range
      const statsUrl = `${backendUrl}/api/admin/stats?time_range=${timeRange}`;
      debugLog += `\n3. Fetching Stats from: ${statsUrl}\n`;
      
      const statsResponse = await fetch(statsUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      debugLog += `4. Stats Response Status: ${statsResponse.status}\n`;
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        debugLog += `5. Stats Data: ${JSON.stringify(statsData, null, 2)}\n`;
        setStats(statsData);
      } else {
        const errorText = await statsResponse.text();
        debugLog += `5. Stats Error: ${errorText}\n`;
      }

      // Load users
      const usersUrl = `${backendUrl}/api/admin/users`;
      debugLog += `\n6. Fetching Users from: ${usersUrl}\n`;
      
      const usersResponse = await fetch(usersUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      debugLog += `7. Users Response Status: ${usersResponse.status}\n`;
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        debugLog += `8. Users Count: ${usersData.users?.length || 0}\n`;
        debugLog += `9. Users Data Sample: ${JSON.stringify(usersData.users?.slice(0, 2), null, 2)}\n`;
        setUsers(usersData.users || []);
      } else {
        const errorText = await usersResponse.text();
        debugLog += `8. Users Error: ${errorText}\n`;
      }

      // Load pending wallets
      const pendingResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/pending-wallets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log('Pending wallets response status:', pendingResponse.status);
      
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        console.log('Pending wallets data:', pendingData);
        setPendingWallets(pendingData.pending_wallets || []);
      } else {
        const error = await pendingResponse.text();
        console.error('Pending wallets error:', error);
      }
      
      debugLog += '\n=== END DEBUG ===';
      setDebugInfo(debugLog);
      console.log(debugLog);
      
    } catch (error) {
      debugLog += `\n❌ EXCEPTION: ${error.message}\n`;
      debugLog += `Stack: ${error.stack}\n`;
      setDebugInfo(debugLog);
      console.error('Failed to load admin data:', error);
      showCustomAlert('Error', `Failed to load admin data: ${error.message}`);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    showCustomAlert(
      'Sign Out',
      'Are you sure you want to sign out from admin panel?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              await AsyncStorage.removeItem('session_token');
              await AsyncStorage.removeItem('user_data');
              await AsyncStorage.removeItem('app_launch_ad_shown');
              // Reset all app state
              setUser({
                freeMiners: [],
                premiumMiners: [],
                referralMiners: []
              });
              setWalletData(null);
              setCurrentScreen('auth');
              setIsAdmin(false);
            } catch (error) {
              console.error('Logout error:', error);
              showCustomAlert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleResetUser = async (userId, userEmail) => {
    showCustomAlert(
      '⚠️ Reset User Account',
      `Are you sure you want to reset ${userEmail}?\n\nThis will:\n• Delete all miners\n• Reset BTC balance to 0\n• Keep login credentials`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/reset-user/${userId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                showCustomAlert('✅ Success', 'User account reset successfully');
                loadAdminData();
              } else {
                showCustomAlert('❌ Error', 'Failed to reset user account');
              }
            } catch (error) {
              showCustomAlert('❌ Error', 'Network error occurred');
            }
          }
        }
      ]
    );
  };

  const approveWallet = async (walletId, userEmail) => {
    showCustomAlert(
      '✅ Approve Wallet',
      `Approve Bitcoin wallet for ${userEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/approve-wallet/${walletId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                showCustomAlert('✅ Success', 'Wallet approved successfully');
                loadAdminData();
              } else {
                showCustomAlert('❌ Error', 'Failed to approve wallet');
              }
            } catch (error) {
              showCustomAlert('❌ Error', 'Network error occurred');
            }
          }
        }
      ]
    );
  };

  const handleFactoryReset = async () => {
    showCustomAlert(
      '🚨 FACTORY RESET WARNING',
      'This will DELETE ALL MINERS and RESET ALL BALANCES to ₿ 0.00000000 for ALL users!\n\nThis action CANNOT be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'RESET ALL',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/factory-reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                const result = await response.json();
                showCustomAlert(
                  '✅ Factory Reset Complete',
                  `Successfully reset all accounts!\n\nMiners Deleted: ${result.miners_deleted}\nUsers Reset: ${result.users_reset}`,
                  [{ text: 'OK', onPress: () => loadAdminData() }]
                );
              } else {
                showCustomAlert('❌ Error', 'Failed to perform factory reset');
              }
            } catch (error) {
              showCustomAlert('❌ Error', 'Network error occurred');
            }
          }
        }
      ]
    );
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.container}>
      <ScrollView
        style={[styles.scrollView, { flex: 1 }]}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        {/* Header */}
        <View style={styles.adminHeader}>
          <Text style={styles.adminHeaderTitle}>⚙️ Admin Panel</Text>
          <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={() => {
              console.log('Debug button pressed');
              setShowDebugModal(true);
            }}>
              <Ionicons name="bug" size={24} color="#FFD700" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                console.log('Sign out button pressed');
                handleSignOut();
              }}
              style={{ padding: 5 }}
            >
              <Ionicons name="log-out" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Debug Modal */}
        <Modal visible={showDebugModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={[styles.modalContent, { maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>🐛 Debug Information</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={[styles.modalSubtitle, { textAlign: 'left', fontFamily: 'monospace', fontSize: 12 }]}>
                  {debugInfo || 'No debug info yet. Pull to refresh admin panel.'}
                </Text>
              </ScrollView>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDebugModal(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>

        {/* Time Range Toggle */}
        <View style={styles.timeRangeToggle}>
          <TouchableOpacity 
            style={[styles.toggleButton, timeRange === '30_days' && styles.toggleButtonActive]}
            onPress={() => setTimeRange('30_days')}
          >
            <Text style={[styles.toggleButtonText, timeRange === '30_days' && styles.toggleButtonTextActive]}>
              Last 30 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, timeRange === 'all_time' && styles.toggleButtonActive]}
            onPress={() => setTimeRange('all_time')}
          >
            <Text style={[styles.toggleButtonText, timeRange === 'all_time' && styles.toggleButtonTextActive]}>
              All Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statCard}>
            <Ionicons name="people" size={32} color="#FFD700" />
            <Text style={styles.statValue}>{stats?.total_users || 0}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </LinearGradient>

          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statCard}>
            <Ionicons name="flash" size={32} color="#FFD700" />
            <Text style={styles.statValue}>{stats?.active_miners || 0}</Text>
            <Text style={styles.statLabel}>Active Miners</Text>
          </LinearGradient>

          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statCard}>
            <Ionicons name="cash" size={32} color="#4CAF50" />
            <Text style={styles.statValue}>${(stats?.total_miner_revenue || 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Miner Revenue</Text>
            <Text style={styles.statSubLabel}>({timeRange === '30_days' ? 'Last 30 Days' : 'All Time'})</Text>
          </LinearGradient>

          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statCard}>
            <Ionicons name="warning" size={32} color="#FF6B6B" />
            <Text style={styles.statValue}>₿ {(stats?.total_btc_owed || 0).toFixed(8)}</Text>
            <Text style={styles.statLabel}>Total BTC Owed</Text>
            <Text style={styles.statSubLabel}>(Future Earnings)</Text>
          </LinearGradient>
        </View>

        {/* Factory Reset */}
        <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.adminSection}>
          <Text style={styles.sectionTitle}>🚨 Danger Zone</Text>
          <TouchableOpacity onPress={handleFactoryReset}>
            <LinearGradient colors={['#FF6B6B', '#FF4444']} style={styles.factoryResetButton}>
              <Ionicons name="nuclear" size={20} color="#FFF" />
              <Text style={styles.factoryResetButtonText}>Factory Reset All Accounts</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* User Management */}
        <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.adminSection}>
          <TouchableOpacity 
            onPress={() => setShowUserManagement(!showUserManagement)}
            style={styles.collapsibleHeader}
          >
            <Text style={styles.sectionTitle}>👥 User Management ({users.length})</Text>
            <Ionicons 
              name={showUserManagement ? "chevron-up" : "chevron-down"} 
              size={24} 
              color="#FFD700" 
            />
          </TouchableOpacity>
          
          {showUserManagement && (
            <>
              {/* Search */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search users..."
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {filteredUsers.map((usr) => (
                <View key={usr.id} style={styles.userItem}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{usr.name || 'Unknown'}</Text>
                    <Text style={styles.userEmail}>{usr.email}</Text>
                    <Text style={styles.userBalance}>Balance: ₿ {(usr.balance || 0).toFixed(8)}</Text>
                    <Text style={styles.userMiners}>Active Miners: {usr.active_miners || 0}</Text>
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity onPress={() => handleResetUser(usr.id, usr.email)}>
                      <LinearGradient colors={['#FF6B6B', '#FF4444']} style={styles.actionButton}>
                        <Ionicons name="refresh" size={16} color="#FFF" />
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteUser(usr.id, usr.email)}>
                      <LinearGradient colors={['#8B0000', '#6B0000']} style={styles.actionButton}>
                        <Ionicons name="trash" size={16} color="#FFF" />
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleGiveBtc(usr.id, usr.email)}>
                      <LinearGradient colors={['#4CAF50', '#45A049']} style={styles.actionButton}>
                        <Ionicons name="add-circle" size={16} color="#FFF" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </LinearGradient>

        {/* Pending Wallets */}
        <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.adminSection}>
          <TouchableOpacity 
            onPress={() => setShowPendingWallets(!showPendingWallets)}
            style={styles.collapsibleHeader}
          >
            <Text style={styles.sectionTitle}>🔐 Pending Wallet Approvals ({pendingWallets.length})</Text>
            <Ionicons 
              name={showPendingWallets ? "chevron-up" : "chevron-down"} 
              size={24} 
              color="#FFD700" 
            />
          </TouchableOpacity>
          
          {showPendingWallets && (
            <>
              {pendingWallets.length === 0 ? (
                <Text style={styles.noDataText}>No pending wallet approvals</Text>
              ) : (
                pendingWallets.map((wallet) => (
                  <View key={wallet.user_id} style={styles.userItem}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{wallet.name || 'Unknown'}</Text>
                      <Text style={styles.userEmail}>{wallet.email}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <TouchableOpacity 
                          onPress={async () => {
                            await Clipboard.setString(wallet.btc_wallet_address);
                            showCustomAlert('Copied! 📋', 'Bitcoin address copied to clipboard');
                          }}
                          style={[styles.copyButton, { marginRight: 6 }]}
                        >
                          <Ionicons name="copy" size={16} color="#FFD700" />
                        </TouchableOpacity>
                        <Text style={[styles.userBalance, { fontSize: 11, flex: 1 }]} numberOfLines={1}>
                          {wallet.btc_wallet_address}
                        </Text>
                      </View>
                      <Text style={styles.userMiners}>Balance: ₿ {(wallet.balance || 0).toFixed(8)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => approveWallet(wallet.user_id, wallet.email)}>
                      <LinearGradient colors={['#4CAF50', '#45a049']} style={styles.resetButton}>
                        <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                        <Text style={styles.resetButtonText}>Approve</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </LinearGradient>
      </ScrollView>
    </LinearGradient>
  );
}

export default function PremiumBitcoinMiningApp() {
  const [currentScreen, setCurrentScreen] = useState('loading');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    referralCode: ''
  });

  // User and app state
  const [user, setUser] = useState({
    freeMiners: [],
    premiumMiners: [],
    referralMiners: []
  });
  const [walletData, setWalletData] = useState(null);
  // Removed miners and expiredMiners state - using user.freeMiners, user.premiumMiners, user.referralMiners instead
  const [storeMiners, setStoreMiners] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Admin panel state
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  
  // Wallet status state
  const [walletStatus, setWalletStatus] = useState('disconnected');
  const [showWalletRegistrationModal, setShowWalletRegistrationModal] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletDebugLog, setWalletDebugLog] = useState('');
  const [giveBtcModal, setGiveBtcModal] = useState({ visible: false, userId: '', userEmail: '', amount: '' });
  
  // Modal states
  const [showContactForm, setShowContactForm] = useState(false);
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showActiveMiners, setShowActiveMiners] = useState(false);
  const [showFreeMiners, setShowFreeMiners] = useState(false);
  const [showPremiumMiners, setShowPremiumMiners] = useState(false);
  const [showReferralMiners, setShowReferralMiners] = useState(false);
  
  // Form states
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  
  const [suggestForm, setSuggestForm] = useState({
    name: '',
    email: '',
    feature: '',
    description: ''
  });
  
  const [withdrawForm, setWithdrawForm] = useState({
    address: '',
    amount: '',
    network: 'bitcoin'
  });
  
  const [bitcoinPrice, setBitcoinPrice] = useState(50000); // Default fallback price
  const [networkFee, setNetworkFee] = useState(0.00001); // Default network fee in BTC
  
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  
  // Activity feed state
  const [currentActivity, setCurrentActivity] = useState(null);
  const [activityTimer, setActivityTimer] = useState(null);

  // Facebook Ads state
  const [adStats, setAdStats] = useState({
    ads_watched_today: 0,
    remaining_ads: 30,
    max_daily_ads: 30,
    can_watch_ad: true
  });
  const [canActivateFreeMiner, setCanActivateFreeMiner] = useState(true);
  const [showAdModal, setShowAdModal] = useState(false);
  const [currentAdType, setCurrentAdType] = useState(null);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  
  // Custom Alert state
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  // Calculate estimated BTC per day for a given hash rate
  const calculateDailyEarnings = (hashRate) => {
    // Base rate: 0.000000000000083 BTC per GH/s per 5 seconds (current actual rate)
    const baseRate = 0.000000000000083;
    const secondsPerDay = 86400;
    const intervalSeconds = 5;
    const cyclesPerDay = secondsPerDay / intervalSeconds; // 17280 cycles per day
    
    return (hashRate * baseRate * cyclesPerDay).toFixed(14);
  };

  // Calculate time until daily reset (midnight UTC)
  const getTimeUntilReset = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    
    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  // Format time remaining in days, hours, minutes
  const formatTimeRemaining = (hours) => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    const minutes = Math.floor((hours % 1) * 60);
    
    if (days > 0) {
      return `${days}d ${remainingHours}h ${minutes}m`;
    } else if (remainingHours > 0) {
      return `${remainingHours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Calculate total daily earnings from all active miners
  const calculateTotalDailyEarnings = () => {
    // Combine all miner arrays from user state
    const allMiners = [
      ...(user?.freeMiners || []),
      ...(user?.premiumMiners || []),
      ...(user?.referralMiners || [])
    ];
    
    if (allMiners.length === 0) return '0.00000000000000';
    
    const totalHashRate = allMiners.reduce((sum, miner) => {
      if (miner.status === 'active') {
        return sum + (miner.hash_rate || 0);
      }
      return sum;
    }, 0);
    
    return calculateDailyEarnings(totalHashRate);
  };

  // Custom Alert helper function (replaces Alert.alert with black/gold themed modal)
  const showCustomAlert = (title, message, buttons = [{ text: 'OK', onPress: () => {} }]) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      buttons
    });
  };

  const hideCustomAlert = () => {
    setCustomAlert({
      visible: false,
      title: '',
      message: '',
      buttons: []
    });
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle deep links for PayPal returns
  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event.url;
      console.log('Deep link received:', url);
      
      if (url.includes('koalamining://paypal/success')) {
        // PayPal payment successful - refresh data
        showCustomAlert(
          '✅ Payment Successful!',
          'Your miner has been activated and is now generating Bitcoin!',
          [{ text: 'Great!', onPress: () => loadAppData() }]
        );
      } else if (url.includes('koalamining://paypal/cancel')) {
        // PayPal payment canceled
        showCustomAlert(
          'Payment Canceled',
          'Your payment was canceled. No charges were made.',
          [{ text: 'OK' }]
        );
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Real-time balance updates
  useEffect(() => {
    let balanceIntervalId: NodeJS.Timeout;
    let priceIntervalId: NodeJS.Timeout;
    
    if (currentScreen === 'app' && user) {
      // Start real-time balance updates after successful login
      balanceIntervalId = setInterval(async () => {
        try {
          await updateBalanceInRealTime(); // Only refresh wallet balance - faster and non-intrusive
        } catch (error) {
          console.error('Real-time balance update failed:', error);
        }
      }, 1000); // Update every 1 second for balance changes

      // Start Bitcoin price updates (every 60 seconds)
      priceIntervalId = setInterval(async () => {
        try {
          await updateBitcoinPricePeriodically();
        } catch (error) {
          console.error('Bitcoin price update failed:', error);
        }
      }, 60000); // Update every 60 seconds for price changes
    }

    return () => {
      if (balanceIntervalId) {
        clearInterval(balanceIntervalId);
      }
      if (priceIntervalId) {
        clearInterval(priceIntervalId);
      }
    };
  }, [currentScreen, user]);

  // Load app data and Bitcoin price when app loads
  useEffect(() => {
    if (currentScreen === 'app' && user) {
      loadAppData();
      loadBitcoinPrice(); // Load Bitcoin price when app loads
    }
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
            
            // Check if user is admin
            if (userInfo.email === 'colourfulkoaladevelopment@gmail.com') {
              setIsAdmin(true);
            }
            
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

  const updateBalanceInRealTime = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/wallet/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        setWalletData(result);
      }
    } catch (error) {
      // Silently fail for real-time updates to avoid disrupting user experience
      console.error('Balance update failed:', error);
    }
  };

  // Update Bitcoin price periodically (every 60 seconds)
  const updateBitcoinPricePeriodically = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/bitcoin/price`);
      if (response.ok) {
        const priceData = await response.json();
        setBitcoinPrice(priceData.btc_price_usd);
      }
    } catch (error) {
      console.error('Bitcoin price update failed:', error);
    }
  };

  const loadBitcoinPrice = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/bitcoin/price`);
      if (response.ok) {
        const priceData = await response.json();
        setBitcoinPrice(priceData.btc_price_usd);
      }
    } catch (error) {
      console.error('Failed to load Bitcoin price:', error);
    }
  };

  const loadAppData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      // Load all data in parallel including updated user info
      const [walletResponse, walletStatusResponse, minersResponse, storeResponse, referralResponse, userResponse] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/wallet/balance`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/wallet/status`, {
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
        }),
        fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (walletResponse.ok) {
        const walletResult = await walletResponse.json();
        setWalletData(walletResult);
      }

      if (walletStatusResponse.ok) {
        const statusData = await walletStatusResponse.json();
        setWalletStatus(statusData.wallet_status || 'disconnected');
      }

      if (minersResponse.ok) {
        const minersResult = await minersResponse.json();
        const allMiners = minersResult.miners;
        
        // Check if free miner was activated today (using UTC to match backend)
        const now = new Date();
        const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        
        const hasFreeMinerToday = allMiners.some(miner => {
          if (miner.miner_type === 'free') {
            const createdDate = new Date(miner.created_at);
            const createdUTC = Date.UTC(createdDate.getUTCFullYear(), createdDate.getUTCMonth(), createdDate.getUTCDate());
            return createdUTC === todayUTC;
          }
          return false;
        });
        setCanActivateFreeMiner(!hasFreeMinerToday);
        
        // Categorize miners by type
        // Free miners: daily free + ad rewards
        const freeMiners = allMiners.filter(miner => 
          (miner.miner_type === 'free' || miner.miner_type === 'ad' || miner.miner_type === 'ad_reward') && miner.status !== 'expired'
        );
        
        // Premium miners: purchased miners (active or expired with renew option)
        const premiumMiners = allMiners.filter(miner => 
          miner.miner_type === 'premium'
        );
        
        // Referral miners: rewards from referrals
        const referralMiners = allMiners.filter(miner => 
          (miner.miner_type === 'referral_reward' || miner.miner_type === 'referral_commission') && miner.status !== 'expired'
        );
        
        // Store categorized miners for new UI
        setUser(prev => ({
          ...prev,
          freeMiners,
          premiumMiners,
          referralMiners
        }));
      }

      if (storeResponse.ok) {
        const storeResult = await storeResponse.json();
        setStoreMiners(storeResult.miners);
      }

      if (referralResponse.ok) {
        const referralResult = await referralResponse.json();
        setReferralStats(referralResult);
      }

      // Update user data with latest total_earnings and total_cashed_out
      if (userResponse.ok) {
        const userResult = await userResponse.json();
        setUser(prev => ({ ...prev, ...userResult }));
      }

      // Load ad stats
      await loadAdStats();

      // Trigger app launch ad (only once per session)
      setTimeout(() => {
        triggerAppLaunchAd();
      }, 1000);

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
      showCustomAlert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Admin functions
  const handleDeleteUser = async (userId, userEmail) => {
    showCustomAlert(
      '🗑️ Delete User',
      `Are you sure you want to PERMANENTLY DELETE ${userEmail}?\n\nThis will remove:\n• User account\n• All miners\n• All balance\n• All history\n\nThis action CANNOT be undone!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/delete-user/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                showCustomAlert('✅ Success', 'User deleted successfully');
              } else {
                showCustomAlert('❌ Error', 'Failed to delete user');
              }
            } catch (error) {
              showCustomAlert('❌ Error', 'Network error occurred');
            }
          }
        }
      ]
    );
  };

  const handleGiveBtc = (userId, userEmail) => {
    setGiveBtcModal({ visible: true, userId, userEmail, amount: '' });
  };

  const confirmGiveBtc = async () => {
    const amount = parseFloat(giveBtcModal.amount);
    
    if (isNaN(amount) || amount <= 0) {
      showCustomAlert('❌ Error', 'Please enter a valid BTC amount');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/give-btc/${giveBtcModal.userId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });

      if (response.ok) {
        showCustomAlert('✅ Success', `Successfully added ₿ ${amount.toFixed(8)} to ${giveBtcModal.userEmail}`);
        setGiveBtcModal({ visible: false, userId: '', userEmail: '', amount: '' });
      } else {
        showCustomAlert('❌ Error', 'Failed to add BTC');
      }
    } catch (error) {
      showCustomAlert('❌ Error', 'Network error occurred');
    }
  };

  const handleAuth = async () => {
    if (!formData.email || !formData.password) {
      showCustomAlert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isLogin && !formData.name) {
      showCustomAlert('Error', 'Please enter your name');
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

      const apiUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL}${endpoint}`;
      console.log('Making auth request to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let result;
      try {
        result = await response.json();
        console.log('Login response parsed:', { status: response.status, ok: response.ok, result });
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        console.log('SHOWING ALERT: Parse error');
        showCustomAlert('Error', 'Incorrect Email/Password Combination');
        return;
      }

      console.log('Checking response.ok:', response.ok);
      if (response.ok) {
        console.log('Login successful, setting user data');
        await AsyncStorage.setItem('session_token', result.access_token);
        await AsyncStorage.setItem('user_data', JSON.stringify(result.user));
        setUser(result.user);
        
        // Check if user is admin
        if (result.user.email === 'colourfulkoaladevelopment@gmail.com') {
          setIsAdmin(true);
        }
        
        await loadAppData();
        setCurrentScreen('app');
        setActiveTab('dashboard');
        showCustomAlert('Success! 🎉', isLogin ? 'Welcome back to Koala Mining!' : 'Account created successfully!');
      } else {
        // Show specific error message for login failures
        console.log('Login failed, showing error alert');
        const errorMessage = isLogin ? 'Incorrect Email/Password Combination' : (result.detail || 'Registration failed');
        console.log('SHOWING ALERT:', errorMessage);
        showCustomAlert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Login/Register error:', error);
      showCustomAlert('Network Error', `Unable to connect to server. Please check your internet connection.\n\nError: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      showCustomAlert('Error', 'Please enter your email address');
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
        showCustomAlert(
          'Password Reset Sent! 📧',
          result.message || 'If an account with this email exists, you will receive password reset instructions.',
          [{ text: 'OK', onPress: () => {
            setShowForgotPassword(false);
            setForgotPasswordEmail('');
          }}]
        );
      } else {
        showCustomAlert('Error', result.detail || 'Failed to send reset email');
      }
    } catch (error) {
      showCustomAlert('Error', 'Network error occurred. Please try again.');
    }
  };

  const activateFreeMiner = async () => {
    // Don't show popup if already activated - button is already grayed out
    if (!canActivateFreeMiner) {
      return;
    }
    
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
        showCustomAlert('Success! 🎉', 'Free daily miner activated for 24 hours!');
        setCanActivateFreeMiner(false); // Disable until next reset
        await loadAppData();
      } else {
        const result = await response.json();
        // Silently handle "already active" error - just refresh data
        if (result.detail?.includes('already active')) {
          setCanActivateFreeMiner(false);
          await loadAppData();
        } else {
          showCustomAlert('Error', result.detail || 'Failed to activate free miner');
        }
      }
    } catch (error) {
      showCustomAlert('Error', 'Network error occurred');
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
        showCustomAlert('Ad Boost Activated! ⚡', 'Your mining power has been increased for 30 minutes!');
        await loadAppData();
      } else {
        const result = await response.json();
        showCustomAlert('Error', result.detail || 'Failed to activate ad boost');
      }
    } catch (error) {
      showCustomAlert('Error', 'Network error occurred');
    }
  };

  const handlePurchaseMiner = async (miner) => {
    try {
      showCustomAlert(
        '💰 Purchase Miner',
        `Purchase ${miner.name} for $${miner.price}?

Mining Power: ${miner.hash_rate} GH/s
Duration: ${miner.duration_days} days
Daily Earning Estimate: est.
₿ ${calculateDailyEarnings(miner.hash_rate)}/day`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Pay with PayPal', onPress: () => initiatePayPalPurchase(miner) }
        ]
      );
    } catch (error) {
      showCustomAlert('Error', 'Failed to purchase miner');
    }
  };

  const initiatePayPalPurchase = async (miner) => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('session_token');
      
      // Create PayPal order
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/payments/create-paypal-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          miner_id: miner.id,
          promo_code: '', // Could add promo code input later
          subscription_type: 'one_time'
        })
      });

      const orderData = await response.json();

      if (response.ok) {
        // Find the approval URL from PayPal links
        const approvalUrl = orderData.links.find(link => link.rel === 'approve')?.href;
        
        if (approvalUrl) {
          // Open PayPal checkout in browser
          await Linking.openURL(approvalUrl);
          
          // Show simple instructions - automatic redirect will handle the rest
          showCustomAlert(
            '🌐 PayPal Checkout Opened',
            'Complete your payment in the browser.\n\nAfter payment, you\'ll be automatically redirected back to the app and your miner will be activated immediately.\n\n✅ No need to click anything manually!',
            [
              { text: 'OK', onPress: () => {
                // Refresh data when they come back
                setTimeout(() => loadAppData(), 5000);
              }}
            ]
          );
        } else {
          throw new Error('No PayPal approval URL found');
        }
      } else {
        throw new Error(orderData.detail || 'Failed to create PayPal order');
      }
    } catch (error) {
      showCustomAlert('Payment Error', error.message || 'Failed to initiate PayPal payment');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPayPalPayment = async (orderId, miner) => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('session_token');
      
      // Capture PayPal payment
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/payments/capture-paypal-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: orderId
        })
      });

      const result = await response.json();

      if (response.ok) {
        showCustomAlert(
          '✅ Payment Successful!',
          `${miner.name} purchased successfully!

Payment ID: ${result.payment_id}
Mining Power: ${result.hash_rate} GH/s
Duration: ${result.duration_days} days
Amount Paid: $${result.amount_paid}

Your miner is now active and earning Bitcoin!`,
          [{ text: 'OK', onPress: () => {
            // Refresh app data to show new miner
            loadAppData();
          }}]
        );
      } else {
        // Payment failed - show error
        showCustomAlert(
          '❌ Payment Failed', 
          result.detail || 'Payment could not be processed. Please try again.'
        );
      }
    } catch (error) {
      showCustomAlert('Payment Error', 'Failed to confirm payment. Please contact support if you were charged.');
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseMiner = async (miner) => {
    return handlePurchaseMiner(miner);
  };

  const renewMiner = (miner) => {
    showCustomAlert(
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

  // Fetch Bitcoin network fee
  const fetchNetworkFee = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/bitcoin/network-fee`);
      if (response.ok) {
        const data = await response.json();
        setNetworkFee(data.network_fee_btc);
        console.log('Network fee fetched:', data.network_fee_btc, 'BTC');
      }
    } catch (error) {
      console.error('Failed to fetch network fee:', error);
      // Keep default fallback fee
    }
  };

  // Facebook Ads Functions
  const loadAdStats = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/ads/daily-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const stats = await response.json();
        setAdStats(stats);
      }
    } catch (error) {
      console.error('Failed to load ad stats:', error);
    }
  };

  const showFacebookAd = async (adType) => {
    // Use real Google AdMob ads on device
    const isRealDevice = Platform.OS === 'ios' || Platform.OS === 'android';
    
    setIsWatchingAd(true);
    
    try {
      if (isRealDevice) {
        // Load AdMob utility dynamically
        const { showRewardedVideoAd, showInterstitialAd } = await import('../utils/adMobAds');
        
        let adResult = false;
        
        if (adType === 'miner_activation') {
          // Rewarded video ad for miner activation
          console.log('Attempting to show rewarded video ad...');
          const result = await showRewardedVideoAd();
          console.log('Rewarded video ad result:', result);
          adResult = result.watched && result.rewarded;
        } else {
          // Interstitial ad for app_launch and withdrawal
          console.log('Attempting to show interstitial ad for:', adType);
          adResult = await showInterstitialAd(adType);
        }
        
        setIsWatchingAd(false);
        return adResult;
      } else {
        // Web/Expo Go - silent fallback
        console.log('Web/Expo Go detected, using silent fallback');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setIsWatchingAd(false);
        return true;
      }
    } catch (error) {
      console.error('Error showing AdMob ad:', error);
      setIsWatchingAd(false);
      // Show user-friendly error message
      const errorMessage = error.message || 'Unable to load advertisement';
      showCustomAlert('Ad Unavailable', `${errorMessage}. Please try again later.`);
      return false;
    }
  };

  const watchAd = async (adType) => {
    try {
      // Set ad type and show modal (like login ad)
      setCurrentAdType(adType);
      setShowAdModal(true);
    } catch (error) {
      console.error('Error in watchAd:', error);
      showCustomAlert('Error', 'Failed to load ad. Please try again.');
    }
  };

  const handleAdWatch = async () => {
    try {
      // Show Facebook Ad
      const adWatched = await showFacebookAd(currentAdType);
      
      // Hide modal after ad
      setShowAdModal(false);
      
      if (!adWatched) {
        showCustomAlert('Ad Canceled', 'You must watch the ad to continue.');
        setCurrentAdType(null);
        return;
      }

      // Process ad view on backend for ALL ad types (to track counter)
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/ads/watch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ad_type: currentAdType
        })
      });

      const result = await response.json();

      if (response.ok) {
        // Refresh ad stats and app data immediately
        await Promise.all([
          loadAdStats(),
          loadAppData() // Load immediately to update UI faster
        ]);
        
        // Handle based on ad type
        if (currentAdType === 'miner_activation') {
          // Rewarded ad - show reward details
          showCustomAlert(
            '🎉 Ad Reward Earned!',
            `${result.message}

Mining Power: +${result.ad_miner.hash_rate} GH/s
Duration: ${result.ad_miner.duration_hours} hours

${result.daily_stats.ads_watched_today} videos watched today, keep it up!`,
            [{ text: 'Awesome!' }]
          );
        } else if (currentAdType === 'withdrawal') {
          // Withdrawal ad - proceed with withdrawal
          showCustomAlert('Thank you!', 'Thank you for watching. Proceeding with withdrawal...', [{
            text: 'Continue',
            onPress: () => {
              setTimeout(() => proceedWithWithdrawal(), 500);
            }
          }]);
        } else if (currentAdType === 'app_launch') {
          // App launch ad - just thank user
          showCustomAlert('Welcome!', 'Thank you for watching. Enjoy mining!');
        }
      } else {
        // Handle backend errors (e.g., daily limit reached)
        if (response.status === 429) {
          showCustomAlert('Daily Limit Reached', result.detail || 'You have watched the maximum number of ads for today.');
        } else {
          showCustomAlert('Error', result.detail || 'Failed to process ad view');
        }
      }
      
      setShowAdModal(false);
      setCurrentAdType(null);
    } catch (error) {
      console.error('Error handling ad watch:', error);
      showCustomAlert('Error', 'Failed to process ad. Please try again.');
      setShowAdModal(false);
      setCurrentAdType(null);
    }
  };

  // Show forced non-rewarded ad
  const showForcedAd = (adType) => {
    setCurrentAdType(adType);
    setShowAdModal(true);
  };

  // Trigger forced non-rewarded ad on app launch (once per session)
  const triggerAppLaunchAd = async () => {
    try {
      // Check if already shown in this session
      const hasSeenAppLaunchAd = await AsyncStorage.getItem('app_launch_ad_shown');
      if (hasSeenAppLaunchAd) {
        return; // Already shown in this session
      }
      
      // Check if user has reached daily ad limit
      if (!adStats.can_watch_ad) {
        console.log('Daily ad limit reached, skipping app launch ad');
        return;
      }
      
      // Auto-play ad after 2 seconds delay without confirmation
      setTimeout(() => {
        // Mark as shown for this session
        AsyncStorage.setItem('app_launch_ad_shown', 'true');
        showForcedAd('app_launch');
      }, 2000);
    } catch (error) {
      console.error('Error triggering app launch ad:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawForm.address || !withdrawForm.amount) {
      showCustomAlert('Error', 'Please enter Bitcoin address and amount');
      return;
    }

    const amount = parseFloat(withdrawForm.amount);
    const minWithdrawal = 0.00001;

    if (isNaN(amount) || amount <= 0) {
      showCustomAlert('Error', 'Please enter a valid withdrawal amount');
      return;
    }

    if (amount < minWithdrawal) {
      showCustomAlert('Minimum Withdrawal', `Minimum withdrawal amount is ₿ ${minWithdrawal.toFixed(5)}. Please enter a higher amount.`);
      return;
    }

    // Check if user can watch more ads today
    if (adStats.can_watch_ad) {
      // Show forced non-rewarded ad before withdrawal
      showForcedAd('withdrawal');
    } else {
      // Daily limit reached, proceed directly to withdrawal
      console.log('Daily ad limit reached, skipping withdrawal ad');
      proceedWithWithdrawal();
    }
  };

  const proceedWithWithdrawal = async () => {
    console.log('=== WITHDRAWAL PROCESS STARTED ===');
    const amount = parseFloat(withdrawForm.amount);
    const processingFee = amount * 0.005; // 0.5% fee
    const totalDeduction = amount + processingFee + networkFee; // User receives full amount, fees are added on top
    const usdValue = amount * bitcoinPrice;

    console.log('Withdrawal details:', {
      amount,
      processingFee,
      networkFee,
      totalDeduction,
      address: withdrawForm.address
    });

    showCustomAlert(
      '🪙 Confirm Bitcoin Withdrawal',
      `User Receives: ₿ ${amount.toFixed(8)}
System Fee: ₿ ${processingFee.toFixed(8)}
Network Fee: ₿ ${networkFee.toFixed(8)}
─────────────────────────────
Total Deducted: ₿ ${totalDeduction.toFixed(8)}
USD Value: $${usdValue.toFixed(2)}
      
Address: ${withdrawForm.address}

This withdrawal will be sent to the Bitcoin blockchain and cannot be reversed.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {
          console.log('Withdrawal canceled by user');
        }},
        { text: 'Confirm Withdrawal', onPress: async () => {
          console.log('User confirmed withdrawal, starting API call...');
          
          // Collect debug info
          let debugInfo = '=== DEBUG INFO ===\n\n';
          
          setIsWithdrawing(true);
          try {
            const token = await AsyncStorage.getItem('session_token');
            debugInfo += `Session Token: ${token ? 'Present (' + token.substring(0, 20) + '...)' : 'MISSING'}\n`;
            console.log('Session token retrieved:', token ? 'Present' : 'Missing');
            
            const apiUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/withdraw/bitcoin`;
            debugInfo += `API URL: ${apiUrl}\n`;
            console.log('Calling API:', apiUrl);
            
            const requestBody = {
              address: withdrawForm.address,
              amount: amount,
              network: withdrawForm.network || 'bitcoin'  // Pass selected network
            };
            debugInfo += `Request Body: ${JSON.stringify(requestBody, null, 2)}\n`;
            console.log('Request body:', requestBody);
            
            debugInfo += '\n--- Sending Request ---\n';
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });

            debugInfo += `Response Status: ${response.status}\n`;
            debugInfo += `Response OK: ${response.ok}\n`;
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            const result = await response.json();
            debugInfo += `Response Body: ${JSON.stringify(result, null, 2)}\n`;
            console.log('Response body:', result);

            if (response.ok) {
              console.log('✅ Withdrawal successful');
              showCustomAlert(
                '✅ Withdrawal Submitted!',
                `${result.message}
                
Withdrawal ID: ${result.withdrawal_id}
Amount: ₿ ${result.amount_btc}
Processing Fee: ₿ ${result.processing_fee_btc.toFixed(8)}
USD Value: $${result.usd_value}

Your Bitcoin will be sent to: ${result.bitcoin_address}`,
                [{ text: 'OK', onPress: () => {
                  setWithdrawForm({ address: '', amount: '', network: 'bitcoin' });
                  setShowWithdrawModal(false);
                  loadAppData(); // Refresh balance
                }}]
              );
            } else {
              console.error('❌ Withdrawal failed:', result.detail);
              debugInfo += '\n=== FAILURE ===\n';
              debugInfo += `Error: ${result.detail}\n`;
              
              // Show debug info
              showCustomAlert(
                '❌ Withdrawal Failed',
                result.detail || 'Failed to process withdrawal',
                [
                  { text: 'Show Debug Info', onPress: () => {
                    showCustomAlert('Debug Information', debugInfo, [
                      { text: 'Close' }
                    ]);
                  }},
                  { text: 'Close' }
                ]
              );
            }
          } catch (error) {
            console.error('❌ Withdrawal error:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            
            debugInfo += '\n=== ERROR CAUGHT ===\n';
            debugInfo += `Error Type: ${error.constructor.name}\n`;
            debugInfo += `Error Message: ${error.message}\n`;
            if (error.stack) {
              debugInfo += `Stack Trace: ${error.stack}\n`;
            }
            
            // Show error with debug option
            showCustomAlert(
              '❌ Network Error',
              `An error occurred while processing your withdrawal.\n\nError: ${error.message}`,
              [
                { text: 'Show Debug Info', onPress: () => {
                  showCustomAlert('Debug Information', debugInfo, [
                    { text: 'Close' }
                  ]);
                }},
                { text: 'Close' }
              ]
            );
          } finally {
            setIsWithdrawing(false);
            console.log('=== WITHDRAWAL PROCESS ENDED ===');
            console.log(debugInfo);
          }
        }}
      ]
    );
  };


  const handleAvatarPress = async () => {
    try {
      // Import expo-image-picker
      const ImagePicker = require('expo-image-picker');
      
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        showCustomAlert('Permission Denied', 'We need camera roll permissions to upload an avatar', [{ text: 'OK' }]);
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Reduce quality to keep under 2MB
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        await uploadAvatar(result.assets[0].base64, result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (error) {
      console.error('Error handling avatar:', error);
      showCustomAlert('Error', 'Failed to access photo library: ' + error.message, [{ text: 'OK' }]);
    }
  };

  const uploadAvatar = async (base64, mimeType) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/user/avatar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ avatar: dataUrl })
      });

      const result = await response.json();

      if (response.ok) {
        setUser(prev => ({ ...prev, avatar: dataUrl }));
        showCustomAlert('Success', 'Avatar updated successfully!');
      } else {
        showCustomAlert('Error', result.detail || 'Failed to upload avatar');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showCustomAlert('Error', 'Failed to upload avatar');
    }
  };

  const removeAvatar = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/user/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (response.ok) {
        setUser(prev => ({ ...prev, avatar: null }));
        showCustomAlert('Success', 'Avatar removed successfully!');
      } else {
        showCustomAlert('Error', result.detail || 'Failed to remove avatar');
      }
    } catch (error) {
      console.error('Error removing avatar:', error);
      showCustomAlert('Error', 'Failed to remove avatar');
    }
  };

  const submitContactForm = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      showCustomAlert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      // Use device native email via mailto:
      const subject = encodeURIComponent(contactForm.subject || 'Support Request');
      const body = encodeURIComponent(
        `Name: ${contactForm.name}\nEmail: ${contactForm.email}\n\nMessage:\n${contactForm.message}`
      );
      const mailtoUrl = `mailto:colourfulkoaladevelopment@gmail.com?subject=${subject}&body=${body}`;
      
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        showCustomAlert('Email App Opened 📧', 'Your email app has been opened. Please send the email to submit your support request.');
        setShowContactForm(false);
        setContactForm({ name: '', email: '', subject: '', message: '' });
      } else {
        showCustomAlert('Error', 'Could not open email app. Please email us at colourfulkoaladevelopment@gmail.com');
      }
    } catch (error) {
      showCustomAlert('Error', 'Failed to open email app. Please email us at colourfulkoaladevelopment@gmail.com');
    }
  };
  
  const submitSuggestForm = async () => {
    if (!suggestForm.name || !suggestForm.email || !suggestForm.feature || !suggestForm.description) {
      showCustomAlert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      // Use device native email via mailto:
      const subject = encodeURIComponent(`Feature Suggestion: ${suggestForm.feature}`);
      const body = encodeURIComponent(
        `Name: ${suggestForm.name}\nEmail: ${suggestForm.email}\n\nFeature: ${suggestForm.feature}\n\nDescription:\n${suggestForm.description}`
      );
      const mailtoUrl = `mailto:colourfulkoaladevelopment@gmail.com?subject=${subject}&body=${body}`;
      
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        showCustomAlert('Email App Opened 💡', 'Your email app has been opened. Please send the email to submit your feature suggestion.');
        setShowSuggestForm(false);
        setSuggestForm({ name: '', email: '', feature: '', description: '' });
      } else {
        showCustomAlert('Error', 'Could not open email app. Please email us at colourfulkoaladevelopment@gmail.com');
      }
    } catch (error) {
      showCustomAlert('Error', 'Failed to open email app. Please email us at colourfulkoaladevelopment@gmail.com');
    }
  };

  const signOut = async () => {
    showCustomAlert(
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
            await AsyncStorage.removeItem('app_launch_ad_shown'); // Clear app launch ad flag
            setUser({
              freeMiners: [],
              premiumMiners: [],
              referralMiners: []
            });
            setWalletData(null);
            setCurrentScreen('auth');
            setActiveTab('dashboard');
          } catch (error) {
            console.error('Logout error:', error);
          }
        }}
      ]
    );
  };
  
  const executeFactoryReset = async () => {
    showCustomAlert(
      '🚨 FACTORY RESET - FINAL CONFIRMATION',
      'This will DELETE ALL MINERS and RESET ALL BALANCES to ₿ 0 for ALL USERS!\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'RESET ALL',
          style: 'destructive',
          onPress: async () => {
            try {
              setAdminLoading(true);
              const token = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/factory-reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                const result = await response.json();
                showCustomAlert(
                  '✅ Factory Reset Complete',
                  `Successfully reset all accounts!\n\nMiners Deleted: ${result.miners_deleted}\nUsers Reset: ${result.users_reset}`,
                  [{ text: 'OK', onPress: () => {
                    loadAppData(); // Refresh data
                  }}]
                );
              } else {
                showCustomAlert('❌ Error', 'Failed to perform factory reset');
              }
            } catch (error) {
              showCustomAlert('❌ Error', 'Network error occurred');
            } finally {
              setAdminLoading(false);
            }
          }
        }
      ]
    );
  };

  const registerWalletAddress = async () => {
    let debugLog = '=== WALLET REGISTRATION DEBUG ===\n';
    debugLog += '1. Function called\n';
    debugLog += `2. Wallet address: ${walletAddress}\n`;
    setWalletDebugLog(debugLog);
    
    try {
      if (!walletAddress.trim()) {
        debugLog += '3. Validation failed: empty address\n';
        setWalletDebugLog(debugLog);
        showCustomAlert('Error', 'Please enter a valid Bitcoin address');
        return;
      }
      
      debugLog += '4. Validation passed\n';
      debugLog += '5. Getting token from AsyncStorage...\n';
      setWalletDebugLog(debugLog);
      
      const token = await AsyncStorage.getItem('session_token');
      debugLog += `6. Token: ${token ? 'Present (length: ' + token.length + ')' : 'MISSING!'}\n`;
      setWalletDebugLog(debugLog);
      
      const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/wallet/register`;
      debugLog += `7. URL: ${url}\n`;
      setWalletDebugLog(debugLog);
      
      const body = { btc_address: walletAddress };
      debugLog += `8. Body: ${JSON.stringify(body)}\n`;
      debugLog += '9. Sending POST request...\n';
      setWalletDebugLog(debugLog);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      debugLog += `10. Response status: ${response.status}\n`;
      debugLog += `11. Response ok: ${response.ok}\n`;
      setWalletDebugLog(debugLog);
      
      let result;
      try {
        const responseText = await response.text();
        debugLog += `12. Response text: ${responseText}\n`;
        setWalletDebugLog(debugLog);
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        debugLog += `12. JSON Parse Error: ${parseError.message}\n`;
        setWalletDebugLog(debugLog);
        result = { detail: 'Invalid server response' };
      }
      debugLog += `13. Response data: ${JSON.stringify(result)}\n`;
      setWalletDebugLog(debugLog);

      if (response.ok) {
        debugLog += '14. SUCCESS - Updating wallet status to pending\n';
        setWalletDebugLog(debugLog);
        setWalletStatus('pending');
        setShowWalletRegistrationModal(false);
        setWalletAddress('');
        setWalletDebugLog('');
        showCustomAlert(
          '✅ Wallet Registered!',
          'Your address has been submitted, and should be approved within 2 business days.',
          [{ text: 'OK' }]
        );
      } else {
        debugLog += '15. FAILED - Response not OK\n';
        debugLog += `16. Error detail: ${result.detail || 'Unknown error'}\n`;
        setWalletDebugLog(debugLog);
        showCustomAlert('Error', result.detail || 'Failed to register wallet');
      }
    } catch (error) {
      debugLog += `16. EXCEPTION caught: ${error.message}\n`;
      debugLog += `17. Error type: ${error.constructor.name}\n`;
      debugLog += `18. Error stack: ${error.stack}\n`;
      setWalletDebugLog(debugLog);
      showCustomAlert('Error', `Network error: ${error.message}`);
    }
    debugLog += '=== END WALLET REGISTRATION DEBUG ===\n';
    setWalletDebugLog(debugLog);
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
            <Text style={styles.appTitle}>Koala Mining</Text>
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
                <Text style={styles.titleText}>Koala Mining</Text>
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
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="#FFD700" 
                  />
                </TouchableOpacity>
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

        {/* Custom Alert Modal - MUST be here for auth screen alerts */}
        <Modal visible={customAlert.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              <Text style={styles.modalTitle}>{customAlert.title}</Text>
              <Text style={styles.modalSubtitle}>{customAlert.message}</Text>
              
              <View style={styles.modalButtons}>
                {customAlert.buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      index === customAlert.buttons.length - 1 && customAlert.buttons.length > 1
                        ? styles.confirmButton
                        : styles.cancelButton,
                      customAlert.buttons.length === 1 && { marginRight: 0, marginLeft: 0 }
                    ]}
                    onPress={() => {
                      hideCustomAlert();
                      if (button.onPress) button.onPress();
                    }}
                  >
                    {index === customAlert.buttons.length - 1 && customAlert.buttons.length > 1 ? (
                      <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                        <Text style={styles.confirmButtonText}>{button.text || 'OK'}</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.cancelButtonText}>{button.text || 'OK'}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </LinearGradient>
          </View>
        </Modal>
      </LinearGradient>
    );
  }

  // Main App with Tab Navigation
  // Show Admin Panel if user is admin
  if (isAdmin) {
    return (
      <>
        <AdminPanelComponent 
          user={user}
          setUser={setUser}
          setWalletData={setWalletData}
          setMiners={setMiners}
          setCurrentScreen={setCurrentScreen}
          setIsAdmin={setIsAdmin}
          showCustomAlert={showCustomAlert}
          loadAppData={loadAppData}
          giveBtcModal={giveBtcModal}
          setGiveBtcModal={setGiveBtcModal}
        />
        
        {/* Custom Alert Modal - MUST be here for admin panel alerts */}
        <Modal visible={customAlert.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              <Text style={styles.modalTitle}>{customAlert.title}</Text>
              <Text style={styles.modalSubtitle}>{customAlert.message}</Text>
              
              <View style={styles.modalButtons}>
                {customAlert.buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      index === customAlert.buttons.length - 1 && customAlert.buttons.length > 1
                        ? styles.confirmButton
                        : styles.cancelButton,
                      customAlert.buttons.length === 1 && { marginRight: 0, marginLeft: 0 }
                    ]}
                    onPress={() => {
                      hideCustomAlert();
                      if (button.onPress) button.onPress();
                    }}
                  >
                    {index === customAlert.buttons.length - 1 && customAlert.buttons.length > 1 ? (
                      <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                        <Text style={styles.confirmButtonText}>{button.text || 'OK'}</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.cancelButtonText}>{button.text || 'OK'}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </LinearGradient>
          </View>
        </Modal>
      </>
    );
  }

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
              <Text style={styles.usdValue}>≈ ${((walletData?.total_balance || 0) * bitcoinPrice).toFixed(2)} USD</Text>
            </LinearGradient>

            {/* Wallet Status Indicator */}
            <View style={styles.walletStatusContainer}>
              <Text style={[styles.walletStatusText, {
                color: walletStatus === 'connected' ? '#4CAF50' : 
                       walletStatus === 'pending' ? '#FFA500' : '#FF6B6B'
              }]}>
                Wallet Status: {
                  walletStatus === 'connected' ? 'Connected ✅' :
                  walletStatus === 'pending' ? 'Pending ⏳' :
                  'Disconnected ❌'
                }
              </Text>
              {walletStatus === 'disconnected' && (
                <Text style={styles.walletStatusSubtext}>Register your wallet to enable withdrawals</Text>
              )}
            </View>

            {/* Withdraw Button */}
            <TouchableOpacity 
              style={styles.withdrawButton}
              onPress={() => {
                if (walletStatus === 'disconnected') {
                  setShowWalletRegistrationModal(true);
                } else if (walletStatus === 'pending') {
                  showCustomAlert(
                    'Pending Approval ⏳',
                    'Your address has been submitted, and should be approved within 2 business days.'
                  );
                } else {
                  // Fetch network fee before showing modal
                  fetchNetworkFee();
                  setShowWithdrawModal(true);
                }
              }}
            >
              <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                <Ionicons name={walletStatus === 'connected' ? 'send' : 'link'} size={20} color="#000" />
                <Text style={styles.withdrawButtonText}>
                  {walletStatus === 'connected' ? 'Withdraw BTC' : 'Link Your BTC Wallet'}
                </Text>
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
              </View>
              <View style={styles.hashRateContainer}>
                <Text style={styles.hashRateLabel}>Total Estimated Daily Bitcoin</Text>
                <Text style={styles.hashRate}>₿ {calculateTotalDailyEarnings()}/day</Text>
              </View>
            </LinearGradient>

            {/* Quick Actions */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.quickActionsCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="rocket" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Daily Free Miner</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={activateFreeMiner}
                disabled={!canActivateFreeMiner}
              >
                <LinearGradient 
                  colors={canActivateFreeMiner ? ['#1B4332', '#2D5A3D'] : ['#444', '#333']} 
                  style={styles.actionButtonGradient}
                >
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="gift" size={24} color={canActivateFreeMiner ? "#4CAF50" : "#666"} />
                    <View style={styles.actionButtonText}>
                      <Text style={[styles.actionButtonTitle, !canActivateFreeMiner && { color: '#666' }]}>
                        Activate Daily Free Miner
                      </Text>
                      <Text style={[styles.actionButtonSubtitle, !canActivateFreeMiner && { color: '#666' }]}>
                        {canActivateFreeMiner ? '1 GH/s for 24 hours' : 'Available in ' + getTimeUntilReset()}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={canActivateFreeMiner ? "#4CAF50" : "#666"} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>

            {/* Daily Ad Counter */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.adCounterCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="tv" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Daily Ad Rewards</Text>
              </View>
              <View style={styles.adCounterContent}>
                <View style={styles.adCounterStats}>
                  <Text style={styles.adCounterLabel}>Ads Watched Today</Text>
                  <Text style={styles.adCounterValue}>
                    {adStats.ads_watched_today} ads watched
                  </Text>
                </View>
                <View style={styles.adCounterProgress}>
                  <View style={styles.adProgressBar}>
                    <LinearGradient 
                      colors={['#FFD700', '#FFC000']} 
                      style={[styles.adProgressFill]} 
                    />
                  </View>
                  <Text style={styles.adRemainingText}>
                    Keep watching to earn more miners!
                  </Text>
                </View>
                {adStats.can_watch_ad && (
                  <TouchableOpacity 
                    style={styles.watchAdButton}
                    onPress={() => watchAd('miner_activation')}
                  >
                    <LinearGradient colors={['#FF5722', '#E53935']} style={styles.buttonGradient}>
                      <Ionicons name="play-circle" size={16} color="#FFF" />
                      <Text style={styles.watchAdButtonText}>Watch Ad (+2 GH/s)</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>

            {/* Free Miners - Collapsible */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.minersCard}>
              <TouchableOpacity 
                style={styles.cardHeader} 
                onPress={() => setShowFreeMiners(!showFreeMiners)}
                activeOpacity={0.7}
              >
                <Ionicons name="gift" size={24} color="#4CAF50" />
                <Text style={styles.cardTitle}>Free Miners ({user?.freeMiners?.length || 0})</Text>
                <Ionicons 
                  name={showFreeMiners ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#4CAF50" 
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>
              
              {showFreeMiners && (
                <>
                  {(user?.freeMiners && user.freeMiners.length > 0) ? (
                    user.freeMiners?.map((miner) => (
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
                          <Text style={styles.minerStat}>Time Left: {formatTimeRemaining(miner.time_remaining)}</Text>
                        </View>
                      </LinearGradient>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Ionicons name="gift" size={48} color="#666" />
                      <Text style={styles.emptyStateTitle}>No Free Miners</Text>
                      <Text style={styles.emptyStateSubtitle}>Watch ads to activate free miners</Text>
                    </View>
                  )}
                </>
              )}
            </LinearGradient>

            {/* Premium Miners - Collapsible */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.minersCard}>
              <TouchableOpacity 
                style={styles.cardHeader} 
                onPress={() => setShowPremiumMiners(!showPremiumMiners)}
                activeOpacity={0.7}
              >
                <Ionicons name="diamond" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>Premium Miners ({user?.premiumMiners?.length || 0})</Text>
                <Ionicons 
                  name={showPremiumMiners ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#FFD700" 
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>
              
              {showPremiumMiners && (
                  <>
                    {(user.premiumMiners && user.premiumMiners.length > 0) ? (
                      user.premiumMiners?.map((miner) => (
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
                            <Text style={styles.minerStat}>Time Left: {formatTimeRemaining(miner.time_remaining)}</Text>
                          </View>

                          {miner.status === 'expired' && (
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
                    ) : (
                      <View style={styles.emptyState}>
                        <Ionicons name="diamond" size={48} color="#666" />
                        <Text style={styles.emptyStateTitle}>No Premium Miners</Text>
                        <Text style={styles.emptyStateSubtitle}>Purchase miners from the store</Text>
                      </View>
                    )}
                  </>
                )}
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
                    <Text style={styles.storeMinerPrice}>${miner.price}</Text>
                    <Text style={styles.storeMinerDuration}>30 days rental</Text>
                    
                    <TouchableOpacity 
                      style={styles.purchaseButton}
                      onPress={() => handlePurchaseMiner(miner)}
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
            {/* Referral Rewards Description */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.referralCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle" size={24} color="#4CAF50" />
                <Text style={styles.cardTitle}>Referral Rewards</Text>
              </View>
              <Text style={styles.referralDescription}>
                Invite friends and earn rewards! When someone signs up with your referral code, you both receive bonus mining power. Plus, you'll earn commission from their mining activity!
              </Text>
            </LinearGradient>

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
                    showCustomAlert('Copied! 📋', 'Referral code copied to clipboard');
                  }
                }}>
                  <Ionicons name="copy" size={20} color="#FFD700" />
                </TouchableOpacity>
              </LinearGradient>
            </LinearGradient>

            {/* Share Button - Moved here */}
            <TouchableOpacity style={styles.shareButton} onPress={() => {
              const message = `🐨 Join me on Koala Mining!\n\n💰 Use my code: ${referralStats?.referral_code}\n🎁 We both get 100 GH/s bonus!\n\nDownload: https://koalamining.app`;
              Share.share({ message });
            }}>
              <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                <Ionicons name="share" size={20} color="#000" />
                <Text style={styles.shareButtonText}>Share Referral Code</Text>
              </LinearGradient>
            </TouchableOpacity>

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

            {/* Referral Rewards Miners - Collapsible */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.minersCard}>
              <TouchableOpacity 
                style={styles.cardHeader} 
                onPress={() => setShowReferralMiners(!showReferralMiners)}
                activeOpacity={0.7}
              >
                <Ionicons name="people" size={24} color="#9C27B0" />
                <Text style={styles.cardTitle}>Referral Rewards ({user?.referralMiners?.length || 0})</Text>
                <Ionicons 
                  name={showReferralMiners ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#9C27B0" 
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>
              
              {showReferralMiners && (
                  <>
                    {(user.referralMiners && user.referralMiners.length > 0) ? (
                      user.referralMiners?.map((miner) => (
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
                            <Text style={styles.minerStat}>Time Left: {formatTimeRemaining(miner.time_remaining)}</Text>
                          </View>
                        </LinearGradient>
                      ))
                    ) : (
                      <View style={styles.emptyState}>
                        <Ionicons name="people" size={48} color="#666" />
                        <Text style={styles.emptyStateTitle}>No Referral Rewards</Text>
                        <Text style={styles.emptyStateSubtitle}>Invite friends to earn rewards</Text>
                      </View>
                    )}
                  </>
                )}
              </LinearGradient>
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
              <TouchableOpacity 
                style={styles.avatarContainer}
                onPress={handleAvatarPress}
              >
                {user?.avatar ? (
                  <Image 
                    source={{ uri: user.avatar }} 
                    style={styles.avatarImage}
                  />
                ) : (
                  <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>
                      {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                    </Text>
                  </LinearGradient>
                )}
                <View style={styles.avatarEditIcon}>
                  <Ionicons name="camera" size={16} color="#000" />
                </View>
              </TouchableOpacity>
              
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">{user?.name}</Text>
                <Text style={styles.userSubtitle} numberOfLines={1} ellipsizeMode="tail">Koala BTC Mining</Text>
                <Text style={styles.userCode} numberOfLines={1} ellipsizeMode="tail">Referral Code: {user?.referral_code}</Text>
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

            {/* App Version */}
            <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statsCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle" size={24} color="#FFD700" />
                <Text style={styles.cardTitle}>App Information</Text>
              </View>
              
              <View style={styles.profileStats}>
                <Text style={styles.profileStat}>Version: 1.0.0 (Alpha)</Text>
              </View>
            </LinearGradient>

            {/* Support Actions */}

            <TouchableOpacity style={styles.supportButton} onPress={() => setShowContactForm(true)}>
              <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.supportButtonGradient}>
                <Ionicons name="headset" size={20} color="#4CAF50" />
                <Text style={styles.supportButtonText}>Contact Support</Text>
                <Ionicons name="chevron-forward" size={16} color="#666" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportButton} onPress={() => setShowSuggestForm(true)}>
              <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.supportButtonGradient}>
                <Ionicons name="headset" size={20} color="#2196F3" />
                <Text style={styles.supportButtonText}>Suggest a Feature</Text>
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
              <Text style={[styles.modalSubtitle, { fontSize: 14, color: '#FFD700', marginTop: 5 }]}>
                {withdrawForm.network === 'lightning' 
                  ? 'Lightning: ₿ 0.00001 - 0.001' 
                  : 'Bitcoin: Min ₿ 0.001'}
              </Text>
              
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
                  placeholder={withdrawForm.network === 'lightning' ? "Lightning Invoice" : "Bitcoin Address"}
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

        {/* FAQ Modal removed */}

        {/* Facebook Ad Modal */}
        <Modal visible={showAdModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {currentAdType === 'miner_activation' ? '🎁 Watch Ad for Rewards' : '📺 Advertisement Required'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {currentAdType === 'app_launch' && 'Please watch this brief advertisement to continue using the app.'}
                {currentAdType === 'withdrawal' && 'Please watch this brief advertisement before proceeding with your withdrawal.'}
                {currentAdType === 'miner_activation' && 'Watch this ad to earn free mining power!'}
              </Text>
              
              {isWatchingAd ? (
                <View style={styles.adContainer}>
                  <View style={styles.adSimulation}>
                    <ActivityIndicator size="large" color="#FFD700" style={{ marginBottom: 10 }} />
                    <Text style={styles.adText}>Loading Advertisement...</Text>
                  </View>
                  <Text style={styles.adTimerText}>Ad playing... Please wait</Text>
                </View>
              ) : (
                <View style={styles.adPreview}>
                  <Ionicons name="tv" size={48} color="#FFD700" />
                  <Text style={styles.adPreviewText}>Ready to watch ad</Text>
                  {currentAdType === 'miner_activation' && (
                    <Text style={styles.adRewardText}>Reward: +2 GH/s for 24 hours</Text>
                  )}
                </View>
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => {
                    setShowAdModal(false);
                    setCurrentAdType(null);
                  }}
                  disabled={isWatchingAd}
                >
                  <Text style={styles.cancelButtonText}>
                    {currentAdType === 'miner_activation' ? 'Skip' : 'Back'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.confirmButton} 
                  onPress={handleAdWatch}
                  disabled={isWatchingAd}
                >
                  <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                    <Text style={styles.confirmButtonText}>
                      {isWatchingAd ? 'Watching...' : 'Watch Ad'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              
              {/* Footer spacer to prevent navigation overlap */}
              <View style={{ height: 35 }} />
            </LinearGradient>
          </View>
        </Modal>

        {/* Custom Alert Modal */}
        <Modal visible={customAlert.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              <Text style={styles.modalTitle}>{customAlert.title}</Text>
              <Text style={styles.modalSubtitle}>{customAlert.message}</Text>
              
              <View style={styles.modalButtons}>
                {customAlert.buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      index === customAlert.buttons.length - 1 && customAlert.buttons.length > 1
                        ? styles.confirmButton
                        : styles.cancelButton,
                      customAlert.buttons.length === 1 && { marginRight: 0, marginLeft: 0 }
                    ]}
                    onPress={() => {
                      hideCustomAlert();
                      if (button.onPress) button.onPress();
                    }}
                  >
                    {index === customAlert.buttons.length - 1 && customAlert.buttons.length > 1 ? (
                      <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                        <Text style={styles.confirmButtonText}>{button.text || 'OK'}</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.cancelButtonText}>{button.text || 'OK'}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </LinearGradient>
          </View>
        </Modal>

        {/* Wallet Registration Modal */}
        <Modal visible={showWalletRegistrationModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              
              {/* DEBUG LOG - ALWAYS AT TOP */}
              <View style={{ backgroundColor: '#FF0000', padding: 10, borderRadius: 8, marginBottom: 10, minHeight: 80, borderWidth: 2, borderColor: '#FFD700' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }}>
                  DEBUG LOG:
                </Text>
                <Text style={{ color: '#FFFFFF', fontSize: 9 }}>
                  {walletDebugLog || 'Waiting for registration attempt...'}
                </Text>
              </View>
              
              <Text style={styles.modalTitle}>🔐 Register Bitcoin Wallet</Text>
              <Text style={styles.modalSubtitle}>
                Enter your Bitcoin wallet address to enable withdrawals. Your address will be reviewed by an admin before activation.
              </Text>
              <Text style={[styles.modalSubtitle, { color: '#FFA500', marginTop: 10, fontSize: 13 }]}>
                ⚡ We currently only accept withdrawals on the Bitcoin network. Lightning support will be added soon.
              </Text>
              
              <TextInput
                style={styles.walletAddressInput}
                placeholder="Enter Bitcoin address"
                placeholderTextColor="#666"
                value={walletAddress}
                onChangeText={setWalletAddress}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowWalletRegistrationModal(false);
                    setWalletAddress('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={registerWalletAddress}
                >
                  <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.buttonGradient}>
                    <Text style={styles.confirmButtonText}>Register</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>

        {/* Give BTC Modal */}
        <Modal visible={giveBtcModal.visible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.modalContent}>
              <Text style={styles.modalTitle}>💰 Give BTC</Text>
              <Text style={styles.modalSubtitle}>
                Add Bitcoin to {giveBtcModal.userEmail}
              </Text>
              
              <TextInput
                style={styles.walletAddressInput}
                placeholder="Amount in BTC (e.g., 0.00001)"
                placeholderTextColor="#666"
                value={giveBtcModal.amount}
                onChangeText={(text) => setGiveBtcModal({...giveBtcModal, amount: text})}
                keyboardType="decimal-pad"
                autoCapitalize="none"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setGiveBtcModal({ visible: false, userId: '', userEmail: '', amount: '' })}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmGiveBtc}
                >
                  <LinearGradient colors={['#4CAF50', '#45A049']} style={styles.buttonGradient}>
                    <Text style={styles.confirmButtonText}>Give BTC</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
    ...(Platform.OS === 'web' ? {
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    } : {}),
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
    ...(Platform.OS === 'web' ? {
      overflowY: 'auto',
      maxHeight: '100vh',
    } : {}),
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
  passwordToggle: {
    padding: 10,
    marginLeft: 10,
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    zIndex: 9999,
    elevation: 9999,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
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
    ...(Platform.OS === 'web' ? {
      maxWidth: 480,
      marginHorizontal: 'auto',
      width: '100%',
    } : {}),
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
    paddingBottom: 35, // Add some clearance below navigation
    ...(Platform.OS === 'web' ? {
      overflowY: 'auto',
      maxHeight: '100vh',
    } : {}),
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
  walletStatusContainer: {
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  walletStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  walletStatusSubtext: {
    fontSize: 12,
    color: '#AAA',
    textAlign: 'center',
    marginTop: 4,
  },
  walletAddressInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    marginBottom: 20,
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
    fontSize: 12,
    color: '#AAA',
    marginBottom: 5,
  },
  hashRate: {
    fontSize: 22,
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
    justifyContent: 'flex-start',
    width: '100%',
  },
  actionButtonText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    minWidth: 0,
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
    marginTop: 15,
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
  referralDescription: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
    marginTop: 12,
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
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
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
  userSubtitle: {
    fontSize: 14,
    color: '#FFD700',
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
  buildVersionContainer: {
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buildVersionText: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
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
    ...(Platform.OS === 'web' ? {
      overflowY: 'auto',
    } : {}),
  },
  faqItem: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    flex: 1,
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
  
  // Ad Modal Styles
  adContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  adSimulation: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  adText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 10,
  },
  adSubtext: {
    fontSize: 14,
    color: '#333',
    marginTop: 5,
  },
  adTimerText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  adPreview: {
    alignItems: 'center',
    marginVertical: 30,
  },
  adPreviewText: {
    fontSize: 16,
    color: '#FFF',
    marginTop: 10,
    marginBottom: 5,
  },
  adRewardText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  
  // Ad Counter Card Styles
  adCounterCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
  },
  adCounterContent: {
    alignItems: 'center',
  },
  adCounterStats: {
    alignItems: 'center',
    marginBottom: 15,
  },
  adCounterLabel: {
    fontSize: 14,
    color: '#AAA',
    marginBottom: 5,
  },
  adCounterValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  adCounterProgress: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  adProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 8,
  },
  adProgressFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
  },
  adRemainingText: {
    fontSize: 12,
    color: '#AAA',
  },
  watchAdButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  watchAdButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
    marginRight: 2,
  },
  
  // Admin Panel Styles
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  adminHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  timeRangeToggle: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#AAA',
  },
  toggleButtonTextActive: {
    color: '#000',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 10,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    minWidth: 150,
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 5,
  },
  statSubLabel: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  adminSection: {
    margin: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 15,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    marginBottom: 15,
  },
  factoryResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  factoryResetButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    marginLeft: 10,
    fontSize: 16,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginBottom: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#AAA',
    marginTop: 2,
  },
  userBalance: {
    fontSize: 13,
    color: '#FFD700',
    marginTop: 4,
  },
  userMiners: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 20,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  userActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});