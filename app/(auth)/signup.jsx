import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import NiyamaIcon from '../../src/components/NiyamaIcon';

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [useOtp, setUseOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!fullName.trim()) return Alert.alert('Required', 'Please enter your full name.');
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email address.');
    if (!phone.trim()) return Alert.alert('Required', 'Please enter your phone number.');
    if (!useOtp && !password) return Alert.alert('Required', 'Please enter a password or switch to OTP sign-up.');

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: useOtp ? crypto.randomUUID() : password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) throw error;

      // Supabase sends a 6-digit OTP to the email for verification
      router.push({
        pathname: '/(auth)/otp',
        params: { email: email.trim().toLowerCase(), type: 'signup' },
      });
    } catch (err) {
      Alert.alert('Sign-up failed', err.message);
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

          <View style={styles.iconRow}>
            <NiyamaIcon size={80} />
          </View>

          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join Niyama Life and start building daily discipline.</Text>

          <View style={styles.form}>
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Sahil Inamdar"
              autoComplete="name"
              textContentType="name"
            />
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
            />
            <Field
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />

            {!useOtp && (
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
            )}

            <Pressable
              style={styles.otpToggle}
              onPress={() => setUseOtp(v => !v)}
            >
              <View style={[styles.checkbox, useOtp && styles.checkboxActive]}>
                {useOtp && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.otpToggleLabel}>Sign up with email OTP instead of password</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>Create Account</Text>
            }
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>Already have an account? <Text style={styles.loginLinkBold}>Log in</Text></Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...inputProps }) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput style={fieldStyles.input} placeholderTextColor={colors.textMuted} {...inputProps} />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: {
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
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  backBtn: { marginBottom: spacing.lg },
  iconRow: { alignItems: 'center', marginBottom: spacing.xl },
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
    lineHeight: 22,
  },
  form: { marginBottom: spacing.xl },
  otpToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  otpToggleLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  btnPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: '#FFFFFF',
  },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.6 },
  loginLink: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loginLinkBold: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
