import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email address.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      router.push({
        pathname: '/(auth)/otp',
        params: { email: email.trim().toLowerCase(), type: 'magiclink' },
      });
    } catch (err) {
      Alert.alert('Could not send OTP', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin() {
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email address.');
    if (!password) return Alert.alert('Required', 'Please enter your password.');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      // AuthContext detects the session and root _layout redirects to tabs
    } catch (err) {
      Alert.alert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to continue your streak.</Text>

          <View style={styles.form}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {usePassword && (
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}
          </View>

          {!usePassword ? (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Send OTP</Text>
              }
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
              onPress={handlePasswordLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>Log In</Text>
              }
            </Pressable>
          )}

          <Pressable
            style={styles.toggleBtn}
            onPress={() => setUsePassword(v => !v)}
          >
            <Text style={styles.toggleText}>
              {usePassword ? 'Use email OTP instead' : 'Use password instead'}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupLink}>
              New to Niyama Life?{' '}
              <Text style={styles.signupLinkBold}>Sign up</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  backBtn: { marginBottom: spacing.xl },
  backText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  form: { marginBottom: spacing.xl },
  fieldWrapper: { marginBottom: spacing.lg },
  fieldLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  btnPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: '#FFFFFF',
  },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.6 },
  toggleBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  toggleText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.primary,
  },
  signupLink: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  signupLinkBold: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
