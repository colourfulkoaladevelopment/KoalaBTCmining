import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function Store() {
  const [storeMiners, setStoreMiners] = useState<StoreMiner[]>([]);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingMiner, setPurchasingMiner] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      // Load store miners
      const storeResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/miners`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (storeResponse.ok) {
        const storeResult = await storeResponse.json();
        setStoreMiners(storeResult.miners);
      }

      // Load user balance
      const balanceResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/wallet/balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (balanceResponse.ok) {
        const balanceResult = await balanceResponse.json();
        setUserBalance({ total_balance: balanceResult.total_balance });
      }

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

  const formatHashRate = (hashRate: number): string => {
    if (hashRate >= 1000) {
      return `${(hashRate / 1000).toFixed(1)} TH/s`;
    } else if (hashRate >= 1) {
      return `${hashRate} GH/s`;
    } else {
      return `${hashRate * 1000} MH/s`;
    }
  };

  const purchaseMiner = (miner: StoreMiner) => {
    Alert.alert(
      'Purchase Miner',
      `Purchase ${miner.name} for $${miner.price}?\n\nHash Rate: ${formatHashRate(miner.hash_rate)}\nDuration: ${miner.duration_days} days`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Choose Payment Method', 
          onPress: () => showPaymentOptions(miner)
        }
      ]
    );
  };

  const showPaymentOptions = (miner: StoreMiner) => {
    Alert.alert(
      'Payment Method',
      'Choose your payment method:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'PayPal', onPress: () => processPayment(miner, 'paypal') },
        { text: 'Google Pay', onPress: () => processPayment(miner, 'google_pay') },
        { text: 'Credit Card', onPress: () => processPayment(miner, 'credit_card') }
      ]
    );
  };

  const processPayment = async (miner: StoreMiner, paymentMethod: string) => {
    try {
      setPurchasingMiner(miner.id);
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const token = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/store/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...miner,
          payment_method: paymentMethod
        })
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          'Purchase Successful! 🎉',
          `${miner.name} has been added to your miners. Go to Dashboard to activate it.`,
          [{ text: 'OK' }]
        );
        loadData(); // Refresh data
      } else {
        Alert.alert('Purchase Failed', result.detail || 'Payment processing failed');
      }

    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setPurchasingMiner(null);
    }
  };

  const getMinerIcon = (hashRate: number): string => {
    if (hashRate >= 10000) return 'diamond';
    if (hashRate >= 5000) return 'star';
    if (hashRate >= 1000) return 'trophy';
    if (hashRate >= 500) return 'medal';
    if (hashRate >= 200) return 'ribbon';
    return 'hardware-chip';
  };

  const getMinerColor = (hashRate: number): string => {
    if (hashRate >= 10000) return '#E91E63'; // Pink - Mythic
    if (hashRate >= 5000) return '#9C27B0';  // Purple - Legendary
    if (hashRate >= 1000) return '#FF5722';  // Deep Orange - Elite
    if (hashRate >= 500) return '#FF9800';   // Orange - Pro
    if (hashRate >= 200) return '#2196F3';   // Blue - Advanced
    return '#4CAF50'; // Green - Basic
  };

  const getTierName = (hashRate: number): string => {
    if (hashRate >= 10000) return 'MYTHIC';
    if (hashRate >= 5000) return 'LEGENDARY';
    if (hashRate >= 1000) return 'ELITE';
    if (hashRate >= 500) return 'PRO';
    if (hashRate >= 200) return 'ADVANCED';
    return 'BASIC';
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Miner Store</Text>
          <Text style={styles.subtitle}>Rent premium mining hardware</Text>
          {userBalance && (
            <Text style={styles.balance}>
              Balance: ₿ {userBalance.total_balance.toFixed(8)}
            </Text>
          )}
        </View>

        {/* Store Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#2196F3" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>30-Day Rentals</Text>
            <Text style={styles.infoDescription}>
              All miners are rented for 30 days. They will automatically deactivate when the rental period expires.
            </Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.paymentCard}>
          <Text style={styles.cardTitle}>Accepted Payment Methods</Text>
          <View style={styles.paymentMethods}>
            <View style={styles.paymentMethod}>
              <Ionicons name="card" size={20} color="#FF9800" />
              <Text style={styles.paymentMethodText}>Credit/Debit Card</Text>
            </View>
            <View style={styles.paymentMethod}>
              <Ionicons name="logo-paypal" size={20} color="#0070ba" />
              <Text style={styles.paymentMethodText}>PayPal</Text>
            </View>
            <View style={styles.paymentMethod}>
              <Ionicons name="phone-portrait" size={20} color="#4CAF50" />
              <Text style={styles.paymentMethodText}>Google Pay</Text>
            </View>
          </View>
        </View>

        {/* Premium Miners Header */}
        <View style={styles.premiumHeader}>
          <Text style={styles.premiumTitle}>Premium Miners</Text>
        </View>

        {/* Hash Rate Legend */}
        <View style={styles.legendCard}>
          <View style={styles.legendHeader}>
            <Ionicons name="information-circle" size={20} color="#FFD700" />
            <Text style={styles.legendTitle}>Hash Rate Legend</Text>
          </View>
          <View style={styles.legendContent}>
            <Text style={styles.legendText}>100 MH/s = Est. B 0.00000000054350/day</Text>
            <Text style={styles.legendText}>1 GH/s = Est. B 0.00000000543500/day</Text>
            <Text style={styles.legendText}>10 GH/s = Est. B 0.00000005435000/day</Text>
            <Text style={styles.legendText}>100 GH/s = Est. B 0.00000054350000/day</Text>
            <Text style={styles.legendText}>1 TH/s = Est. B 0.00000543500000/day</Text>
            <Text style={styles.legendText}>10 TH/s = Est. B 0.00005435000000/day</Text>
          </View>
        </View>

        {/* Miners Grid */}
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
                  <Ionicons 
                    name={getMinerIcon(miner.hash_rate)} 
                    size={32} 
                    color={tierColor} 
                    style={styles.minerIcon}
                  />
                  
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
                        <Ionicons name="card" size={16} color="#FFF" />
                        <Text style={styles.purchaseButtonText}>Purchase</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Referral Bonus Info */}
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
  balance: {
    fontSize: 14,
    color: '#FF9800',
    marginTop: 8,
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A8A',
    margin: 15,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  infoDescription: {
    fontSize: 14,
    color: '#AAA',
    marginTop: 4,
  },
  paymentCard: {
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
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  paymentMethod: {
    alignItems: 'center',
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 8,
    textAlign: 'center',
  },
  premiumHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  premiumTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  legendCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 8,
  },
  legendContent: {
    paddingLeft: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#CCC',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  minersGrid: {
    paddingHorizontal: 15,
  },
  minerCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  minerTier: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  tierText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 1,
  },
  minerContent: {
    padding: 20,
    alignItems: 'center',
  },
  minerIcon: {
    marginBottom: 12,
  },
  minerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  minerSpecs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  specText: {
    fontSize: 14,
    color: '#FFF',
    marginLeft: 6,
    fontWeight: 'bold',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  priceUnit: {
    fontSize: 16,
    color: '#AAA',
    marginLeft: 6,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 140,
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bonusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D1B3D',
    margin: 15,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  bonusText: {
    flex: 1,
    marginLeft: 12,
  },
  bonusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  bonusDescription: {
    fontSize: 14,
    color: '#AAA',
    marginTop: 4,
  },
});