import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/supabase';
import { getCustomHabitPointSlots, CUSTOM_HABIT_POINTS } from '../../src/config';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const EMOJI_OPTIONS = [
  '💪','🏃','🧘','📚','💧','🥗','🎯','🎨','🎵','🌿',
  '🛌','🚴','🏋️','🧠','❤️','🌞','✍️','🍎','🎸','🧹',
  '💰','🐕','🌱','⚽','🏊','🎭','🔬','✈️','🧗','🎲',
];

export default function CustomHabitsScreen() {
  const router = useRouter();
  const [habits, setHabits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('💪');
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState('free');

  // Fetch user's tier on mount
  useState(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('tier').eq('id', user.id).single().then(({ data }) => {
        if (data?.tier) setTier(data.tier);
      });
    });
  });

  const pointSlots = getCustomHabitPointSlots(tier);

  function addHabit() {
    if (!newName.trim()) return;
    setHabits(prev => [...prev, { id: Date.now().toString(), name: newName.trim(), emoji: newEmoji }]);
    setNewName('');
    setNewEmoji('💪');
    setShowModal(false);
  }

  function removeHabit(id) {
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  async function handleContinue() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (habits.length > 0) {
        const rows = habits.map((h, i) => ({
          user_id: user.id,
          name: h.name,
          emoji: h.emoji,
          sort_order: i,
        }));
        const { error } = await supabase.from('custom_habits').insert(rows);
        if (error) throw error;
      }

      router.push('/(onboarding)/8-notifications');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const earnCount = Math.min(habits.length, pointSlots);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '77%' }]} />
          </View>
          <Text style={styles.stepLabel}>7 of 9</Text>

          <Text style={styles.title}>Add personal habits</Text>
          <Text style={styles.subtitle}>Track anything that matters to you. Unlimited tracking, always free.</Text>

          {/* Tier badge */}
          <View style={styles.tierBadge}>
            {pointSlots > 0 ? (
              <Text style={styles.tierBadgeText}>
                ✨ Your {tier} plan: up to {pointSlots} custom habit{pointSlots > 1 ? 's' : ''} earn {CUSTOM_HABIT_POINTS} pts each
              </Text>
            ) : (
              <Text style={styles.tierBadgeText}>
                📊 Track unlimited habits — upgrade to Plus or Premium to earn points on them
              </Text>
            )}
          </View>

          {/* Habit list */}
          <View style={styles.habitList}>
            {habits.map((habit, index) => {
              const earnsPoints = index < pointSlots;
              return (
                <Swipeable
                  key={habit.id}
                  renderRightActions={() => (
                    <Pressable style={styles.deleteAction} onPress={() => removeHabit(habit.id)}>
                      <Text style={styles.deleteActionText}>Delete</Text>
                    </Pressable>
                  )}
                >
                  <View style={styles.habitRow}>
                    <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                    <Text style={styles.habitName}>{habit.name}</Text>
                    <Text style={[styles.habitPts, !earnsPoints && styles.habitPtsMuted]}>
                      {earnsPoints ? `${CUSTOM_HABIT_POINTS} pts` : '0 pts'}
                    </Text>
                  </View>
                </Swipeable>
              );
            })}

            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
              onPress={() => setShowModal(true)}
            >
              <Text style={styles.addBtnIcon}>+</Text>
              <Text style={styles.addBtnText}>Add a habit</Text>
            </Pressable>
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
              : <Text style={styles.btnPrimaryText}>{habits.length === 0 ? 'Skip for now' : 'Continue'}</Text>
            }
          </Pressable>
        </View>

        {/* Add habit modal */}
        <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
          <Pressable style={styles.modalBackdrop} onPress={() => setShowModal(false)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>New habit</Text>

              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="E.g. Read 20 pages"
                placeholderTextColor={colors.textMuted}
                autoFocus
                maxLength={40}
              />

              <Text style={styles.emojiLabel}>Pick an emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map(e => (
                  <Pressable
                    key={e}
                    style={[styles.emojiOption, newEmoji === e && styles.emojiOptionSelected]}
                    onPress={() => setNewEmoji(e)}
                  >
                    <Text style={styles.emojiOptionText}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.btnPrimary, !newName.trim() && styles.btnDisabled]}
                onPress={addHabit}
                disabled={!newName.trim()}
              >
                <Text style={styles.btnPrimaryText}>Add habit</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  progressBar: { height: 3, backgroundColor: colors.border, borderRadius: radius.full, marginBottom: spacing.md },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: radius.full },
  stepLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.xl, textAlign: 'right' },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xl, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 22 },
  tierBadge: {
    backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.primary + '40',
  },
  tierBadgeText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.primary, lineHeight: 20 },
  habitList: { gap: spacing.sm },
  habitRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
  },
  habitEmoji: { fontSize: 22 },
  habitName: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textPrimary },
  habitPts: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.primary },
  habitPtsMuted: { color: colors.textMuted },
  deleteAction: {
    backgroundColor: colors.error, borderRadius: radius.md, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: spacing.xl, marginLeft: spacing.sm,
  },
  deleteActionText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary,
    borderStyle: 'dashed', paddingVertical: spacing.md, gap: spacing.sm,
  },
  addBtnPressed: { opacity: 0.7 },
  addBtnIcon: { fontFamily: fonts.bold, fontSize: 20, color: colors.primary },
  addBtnText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.primary },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.background },
  btnPrimary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF' },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: colors.border, borderRadius: radius.full,
    alignSelf: 'center', marginBottom: spacing.xl,
  },
  modalTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.lg },
  modalInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textPrimary,
    backgroundColor: colors.card, marginBottom: spacing.xl,
  },
  emojiLabel: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  emojiOption: {
    width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card,
  },
  emojiOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  emojiOptionText: { fontSize: 22 },
});
