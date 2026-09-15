import React, { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthScreen from './auth';

try {
  SplashScreen.preventAutoHideAsync();
} catch {
  // Splash screen may already be prevented or unavailable
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    ),
  ]);

export default function RootLayout() {
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    let mounted = true;

    async function prepare() {
      try {
        try {
          await withTimeout(
            Font.loadAsync({
              SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
            }),
            5000
          );
        } catch {
          // Font failed — system defaults will be used
        }

        let token: string | null = null;
        try {
          token = await withTimeout(
            AsyncStorage.getItem('session_token'),
            3000
          );
        } catch {
          token = null;
        }

        if (mounted) {
          setAuthState(token ? 'authenticated' : 'unauthenticated');
        }
      } catch {
        if (mounted) {
          setAuthState('unauthenticated');
        }
      } finally {
        if (mounted) {
          try {
            await SplashScreen.hideAsync();
          } catch {
            // Splash screen may already be hidden
          }
        }
      }
    }

    prepare();
    return () => {
      mounted = false;
    };
  }, []);

  if (authState === 'loading') {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <SafeAreaProvider>
        <AuthScreen onAuthSuccess={() => setAuthState('authenticated')} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
