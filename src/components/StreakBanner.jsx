import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, spacing, radius } from '../theme';
import { getStreakMessage, showStreakFlame } from '../config';

/**
 * Streak banner: current streak count + 7-day bar chart.
 *
 * Props:
 *   streak   — number (current consecutive days)
 *   weekData — [{ date, total_points, day_successful, perfect_day }] (7 items, oldest first)
 */
export default function StreakBanner({ streak = 0, weekData = [] }) {
  const message = getStreakMessage(streak);
  const showFlame = showStreakFlame(streak);

  // Normalise bar heights: max bar = 40px
  const maxPts = Math.max(...weekData.map(d => d?.total_points ?? 0), 1);
  const BAR_MAX_H = 40;

  function barColor(day) {
    if (!day) return colors.border;
    if (day.perfect_day) return colors.accent;
    if (day.day_successful) return colors.primary;
    if (day.total_points > 0) return colors.primaryLight;
    return colors.error + '55';
  }

  // Build 7-slot array aligned to today
  const slots = Array.from({ length: 7 }, (_, i) => weekData[i] ?? null);

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon=0 … Sun=6
  const todayJS = new Date().getDay(); // JS: 0=Sun, 1=Mon … 6=Sat
  const todayMon = (todayJS + 6) % 7;  // Convert to Mon-start: Mon=0 … Sun=6
  // Rotate labels so today (i=6) is always the rightmost bar
  const orderedLabels = Array.from({ length: 7 }, (_, i) => {
    const dayIndex = (todayMon - 6 + i + 7) % 7;
    return DAY_LABELS[dayIndex];
  });

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.streakLeft}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <View style={styles.streakMeta}>
            <Text style={styles.streakLabel}>
              {showFlame ? '🔥 ' : ''}{streak === 1 ? 'day streak' : 'day streak'}
            </Text>
            {message ? <Text style={styles.milestoneMsg}>{message}</Text> : null}
          </View>
        </View>

        {/* 7-day bar chart */}
        <View style={styles.chart}>
          {slots.map((day, i) => {
            const pts = day?.total_points ?? 0;
            const h = pts > 0 ? Math.max(4, Math.round((pts / maxPts) * BAR_MAX_H)) : 4;
            const isToday = i === 6;
            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: h, backgroundColor: barColor(day) },
                      isToday && styles.barToday,
                    ]}
                  />
                </View>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                  {orderedLabels[i]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <LegendDot color={colors.accent} label="Perfect" />
        <LegendDot color={colors.primary} label="Successful" />
        <LegendDot color={colors.error + '55'} label="Missed" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  streakNumber: {
    fontFamily: fonts.bold,
    fontSize: 44,
    color: colors.textPrimary,
    lineHeight: 48,
  },
  streakMeta: { paddingBottom: 6 },
  streakLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  milestoneMsg: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.accent,
    marginTop: 2,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barCol: { alignItems: 'center', gap: 4 },
  barTrack: {
    height: BAR_MAX_H + 4,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 16,
    borderRadius: 4,
    minHeight: 4,
  },
  barToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  dayLabelToday: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
});

const BAR_MAX_H = 40;
