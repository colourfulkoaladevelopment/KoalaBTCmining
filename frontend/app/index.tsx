import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay for UI
      
      const token = await AsyncStorage.getItem('session_token');
      
      if (token) {
        // Verify token with backend
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            // Token is valid, redirect to dashboard
            setAuthChecked(true);
            router.replace('/(tabs)/dashboard');
          } else {
            // Token is invalid, clear and go to auth
            await AsyncStorage.removeItem('session_token');
            setAuthChecked(true);
            router.replace('/auth');
          }
        } catch (error) {
          console.error('Auth verification error:', error);
          // Network error, still allow to auth screen
          setAuthChecked(true);
          router.replace('/auth');
        }
      } else {
        // No token, go to auth
        setAuthChecked(true);
        router.replace('/auth');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setAuthChecked(true);
      router.replace('/auth');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading screen while checking auth
  if (isLoading || !authChecked) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>₿</Text>
        <Text style={styles.title}>Bitcoin Mining</Text>
        <ActivityIndicator size="large" color="#FF9800" style={styles.loader} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // This component will be replaced by router navigation
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 60,
    color: '#FF9800',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 40,
  },
  loader: {
    marginBottom: 20,
  },
  loadingText: {
    color: '#AAA',
    fontSize: 16,
  },
});