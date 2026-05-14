import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

function buildDefaultWakeTime() {
  const d = new Date();
  d.setHours(6, 30, 0, 0);
  return d;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function WakeTimeScreen() {
  const router = useRouter();
  const [wakeTime, setWakeTime] = useState(buildDefaultWakeTime());
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Store as HH:MM string (24hr) for consistency
      const hh = String(wakeTime.getHours()).padStart(2, '0');
      const mm = String(wakeTime.getMinutes()).padStart(2, '0');
      await supabase.from('profiles').upsert({ id: user.id, wake_time: `${hh}:${mm}` });

      router.push('/(onboarding)/7-custom-habits');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '66%' }]} />
        </View>
        <Text style={styles.stepLabel}>6 of 9</Text>

        <Text style={styles.emoji}>⏰</Text>
        <Text style={styles.title}>Set your wake time</Text>
        <Text style={styles.subtitle}>
          We'll send your morning wake notification at this time to help anchor your circadian rhythm.
        </Text>

        {/* Time display */}
        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>{formatTime(wakeTime)}</Text>
        </View>

        {/* Native drum-roll picker */}
        <DateTimePicker
          value={wakeTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, time) => { if (time) setWakeTime(time); }}
          style={styles.picker}
          textColor={colors.textPrimary}
          themeVariant="light"
          minuteInterval={5}
        />

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Waking within 30 minutes of this time every day earns your Wake Consistency habit (100 pts).
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed, loading && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>Continue</Text>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  progressBar: { height: 3, backgroundColor: colors.border, borderRadius: radius.full, marginBottom: spacing.md },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: radius.full },
  stepLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.xl, textAlign: 'right' },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  timeDisplay: {
    alignItems: 'center', marginBottom: spacing.lg,
  },
  timeText: {
    fontFamily: fonts.bold, fontSize: 48, color: colors.primary, letterSpacing: -1,
  },
  picker: { width: '100%', height: 180 },
  infoCard: {
    backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.primary + '40', marginTop: spacing.xl,
  },
  infoText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.primary, lineHeight: 22 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.background },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.6 },
});
