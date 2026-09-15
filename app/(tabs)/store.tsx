import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../utils/api';

interface StoreMiner {
  id: string;
  name: string;
  hash_rate: number;
  price: number;
  duration_days: number;
}

interface UserBalance {
  total_balance: number;
}

interface Miner {
  id: string;
  name: string;
  hash_rate: number;
  status: string;
  time_remaining: number;
  expires_at?: string;
}

export default function Store() {
  const [storeMiners, setStoreMiners] = useState<StoreMiner[]>([]);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [userMiners, setUserMiners] = useState<Miner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingMiner, setPurchasingMiner] = useState<string | null>(null);
  const [showEarningsGuide, setShowEarningsGuide] = useState(false);
  const paypalPendingRef = useRef<{ orderId: string; minerId: string } | null>(null);

  useEffect(() => {
    loadData();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && paypalPendingRef.current) {
        checkPendingPayPal();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const loadData = async () => {
    try {
      const [storeRes, balanceRes, minersRes] = await Promise.all([
        apiFetch('/api/store/miners'),
        apiFetch('/api/wallet/balance'),
        apiFetch('/api/miners/list'),
      ]);

      if (storeRes.ok) setStoreMiners(storeRes.data.miners || []);
      if (balanceRes.ok) setUserBalance({ total_balance: balanceRes.data.total_balance });
      if (minersRes.ok) setUserMiners(minersRes.data.miners || []);
    } catch (error) {
      console.error('Error loading store data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const checkPendingPayPal = async () => {
    const pending = paypalPendingRef.current;
    if (!pending) return;

    try {
      const res = await apiFetch('/api/payments/capture-paypal-order', {
        method: 'POST',
        body: JSON.stringify({ order_id: pending.orderId }),
      });

      if (res.ok) {
        Alert.alert('Purchase Successful!', 'Your miner has been added. Go to Dashboard to activate it.');
        loadData();
      } else {
        Alert.alert('Payment Pending', 'Your payment is being processed. You will be notified when it completes.');
      }
    } catch (error) {
      console.error('PayPal capture error:', error);
    } finally {
      paypalPendingRef.current = null;
    }
  };

  const formatHashRate = (hashRate: number): string => {
    if (hashRate >= 1000) return `${(hashRate / 1000).toFixed(1)} TH/s`;
    if (hashRate >= 1) return `${hashRate} GH/s`;
    return `${hashRate * 1000} MH/s`;
  };

  const purchaseMiner = (miner: StoreMiner) => {
    Alert.alert(
      'Purchase Miner',
      `Purchase ${miner.name} for $${miner.price}?\n\nHash Rate: ${formatHashRate(miner.hash_rate)}\nDuration: ${miner.duration_days} days`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay with PayPal', onPress: () => initiatePayPalPurchase(miner) },
      ]
    );
  };

  const initiatePayPalPurchase = async (miner: StoreMiner) => {
    try {
      setPurchasingMiner(miner.id);
      const res = await apiFetch('/api/payments/create-paypal-order', {
        method: 'POST',
        body: JSON.stringify({ miner_id: miner.id }),
      });

      if (res.ok && res.data.approval_url) {
        paypalPendingRef.current = { orderId: res.data.order_id, minerId: miner.id };
        await Linking.openURL(res.data.approval_url);
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to create PayPal order');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setPurchasingMiner(null);
    }
  };

  const renewMiner = (miner: Miner) => {
    const storeMiner = storeMiners.find(sm => sm.name === miner.name || sm.hash_rate === miner.hash_rate);
    if (storeMiner) {
      purchaseMiner(storeMiner);
    } else {
      Alert.alert('Info', 'This miner is no longer available in the store.');
    }
  };

  const getMinerIcon = (hashRate: number): string => {
    if (hashRate >= 20000) return 'diamond';
    if (hashRate >= 15000) return 'star';
    if (hashRate >= 10000) return 'trophy';
    if (hashRate >= 4000) return 'medal';
    if (hashRate >= 2000) return 'ribbon';
    if (hashRate >= 1000) return 'flash';
    if (hashRate >= 400) return 'flame';
    if (hashRate >= 200) return 'sparkles';
    return 'hardware-chip';
  };

  const getMinerColor = (hashRate: number): string => {
    if (hashRate >= 20000) return '#E91E63';
    if (hashRate >= 15000) return '#9C27B0';
    if (hashRate >= 10000) return '#673AB7';
    if (hashRate >= 4000) return '#FF5722';
    if (hashRate >= 2000) return '#FF9800';
    if (hashRate >= 1000) return '#FFC107';
    if (hashRate >= 400) return '#2196F3';
    if (hashRate >= 200) return '#00BCD4';
    return '#4CAF50';
  };

  const getTierName = (hashRate: number): string => {
    if (hashRate >= 20000) return 'MYTHICAL';
    if (hashRate >= 15000) return 'LEGENDARY';
    if (hashRate >= 10000) return 'ULTIMATE';
    if (hashRate >= 4000) return 'SUPREME';
    if (hashRate >= 2000) return 'MASTER';
    if (hashRate >= 1000) return 'ELITE';
    if (hashRate >= 400) return 'PRO';
    if (hashRate >= 200) return 'ADVANCED';
    return 'STANDARD';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Loading Store...</Text>
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
          <Text style={styles.title}>Miner Store</Text>
          <Text style={styles.subtitle}>Rent premium mining hardware</Text>
          {userBalance && (
            <Text style={styles.balance}>Balance: ₿ {(userBalance?.total_balance ?? 0).toFixed(12)}</Text>
          )}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#2196F3" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>30-Day Rentals</Text>
            <Text style={styles.infoDescription}>
              All miners are rented for 30 days. They will automatically deactivate when the rental period expires.
            </Text>
          </View>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.cardTitle}>Accepted Payment Methods</Text>
          <View style={styles.paymentMethods}>
            <View style={styles.paymentMethod}>
              <Ionicons name="logo-paypal" size={20} color="#0070ba" />
              <Text style={styles.paymentMethodText}>PayPal</Text>
            </View>
          </View>
        </View>

        <View style={styles.legendCard}>
          <TouchableOpacity
            style={styles.legendHeader}
            onPress={() => setShowEarningsGuide(s => !s)}
            activeOpacity={0.7}
          >
            <Ionicons name="stats-chart" size={24} color="#FFD700" />
            <Text style={styles.legendTitle}>Daily Earnings Guide</Text>
            <Ionicons
              name={showEarningsGuide ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#FFD700"
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>
          {showEarningsGuide && (
            <>
              <Text style={styles.legendSubtitle}>Each miner earns Bitcoin based on its hash rate:</Text>
              <View style={styles.legendGrid}>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>200 GH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000000544 / day</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>400 GH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000001087 / day</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>800 GH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000002174 / day</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>2 TH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000005435 / day</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>4 TH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000010870 / day</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>8 TH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000021740 / day</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>20 TH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000054350 / day</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>30 TH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000081525 / day</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHashRate}>40 TH/s</Text>
                  <Text style={styles.legendEarning}>₿ 0.000000108700 / day</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={styles.premiumHeader}>
          <Text style={styles.premiumTitle}>Premium Miners</Text>
        </View>

        <View style={styles.minersGrid}>
          {storeMiners.map((miner) => {
            const tierColor = getMinerColor(miner.hash_rate);
            const tierName = getTierName(miner.hash_rate);
            const isPurchasing = purchasingMiner === miner.id;

            return (
              <View key={miner.id} style={[styles.minerCard, { borderColor: tierColor }]}>
                <View style={[styles.minerTier, { backgroundColor: tierColor }]}>
                  <Text style={styles.tierText}>{tierName}</Text>
                </View>
                <View style={styles.minerContent}>
                  <Ionicons name={getMinerIcon(miner.hash_rate)} size={32} color={tierColor} style={styles.minerIcon} />
                  <Text style={styles.minerName}>{miner.name}</Text>
                  <View style={styles.minerSpecs}>
                    <View style={styles.specRow}>
                      <Ionicons name="flash" size={16} color="#FF9800" />
                      <Text style={styles.specText}>{formatHashRate(miner.hash_rate)}</Text>
                    </View>
                    <View style={styles.specRow}>
                      <Ionicons name="time" size={16} color="#2196F3" />
                      <Text style={styles.specText}>{miner.duration_days} days</Text>
                    </View>
                  </View>
                  <View style={styles.priceSection}>
                    <Text style={styles.price}>${miner.price}</Text>
                    <Text style={styles.priceUnit}>USD</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.purchaseButton, { backgroundColor: tierColor }]}
                    onPress={() => purchaseMiner(miner)}
                    disabled={isPurchasing}
                  >
                    {isPurchasing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="logo-paypal" size={16} color="#FFF" />
                        <Text style={styles.purchaseButtonText}>Pay with PayPal</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.bonusCard}>
          <Ionicons name="people" size={24} color="#9C27B0" />
          <View style={styles.bonusText}>
            <Text style={styles.bonusTitle}>Referral Bonus</Text>
            <Text style={styles.bonusDescription}>
              When someone you referred makes a purchase, you get 10% of their hash rate as a bonus miner!
            </Text>
          </View>
        </View>
      </ScrollView>
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
  balance: { fontSize: 14, color: '#FF9800', marginTop: 8, fontWeight: 'bold' },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', margin: 15, padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  infoText: { flex: 1, marginLeft: 12 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  infoDescription: { fontSize: 14, color: '#AAA', marginTop: 4 },
  paymentCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
  paymentMethods: { flexDirection: 'row', justifyContent: 'space-around' },
  paymentMethod: { alignItems: 'center' },
  paymentMethodText: { fontSize: 12, color: '#AAA', marginTop: 8, textAlign: 'center' },
  legendCard: { backgroundColor: '#2a2a2a', marginHorizontal: 15, marginBottom: 15, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#FFD700' },
  legendHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', marginLeft: 10 },
  legendSubtitle: { fontSize: 14, color: '#AAA', marginBottom: 15 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 },
  legendItem: { width: '48%', backgroundColor: '#1a1a1a', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#444' },
  legendHashRate: { fontSize: 14, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
  legendEarning: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  premiumHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 5 },
  premiumTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFD700', textAlign: 'center' },
  minersGrid: { paddingHorizontal: 15 },
  minerCard: { backgroundColor: '#2a2a2a', borderRadius: 16, marginBottom: 20, borderWidth: 2, overflow: 'hidden' },
  minerTier: { paddingVertical: 8, alignItems: 'center' },
  tierText: { fontSize: 12, fontWeight: 'bold', color: '#FFF', letterSpacing: 1 },
  minerContent: { padding: 20, alignItems: 'center' },
  minerIcon: { marginBottom: 12 },
  minerName: { fontSize: 18, fontWeight: 'bold', color: '#FFF', textAlign: 'center', marginBottom: 16 },
  minerSpecs: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 20 },
  specRow: { flexDirection: 'row', alignItems: 'center' },
  specText: { fontSize: 14, color: '#FFF', marginLeft: 6, fontWeight: 'bold' },
  priceSection: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  price: { fontSize: 28, fontWeight: 'bold', color: '#4CAF50' },
  priceUnit: { fontSize: 16, color: '#AAA', marginLeft: 6 },
  purchaseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, minWidth: 140 },
  purchaseButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  bonusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2D1B3D', margin: 15, padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#9C27B0' },
  bonusText: { flex: 1, marginLeft: 12 },
  bonusTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  bonusDescription: { fontSize: 14, color: '#AAA', marginTop: 4 },
});
