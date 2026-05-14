import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { isMinorUser } from '../../src/config';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const GENDER_OPTIONS = ['Prefer not to say', 'Male', 'Female', 'Non-binary', 'Other'];
const REGION_OPTIONS = [
  { key: 'US', label: '🇺🇸  United States' },
  { key: 'IN', label: '🇮🇳  India' },
];

const MIN_DOB = new Date(new Date().setFullYear(new Date().getFullYear() - 100));
const MAX_DOB = new Date(new Date().setFullYear(new Date().getFullYear() - 10));
const DEFAULT_DOB = new Date(new Date().setFullYear(new Date().getFullYear() - 25));

export default function PersonalScreen() {
  const router = useRouter();
  const [dob, setDob] = useState(DEFAULT_DOB);
  const [showPicker, setShowPicker] = useState(false);
  const [gender, setGender] = useState('Prefer not to say');
  const [region, setRegion] = useState('US');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    const minor = isMinorUser(dob.toISOString());

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        date_of_birth: dob.toISOString().split('T')[0],
        is_minor: minor,
        gender: gender === 'Prefer not to say' ? null : gender,
        region,
      });
      if (error) throw error;

      if (minor) {
        Alert.alert(
          'Age notice',
          'You must be 18 or older to earn and redeem rewards. Your habits and streak will still be tracked.',
          [{ text: 'Continue', onPress: () => router.push('/(onboarding)/4-healthkit') }]
        );
      } else {
        router.push('/(onboarding)/4-healthkit');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const dobLabel = dob.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '33%' }]} />
        </View>
        <Text style={styles.stepLabel}>3 of 9</Text>

        <Text style={styles.title}>A little about you</Text>
        <Text style={styles.subtitle}>This personalises your experience and verifies your eligibility for rewards.</Text>

        {/* Date of birth */}
        <Text style={styles.fieldLabel}>Date of birth</Text>
        <Pressable style={styles.selectBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.selectBtnText}>{dobLabel}</Text>
          <Text style={styles.selectChevron}>▾</Text>
        </Pressable>

        {showPicker && (
          <DateTimePicker
            value={dob}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={MIN_DOB}
            maximumDate={MAX_DOB}
            onChange={(_, date) => {
              setShowPicker(Platform.OS === 'ios');
              if (date) setDob(date);
            }}
          />
        )}
        {Platform.OS === 'android' && showPicker === false && null}

        {isMinorUser(dob.toISOString()) && (
          <View style={styles.minorNotice}>
            <Text style={styles.minorNoticeText}>
              ⚠️ Users under 18 can track habits and streaks but cannot earn or redeem rewards.
            </Text>
          </View>
        )}

        {/* Gender (optional) */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.xl }]}>
          Gender <Text style={styles.optionalTag}>(optional)</Text>
        </Text>
        <View style={styles.optionGroup}>
          {GENDER_OPTIONS.map(g => (
            <Pressable
              key={g}
              style={[styles.optionPill, gender === g && styles.optionPillActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.optionPillText, gender === g && styles.optionPillTextActive]}>
                {g}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Region */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.xl }]}>Region</Text>
        <Text style={styles.fieldHint}>Determines your currency and pricing.</Text>
        <View style={styles.regionGroup}>
          {REGION_OPTIONS.map(r => (
            <Pressable
              key={r.key}
              style={[styles.regionCard, region === r.key && styles.regionCardActive]}
              onPress={() => setRegion(r.key)}
            >
              <Text style={styles.regionLabel}>{r.label}</Text>
              {region === r.key && (
                <View style={styles.regionCheck}>
                  <Text style={styles.regionCheckMark}>✓</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

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
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  progressBar: {
    height: 3, backgroundColor: colors.border, borderRadius: radius.full, marginBottom: spacing.md,
  },
  progressFill: {
    height: 3, backgroundColor: colors.primary, borderRadius: radius.full,
  },
  stepLabel: {
    fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted,
    marginBottom: spacing.xl, textAlign: 'right',
  },
  title: {
    fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary,
    lineHeight: 22, marginBottom: spacing.xxl,
  },
  fieldLabel: {
    fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm,
  },
  fieldHint: {
    fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted,
    marginBottom: spacing.sm, marginTop: -spacing.xs,
  },
  optionalTag: {
    fontFamily: fonts.regular, color: colors.textMuted, textTransform: 'none', letterSpacing: 0,
  },
  selectBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    backgroundColor: colors.card,
  },
  selectBtnText: {
    fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textPrimary,
  },
  selectChevron: {
    fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted,
  },
  minorNotice: {
    backgroundColor: '#FFF8E6', borderRadius: radius.sm, padding: spacing.md,
    marginTop: spacing.sm, borderWidth: 1, borderColor: '#F0D080',
  },
  minorNoticeText: {
    fontFamily: fonts.regular, fontSize: fontSizes.base, color: '#8A6A00', lineHeight: 20,
  },
  optionGroup: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  optionPill: {
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  optionPillActive: {
    backgroundColor: colors.primaryLight, borderColor: colors.primary,
  },
  optionPillText: {
    fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textSecondary,
  },
  optionPillTextActive: {
    color: colors.primary,
  },
  regionGroup: { gap: spacing.md },
  regionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    backgroundColor: colors.card,
  },
  regionCardActive: {
    borderColor: colors.primary, backgroundColor: colors.primaryLight,
  },
  regionLabel: {
    fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textPrimary,
  },
  regionCheck: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  regionCheckMark: {
    color: '#fff', fontSize: 12, fontFamily: fonts.bold,
  },
  footer: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
    paddingTop: spacing.md, backgroundColor: colors.background,
  },
  btnPrimary: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.6 },
});
