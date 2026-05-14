import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function OtpScreen() {
  const router = useRouter();
  const { email, type } = useLocalSearchParams();

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(v => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  function handleDigitChange(text, index) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when last digit is filled
    if (digit && index === CODE_LENGTH - 1) {
      const code = [...next].join('');
      if (code.length === CODE_LENGTH) verifyCode(code);
    }
  }

  function handleKeyPress(e, index) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function verifyCode(code) {
    const fullCode = code ?? digits.join('');
    if (fullCode.length < CODE_LENGTH) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: fullCode,
        type: type === 'signup' ? 'signup' : 'email',
      });
      if (error) throw error;
      // AuthContext + root _layout handles redirect to onboarding or tabs
    } catch (err) {
      Alert.alert('Invalid code', err.message ?? 'Please check the code and try again.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setResendCooldown(RESEND_COOLDOWN);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      Alert.alert('Could not resend', err.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>

        <View style={styles.codeRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={r => { inputRefs.current[i] = r; }}
              style={[styles.digitBox, digit && styles.digitBoxFilled]}
              value={digit}
              onChangeText={text => handleDigitChange(text, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              textContentType="oneTimeCode"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        {loading && (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        )}

        <Pressable
          style={({ pressed }) => [
            styles.btnPrimary,
            pressed && styles.btnPressed,
            loading && styles.btnDisabled,
          ]}
          onPress={() => verifyCode()}
          disabled={loading || digits.join('').length < CODE_LENGTH}
        >
          <Text style={styles.btnPrimaryText}>Verify</Text>
        </Pressable>

        <Pressable
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={resendCooldown > 0 || resending}
        >
          {resending ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.resendText, resendCooldown > 0 && styles.resendMuted]}>
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend code'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  backBtn: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.primary,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.section,
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
    lineHeight: 22,
    marginBottom: spacing.xxl * 1.5,
  },
  emailHighlight: {
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  digitBox: {
    width: 48,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },
  digitBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  spinner: { marginBottom: spacing.lg },
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
  btnDisabled: { opacity: 0.5 },
  resendBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  resendText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.primary,
  },
  resendMuted: {
    color: colors.textMuted,
  },
});
