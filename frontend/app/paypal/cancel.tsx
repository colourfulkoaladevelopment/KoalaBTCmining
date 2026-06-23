import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Deep-link landing route for koala-mining://paypal/cancel
export default function PaypalCancel() {
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem('paypal_payment_result', 'cancel');
      } catch (e) {}
      router.replace('/');
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.text}>Returning to app...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#FFD700', marginTop: 16, fontSize: 16, fontWeight: '600' },
});
