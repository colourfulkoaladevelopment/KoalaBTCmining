import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      if (token) {
        // Verify token with backend
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          router.replace('/(tabs)/dashboard');
        } else {
          await AsyncStorage.removeItem('session_token');
          router.replace('/auth');
        }
      } else {
        router.replace('/auth');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/auth');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});