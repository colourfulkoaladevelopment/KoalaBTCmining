import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
  Clipboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  total_commission: number;
  referral_miners: number;
  total_referral_rewards: number;
}

interface UserData {
  referral_code: string;
  name: string;
}

export default function Invites() {
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('user_data');
      if (userDataString) {
        setUserData(JSON.parse(userDataString));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/referrals/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        setReferralStats(result);
      }

    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const copyReferralCode = async () => {
    if (referralStats?.referral_code) {
      await Clipboard.setString(referralStats.referral_code);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    }
  };

  const shareReferralCode = async () => {
    if (referralStats?.referral_code) {
      const message = `🐨 Join me on Koala Mining and start earning Bitcoin! Use my referral code: ${referralStats.referral_code}\n\n🎁 We both get a 100 GH/s miner for 30 days when you sign up!\n\nDownload: https://koalamining.app`;
      
      try {
        await Share.share({
          message: message,
          title: 'Join Bitcoin Mining Simulator'
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const shareDownloadLink = async () => {
    const message = `🚀 Start mining Bitcoin with the best mobile mining simulator!\n\n⚡ Free daily miners\n💰 Real Bitcoin earnings\n🎁 Referral rewards\n\n${userData?.name && `Use ${userData.name}'s referral code: ${referralStats?.referral_code}\n\n`}Download now: https://bitcoinmining.app`;
    
    try {
      await Share.share({
        message: message,
        title: 'Bitcoin Mining Simulator'
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Loading Referrals...</Text>
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
          <Text style={styles.title}>Invite Friends</Text>
          <Text style={styles.subtitle}>Earn rewards together</Text>
        </View>

        {/* Referral Code Card */}
        <View style={styles.referralCodeCard}>
          <Text style={styles.cardTitle}>Your Referral Code</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.referralCode}>{referralStats?.referral_code || 'Loading...'}</Text>
            <TouchableOpacity style={styles.copyButton} onPress={copyReferralCode}>
              <Ionicons name="copy" size={20} color="#FF9800" />
            </TouchableOpacity>
          </View>
          <Text style={styles.codeDescription}>
            Share this code with friends to earn rewards when they sign up
          </Text>
        </View>

        {/* Rewards Info */}
        <View style={styles.rewardsCard}>
          <Text style={styles.cardTitle}>Referral Rewards</Text>
          
          <View style={styles.rewardItem}>
            <View style={styles.rewardIcon}>
              <Ionicons name="gift" size={24} color="#4CAF50" />
            </View>
            <View style={styles.rewardText}>
              <Text style={styles.rewardTitle}>Sign-up Bonus</Text>
              <Text style={styles.rewardDescription}>
                Both you and your friend get a 100 GH/s miner for 30 days when they join
              </Text>
            </View>
          </View>

          <View style={styles.rewardItem}>
            <View style={styles.rewardIcon}>
              <Ionicons name="trending-up" size={24} color="#9C27B0" />
            </View>
            <View style={styles.rewardText}>
              <Text style={styles.rewardTitle}>Purchase Commission</Text>
              <Text style={styles.rewardDescription}>
                Earn 10% of your friend's mining hash rate when they buy premium miners
              </Text>
            </View>
          </View>

          <View style={styles.rewardItem}>
            <View style={styles.rewardIcon}>
              <Ionicons name="infinite" size={24} color="#FF5722" />
            </View>
            <View style={styles.rewardText}>
              <Text style={styles.rewardTitle}>Unlimited Invites</Text>
              <Text style={styles.rewardDescription}>
                No limit on how many friends you can invite and earn from
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Card */}
        {referralStats && (
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>Your Referral Stats</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{referralStats.total_referrals}</Text>
                <Text style={styles.statLabel}>Total Referrals</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{referralStats.referral_miners}</Text>
                <Text style={styles.statLabel}>Bonus Miners</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{referralStats.total_commission.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Commission GH/s</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{referralStats.total_referral_rewards.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Total Rewards GH/s</Text>
              </View>
            </View>
          </View>
        )}

        {/* Share Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Share & Invite</Text>
          
          <TouchableOpacity style={styles.shareButton} onPress={shareReferralCode}>
            <Ionicons name="share" size={20} color="#FFF" />
            <Text style={styles.shareButtonText}>Share Referral Code</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.shareButton, styles.downloadButton]} onPress={shareDownloadLink}>
            <Ionicons name="download" size={20} color="#FFF" />
            <Text style={styles.shareButtonText}>Share Download Link</Text>
          </TouchableOpacity>
        </View>

        {/* How It Works */}
        <View style={styles.howItWorksCard}>
          <Text style={styles.cardTitle}>How Referrals Work</Text>
          
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepDescription}>
              Share your referral code or download link with friends
            </Text>
          </View>
          
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepDescription}>
              They sign up using your code and both get 100 GH/s miners
            </Text>
          </View>
          
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepDescription}>
              When they purchase miners, you get 10% commission automatically
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
  referralCodeCard: {
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
    marginBottom: 15,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  referralCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
  },
  copyButton: {
    padding: 8,
  },
  codeDescription: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
  },
  rewardsCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rewardText: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 20,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#AAA',
    textAlign: 'center',
  },
  actionsCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  downloadButton: {
    backgroundColor: '#2196F3',
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  howItWorksCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  stepDescription: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
    paddingTop: 6,
  },
});