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
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/api';
import { openAdInspector } from '../utils/adMobAds';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  active_miners: number;
  wallet_status?: string;
  btc_address?: string;
}

interface PendingWallet {
  user_id: string;
  user_email: string;
  btc_address: string;
}

interface PendingAddressChange {
  user_id: string;
  user_email: string;
  old_address: string;
  new_address: string;
}

export default function AdminPanel() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingWallets, setPendingWallets] = useState<PendingWallet[]>([]);
  const [pendingAddressChanges, setPendingAddressChanges] = useState<PendingAddressChange[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [giveBtcModal, setGiveBtcModal] = useState<{ visible: boolean; userId: string; userEmail: string; amount: string; operation: string }>({ visible: false, userId: '', userEmail: '', amount: '', operation: 'add' });
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; userId: string; reason: string }>({ visible: false, userId: '', reason: '' });
  const [setAddrModal, setSetAddrModal] = useState<{ visible: boolean; userId: string; address: string }>({ visible: false, userId: '', address: '' });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const res = await apiFetch('/api/admin/check');
      if (res.ok) {
        setIsAdmin(true);
        loadAdminData();
      } else {
        Alert.alert('Access Denied', 'You do not have admin privileges.');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify admin access');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const [statsRes, usersRes, walletsRes, addrChangesRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/pending-wallets'),
        apiFetch('/api/admin/pending-address-changes'),
      ]);
      if (statsRes.ok) setStats(statsRes.data);
      if (usersRes.ok) setUsers(usersRes.data.users || []);
      if (walletsRes.ok) setPendingWallets(walletsRes.data.pending_wallets || []);
      if (addrChangesRes.ok) setPendingAddressChanges(addrChangesRes.data.pending_changes || []);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  const approveWallet = async (userId: string) => {
    Alert.alert('Approve Wallet', 'Approve this wallet address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            const res = await apiFetch(`/api/admin/approve-wallet/${userId}`, { method: 'POST' });
            if (res.ok) {
              Alert.alert('Success', 'Wallet approved');
              loadAdminData();
            } else {
              Alert.alert('Error', res.data?.detail || 'Failed to approve wallet');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          }
        },
      },
    ]);
  };

  const approveAddressChange = async (userId: string) => {
    Alert.alert('Approve Address Change', 'Approve this address change?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          try {
            const res = await apiFetch(`/api/admin/approve-address-change/${userId}`, { method: 'POST' });
            if (res.ok) {
              Alert.alert('Success', 'Address change approved');
              loadAdminData();
            } else {
              Alert.alert('Error', res.data?.detail || 'Failed to approve address change');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          }
        },
      },
    ]);
  };

  const showRejectModal = (userId: string) => {
    setRejectModal({ visible: true, userId, reason: '' });
  };

  const confirmRejectAddressChange = async () => {
    if (!rejectModal.reason.trim()) {
      Alert.alert('Error', 'Please enter a rejection reason');
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/reject-address-change/${rejectModal.userId}`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectModal.reason }),
      });
      if (res.ok) {
        Alert.alert('Success', 'Address change rejected');
        setRejectModal({ visible: false, userId: '', reason: '' });
        loadAdminData();
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to reject address change');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const showSetAddrModal = (userId: string) => {
    setSetAddrModal({ visible: true, userId, address: '' });
  };

  const confirmSetAddress = async () => {
    if (!setAddrModal.address.trim()) {
      Alert.alert('Error', 'Please enter a Bitcoin address');
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/set-address/${setAddrModal.userId}`, {
        method: 'POST',
        body: JSON.stringify({ btc_address: setAddrModal.address }),
      });
      if (res.ok) {
        Alert.alert('Success', 'Address set successfully');
        setSetAddrModal({ visible: false, userId: '', address: '' });
        loadAdminData();
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to set address');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const showGiveBtcModal = (userId: string, userEmail: string) => {
    setGiveBtcModal({ visible: true, userId, userEmail, amount: '', operation: 'add' });
  };

  const confirmGiveBtc = async () => {
    const amount = parseFloat(giveBtcModal.amount);
    if (isNaN(amount)) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/give-btc/${giveBtcModal.userId}`, {
        method: 'POST',
        body: JSON.stringify({ amount, operation: giveBtcModal.operation }),
      });
      if (res.ok) {
        Alert.alert('Success', `Balance ${giveBtcModal.operation === 'add' ? 'increased' : giveBtcModal.operation === 'remove' ? 'decreased' : 'set'} successfully`);
        setGiveBtcModal({ visible: false, userId: '', userEmail: '', amount: '', operation: 'add' });
        loadAdminData();
      } else {
        Alert.alert('Error', res.data?.detail || 'Failed to adjust balance');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    }
  };

  const handleResetUser = (userId: string, userEmail: string) => {
    Alert.alert('Reset User Account', `Reset ${userEmail}?\n\nThis will delete all miners and reset BTC balance to 0. Login credentials will be preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await apiFetch(`/api/admin/reset-user/${userId}`, { method: 'POST' });
            if (res.ok) {
              Alert.alert('Success', 'User account reset successfully');
              loadAdminData();
            } else {
              Alert.alert('Error', res.data?.detail || 'Failed to reset user');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          }
        },
      },
    ]);
  };

  const handleDeleteUser = (userId: string, userEmail: string) => {
    Alert.alert('Delete User', `Permanently delete ${userEmail}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await apiFetch(`/api/admin/delete-user/${userId}`, { method: 'DELETE' });
            if (res.ok) {
              Alert.alert('Success', 'User deleted');
              loadAdminData();
            } else {
              Alert.alert('Error', res.data?.detail || 'Failed to delete user');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          }
        },
      },
    ]);
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }
    Alert.alert('Broadcast', `Send to all users?\n\n"${broadcastMessage}"`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          try {
            const res = await apiFetch('/api/admin/broadcast', {
              method: 'POST',
              body: JSON.stringify({ message: broadcastMessage }),
            });
            if (res.ok) {
              Alert.alert('Success', 'Notification sent to all users');
              setBroadcastMessage('');
            } else {
              Alert.alert('Error', 'Failed to send notification');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          }
        },
      },
    ]);
  };

  const handleFactoryReset = () => {
    Alert.alert('FACTORY RESET', 'This will DELETE ALL MINERS and RESET ALL BALANCES to 0 for ALL users. This cannot be undone!', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'RESET ALL',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await apiFetch('/api/admin/factory-reset', { method: 'POST' });
            if (res.ok) {
              Alert.alert('Factory Reset Complete', `Miners Deleted: ${res.data.miners_deleted}\nUsers Reset: ${res.data.users_reset}`, [{ text: 'OK', onPress: () => loadAdminData() }]);
            } else {
              Alert.alert('Error', 'Failed to perform factory reset');
            }
          } catch (error) {
            Alert.alert('Error', 'Network error occurred');
          }
        },
      },
    ]);
  };

  const handleAdInspector = async () => {
    const result = await openAdInspector();
    if (!result.ok) Alert.alert('Ad Inspector', result.message);
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#FFD700" /></View>;
  }

  if (!isAdmin) return null;

  return (
    <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Panel</Text>
        </View>

        {/* Stats */}
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
            <Text style={styles.statValue}>₿ {(stats?.total_btc_mined || 0).toFixed(12)}</Text>
            <Text style={styles.statLabel}>Total BTC Mined</Text>
          </LinearGradient>
          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.statCard}>
            <Ionicons name="warning" size={32} color="#FF6B6B" />
            <Text style={styles.statValue}>₿ {(stats?.total_btc_owed || 0).toFixed(12)}</Text>
            <Text style={styles.statLabel}>Total BTC Owed</Text>
          </LinearGradient>
        </View>

        {/* Pending Wallet Approvals */}
        {pendingWallets.length > 0 && (
          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Wallet Approvals</Text>
            {pendingWallets.map((wallet, index) => (
              <View key={index} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingEmail}>{wallet.user_email}</Text>
                  <Text style={styles.pendingAddress} numberOfLines={1}>{wallet.btc_address}</Text>
                </View>
                <TouchableOpacity onPress={() => approveWallet(wallet.user_id)}>
                  <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.approveButton}>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))}
          </LinearGradient>
        )}

        {/* Pending Address Changes */}
        {pendingAddressChanges.length > 0 && (
          <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Address Changes</Text>
            {pendingAddressChanges.map((change, index) => (
              <View key={index} style={styles.pendingCard}>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingEmail}>{change.user_email}</Text>
                  <Text style={styles.pendingAddressSmall}>From: {change.old_address?.substring(0, 16)}...</Text>
                  <Text style={styles.pendingAddressSmall}>To: {change.new_address?.substring(0, 16)}...</Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity onPress={() => approveAddressChange(change.user_id)}>
                    <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.smallActionBtn}>
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => showRejectModal(change.user_id)}>
                    <LinearGradient colors={['#FF6B6B', '#FF4444']} style={styles.smallActionBtn}>
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </LinearGradient>
        )}

        {/* Broadcast */}
        <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.section}>
          <Text style={styles.sectionTitle}>Broadcast Notification</Text>
          <TextInput style={styles.broadcastInput} placeholder="Enter message to send to all users..." placeholderTextColor="#666" value={broadcastMessage} onChangeText={setBroadcastMessage} multiline />
          <TouchableOpacity onPress={handleBroadcast}>
            <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.broadcastButton}>
              <Ionicons name="send" size={20} color="#000" />
              <Text style={styles.broadcastButtonText}>Send to All Users</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* Danger Zone */}
        <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <Text style={styles.warningText}>Factory Reset will delete ALL miners and reset ALL user balances to 0. This cannot be undone!</Text>
          <TouchableOpacity onPress={handleFactoryReset} style={styles.mb12}>
            <LinearGradient colors={['#FF6B6B', '#FF4444']} style={styles.dangerButton}>
              <Ionicons name="nuclear" size={20} color="#FFF" />
              <Text style={styles.dangerButtonText}>Factory Reset All Accounts</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAdInspector}>
            <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.dangerButton}>
              <Ionicons name="search" size={20} color="#FFF" />
              <Text style={styles.dangerButtonText}>Open Ad Inspector</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* User Management */}
        <LinearGradient colors={['#2a2a2a', '#1a1a1a']} style={styles.section}>
          <Text style={styles.sectionTitle}>User Management</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput style={styles.searchInput} placeholder="Search users..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} />
          </View>
          {filteredUsers.map((user, index) => (
            <View key={user.id || index} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name || 'No Name'}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userBalance}>Balance: ₿ {(user.balance || 0).toFixed(12)}</Text>
                <Text style={styles.userMiners}>Active Miners: {user.active_miners || 0}</Text>
                {user.wallet_status && (
                  <Text style={styles.userWallet}>Wallet: {user.wallet_status}{user.btc_address ? ` (${user.btc_address.substring(0, 12)}...)` : ''}</Text>
                )}
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity onPress={() => showGiveBtcModal(user.id, user.email)} style={styles.userActionBtn}>
                  <LinearGradient colors={['#FFD700', '#FFC000']} style={styles.gradientBtn}>
                    <Text style={styles.gradientBtnText}>BTC</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => showSetAddrModal(user.id)} style={styles.userActionBtn}>
                  <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.gradientBtn}>
                    <Text style={styles.gradientBtnText}>Addr</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleResetUser(user.id, user.email)} style={styles.userActionBtn}>
                  <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.gradientBtn}>
                    <Text style={styles.gradientBtnText}>Reset</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteUser(user.id, user.email)} style={styles.userActionBtn}>
                  <LinearGradient colors={['#FF6B6B', '#FF4444']} style={styles.gradientBtn}>
                    <Text style={styles.gradientBtnText}>Delete</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </LinearGradient>
      </ScrollView>

      {/* Give BTC Modal */}
      <Modal visible={giveBtcModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adjust Balance</Text>
            <Text style={styles.modalSubtitle}>{giveBtcModal.userEmail}</Text>
            <View style={styles.operationRow}>
              {['add', 'remove', 'set'].map(op => (
                <TouchableOpacity key={op} style={[styles.operationBtn, giveBtcModal.operation === op && styles.operationBtnActive]} onPress={() => setGiveBtcModal({ ...giveBtcModal, operation: op })}>
                  <Text style={[styles.operationBtnText, giveBtcModal.operation === op && styles.operationBtnTextActive]}>{op.charAt(0).toUpperCase() + op.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.modalInput} placeholder="Amount (BTC)" placeholderTextColor="#666" value={giveBtcModal.amount} onChangeText={t => setGiveBtcModal({ ...giveBtcModal, amount: t })} keyboardType="decimal-pad" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setGiveBtcModal({ visible: false, userId: '', userEmail: '', amount: '', operation: 'add' })}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmGiveBtc}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={rejectModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Address Change</Text>
            <TextInput style={[styles.modalInput, styles.modalTextArea]} placeholder="Reason for rejection..." placeholderTextColor="#666" value={rejectModal.reason} onChangeText={t => setRejectModal({ ...rejectModal, reason: t })} multiline numberOfLines={3} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectModal({ visible: false, userId: '', reason: '' })}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmRejectAddressChange}>
                <Text style={styles.modalConfirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Set Address Modal */}
      <Modal visible={setAddrModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Wallet Address</Text>
            <TextInput style={styles.modalInput} placeholder="Bitcoin Address" placeholderTextColor="#666" value={setAddrModal.address} onChangeText={t => setSetAddrModal({ ...setAddrModal, address: t })} autoCapitalize="none" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSetAddrModal({ visible: false, userId: '', address: '' })}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmSetAddress}>
                <Text style={styles.modalConfirmText}>Set Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50 },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFD700' },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'space-between' },
  statCard: { width: '48%', padding: 20, borderRadius: 15, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#FFD700' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#FFF', marginTop: 10 },
  statLabel: { fontSize: 12, color: '#AAA', marginTop: 5 },
  section: { margin: 15, padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#FFD700' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFD700', marginBottom: 15 },
  pendingCard: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  pendingInfo: { flex: 1 },
  pendingEmail: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  pendingAddress: { color: '#FFD700', fontSize: 12, marginTop: 4, fontFamily: 'monospace' },
  pendingAddressSmall: { color: '#AAA', fontSize: 11, marginTop: 2, fontFamily: 'monospace' },
  pendingActions: { flexDirection: 'column', gap: 8 },
  approveButton: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, gap: 5 },
  smallActionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  broadcastInput: { backgroundColor: '#1a1a1a', color: '#FFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', minHeight: 100, textAlignVertical: 'top', marginBottom: 15 },
  broadcastButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 10, gap: 8 },
  broadcastButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  warningText: { color: '#FF6B6B', fontSize: 14, marginBottom: 15, lineHeight: 20 },
  mb12: { marginBottom: 12 },
  dangerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 12 },
  dangerButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#333', padding: 12, marginBottom: 15 },
  searchInput: { flex: 1, color: '#FFF', marginLeft: 10, fontSize: 16 },
  userCard: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  userInfo: { marginBottom: 10 },
  userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  userEmail: { color: '#AAA', fontSize: 14, marginTop: 2 },
  userBalance: { color: '#FFD700', fontSize: 14, marginTop: 5 },
  userMiners: { color: '#AAA', fontSize: 12, marginTop: 2 },
  userWallet: { color: '#2196F3', fontSize: 12, marginTop: 2 },
  userActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  userActionBtn: { borderRadius: 8, overflow: 'hidden' },
  gradientBtn: { paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', borderRadius: 8 },
  gradientBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  modalContent: { width: '100%', backgroundColor: '#2a2a2a', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#FFD700' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFD700', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#AAA', textAlign: 'center', marginBottom: 16 },
  operationRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  operationBtn: { flex: 1, backgroundColor: '#333', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginHorizontal: 4 },
  operationBtnActive: { backgroundColor: '#FFD700' },
  operationBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  operationBtnTextActive: { color: '#000' },
  modalInput: { backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, color: '#FFF', marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  modalTextArea: { minHeight: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  modalCancelBtn: { flex: 1, backgroundColor: '#333', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginRight: 10 },
  modalCancelText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  modalConfirmBtn: { flex: 1, backgroundColor: '#FFD700', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginLeft: 10 },
  modalConfirmText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
