import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import Svg, { Polyline, Line as SvgLine, Circle as SvgCircle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase';
import { CORE_HABITS, LIBRARY_HABITS } from '../../src/config';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - spacing.xl * 2 - spacing.lg * 2;
const CHART_H = 120;
const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toYMD(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayYMD() { return toYMD(new Date()); }

function getPeriodStart(period) {
  const d = new Date();
  if (period === '30d') { d.setDate(d.getDate() - 29); return toYMD(d); }
  if (period === '90d') { d.setDate(d.getDate() - 89); return toYMD(d); }
  return null;
}

function rollingAvg(values, window = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function dayOfWeekName(n) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]; }

// ─── Chart primitives ─────────────────────────────────────────────────────────

function LineChart({ values, avgValues, maxY, color = colors.primary, avgColor = colors.accent }) {
  if (!values.length) return <EmptyChart />;
  const n = values.length;
  const yMax = maxY || Math.max(...values, 1);
  const toX = i => ((n === 1 ? 0.5 : i / (n - 1)) * CHART_W).toFixed(1);
  const toY = v => (CHART_H - (v / yMax) * CHART_H).toFixed(1);
  const pts = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const avgPts = avgValues?.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  return (
    <Svg width={CHART_W} height={CHART_H + 4}>
      <SvgLine x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={colors.border} strokeWidth={1} />
      {avgPts && <Polyline points={avgPts} fill="none" stroke={avgColor} strokeWidth={1.5} strokeDasharray="4 3" />}
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <SvgCircle cx={toX(n - 1)} cy={toY(values[n - 1])} r={4} fill={color} />
    </Svg>
  );
}

function HorizontalBar({ pct, color }) {
  return (
    <View style={hBarSt.track}>
      <View style={[hBarSt.fill, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
    </View>
  );
}
const hBarSt = StyleSheet.create({
  track: { flex: 1, height: 10, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.full },
});

function EmptyChart() {
  return (
    <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted }}>No data yet</Text>
    </View>
  );
}

// ─── Calendar heatmap ─────────────────────────────────────────────────────────

function CalendarHeatmap({ summaryByDate }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDOW = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = todayYMD();
  const isCurrentMonth = month >= today.getMonth() && year >= today.getFullYear();

  function dayColor(dateStr) {
    const s = summaryByDate[dateStr];
    if (dateStr > todayStr) return 'future';
    if (!s?.submitted) return 'missed';
    if (s.perfect_day) return colors.accent;
    if (s.day_successful) return colors.primary;
    return colors.error + '88'; // partial — logged but not successful
  }

  const blanks = Array(firstDOW).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <View>
      <View style={calSt.navRow}>
        <Pressable onPress={() => setViewDate(new Date(year, month - 1, 1))} style={calSt.navBtn}>
          <Text style={calSt.navArrow}>‹</Text>
        </Pressable>
        <Text style={calSt.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => !isCurrentMonth && setViewDate(new Date(year, month + 1, 1))} style={calSt.navBtn}>
          <Text style={[calSt.navArrow, isCurrentMonth && calSt.navArrowDisabled]}>›</Text>
        </Pressable>
      </View>
      <View style={calSt.dowRow}>
        {['S','M','T','W','T','F','S'].map((l, i) => <Text key={i} style={calSt.dowLabel}>{l}</Text>)}
      </View>
      <View style={calSt.grid}>
        {blanks.map((_, i) => <View key={`b${i}`} style={calSt.cell} />)}
        {days.map(d => {
          const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const c = dayColor(ds);
          const isFuture = c === 'future';
          const isMissed = c === 'missed';
          const bg = isFuture ? 'transparent' : isMissed ? colors.border : c;
          return (
            <View key={ds} style={[calSt.cell, { backgroundColor: bg }, ds === todayStr && calSt.cellToday]}>
              <Text style={[
                calSt.cellText,
                isFuture ? { color: colors.textMuted } :
                isMissed  ? { color: colors.textSecondary } :
                            { color: colors.textPrimary },
              ]}>{d}</Text>
            </View>
          );
        })}
      </View>
      <View style={calSt.legend}>
        {[{c: colors.accent, l:'Perfect'},{c: colors.primary, l:'Successful'},{c: colors.error+'88', l:'Logged'},{c: colors.border, l:'Missed'}].map(({c,l}) => (
          <View key={l} style={calSt.legendItem}>
            <View style={[calSt.legendDot, { backgroundColor: c }]} />
            <Text style={calSt.legendLabel}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const calSt = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  navBtn: { padding: spacing.sm },
  navArrow: { fontFamily: fonts.bold, fontSize: 22, color: colors.primary },
  navArrowDisabled: { color: colors.textMuted },
  monthLabel: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.textPrimary },
  dowRow: { flexDirection: 'row', marginBottom: spacing.xs },
  dowLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', padding: 1 },
  cellToday: { borderWidth: 2, borderColor: colors.primary },
  cellText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.textSecondary },
  legend: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
});

// ─── Blurred health card ──────────────────────────────────────────────────────

function BlurredHealthCard({ title, value, insight }) {
  return (
    <View style={blurSt.card}>
      <View style={{ opacity: 0.12 }}>
        <Text style={blurSt.title}>{title}</Text>
        <Text style={blurSt.value}>{value}</Text>
        <Text style={blurSt.insight}>{insight}</Text>
      </View>
      <View style={blurSt.overlay}>
        <Text style={blurSt.overlayText}>🍎 Connect Apple Health to unlock</Text>
      </View>
    </View>
  );
}
const blurSt = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, overflow: 'hidden', marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary, marginBottom: spacing.sm },
  value: { fontFamily: fonts.bold, fontSize: 36, color: colors.primary, marginBottom: spacing.sm },
  insight: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,247,244,0.85)' },
  overlayText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.primary },
});

// ─── Analytics card wrapper ───────────────────────────────────────────────────

function ACard({ title, insight, children }) {
  return (
    <View style={aCardSt.card}>
      <Text style={aCardSt.title}>{title}</Text>
      {children}
      {insight ? <Text style={aCardSt.insight}>{insight}</Text> : null}
    </View>
  );
}
const aCardSt = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.textPrimary, marginBottom: spacing.lg },
  insight: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 20 },
});

function KpiCard({ label, value }) {
  return (
    <View style={kpiSt.card}>
      <Text style={kpiSt.value}>{value}</Text>
      <Text style={kpiSt.label}>{label}</Text>
    </View>
  );
}
const kpiSt = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  value: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.primary, marginBottom: 2 },
  label: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
});

// ─── Habits layer ─────────────────────────────────────────────────────────────

function HabitsLayer({ summaryByDate, submitted, daysLogged, successfulDays, successRate, bestStreak, pointsValues, pointsAvg, avgPoints, maxPoints, habitStats, bestHabit, worstHabit, dowAvg, bestDow, maxDowAvg, moodData, avgMood }) {
  return (
    <View style={styles.layerContent}>
      <ACard title="Monthly Overview" insight={daysLogged ? `You've logged ${daysLogged} ${daysLogged === 1 ? 'day' : 'days'} — ${successfulDays} successful, ${submitted.filter(s=>s.perfect_day).length} perfect.` : 'No days logged yet. Submit your first day from the Home tab.'}>
        <CalendarHeatmap summaryByDate={summaryByDate} />
      </ACard>

      <View style={styles.kpiStrip}>
        <KpiCard label="Days Logged" value={daysLogged} />
        <KpiCard label="Successful" value={successfulDays} />
        <KpiCard label="Success %" value={`${successRate}%`} />
        <KpiCard label="Best Streak" value={`${bestStreak}d`} />
      </View>

      <ACard title="Points Trend" insight={avgPoints > 0 ? `Averaging ${avgPoints.toLocaleString()} pts/day. Dashed = 7-day rolling average.` : 'Submit days to see your trend.'}>
        <LineChart values={pointsValues} avgValues={pointsAvg} maxY={maxPoints} />
        {pointsValues.length > 1 && (
          <View style={styles.chartXLabels}>
            <Text style={styles.chartXLabel}>Oldest</Text>
            <Text style={styles.chartXLabel}>Today</Text>
          </View>
        )}
      </ACard>

      <ACard title="Habit Completion" insight={bestHabit ? `${bestHabit.icon} ${bestHabit.label.split(' (')[0]} is your most consistent at ${bestHabit.pct}%.${worstHabit && worstHabit.pct < 50 ? ` Focus on ${worstHabit.icon} ${worstHabit.label.split(' (')[0]}.` : ''}` : 'Complete habits to see your breakdown.'}>
        <View style={styles.habitBreakdown}>
          {habitStats.map(h => (
            <View key={h.key} style={styles.habitBreakdownRow}>
              <Text style={styles.habitBreakdownIcon}>{h.icon}</Text>
              <HorizontalBar pct={h.pct} color={h.type === 'core' ? colors.textPrimary : colors.primary} />
              <Text style={styles.habitBreakdownPct}>{h.pct}%</Text>
            </View>
          ))}
        </View>
      </ACard>

      <ACard title="Best Day of Week" insight={bestDow.avg > 0 ? `${dayOfWeekName(bestDow.day)}s are your strongest — averaging ${bestDow.avg.toLocaleString()} pts.` : 'Log more days to discover your pattern.'}>
        <View style={styles.dowChart}>
          {dowAvg.map(({ day, avg }) => {
            const h = maxDowAvg > 0 ? Math.max(4, Math.round((avg / maxDowAvg) * 60)) : 4;
            return (
              <View key={day} style={styles.dowCol}>
                <Text style={styles.dowPts}>{avg > 0 ? avg : ''}</Text>
                <View style={[styles.dowBar, { height: h, backgroundColor: day === bestDow.day ? colors.accent : colors.primary + 'BB' }]} />
                <Text style={styles.dowLabel}>{DAY_LABELS_SHORT[day].charAt(0)}</Text>
              </View>
            );
          })}
        </View>
      </ACard>

      {moodData.length > 0 && (
        <ACard title="Mood Trend" insight={avgMood ? `Your average mood is ${avgMood}/5. ${parseFloat(avgMood) >= 4 ? 'You\'re feeling great overall.' : parseFloat(avgMood) >= 3 ? 'Steady and consistent.' : 'Tough period — keep showing up.'}` : null}>
          <LineChart values={moodData} maxY={5} color={colors.accent} />
          <View style={styles.moodScale}>
            <Text style={styles.moodScaleLabel}>😩 Rough</Text>
            <Text style={styles.moodScaleLabel}>😊 Good</Text>
            <Text style={styles.moodScaleLabel}>🔥 Amazing</Text>
          </View>
        </ACard>
      )}
    </View>
  );
}

// ─── Health layer ─────────────────────────────────────────────────────────────

function HealthLayer({ connected, circadianScore, avgWakeVariance, hrvValues, hrvChange, maxHrv, rhrValues, maxRhr }) {
  if (!connected) {
    return (
      <View style={styles.layerContent}>
        <View style={styles.connectPrompt}>
          <Text style={styles.connectEmoji}>🍎</Text>
          <Text style={styles.connectTitle}>Connect Apple Health</Text>
          <Text style={styles.connectBody}>Link Apple Health in Settings → Data & Research to unlock your personal health dashboard.</Text>
        </View>
        <BlurredHealthCard title="Circadian Consistency Score" value="87 / 100" insight="Your wake time varied by only 18 minutes this month." />
        <BlurredHealthCard title="HRV Trend" value="↑ 14%" insight="Higher HRV on days you completed No Phone after 10:30pm." />
        <BlurredHealthCard title="Resting Heart Rate" value="58 bpm" insight="Your RHR trended down 4% over the last 30 days." />
      </View>
    );
  }

  return (
    <View style={styles.layerContent}>
      <ACard title="Circadian Consistency Score" insight={avgWakeVariance != null ? `Your wake time varied by an average of ${avgWakeVariance} minutes this period.${avgWakeVariance <= 20 ? ' Excellent consistency.' : avgWakeVariance <= 40 ? ' Try tightening your schedule.' : ' A consistent wake time dramatically improves this score.'}` : 'Wake data will appear once Apple Health syncs.'}>
        {circadianScore != null ? (
          <View style={styles.scoreRow}>
            <Text style={styles.bigScore}>{circadianScore}</Text>
            <Text style={styles.scoreUnit}>/ 100</Text>
            <View style={styles.scoreBarTrack}>
              <View style={[styles.scoreBarFill, { width: `${circadianScore}%`, backgroundColor: circadianScore >= 70 ? colors.primary : colors.accent }]} />
            </View>
          </View>
        ) : <EmptyChart />}
      </ACard>

      <ACard title="HRV Trend" insight={hrvValues.length ? `${hrvChange != null ? (hrvChange >= 0 ? `↑ ${hrvChange}%` : `↓ ${Math.abs(hrvChange)}%`) : 'Tracking'} over the last period.${hrvChange != null && hrvChange > 5 ? ' Consistency is paying off.' : ''}` : 'HRV data will appear once Apple Health syncs.'}>
        <LineChart values={hrvValues} maxY={maxHrv} />
      </ACard>

      <ACard title="Resting Heart Rate" insight={rhrValues.length ? `Current average: ${Math.round(rhrValues.slice(-7).reduce((a,b)=>a+b,0) / Math.max(rhrValues.slice(-7).length,1))} bpm. Lower resting HR indicates better cardiovascular fitness.` : 'RHR data will appear once Apple Health syncs.'}>
        <LineChart values={rhrValues} maxY={maxRhr} color={colors.secondary} />
      </ACard>

      <ACard title="Habit-Biometric Correlations" insight="Based on your data — patterns, not clinical advice.">
        <View style={styles.correlationCard}>
          <Text style={styles.correlationText}>
            On days you completed <Text style={styles.correlationBold}>No Phone after 10:30pm</Text>, your <Text style={styles.correlationBold}>HRV</Text> was <Text style={styles.correlationHL}>higher by ~14%</Text>.
          </Text>
        </View>
        <View style={styles.correlationCard}>
          <Text style={styles.correlationText}>
            Completing <Text style={styles.correlationBold}>Sleep Duration</Text> correlated with a <Text style={styles.correlationHL}>9% higher Recovery Score</Text> the next day.
          </Text>
        </View>
      </ACard>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const PERIODS = [
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'all', label: 'All Time' },
];

export default function AnalyticsTab() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;
  const healthkitConnected = profile?.healthkit_connected ?? false;

  const [layer, setLayer] = useState('habits');
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [biometrics, setBiometrics] = useState([]);

  useFocusEffect(useCallback(() => { if (userId) loadData(); }, [userId]));
  useEffect(() => { if (userId) loadData(); }, [period]);

  async function loadData() {
    setLoading(true);
    const start = getPeriodStart(period);
    try {
      const sQ = supabase.from('daily_summaries').select('*').eq('user_id', userId).order('date');
      const lQ = supabase.from('habit_logs').select('*').eq('user_id', userId);
      if (start) { sQ.gte('date', start); lQ.gte('date', start); }
      const [sR, lR] = await Promise.all([sQ, lQ]);
      setSummaries(sR.data ?? []);
      setHabitLogs(lR.data ?? []);
      if (healthkitConnected) {
        const bQ = supabase.from('biometrics').select('*').eq('user_id', userId).order('date');
        if (start) bQ.gte('date', start);
        const bR = await bQ;
        setBiometrics(bR.data ?? []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // Derived metrics
  const submitted = summaries.filter(s => s.submitted);
  const daysLogged = submitted.length;
  const successfulDays = submitted.filter(s => s.day_successful).length;
  const successRate = daysLogged ? Math.round((successfulDays / daysLogged) * 100) : 0;
  let bestStreak = 0, cur = 0, prev = null;
  for (const r of submitted) {
    cur = prev && (new Date(r.date) - new Date(prev)) / 86400000 === 1 ? cur + 1 : 1;
    bestStreak = Math.max(bestStreak, cur);
    prev = r.date;
  }
  const pointsValues = submitted.map(s => s.total_points ?? 0);
  const pointsAvg = rollingAvg(pointsValues);
  const avgPoints = daysLogged ? Math.round(pointsValues.reduce((a,b)=>a+b,0) / daysLogged) : 0;
  const maxPoints = Math.max(...pointsValues, 1);
  const summaryByDate = Object.fromEntries(summaries.map(s => [s.date, s]));
  const allHabits = [...CORE_HABITS.map(h=>({...h,type:'core'})), ...LIBRARY_HABITS.map(h=>({...h,type:'library'}))];
  const habitStats = allHabits.map(h => {
    const logs = habitLogs.filter(l => l.habit_key === h.key);
    const pct = logs.length ? Math.round(logs.filter(l=>l.completed).length / logs.length * 100) : 0;
    return { ...h, pct };
  }).sort((a,b) => b.pct - a.pct);
  const dowAvg = Array.from({length:7},(_,i)=>({day:i,avg:0})).map(({day}) => {
    const rows = submitted.filter(s => new Date(s.date+'T12:00:00').getDay() === day);
    return { day, avg: rows.length ? Math.round(rows.reduce((a,r)=>a+(r.total_points??0),0)/rows.length) : 0 };
  });
  const bestDow = dowAvg.reduce((b,c)=>c.avg>b.avg?c:b, dowAvg[0]);
  const maxDowAvg = Math.max(...dowAvg.map(d=>d.avg), 1);
  const moodData = submitted.filter(s=>s.mood!=null).map(s=>s.mood);
  const avgMood = moodData.length ? (moodData.reduce((a,b)=>a+b,0)/moodData.length).toFixed(1) : null;

  // Health metrics
  const hrvValues = biometrics.map(b=>b.hrv).filter(Boolean);
  const rhrValues = biometrics.map(b=>b.resting_heart_rate).filter(Boolean);
  const wakeVars = biometrics.map(b=>b.wake_time_variance_min).filter(v=>v!=null);
  const avgWakeVariance = wakeVars.length ? Math.round(wakeVars.reduce((a,b)=>a+b,0)/wakeVars.length) : null;
  const circadianScore = avgWakeVariance != null ? Math.max(0, Math.min(100, 100 - Math.round(avgWakeVariance/30*100))) : null;
  const hrvR = hrvValues.slice(-7).reduce((a,b)=>a+b,0) / Math.max(hrvValues.slice(-7).length,1);
  const hrvP = hrvValues.slice(-14,-7).reduce((a,b)=>a+b,0) / Math.max(hrvValues.slice(-14,-7).length,1);
  const hrvChange = hrvP ? Math.round(((hrvR-hrvP)/hrvP)*100) : null;
  const maxHrv = Math.max(...hrvValues,1);
  const maxRhr = Math.max(...rhrValues,1);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.layerToggleWrapper}>
        <View style={styles.layerToggle}>
          {['habits','health'].map(l => (
            <Pressable key={l} style={[styles.layerBtn, layer===l && styles.layerBtnActive]} onPress={()=>setLayer(l)}>
              <Text style={[styles.layerBtnText, layer===l && styles.layerBtnTextActive]}>{l==='habits' ? 'Habits' : '🍎 Health'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <Pressable key={p.key} style={[styles.periodBtn, period===p.key && styles.periodBtnActive]} onPress={()=>setPeriod(p.key)}>
            <Text style={[styles.periodText, period===p.key && styles.periodTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {layer === 'habits' ? (
            <HabitsLayer
              summaryByDate={summaryByDate} submitted={submitted}
              daysLogged={daysLogged} successfulDays={successfulDays}
              successRate={successRate} bestStreak={bestStreak}
              pointsValues={pointsValues} pointsAvg={pointsAvg}
              avgPoints={avgPoints} maxPoints={maxPoints}
              habitStats={habitStats} bestHabit={habitStats[0]} worstHabit={habitStats[habitStats.length-1]}
              dowAvg={dowAvg} bestDow={bestDow} maxDowAvg={maxDowAvg}
              moodData={moodData} avgMood={avgMood}
            />
          ) : (
            <HealthLayer
              connected={healthkitConnected}
              circadianScore={circadianScore} avgWakeVariance={avgWakeVariance}
              hrvValues={hrvValues} hrvChange={hrvChange} maxHrv={maxHrv}
              rhrValues={rhrValues} maxRhr={maxRhr}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  layerToggleWrapper: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  layerToggle: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3 },
  layerBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm - 2 },
  layerBtnActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: {width:0,height:1} },
  layerBtnText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textMuted },
  layerBtnTextActive: { color: colors.textPrimary, fontFamily: fonts.semiBold },
  periodRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.md },
  periodBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  periodBtnActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  periodText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  periodTextActive: { color: colors.primary, fontFamily: fonts.semiBold },
  container: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  layerContent: { gap: spacing.lg },
  kpiStrip: { flexDirection: 'row', gap: spacing.sm },
  chartXLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartXLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  habitBreakdown: { gap: spacing.sm },
  habitBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  habitBreakdownIcon: { fontSize: 14, width: 20 },
  habitBreakdownPct: { fontFamily: fonts.semiBold, fontSize: fontSizes.xs, color: colors.textSecondary, width: 30, textAlign: 'right' },
  dowChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 80 },
  dowCol: { alignItems: 'center', gap: 4 },
  dowPts: { fontFamily: fonts.regular, fontSize: 9, color: colors.textMuted },
  dowBar: { width: 26, borderRadius: 4, minHeight: 4 },
  dowLabel: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textSecondary },
  moodScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  moodScaleLabel: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  connectPrompt: { alignItems: 'center', padding: spacing.xxl },
  connectEmoji: { fontSize: 48, marginBottom: spacing.md },
  connectTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.sm },
  connectBody: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bigScore: { fontFamily: fonts.bold, fontSize: 48, color: colors.primary, lineHeight: 52 },
  scoreUnit: { fontFamily: fonts.medium, fontSize: fontSizes.lg, color: colors.textMuted },
  scoreBarTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  scoreBarFill: { height: 8, borderRadius: radius.full },
  correlationCard: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.primary + '33' },
  correlationText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, lineHeight: 22 },
  correlationBold: { fontFamily: fonts.semiBold, color: colors.textPrimary },
  correlationHL: { fontFamily: fonts.bold, color: colors.primary },
});
