import React, { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

export default function SimpleResetPasswordScreen() {
  const { token } = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    setMessage('Processing...');
    setIsLoading(true);

    if (!newPassword.trim()) {
      setMessage('Please enter a new password');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!token) {
      setMessage('Invalid reset token. Please request a new password reset.');
      setIsLoading(false);
      return;
    }

    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (!backendUrl) {
        Alert.alert('Error', 'Backend URL not configured');
        setIsLoading(false);
        return;
      }
      
      const url = `${backendUrl}/api/auth/reset-password`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ Password reset successful! You can now log in with your new password.');
        setTimeout(() => {
          router.replace('/');
        }, 2000);
      } else {
        setMessage(`❌ Error: ${data.detail || 'Failed to reset password'}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        backgroundColor: '#000', 
        color: '#fff', 
        minHeight: '100vh' 
      }}>
        <h1>Invalid Reset Link</h1>
        <p>This password reset link is invalid or expired.</p>
        <button 
          onClick={() => router.replace('/')}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#FFD700', 
            color: '#000', 
            border: 'none', 
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '400px', 
      margin: '0 auto', 
      backgroundColor: '#000', 
      color: '#fff', 
      minHeight: '100vh' 
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#FFD700' }}>🔑 Reset Password</h1>
        <p>Enter your new password below</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div style={{ marginBottom: '20px' }}>
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#333',
              border: '1px solid #555',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px'
            }}
            disabled={isLoading}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#333',
              border: '1px solid #555',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px'
            }}
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: isLoading ? '#666' : '#FFD700',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            marginBottom: '20px'
          }}
        >
          {isLoading ? 'Processing...' : 'Reset Password'}
        </button>
      </form>

      {message && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: message.includes('✅') ? '#1B5E20' : '#B71C1C',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <button 
          onClick={() => router.replace('/')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#FFD700', 
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          ← Back to Login
        </button>
      </div>

      <div style={{ 
        textAlign: 'center', 
        marginTop: '20px', 
        fontSize: '12px', 
        color: '#4CAF50' 
      }}>
        🔒 Your password will be encrypted and stored securely
      </div>
    </div>
  );
}