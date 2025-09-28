import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface WalletData {
  total_balance: number;
  today_earnings: number;
  total_miners: number;
  active_miners: number;
  current_hash_rate: number;
  total_referral_rewards: number;
}

interface MinerData {
  id: string;
  name: string;
  hash_rate: number;
  miner_type: string;
  status: string;
  time_remaining: number;
  total_earned: number;
  activated_at?: string;
  expires_at?: string;
}

export default function Dashboard() {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [miners, setMiners] = useState<MinerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activatingMiner, setActivatingMiner] = useState<string | null>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    loadData();
    setupNotifications();
    
    // Set up real-time updates
    const interval = setInterval(() => {
      if (!refreshing) {
        loadData();
      }
    }, 30000); // Update every 30 seconds

    return () => {
      clearInterval(interval);
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const setupNotifications = async () => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        await registerDeviceToken(token);
      }
    } catch (error) {
      console.error('Notification setup error:', error);
    }

    // Listen for notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      // Refresh data when notification is received
      loadData();
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;
      
      if (data.type === 'miner_expired') {
        Alert.alert(
          'Miner Expired',
          'Your miner has been deactivated. Activate it again to continue mining!',
          [{ text: 'OK', onPress: () => loadData() }]
        );
      }
    });
  };

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  };

  const registerDeviceToken = async (token: string) => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const appVersion = '1.0.0'; // You can get this from Constants.manifest?.version
      
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          expo_push_token: token,
          device_type: Device.osName?.toLowerCase() || 'unknown',
          app_version: appVersion
        })
      });
    } catch (error) {
      console.error('Device registration error:', error);
    }
  };

  const loadData = async () => {
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
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activateFreeMiner = async () => {
    try {
      setActivatingMiner('free');
      const token = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/miners/activate-free`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Free miner activated for 24 hours!');
        loadData();
      } else {
        Alert.alert('Error', result.detail || 'Failed to activate free miner');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setActivatingMiner(null);
    }
  };

  const watchAdForMining = async () => {
    // Simulate ad watching
    Alert.alert(
      'Watch Ad',
      'Watch a 30-second video ad to get 2 GH/s mining power for 30 minutes?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Watch Ad', onPress: async () => {
          try {
            setActivatingMiner('ad');
            
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

            const result = await response.json();

            if (response.ok) {
              Alert.alert('Success', 'Ad miner boost activated! Duration extended by 30 minutes.');
              loadData();
            } else {
              Alert.alert('Error', result.detail || 'Failed to activate ad miner');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          } finally {
            setActivatingMiner(null);
          }
        }}
      ]
    );
  };

  const activateMiner = async (minerId: string) => {
    try {
      setActivatingMiner(minerId);
      const token = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/miners/${minerId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Miner activated successfully!');
        loadData();
      } else {
        Alert.alert('Error', result.detail || 'Failed to activate miner');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setActivatingMiner(null);
    }
  };

  const formatTimeRemaining = (hours: number): string => {
    if (hours <= 0) return 'Expired';
    
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes}m`;
    }
    
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours - wholeHours) * 60);
    
    if (wholeHours >= 24) {
      const days = Math.floor(wholeHours / 24);
      const remainingHours = wholeHours % 24;
      return `${days}d ${remainingHours}h`;
    }
    
    return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9800" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bitcoin Mining</Text>
          <Text style={styles.subtitle}>Dashboard</Text>
        </View>

        {/* Wallet Overview */}
        <View style={styles.walletCard}>
          <Text style={styles.cardTitle}>Bitcoin Wallet</Text>
          <Text style={styles.balance}>₿ {walletData?.total_balance.toFixed(8) || '0.00000000'}</Text>
          <Text style={styles.usdValue}>≈ ${((walletData?.total_balance || 0) * 45000).toFixed(2)} USD</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Today's Earnings</Text>
              <Text style={styles.statValue}>₿ {walletData?.today_earnings.toFixed(8) || '0.00000000'}</Text>
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
            <Text style={styles.hashRate}>{walletData?.current_hash_rate.toFixed(1) || '0.0'} GH/s</Text>
            {(walletData?.current_hash_rate || 0) > 0 && <View style={styles.miningIndicator} />}
          </View>
        </View>

        {/* Quick Mining Actions */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.cardTitle}>Quick Start</Text>
          
          <TouchableOpacity 
            style={[styles.quickActionButton, styles.freeButton]}
            onPress={activateFreeMiner}
            disabled={activatingMiner === 'free'}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="gift" size={24} color="#4CAF50" />
              <View style={styles.actionButtonText}>
                <Text style={styles.actionButtonTitle}>Free Daily Miner</Text>
                <Text style={styles.actionButtonSubtitle}>1 GH/s for 24 hours</Text>
              </View>
              {activatingMiner === 'free' ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.quickActionButton, styles.adButton]}
            onPress={watchAdForMining}
            disabled={activatingMiner === 'ad'}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="play-circle" size={24} color="#FF5722" />
              <View style={styles.actionButtonText}>
                <Text style={styles.actionButtonTitle}>Watch Ad for Boost</Text>
                <Text style={styles.actionButtonSubtitle}>2 GH/s for 30 minutes</Text>
              </View>
              {activatingMiner === 'ad' ? (
                <ActivityIndicator size="small" color="#FF5722" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#FF5722" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Your Miners */}
        <View style={styles.minersCard}>
          <Text style={styles.cardTitle}>Your Miners</Text>
          {miners.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="hardware-chip" size={48} color="#666" />
              <Text style={styles.emptyStateTitle}>No Miners Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Activate your free daily miner or visit the store to purchase premium miners
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
                  <Text style={styles.minerStat}>
                    Hash Rate: {miner.hash_rate} GH/s
                  </Text>
                  <Text style={styles.minerStat}>
                    Earned: ₿ {miner.total_earned.toFixed(8)}
                  </Text>
                  <Text style={styles.minerStat}>
                    Time Left: {formatTimeRemaining(miner.time_remaining)}
                  </Text>
                </View>

                {miner.status === 'inactive' && miner.time_remaining > 0 && (
                  <TouchableOpacity 
                    style={styles.activateButton}
                    onPress={() => activateMiner(miner.id)}
                    disabled={activatingMiner === miner.id}
                  >
                    {activatingMiner === miner.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="play" size={16} color="#FFF" />
                        <Text style={styles.activateButtonText}>Activate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Referral Rewards */}
        {walletData && walletData.total_referral_rewards > 0 && (
          <View style={styles.referralCard}>
            <Text style={styles.cardTitle}>Referral Rewards</Text>
            <Text style={styles.referralRewards}>
              {walletData.total_referral_rewards.toFixed(1)} GH/s
            </Text>
            <Text style={styles.referralSubtitle}>Total from referrals</Text>
          </View>
        )}
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
  quickActionButton: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  freeButton: {
    backgroundColor: '#1B4332',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  adButton: {
    backgroundColor: '#331C1C',
    borderWidth: 1,
    borderColor: '#FF5722',
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
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    padding: 10,
    borderRadius: 8,
  },
  activateButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  referralCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  referralRewards: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#9C27B0',
    marginVertical: 10,
  },
  referralSubtitle: {
    fontSize: 12,
    color: '#AAA',
  },
});