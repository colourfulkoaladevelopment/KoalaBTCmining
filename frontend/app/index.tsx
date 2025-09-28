import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface MinerConfig {
  id: string;
  name: string;
  hashRate: number;
  status: 'active' | 'inactive' | 'deprecated';
  timeRemaining: number;
  earned: number;
  type: 'free' | 'premium' | 'ad';
}

interface WalletData {
  totalBalance: number;
  todayEarnings: number;
  totalMiners: number;
  activeMiners: number;
}

export default function Dashboard() {
  const [walletData, setWalletData] = useState<WalletData>({
    totalBalance: 0.00012845,
    todayEarnings: 0.00000234,
    totalMiners: 12,
    activeMiners: 8
  });

  const [miners, setMiners] = useState<MinerConfig[]>([
    {
      id: '1',
      name: 'Free Miner #1',
      hashRate: 5.6,
      status: 'active',
      timeRemaining: 23.5,
      earned: 0.00000123,
      type: 'free'
    },
    {
      id: '2',
      name: 'Premium Miner Pro',
      hashRate: 25.8,
      status: 'active',
      timeRemaining: 71.2,
      earned: 0.00000567,
      type: 'premium'
    },
    {
      id: '3',
      name: 'Ad Boost Miner',
      hashRate: 12.4,
      status: 'inactive',
      timeRemaining: 0,
      earned: 0.00000089,
      type: 'ad'
    }
  ]);

  const [currentHashRate, setCurrentHashRate] = useState(43.8);
  const [mining, setMining] = useState(true);

  const toggleMining = () => {
    setMining(!mining);
    Alert.alert(
      mining ? 'Mining Paused' : 'Mining Resumed',
      mining ? 'Your miners have been paused.' : 'Your miners are now active again.'
    );
  };

  const activateAdMiner = () => {
    Alert.alert(
      'Watch Ad for Free Mining',
      'Watch a 30-second ad to activate free mining power for 24 hours?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Watch Ad', onPress: () => {
          // Simulate ad watching
          setMiners(prev => prev.map(miner => 
            miner.type === 'ad' && miner.id === '3'
              ? { ...miner, status: 'active', timeRemaining: 24 }
              : miner
          ));
          Alert.alert('Success', 'Free mining activated for 24 hours!');
        }}
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bitcoin Mining</Text>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="menu" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Wallet Overview */}
        <View style={styles.walletCard}>
          <Text style={styles.cardTitle}>Bitcoin Wallet</Text>
          <Text style={styles.balance}>₿ {walletData.totalBalance.toFixed(8)}</Text>
          <Text style={styles.usdValue}>≈ ${(walletData.totalBalance * 45000).toFixed(2)} USD</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Today's Earnings</Text>
              <Text style={styles.statValue}>₿ {walletData.todayEarnings.toFixed(8)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Active Miners</Text>
              <Text style={styles.statValue}>{walletData.activeMiners}/{walletData.totalMiners}</Text>
            </View>
          </View>
        </View>

        {/* Mining Status */}
        <View style={styles.miningCard}>
          <View style={styles.miningHeader}>
            <Text style={styles.cardTitle}>Mining Status</Text>
            <TouchableOpacity 
              style={[styles.miningToggle, { backgroundColor: mining ? '#4CAF50' : '#FF5722' }]}
              onPress={toggleMining}
            >
              <Ionicons 
                name={mining ? 'pause' : 'play'} 
                size={16} 
                color="#FFF" 
              />
              <Text style={styles.toggleText}>{mining ? 'Pause' : 'Start'}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.hashRateContainer}>
            <Text style={styles.hashRateLabel}>Current Hash Rate</Text>
            <Text style={styles.hashRate}>{currentHashRate.toFixed(1)} GH/s</Text>
            {mining && <View style={styles.miningIndicator} />}
          </View>
        </View>

        {/* Earnings Overview */}
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>24h Earnings Overview</Text>
          <View style={styles.earningsContainer}>
            <View style={styles.earningItem}>
              <Text style={styles.earningLabel}>00:00 - 06:00</Text>
              <Text style={styles.earningValue}>₿ 0.00000012</Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={styles.earningLabel}>06:00 - 12:00</Text>
              <Text style={styles.earningValue}>₿ 0.00000018</Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={styles.earningLabel}>12:00 - 18:00</Text>
              <Text style={styles.earningValue}>₿ 0.00000023</Text>
            </View>
            <View style={styles.earningItem}>
              <Text style={styles.earningLabel}>18:00 - 24:00</Text>
              <Text style={styles.earningValue}>₿ 0.00000019</Text>
            </View>
          </View>
        </View>

        {/* Active Miners */}
        <View style={styles.minersCard}>
          <Text style={styles.cardTitle}>Your Miners</Text>
          {miners.map((miner) => (
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
                  Hash Rate: {miner.hashRate} GH/s
                </Text>
                <Text style={styles.minerStat}>
                  Earned: ₿ {miner.earned.toFixed(8)}
                </Text>
                <Text style={styles.minerStat}>
                  Time Left: {miner.timeRemaining.toFixed(1)}h
                </Text>
              </View>

              {miner.type === 'ad' && miner.status === 'inactive' && (
                <TouchableOpacity 
                  style={styles.adButton}
                  onPress={activateAdMiner}
                >
                  <Ionicons name="play-circle" size={20} color="#FFF" />
                  <Text style={styles.adButtonText}>Watch Ad to Activate</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="add-circle" size={24} color="#FF9800" />
              <Text style={styles.actionText}>Buy Miners</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="wallet" size={24} color="#FF9800" />
              <Text style={styles.actionText}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="tv" size={24} color="#FF9800" />
              <Text style={styles.actionText}>Watch Ads</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="settings" size={24} color="#FF9800" />
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  menuButton: {
    padding: 5,
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
  miningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  miningToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  toggleText: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 5,
    fontWeight: 'bold',
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
  chartCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  minersCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
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
  adButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5722',
    padding: 10,
    borderRadius: 8,
  },
  adButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  actionsCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    width: '22%',
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 10,
  },
  actionText: {
    fontSize: 12,
    color: '#FFF',
    marginTop: 5,
    textAlign: 'center',
  },
});