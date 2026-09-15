import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiFetch } from '../../utils/api';
import { initializeAdMob, showRewardedVideoAd, showInterstitialAd } from '../../utils/adMobAds';

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

interface WalletStatus {
  status: 'disconnected' | 'pending' | 'connected' | 'rejected';
  btc_address?: string;
  pending_change?: any;
  rejection?: any;
}

interface AdStats {
  ads_watched_today: number;
  remaining_ads: number;
  max_daily_ads: number;
  can_watch_ad: boolean;
}

interface ActivityItem {
  id: string;
  user_name: string;
  action: string;
  amount?: number;
  timestamp: string;
}

export default function Dashboard() {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [miners, setMiners] = useState<MinerData[]>([]);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [adStats, setAdStats] = useState<AdStats | null>(null);
  const [bitcoinPrice, setBitcoinPrice] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activatingMiner, setActivatingMiner] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAddressChangeModal, setShowAddressChangeModal] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [currentAdType, setCurrentAdType] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState('');
  const [withdrawForm, setWithdrawForm] = useState({ address: '', amount: '', network: 'bitcoin' });
  const [addressChangeForm, setAddressChangeForm] = useState({ currentPassword: '', newAddress: '', confirmAddress: '' });
  const [isSubmittingAddressChange, setIsSubmittingAddressChange] = useState(false);
  const [networkFee, setNetworkFee] = useState(0.00001);
  const [tick, setTick] = useState(0);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    initializeAdMob();
    loadData();
    setupNotifications();
    loadBitcoinPrice();
    loadActivityFeed();

    const interval = setInterval(() => {
      if (!refreshing) {
        loadData();
      }
    }, 30000);

    const countdownInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const [walletRes, minersRes, walletStatusRes, adStatsRes] = await Promise.all([
        apiFetch('/api/wallet/balance'),
        apiFetch('/api/miners/list'),
        apiFetch('/api/wallet/status'),
        apiFetch('/api/ads/daily-stats', { method: 'POST' }),
      ]);

      if (walletRes.ok) setWalletData(walletRes.data);
      if (minersRes.ok) setMiners(minersRes.data.miners || []);
      if (walletStatusRes.ok) setWalletStatus(walletStatusRes.data);
      if (adStatsRes.ok) setAdStats(adStatsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const loadBitcoinPrice = async () => {
    try {
      const res = await apiFetch('/api/bitcoin/price');
      if (res.ok && res.data.price) {
        setBitcoinPrice(res.data.price);
        return;
      }
    } catch (error) {
      console.error('Backend Bitcoin price fetch failed:', error);
    }
    try {
      const cgResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (cgResponse.ok) {
        const cgData = await cgResponse.json();
        if (cgData?.bitcoin?.usd) {
          setBitcoinPrice(cgData.bitcoin.usd);
          return;
        }
      }
    } catch (error) {
      console.error('CoinGecko fallback fetch failed:', error);
    }
  };

  const loadActivityFeed = async () => {
    try {
      const res = await apiFetch('/api/activity/recent');
      if (res.ok && res.data.activities) {
        setActivity(res.data.activities);
      }
    } catch (error) {
      console.error('Error loading activity feed:', error);
    }
  };

  const setupNotifications = async () => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        await registerDeviceToken(token);
      }
    } catch (error) {
      console.error('Notification setup error:', error);
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      loadData();
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.type === 'miner_expired') {
        Alert.alert('Miner Expired', 'Your miner has been deactivated. Activate it again to continue mining!', [
          { text: 'OK', onPress: () => loadData() },
        ]);
      }
    });
  };

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) return null;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    return (await Notifications.getExpoPushTokenAsync()).data;
  };

  const registerDeviceToken = async (token: string) => {
    try {
      await apiFetch('/api/devices/register', {
        method: 'POST',
        body: JSON.stringify({
          expo_push_token: token,
          device_type: Device.osName?.toLowerCase() || 'unknown',
          app_version: '1.0.0',
        }),
      });
    } catch (error) {
      console.error('Device registration error:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    loadBitcoinPrice();
    loadActivityFeed();
  };

  const activateFreeMiner = async () => {
    try {
      setActivatingMiner('free');
      const res = await apiFetch('/api/miners/activate-free', { method: 'POST' });
      if (res.ok) {
        Alert.alert('Success', 'Free miner activated for 24 hours!');
        loadData();
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to activate free miner');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setActivatingMiner(null);
    }
  };

  const watchAdForMining = async () => {
    if (!adStats?.can_watch_ad) {
      Alert.alert('Daily Limit Reached', 'You have watched all available ads for today. Come back tomorrow!');
      return;
    }
    setCurrentAdType('miner_activation');
    setShowAdModal(true);
  };

  const handleAdWatch = async () => {
    setShowAdModal(false);
    setIsWatchingAd(true);
    setActivatingMiner('ad');

    let adResult = { watched: false, rewarded: false };
    try {
      adResult = await showRewardedVideoAd();
    } catch (error: any) {
      console.error('Ad error:', error);
      Alert.alert('Ad Error', error?.message || 'Failed to load ad. Please try again.');
      setIsWatchingAd(false);
      setActivatingMiner(null);
      return;
    }
    if (!adResult.watched && !adResult.rewarded) {
      setIsWatchingAd(false);
      setActivatingMiner(null);
      return;
    }

    if (adResult.rewarded) {
      try {
        const res = await apiFetch('/api/miners/watch-ad', { method: 'POST' });
        if (res.ok) {
          Alert.alert('Success', 'Ad miner boost activated! Duration extended by 30 minutes.');
          loadData();
        } else {
          Alert.alert('Error', res.data?.detail || 'Failed to activate ad miner');
        }
      } catch (error) {
        Alert.alert('Error', 'Network error occurred');
      }
    } else if (adResult.watched) {
      Alert.alert('Ad Skipped', 'You skipped the ad. Watch the full ad to earn the reward.');
    }
    setIsWatchingAd(false);
    setActivatingMiner(null);
  };

  const activateMiner = async (minerId: string) => {
    try {
      setActivatingMiner(minerId);
      const res = await apiFetch(`/api/miners/${minerId}/activate`, { method: 'POST' });
      if (res.ok) {
        Alert.alert('Success', 'Miner activated successfully!');
        loadData();
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to activate miner');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setActivatingMiner(null);
    }
  };

  const registerWalletAddress = async () => {
    if (!walletAddress.trim()) {
      Alert.alert('Error', 'Please enter a Bitcoin address');
      return;
    }
    try {
      const res = await apiFetch('/api/wallet/register', {
        method: 'POST',
        body: JSON.stringify({ btc_address: walletAddress.trim() }),
      });
      if (res.ok) {
        Alert.alert('Success', 'Wallet address submitted! Pending admin approval.');
        setShowWalletModal(false);
        setWalletAddress('');
        loadData();
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to register wallet address');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const submitAddressChange = async () => {
    if (!addressChangeForm.currentPassword || !addressChangeForm.newAddress || !addressChangeForm.confirmAddress) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (addressChangeForm.newAddress !== addressChangeForm.confirmAddress) {
      Alert.alert('Error', 'New address and confirmation do not match');
      return;
    }
    setIsSubmittingAddressChange(true);
    try {
      const res = await apiFetch('/api/wallet/request-address-change', {
        method: 'POST',
        body: JSON.stringify({
          current_password: addressChangeForm.currentPassword,
          new_address: addressChangeForm.newAddress,
        }),
      });
      if (res.ok) {
        Alert.alert('Success', 'Address change request submitted! Pending admin approval.');
        setShowAddressChangeModal(false);
        setAddressChangeForm({ currentPassword: '', newAddress: '', confirmAddress: '' });
        loadData();
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to request address change');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setIsSubmittingAddressChange(false);
    }
  };

  const dismissAddressRejection = async () => {
    try {
      const res = await apiFetch('/api/wallet/dismiss-rejection', { method: 'POST' });
      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Error dismissing rejection:', error);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawForm.amount);
    if (!withdrawForm.address.trim()) {
      Alert.alert('Error', 'Please enter a Bitcoin address');
      return;
    }
    if (!amount || amount < 0.0002) {
      Alert.alert('Error', 'Minimum withdrawal is 0.0002 BTC');
      return;
    }
    if (amount > (walletData?.total_balance || 0)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    if (adStats?.can_watch_ad) {
      Alert.alert('Watch Ad Required', 'You need to watch a short ad before withdrawing.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Watch Ad', onPress: () => showForcedAdForWithdraw() },
      ]);
    } else {
      proceedWithWithdrawal();
    }
  };

  const showForcedAdForWithdraw = async () => {
    setCurrentAdType('withdrawal');
    setShowAdModal(true);
  };

  const proceedWithWithdrawal = async () => {
    const amount = parseFloat(withdrawForm.amount);
    const withdrawalFee = 0.00002;
    const serviceFee = 0.00001;
    const totalFee = networkFee + withdrawalFee + serviceFee;
    const receiveAmount = amount - totalFee;

    Alert.alert(
      'Confirm Withdrawal',
      `Amount: ${amount} BTC\nNetwork Fee: ${networkFee.toFixed(12)} BTC\nWithdrawal Fee: ${withdrawalFee} BTC\nService Fee: ${serviceFee} BTC\n\nYou will receive: ${receiveAmount.toFixed(12)} BTC`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setIsWithdrawing(true);
            try {
              const res = await apiFetch('/api/withdraw/bitcoin', {
                method: 'POST',
                body: JSON.stringify({
                  address: withdrawForm.address,
                  amount: amount,
                  network: withdrawForm.network,
                }),
              });
              if (res.ok) {
                Alert.alert('Success', 'Withdrawal request submitted! It will be processed shortly.');
                setShowWithdrawModal(false);
                setWithdrawForm({ address: '', amount: '', network: 'bitcoin' });
                loadData();
              } else {
                Alert.alert('Error', res.data?.detail || 'Withdrawal failed');
              }
            } catch (error) {
              Alert.alert('Error', 'Network error occurred');
            } finally {
              setIsWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  const handleAdModalConfirm = async () => {
    setShowAdModal(false);
    setIsWatchingAd(true);

    let adResult = false;
    try {
      if (currentAdType === 'withdrawal') {
        adResult = await showInterstitialAd('withdrawal');
      } else {
        const result = await showRewardedVideoAd();
        adResult = result.rewarded;
      }
    } catch (error: any) {
      console.error('Ad error:', error);
      Alert.alert('Ad Error', error?.message || 'Failed to load ad. Please try again.');
      setIsWatchingAd(false);
      return;
    }

    setIsWatchingAd(false);

    if (currentAdType === 'withdrawal' && adResult) {
      proceedWithWithdrawal();
    } else if (currentAdType === 'miner_activation' && adResult) {
      try {
        setActivatingMiner('ad');
        const res = await apiFetch('/api/miners/watch-ad', { method: 'POST' });
        if (res.ok) {
          Alert.alert('Success', 'Ad miner boost activated!');
          loadData();
        } else {
          Alert.alert('Error', res.data?.detail || 'Failed to activate ad miner');
        }
      } catch (error) {
        Alert.alert('Error', 'Network error occurred');
      } finally {
        setActivatingMiner(null);
      }
    }
  };

  const formatTimeRemaining = (hours: number): string => {
    if (hours <= 0) return 'Expired';
    const totalSeconds = Math.floor(hours * 3600);
    const days = Math.floor(totalSeconds / 86400);
    const hrs = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (days > 0) return `${days}d ${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const liveMiners = miners.map(m => {
    if (m.status !== 'active' || !m.expires_at) return m;
    const now = Date.now();
    const expiry = new Date(m.expires_at).getTime();
    const remainingMs = expiry - now;
    if (remainingMs <= 0) return { ...m, time_remaining: 0, status: 'expired' };
    return { ...m, time_remaining: remainingMs / 3600000 };
  });

  const liveBalance = (() => {
    const base = walletData?.total_balance ?? 0;
    const todayEarnings = walletData?.today_earnings ?? 0;
    if (base === 0 && todayEarnings === 0) return 0;
    const activeHashRate = walletData?.current_hash_rate ?? 0;
    if (activeHashRate <= 0) return base;
    const perSecondRate = 0.0000000027175 / 86400;
    return base + activeHashRate * perSecondRate * tick;
  })();

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
        <View style={styles.header}>
          <Text style={styles.title}>Koala Mining</Text>
          <Text style={styles.subtitle}>Dashboard</Text>
        </View>

        {/* Wallet Overview */}
        <View style={styles.walletCard}>
          <Text style={styles.cardTitle}>Bitcoin Wallet</Text>
          <Text style={styles.balance}>₿ {liveBalance.toFixed(12)}</Text>
          <Text style={styles.usdValue}>≈ ${bitcoinPrice > 0 ? ((walletData?.total_balance || 0) * bitcoinPrice).toFixed(2) : '...'} USD</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Today's Earnings</Text>
              <Text style={styles.statValue}>₿ {(walletData?.today_earnings ?? 0).toFixed(12)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Active Miners</Text>
              <Text style={styles.statValue}>{walletData?.active_miners || 0}/{walletData?.total_miners || 0}</Text>
            </View>
          </View>
        </View>

        {/* Wallet Status / Withdrawal Section */}
        <View style={styles.walletStatusCard}>
          <View style={styles.walletStatusHeader}>
            <Ionicons
              name={walletStatus?.status === 'connected' ? 'checkmark-circle' : walletStatus?.status === 'pending' ? 'time' : 'warning'}
              size={24}
              color={walletStatus?.status === 'connected' ? '#4CAF50' : walletStatus?.status === 'pending' ? '#FF9800' : '#FF5722'}
            />
            <Text style={styles.walletStatusText}>
              {walletStatus?.status === 'connected' ? 'Wallet Connected' :
               walletStatus?.status === 'pending' ? 'Wallet Pending Approval' :
               walletStatus?.status === 'rejected' ? 'Wallet Address Rejected' :
               'No Wallet Connected'}
            </Text>
          </View>
          {walletStatus?.status === 'connected' && walletStatus?.btc_address && (
            <Text style={styles.walletAddress} numberOfLines={1}>
              {walletStatus.btc_address.substring(0, 12)}...{walletStatus.btc_address.substring(walletStatus.btc_address.length - 8)}
            </Text>
          )}
          {walletStatus?.status === 'rejected' && walletStatus?.rejection && (
            <View style={styles.rejectionNotice}>
              <Text style={styles.rejectionReason}>Reason: {walletStatus.rejection.reason || 'Not specified'}</Text>
              <TouchableOpacity onPress={dismissAddressRejection}>
                <Text style={styles.dismissLink}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.walletActionsRow}>
            {walletStatus?.status === 'disconnected' || walletStatus?.status === 'rejected' ? (
              <TouchableOpacity style={styles.walletActionButton} onPress={() => setShowWalletModal(true)}>
                <Ionicons name="wallet" size={16} color="#FF9800" />
                <Text style={styles.walletActionButtonText}>Register Wallet</Text>
              </TouchableOpacity>
            ) : walletStatus?.status === 'connected' ? (
              <>
                <TouchableOpacity style={styles.walletActionButton} onPress={() => setShowAddressChangeModal(true)}>
                  <Ionicons name="create" size={16} color="#2196F3" />
                  <Text style={styles.walletActionButtonText}>Change Address</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.walletActionButton, styles.withdrawButton]} onPress={() => setShowWithdrawModal(true)}>
                  <Ionicons name="arrow-up-circle" size={16} color="#4CAF50" />
                  <Text style={styles.walletActionButtonText}>Withdraw BTC</Text>
                </TouchableOpacity>
              </>
            ) : null}
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
                <Text style={styles.actionButtonSubtitle}>10 GH/s for 24 hours</Text>
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
            disabled={activatingMiner === 'ad' || isWatchingAd}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="play-circle" size={24} color="#FF5722" />
              <View style={styles.actionButtonText}>
                <Text style={styles.actionButtonTitle}>Watch Ad for Boost</Text>
                <Text style={styles.actionButtonSubtitle}>
                  {adStats ? `${adStats.remaining_ads}/${adStats.max_daily_ads} ads remaining today` : '2 GH/s for 30 minutes'}
                </Text>
              </View>
              {activatingMiner === 'ad' || isWatchingAd ? (
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
            liveMiners.map((miner) => (
              <View key={miner.id} style={styles.minerItem}>
                <View style={styles.minerHeader}>
                  <Text style={styles.minerName}>{miner.name}</Text>
                  <View style={[styles.minerStatus, { backgroundColor: miner.status === 'active' ? '#4CAF50' : '#666' }]}>
                    <Text style={styles.statusText}>{miner.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.minerStats}>
                  <Text style={styles.minerStat}>Hash Rate: {miner.hash_rate} GH/s</Text>
                  <Text style={styles.minerStat}>Earned: ₿ {(miner.total_earned ?? 0).toFixed(12)}</Text>
                  <Text style={styles.minerStat}>Time Left: {formatTimeRemaining(liveMiners.find(m => m.id === miner.id)?.time_remaining ?? miner.time_remaining)}</Text>
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

        {/* Activity Feed */}
        {activity.length > 0 && (
          <View style={styles.activityCard}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            {activity.slice(0, 5).map((item, index) => (
              <View key={item.id || index} style={styles.activityItem}>
                <Ionicons name="trending-up" size={16} color="#4CAF50" />
                <Text style={styles.activityText}>
                  {item.user_name} {item.action}
                  {item.amount ? ` ${item.amount} BTC` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Referral Rewards */}
        {walletData && walletData.total_referral_rewards > 0 && (
          <View style={styles.referralCard}>
            <Text style={styles.cardTitle}>Referral Rewards</Text>
            <Text style={styles.referralRewards}>{walletData.total_referral_rewards.toFixed(1)} GH/s</Text>
            <Text style={styles.referralSubtitle}>Total from referrals</Text>
          </View>
        )}
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw Bitcoin</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Bitcoin Address"
              placeholderTextColor="#666"
              value={withdrawForm.address}
              onChangeText={text => setWithdrawForm({ ...withdrawForm, address: text })}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Amount (BTC) - Min 0.0002"
              placeholderTextColor="#666"
              value={withdrawForm.amount}
              onChangeText={text => setWithdrawForm({ ...withdrawForm, amount: text })}
              keyboardType="decimal-pad"
            />
            <Text style={styles.feeInfo}>Network Fee: ₿ {networkFee.toFixed(12)}</Text>
            <Text style={styles.feeInfo}>Withdrawal Fee: ₿ 0.00002000</Text>
            <Text style={styles.feeInfo}>Service Fee: ₿ 0.00001000</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowWithdrawModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleWithdraw} disabled={isWithdrawing}>
                {isWithdrawing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalConfirmText}>Withdraw</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallet Registration Modal */}
      <Modal visible={showWalletModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Register Wallet Address</Text>
            <Text style={styles.modalSubtitle}>Enter your Bitcoin wallet address. This will be reviewed by admin before activation.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Bitcoin Address (e.g., bc1q...)"
              placeholderTextColor="#666"
              value={walletAddress}
              onChangeText={setWalletAddress}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowWalletModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={registerWalletAddress}>
                <Text style={styles.modalConfirmText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Address Change Modal */}
      <Modal visible={showAddressChangeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Wallet Address</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Current Password"
              placeholderTextColor="#666"
              secureTextEntry
              value={addressChangeForm.currentPassword}
              onChangeText={text => setAddressChangeForm({ ...addressChangeForm, currentPassword: text })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="New Bitcoin Address"
              placeholderTextColor="#666"
              value={addressChangeForm.newAddress}
              onChangeText={text => setAddressChangeForm({ ...addressChangeForm, newAddress: text })}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Confirm New Address"
              placeholderTextColor="#666"
              value={addressChangeForm.confirmAddress}
              onChangeText={text => setAddressChangeForm({ ...addressChangeForm, confirmAddress: text })}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowAddressChangeModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={submitAddressChange} disabled={isSubmittingAddressChange}>
                {isSubmittingAddressChange ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalConfirmText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ad Modal */}
      <Modal visible={showAdModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="play-circle" size={48} color="#FF5722" style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={styles.modalTitle}>Watch Ad</Text>
            <Text style={styles.modalSubtitle}>
              {currentAdType === 'withdrawal'
                ? 'Watch a short ad to proceed with your withdrawal.'
                : 'Watch a short ad to boost your mining power.'}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowAdModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleAdModalConfirm}>
                <Text style={styles.modalConfirmText}>Watch</Text>
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
  header: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subtitle: { fontSize: 16, color: '#AAA', marginTop: 4 },
  walletCard: { backgroundColor: '#2a2a2a', margin: 15, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#FF9800' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 10 },
  balance: { fontSize: 28, fontWeight: 'bold', color: '#FF9800', textAlign: 'center', marginVertical: 10 },
  usdValue: { fontSize: 16, color: '#AAA', textAlign: 'center', marginBottom: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#AAA', marginBottom: 5 },
  statValue: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },
  walletStatusCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  walletStatusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  walletStatusText: { fontSize: 16, fontWeight: 'bold', color: '#FFF', marginLeft: 8 },
  walletAddress: { fontSize: 14, color: '#AAA', marginBottom: 10, fontFamily: 'monospace' },
  rejectionNotice: { backgroundColor: '#331C1C', padding: 12, borderRadius: 8, marginBottom: 10 },
  rejectionReason: { fontSize: 12, color: '#FF5722', marginBottom: 8 },
  dismissLink: { fontSize: 12, color: '#FF9800', fontWeight: 'bold' },
  walletActionsRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  walletActionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, flex: 1, justifyContent: 'center' },
  walletActionButtonText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', marginLeft: 6 },
  withdrawButton: { backgroundColor: '#1B4332', borderWidth: 1, borderColor: '#4CAF50' },
  miningCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  hashRateContainer: { alignItems: 'center' },
  hashRateLabel: { fontSize: 14, color: '#AAA', marginBottom: 5 },
  hashRate: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50' },
  miningIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50', marginTop: 10 },
  quickActionsCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  quickActionButton: { borderRadius: 12, padding: 16, marginBottom: 12 },
  freeButton: { backgroundColor: '#1B4332', borderWidth: 1, borderColor: '#4CAF50' },
  adButton: { backgroundColor: '#331C1C', borderWidth: 1, borderColor: '#FF5722' },
  actionButtonContent: { flexDirection: 'row', alignItems: 'center' },
  actionButtonText: { flex: 1, marginLeft: 12 },
  actionButtonTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  actionButtonSubtitle: { fontSize: 12, color: '#AAA', marginTop: 2 },
  minersCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginTop: 16 },
  emptyStateSubtitle: { fontSize: 14, color: '#AAA', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  minerItem: { backgroundColor: '#333', padding: 15, borderRadius: 8, marginBottom: 10 },
  minerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  minerName: { fontSize: 16, fontWeight: 'bold', color: '#FFF', flex: 1 },
  minerStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, color: '#FFF', fontWeight: 'bold' },
  minerStats: { marginBottom: 10 },
  minerStat: { fontSize: 12, color: '#AAA', marginBottom: 2 },
  activateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF9800', padding: 10, borderRadius: 8 },
  activateButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  activityCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#333' },
  activityText: { fontSize: 13, color: '#CCC', marginLeft: 8, flex: 1 },
  referralCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12, alignItems: 'center' },
  referralRewards: { fontSize: 24, fontWeight: 'bold', color: '#9C27B0', marginVertical: 10 },
  referralSubtitle: { fontSize: 12, color: '#AAA' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  modalContent: { width: '100%', backgroundColor: '#2a2a2a', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#FF9800' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 12, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#AAA', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: '#FFF', marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  feeInfo: { fontSize: 12, color: '#AAA', marginBottom: 4 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  modalCancelButton: { flex: 1, backgroundColor: '#333', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginRight: 10 },
  modalCancelText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  modalConfirmButton: { flex: 1, backgroundColor: '#FF9800', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginLeft: 10 },
  modalConfirmText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
