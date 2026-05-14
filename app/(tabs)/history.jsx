import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import {
  ALL_FIXED_HABITS, CORE_HABITS, LIBRARY_HABITS,
  MOOD_OPTIONS, DB,
} from '../../src/config';
import VerifiedBadge from '../../src/components/VerifiedBadge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FILTERS = ['All', 'Successful', 'Perfect'];

// --------------------------------------------------------------------------
// Main screen
// --------------------------------------------------------------------------

export default function HistoryTab() {
  const { session } = useAuth();
  const [summaries, setSummaries] = useState([]);
  const [habitLogsByDate, setHabitLogsByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [expandedDate, setExpandedDate] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [session?.user?.id])
  );

  async function loadHistory() {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from(DB.tables.dailySummaries)
        .select('*')
        .eq(DB.dailySummaries.userId, session.user.id)
        .eq(DB.dailySummaries.submitted, true)
        .order(DB.dailySummaries.date, { ascending: false });
      setSummaries(data ?? []);
    } catch (_) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function loadHabitLogs(date) {
    if (habitLogsByDate[date] !== undefined) return;
    setLoadingLogs(date);
    try {
      const { data } = await supabase
        .from(DB.tables.habitLogs)
        .select('*')
        .eq(DB.habitLogs.userId, session.user.id)
        .eq(DB.habitLogs.date, date);
      setHabitLogsByDate(prev => ({ ...prev, [date]: data ?? [] }));
    } catch (_) {
      setHabitLogsByDate(prev => ({ ...prev, [date]: [] }));
    } finally {
      setLoadingLogs(null);
    }
  }

  function toggleExpand(date) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedDate === date) {
      setExpandedDate(null);
    } else {
      setExpandedDate(date);
      loadHabitLogs(date);
    }
  }

  const filtered = summaries.filter(s => {
    if (filter === 'Successful') return s[DB.dailySummaries.daySuccessful];
    if (filter === 'Perfect') return s[DB.dailySummaries.perfectDay];
    return true;
  });

  // Insight: days logged this month + current streak
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonth = todayStr.slice(0, 7);
  const daysThisMonth = summaries.filter(s => s.date?.startsWith(thisMonth)).length;

  let streak = 0;
  {
    const dates = summaries.map(s => s.date);
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let cursor = dates[0] === todayStr || dates[0] === yesterday ? dates[0] : null;
    if (cursor) {
      for (let i = 0; i < dates.length; i++) {
        const d = new Date(cursor);
        d.setDate(d.getDate() - i + (dates[0] === todayStr ? 0 : 0));
        const expected = new Date(Date.now() - i * 86400000 - (dates[0] === yesterday ? 86400000 : 0))
          .toISOString().split('T')[0];
        if (dates[i] === expected) streak++;
        else break;
      }
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>History</Text>
      </View>

      {!loading && summaries.length > 0 && (
        <View style={s.insightBanner}>
          <Text style={s.insightText}>
            {daysThisMonth} {daysThisMonth === 1 ? 'day' : 'days'} logged this month
            {streak > 1 ? `  ·  🔥 ${streak}-day streak` : ''}
          </Text>
        </View>
      )}

      <View style={s.filterBar}>
        {FILTERS.map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[s.filterPill, filter === f && s.filterPillActive]}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map(summary => (
            <DayCard
              key={summary.date}
              summary={summary}
              isExpanded={expandedDate === summary.date}
              onToggle={() => toggleExpand(summary.date)}
              habitLogs={habitLogsByDate[summary.date] ?? null}
              isLoadingLogs={loadingLogs === summary.date}
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --------------------------------------------------------------------------
// DayCard
// --------------------------------------------------------------------------

function DayCard({ summary, isExpanded, onToggle, habitLogs, isLoadingLogs }) {
  const moodOption = MOOD_OPTIONS.find(m => m.value === summary.mood);
  // Parse date at noon to avoid timezone-shifted day labels
  const date = new Date(summary.date + 'T12:00:00');
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const pts = (summary.total_points ?? 0).toLocaleString();
  const isPerfect = summary[DB.dailySummaries.perfectDay];
  const isSuccessful = summary[DB.dailySummaries.daySuccessful];

  return (
    <Pressable onPress={onToggle} style={[s.card, isExpanded && s.cardExpanded]}>
      {/* Header row */}
      <View style={s.cardHeader}>
        <View style={s.cardLeft}>
          <Text style={s.dateText}>{dateLabel}</Text>
          <View style={s.badgeRow}>
            {isPerfect && <StatusBadge label="Perfect" color={colors.accent} />}
            {!isPerfect && isSuccessful && <StatusBadge label="Successful" color={colors.primary} />}
          </View>
        </View>
        <View style={s.cardRight}>
          <Text style={s.pointsText}>{pts} pts</Text>
          <Text style={s.chevron}>{isExpanded ? '▲' : '▼'}</Text>
        </View>
      </View>

      {/* Collapsed preview strip */}
      {!isExpanded && (
        <View style={s.previewStrip}>
          {ALL_FIXED_HABITS.slice(0, 7).map(h => (
            <Text key={h.key} style={s.previewEmoji}>{h.icon}</Text>
          ))}
          {ALL_FIXED_HABITS.length > 7 && (
            <Text style={s.moreText}>+{ALL_FIXED_HABITS.length - 7}</Text>
          )}
          {moodOption && (
            <Text style={[s.previewEmoji, s.moodSpacer]}>{moodOption.emoji}</Text>
          )}
        </View>
      )}

      {/* Expanded detail */}
      {isExpanded && (
        <View style={s.expandedContent}>
          {isLoadingLogs ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : (
            <>
              <HabitSection label="Core Habits" habits={CORE_HABITS} logs={habitLogs} />
              <View style={s.divider} />
              <HabitSection label="Library Habits" habits={LIBRARY_HABITS} logs={habitLogs} />
              {moodOption && (
                <>
                  <View style={s.divider} />
                  <View style={s.moodRow}>
                    <Text style={s.moodSectionLabel}>Mood</Text>
                    <Text style={s.moodEmoji}>{moodOption.emoji}</Text>
                    <Text style={s.moodValueText}>{moodOption.label}</Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

// --------------------------------------------------------------------------
// HabitSection
// --------------------------------------------------------------------------

function HabitSection({ label, habits, logs }) {
  return (
    <View style={s.habitSection}>
      <Text style={s.habitSectionLabel}>{label}</Text>
      {habits.map(habit => {
        const log = logs?.find(l => l[DB.habitLogs.habitKey] === habit.key);
        const completed = log?.[DB.habitLogs.completed] ?? false;
        const verified = log?.[DB.habitLogs.verified] ?? false;

        let badgeType = null;
        if (completed) {
          if (habit.verificationMethod === 'healthkit' || verified) badgeType = 'verified';
          else if (habit.verificationMethod === 'confirmable') badgeType = 'confirmable';
          else badgeType = 'honour';
        }

        return (
          <View key={habit.key} style={s.habitDetailRow}>
            <Text style={[s.habitIcon, !completed && s.dimmed]}>{habit.icon}</Text>
            <Text
              style={[s.habitName, !completed && s.dimmed]}
              numberOfLines={1}
            >
              {habit.label}
            </Text>
            <View style={s.habitRight}>
              {completed && badgeType ? (
                <VerifiedBadge type={badgeType} />
              ) : (
                <Text style={s.skippedText}>Skipped</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function StatusBadge({ label, color }) {
  return (
    <View style={[s.statusBadge, { backgroundColor: color + '1A' }]}>
      <Text style={[s.statusBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function EmptyState({ filter }) {
  const config = {
    All:        { emoji: '📖', title: 'No days logged yet',      sub: 'Your submitted days will appear here.' },
    Successful: { emoji: '⭐', title: 'No successful days yet',  sub: 'Hit 2+ core and 3+ library habits in a day.' },
    Perfect:    { emoji: '🔥', title: 'No perfect days yet',     sub: 'Complete all 10 habits in a single day.' },
  };
  const { emoji, title, sub } = config[filter] ?? config.All;
  return (
    <View style={s.centered}>
      <Text style={s.emptyEmoji}>{emoji}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySub}>{sub}</Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },

  // Insight
  insightBanner: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  insightText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: 3,
  },
  filterPill: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  filterPillActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },

  // List
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
  },

  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardExpanded: {
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.md,
  },
  dateText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
  },
  pointsText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.primary,
    marginBottom: 4,
  },
  chevron: {
    fontSize: 10,
    color: colors.textMuted,
  },

  // Preview strip
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    flexWrap: 'nowrap',
  },
  previewEmoji: {
    fontSize: 18,
    marginRight: 4,
  },
  moodSpacer: {
    marginLeft: spacing.sm,
  },
  moreText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },

  // Expanded content
  expandedContent: {
    marginTop: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },

  // Habit section
  habitSection: {
    marginBottom: spacing.xs,
  },
  habitSectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  habitDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  habitIcon: {
    fontSize: 16,
    width: 24,
  },
  habitName: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    flex: 1,
    marginLeft: spacing.sm,
  },
  habitRight: {
    marginLeft: spacing.sm,
  },
  dimmed: {
    opacity: 0.35,
  },
  skippedText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },

  // Mood row
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  moodSectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: 48,
  },
  moodEmoji: {
    fontSize: 20,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  moodValueText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },

  // Empty state
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
