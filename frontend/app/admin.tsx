import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function AdminPanel() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // Custom Alert state
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  // Custom Alert helper function
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
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/check`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setIsAdmin(true);
        loadAdminData();
      } else {
        showCustomAlert('Access Denied', 'You do not have admin privileges.');
        router.back();
      }
    } catch (error) {
      showCustomAlert('Error', 'Failed to verify admin access');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      // Load statistics
      const statsResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load users
      const usersResponse = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  const handleResetUser = async (userId: string, userEmail: string) => {
    showCustomAlert(
      '⚠️ Reset User Account',
      `Are you sure you want to reset ${userEmail}?\n\nThis will:\n• Delete all miners\n• Reset BTC balance to 0\n• Keep login credentials`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
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

  const handleBroadcastNotification = async () => {
    if (!broadcastMessage.trim()) {
      showCustomAlert('Error', 'Please enter a message');
      return;
    }

    showCustomAlert(
      '📢 Broadcast Notification',
      `Send this message to all users?\n\n"${broadcastMessage}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/admin/broadcast`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: broadcastMessage })
              });

              if (response.ok) {
                showCustomAlert('✅ Success', 'Notification sent to all users');
                setBroadcastMessage('');
              } else {
                showCustomAlert('❌ Error', 'Failed to send notification');
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Panel</Text>
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
            <Ionicons name="logo-bitcoin" size={32} color="#FFD700" />
            <Text style={styles.statValue}>₿ {(stats?.total_btc_mined || 0).toFixed(8)}</Text>
            <Text style={styles.statLabel}>Total BTC Mined</Text>
          </LinearGradient>

          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statCard}>
            <Ionicons name="warning" size={32} color="#FF6B6B" />
            <Text style={styles.statValue}>₿ {(stats?.total_btc_owed || 0).toFixed(8)}</Text>
            <Text style={styles.statLabel}>Total BTC Owed</Text>
            <Text style={styles.statSubLabel}>(Future Earnings)</Text>
          </LinearGradient>
        </View>

        {/* Broadcast Notification */}
        <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.section}>
          <Text style={styles.sectionTitle}>📢 Broadcast Notification</Text>
          <TextInput
            style={styles.broadcastInput}
            placeholder="Enter message to send to all users..."
            placeholderTextColor="#666"
            value={broadcastMessage}
            onChangeText={setBroadcastMessage}
            multiline
          />
          <TouchableOpacity onPress={handleBroadcastNotification}>
            <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.broadcastButton}>
              <Ionicons name="send" size={20} color="#000" />
              <Text style={styles.broadcastButtonText}>Send to All Users</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* User Management */}
        <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.section}>
          <Text style={styles.sectionTitle}>👥 User Management</Text>
          
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

          {/* User List */}
          {filteredUsers.map((user, index) => (
            <View key={user.id || index} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name || 'No Name'}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userBalance}>Balance: ₿ {(user.balance || 0).toFixed(8)}</Text>
                <Text style={styles.userMiners}>Active Miners: {user.active_miners || 0}</Text>
              </View>
              <TouchableOpacity onPress={() => handleResetUser(user.id, user.email)}>
                <LinearGradient colors={['#FF6B6B', '#FF4444']} style={styles.resetButton}>
                  <Ionicons name="refresh" size={16} color="#FFF" />
                  <Text style={styles.resetButtonText}>Reset</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ))}
        </LinearGradient>
      </ScrollView>

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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
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
    marginTop: 2,
  },
  section: {
    margin: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 15,
  },
  broadcastInput: {
    backgroundColor: '#1a1a1a',
    color: '#FFF',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  broadcastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    gap: 8,
  },
  broadcastButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    padding: 12,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    marginLeft: 10,
    fontSize: 16,
  },
  userCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userEmail: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 2,
  },
  userBalance: {
    color: '#FFD700',
    fontSize: 14,
    marginTop: 5,
  },
  userMiners: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 2,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 5,
  },
  resetButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
