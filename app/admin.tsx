import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AdminPanel() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="lock-closed" size={64} color="#FF5722" />
        <Text style={styles.title}>Access Denied</Text>
        <Text style={styles.subtitle}>Access Denied: Production Simulation Mode Only</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FF5722', marginTop: 20 },
  subtitle: { fontSize: 16, color: '#AAA', textAlign: 'center', marginTop: 10 },
});
