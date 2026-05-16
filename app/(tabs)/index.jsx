import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Modal, ActivityIndicator, Animated, Alert, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase';
import {
  CORE_HABITS, LIBRARY_HABITS,
  calculateDayPoints, isSuccessfulDay, isPerfectDay,
  getStepsPoints, getStepsLabel,
  getGreeting, TIERS,
} from '../../src/config';
import NiyamaIcon from '../../src/components/NiyamaIcon';
import { cancelStreakProtectionForToday, scheduleStreakProtection } from '../../src/notifications';
import HabitRow from '../../src/components/HabitRow';
import StreakBanner from '../../src/components/StreakBanner';
import MoodCheckIn from '../../src/components/MoodCheckIn';
import Confetti from '../../src/components/Confetti';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';

// HealthKit — iOS / EAS Build only
let AppleHealthKit = null;
if (Platform.OS === 'ios') {
  try { AppleHealthKit = require('react-native-health').default; } catch {}
}

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HomeTab() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;
  const tier = profile?.tier ?? 'free';
  const isMinor = profile?.is_minor ?? false;

  // Derive "Wake before HH:MM AM/PM" from profile.wake_time (stored as "HH:MM" or "HH:MM:SS")
  const wakeLabel = (() => {
    const t = profile?.wake_time;
    if (!t) return 'Wake Consistency';
    const [h, m] = t.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    return `Wake before ${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  })();

  // Habit state
  const [checkedCore, setCheckedCore] = useState(new Set());
  const [checkedLibrary, setCheckedLibrary] = useState(new Set());
  const [checkedCustom, setCheckedCustom] = useState(new Set());
  const [verifiedHabits, setVerifiedHabits] = useState(new Set());
  const [customHabits, setCustomHabits] = useState([]);
  const [steps, setSteps] = useState(0);

  // Day state
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Analytics
  const [streak, setStreak] = useState(0);
  const [weekData, setWeekData] = useState([]);

  // UI
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [loading, setLoading] = useState(true);

  // Photo upload (no_late_food, screen_time)
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [pendingPhotoHabit, setPendingPhotoHabit] = useState(null); // { key, type }
  const [photoUrls, setPhotoUrls] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Animations
  const submitSuccessAnim = useRef(new Animated.Value(0)).current;
  const submitBtnAnim = useRef(new Animated.Value(0)).current;

  // Confetti / toast
  const confettiFiredRef = useRef(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Full load on mount: restores checked-habit state from today's logs
  useEffect(() => {
    if (userId) loadTodayData();
  }, [userId]);

  // Lightweight refresh when returning to this tab (e.g. from Settings)
  // Only reloads custom habits — does not reset checked state or show a spinner
  useFocusEffect(
    useCallback(() => {
      if (userId) loadCustomHabits();
    }, [userId])
  );

  // Fire confetti + toast the first time total checked habits reaches 5
  const totalChecked = checkedCore.size + checkedLibrary.size + checkedCustom.size;
  useEffect(() => {
    if (totalChecked >= 5 && !confettiFiredRef.current && !submitted) {
      confettiFiredRef.current = true;
      setShowConfetti(true);
      setShowToast(true);
      Animated.sequence([
        Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setShowToast(false));
      setTimeout(() => setShowConfetti(false), 2500);
    }
  }, [totalChecked, submitted]);

  // Fetch only custom habits — called by useFocusEffect on every tab focus.
  // Does not touch checkedCustom so in-session check-marks are preserved.
  async function loadCustomHabits() {
    if (!userId) return;
    console.log('[loadCustomHabits] userId:', userId);
    const { data, error } = await supabase
      .from('custom_habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    console.log('[loadCustomHabits] data:', JSON.stringify(data));
    console.log('[loadCustomHabits] error:', JSON.stringify(error));
    if (!error) setCustomHabits(data ?? []);
  }

  async function loadTodayData() {
    setLoading(true);
    const today = getTodayDate();
    try {
      const [logsRes, summaryRes, weekRes, customRes] = await Promise.all([
        supabase.from('habit_logs').select('*').eq('user_id', userId).eq('date', today),
        supabase.from('daily_summaries').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
        supabase.from('daily_summaries')
          .select('date,total_points,day_successful,perfect_day')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(7),
        supabase.from('custom_habits').select('*').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: true }),
      ]);

      // Restore checked state from existing logs
      const logs = logsRes.data ?? [];
      setCheckedCore(new Set(logs.filter(l => l.completed && CORE_HABITS.find(h => h.key === l.habit_key)).map(l => l.habit_key)));
      setCheckedLibrary(new Set(logs.filter(l => l.completed && LIBRARY_HABITS.find(h => h.key === l.habit_key)).map(l => l.habit_key)));
      setVerifiedHabits(new Set(logs.filter(l => l.verified).map(l => l.habit_key)));

      // Custom habits
      const customs = customRes.data ?? [];
      setCustomHabits(customs);
      setCheckedCustom(new Set(logs.filter(l => l.completed && customs.find(c => c.id === l.habit_key)).map(l => l.habit_key)));

      // Submitted state
      const summary = summaryRes.data;
      if (summary?.submitted) {
        setSubmitted(true);
        setSubmittedData(summary);
        setSelectedMood(summary.mood ?? null);
        submitBtnAnim.setValue(1);
        confettiFiredRef.current = true;
      }

      // Suppress confetti if habits were already checked before this session
      const restoredCount =
        logs.filter(l => l.completed && CORE_HABITS.find(h => h.key === l.habit_key)).length +
        logs.filter(l => l.completed && LIBRARY_HABITS.find(h => h.key === l.habit_key)).length +
        logs.filter(l => l.completed && customs.find(c => c.id === l.habit_key)).length;
      if (restoredCount >= 5) confettiFiredRef.current = true;

      // Week data (reverse so oldest is first for chart)
      setWeekData((weekRes.data ?? []).reverse());

      // Streak: count consecutive submitted days ending today
      computeStreak(weekRes.data ?? []);

      // Steps from HealthKit
      if (profile?.healthkit_connected) fetchSteps();
    } catch (err) {
      console.error('loadTodayData', err);
    } finally {
      setLoading(false);
    }
  }

  function computeStreak(summaries) {
    // Simple local streak from fetched week data — full streak uses server RPC
    let s = 0;
    const sorted = [...summaries].sort((a, b) => b.date.localeCompare(a.date));
    const today = getTodayDate();
    for (const row of sorted) {
      if (row.date <= today && row.submitted) s++;
      else break;
    }
    setStreak(s);
  }

  function fetchSteps() {
    if (!AppleHealthKit) return;
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    AppleHealthKit.getStepCount(
      { date: start.toISOString(), includeManuallyAdded: false },
      (err, result) => { if (!err) setSteps(result?.value ?? 0); }
    );
  }

  const PHOTO_HABIT_KEYS = ['no_late_food', 'screen_time'];

  function toggleHabit(key, type) {
    if (submitted) return;
    const checkedSet = type === 'core' ? checkedCore : type === 'library' ? checkedLibrary : checkedCustom;

    // If unchecking, always allow without photo modal
    if (checkedSet.has(key)) {
      const setFn = type === 'core' ? setCheckedCore : type === 'library' ? setCheckedLibrary : setCheckedCustom;
      setFn(prev => { const n = new Set(prev); n.delete(key); return n; });
      return;
    }

    // Photo habits — show picker modal instead of direct toggle
    if (PHOTO_HABIT_KEYS.includes(key)) {
      setPendingPhotoHabit({ key, type });
      setShowPhotoModal(true);
      return;
    }

    const setFn = type === 'core' ? setCheckedCore : type === 'library' ? setCheckedLibrary : setCheckedCustom;
    setFn(prev => {
      const next = new Set(prev);
      next.add(key);
      if (type === 'core' || type === 'library') {
        const habit = [...CORE_HABITS, ...LIBRARY_HABITS].find(h => h.key === key);
        if (habit?.verificationMethod === 'healthkit' || habit?.verificationMethod === 'verified') {
          setTimeout(() => verifyWithHealthKit(key), 2000 + Math.random() * 1000);
        }
      }
      return next;
    });
  }

  async function handlePickPhoto(source) {
    if (!pendingPhotoHabit) return;
    setUploadingPhoto(true);
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.7, allowsEditing: true, aspect: [4, 3] });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7, allowsEditing: true, aspect: [4, 3] });
      }

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      const today = getTodayDate();
      const path = `${userId}/${today}/${pendingPhotoHabit.key}.jpg`;

      // Upload to Supabase Storage
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('habit-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('habit-photos').getPublicUrl(path);

      // Save URL and mark habit as checked
      setPhotoUrls(prev => ({ ...prev, [pendingPhotoHabit.key]: publicUrl }));
      const setFn = pendingPhotoHabit.type === 'library' ? setCheckedLibrary : setCheckedCore;
      setFn(prev => new Set([...prev, pendingPhotoHabit.key]));
      setShowPhotoModal(false);
      setPendingPhotoHabit(null);
    } catch (err) {
      Alert.alert('Upload failed', err.message ?? 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function verifyWithHealthKit(key) {
    if (!AppleHealthKit || !profile?.healthkit_connected) return;
    // In a full implementation, query the relevant HealthKit type.
    // For Phase 6, run the query and mark verified if data confirms.
    // Steps verification is already handled via live step count.
    if (key === 'steps' && steps >= 5000) {
      setVerifiedHabits(prev => new Set([...prev, key]));
    } else if (key === 'wake' || key === 'sleep' || key === 'stand' || key === 'no_phone') {
      // Query would go here; optimistically mark verified for HealthKit types
      setVerifiedHabits(prev => new Set([...prev, key]));
    }
  }

  // Live points calculation
  const pointsBreakdown = calculateDayPoints({
    tier,
    completedCoreKeys: Array.from(checkedCore),
    completedLibraryKeys: Array.from(checkedLibrary),
    customHabits: customHabits.map(h => ({ completed: checkedCustom.has(h.id) })),
    stepCount: steps,
    socialShared: false,
  });

  const tierData = TIERS[tier];
  const monthlyPts = profile?.monthly_points ?? 0;
  const capInPts = tierData.baseCap * 1000;
  const progressPct = Math.min((monthlyPts / capInPts) * 100, 100);

  const coreCheckedArr = Array.from(checkedCore);
  const libCheckedArr = Array.from(checkedLibrary);
  const successful = isSuccessfulDay(coreCheckedArr.length, libCheckedArr.length);
  const perfect = isPerfectDay(coreCheckedArr.length, libCheckedArr.length);

  const pointSlots = tierData.customHabitPointSlots;

  async function handleSubmit() {
    if (submitting || submitted) return;
    setSubmitting(true);
    const today = getTodayDate();
    try {
      // Build habit_logs rows for all habits
      const allLogs = [
        ...CORE_HABITS.map(h => ({
          user_id: userId, habit_key: h.key, date: today,
          completed: checkedCore.has(h.key), verified: verifiedHabits.has(h.key),
        })),
        ...LIBRARY_HABITS.map(h => ({
          user_id: userId, habit_key: h.key, date: today,
          completed: checkedLibrary.has(h.key), verified: verifiedHabits.has(h.key),
        })),
        ...customHabits.map(h => ({
          user_id: userId, habit_key: h.id, date: today,
          completed: checkedCustom.has(h.id), verified: false,
        })),
      ];

      const summaryRow = {
        user_id: userId, date: today,
        total_points: pointsBreakdown.total,
        day_successful: successful,
        perfect_day: perfect,
        submitted: true,
        mood: null,
      };

      const [logsResult, summaryResult, profileResult] = await Promise.all([
        supabase.from('habit_logs').upsert(allLogs, { onConflict: 'user_id,habit_key,date' }),
        supabase.from('daily_summaries').upsert(summaryRow, { onConflict: 'user_id,date' }),
        supabase.from('profiles').update({
          total_days_logged: (profile?.total_days_logged ?? 0) + 1,
          successful_days: (profile?.successful_days ?? 0) + (successful ? 1 : 0),
          monthly_points: monthlyPts + pointsBreakdown.total,
        }).eq('id', userId),
      ]);
      if (logsResult.error)    throw logsResult.error;
      if (summaryResult.error) throw summaryResult.error;
      if (profileResult.error) throw profileResult.error;

      setSubmitted(true);
      setSubmittedData(summaryRow);
      setStreak(s => s + 1);
      cancelStreakProtectionForToday(); // user submitted — no need for tonight's reminder
      scheduleStreakProtection();       // reschedule for tomorrow onward

      // Success animation
      Animated.sequence([
        Animated.timing(submitSuccessAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(400),
      ]).start();

      // Fire mood check-in
      setTimeout(() => setShowMoodModal(true), 600);
    } catch (err) {
      Alert.alert('Submit failed', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function animateSubmitToRed() {
    Animated.timing(submitBtnAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }

  async function handleMoodSelect(moodValue) {
    setSelectedMood(moodValue);
    const today = getTodayDate();
    const { error } = await supabase
      .from('daily_summaries')
      .update({ mood: moodValue })
      .eq('user_id', userId)
      .eq('date', today);
    if (error) console.error('mood save failed', error.message);
    setTimeout(() => {
      setShowMoodModal(false);
      animateSubmitToRed();
    }, 600);
  }

  const firstName = session?.user?.user_metadata?.full_name?.split(' ')[0] ?? '';

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Sage green header strip */}
        <View style={styles.headerStrip}>
          <NiyamaIcon size={32} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{getGreeting()}{firstName ? `, ${firstName}` : ''}</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
          {submitted && selectedMood ? (
            <Text style={styles.moodEmoji}>{['😩','😕','😐','😊','🔥'][selectedMood - 1]}</Text>
          ) : null}
        </View>

        {/* Streak Banner */}
        <StreakBanner streak={streak} weekData={weekData} />

        {/* Monthly Reward Card */}
        <View style={styles.rewardCard}>
          <View>
            <Text style={styles.rewardLabel}>Earned this month</Text>
            <Text style={styles.rewardAmount}>${(monthlyPts / 1000).toFixed(2)}</Text>
          </View>
          <View style={styles.rewardRight}>
            <Text style={styles.rewardCap}>of ${tierData.baseCap.toFixed(2)} cap</Text>
            <View style={styles.rewardProgressTrack}>
              <View style={[styles.rewardProgressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>
        </View>

        {/* Points Card */}
        <Pressable style={styles.pointsCard} onPress={() => setShowBreakdown(true)}>
          <View>
            <Text style={styles.pointsLabel}>Today's points</Text>
            <Text style={styles.pointsValue}>{pointsBreakdown.total.toLocaleString()}</Text>
          </View>
          <View style={styles.pointsRight}>
            <Text style={styles.capLabel}>${(monthlyPts / 1000).toFixed(2)} / ${tierData.baseCap.toFixed(2)} cap</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={styles.tapHint}>Tap for breakdown</Text>
          </View>
        </Pressable>

        {/* Successful Day Indicator */}
        <View style={[styles.successIndicator, successful && styles.successIndicatorGreen]}>
          <Text style={[styles.successText, successful && styles.successTextGreen]}>
            {coreCheckedArr.length}/3 core · {libCheckedArr.length}/7 library
            {successful ? '  ✓ Successful day!' : ''}
          </Text>
          {perfect ? <Text style={styles.perfectBadge}>⭐ Perfect day!</Text> : null}
        </View>

        {/* Core Habits */}
        <SectionLabel label="Core Habits" />
        <View style={styles.habitList}>
          {CORE_HABITS.map(habit => {
            const isSteps = habit.key === 'steps';
            const isWake  = habit.key === 'wake';
            const pts = isSteps ? getStepsPoints(steps) : habit.points;
            const displayHabit = isWake ? { ...habit, label: wakeLabel } : habit;
            return (
              <HabitRow
                key={habit.key}
                habit={displayHabit}
                checked={checkedCore.has(habit.key)}
                onToggle={() => toggleHabit(habit.key, 'core')}
                disabled={submitted}
                points={pts}
                subLabel={isSteps ? getStepsLabel(steps) : null}
                isVerified={verifiedHabits.has(habit.key)}
              />
            );
          })}
        </View>

        {/* Library Habits */}
        <SectionLabel label="Library Habits" />
        <View style={styles.habitList}>
          {LIBRARY_HABITS.map(habit => (
            <HabitRow
              key={habit.key}
              habit={habit}
              checked={checkedLibrary.has(habit.key)}
              onToggle={() => toggleHabit(habit.key, 'library')}
              disabled={submitted}
              points={habit.points}
              photoUrl={photoUrls[habit.key] ?? null}
            />
          ))}
        </View>

        {/* Custom Habits */}
        {customHabits.length > 0 && (
          <>
            <SectionLabel label="Personal Habits" />
            <View style={styles.habitList}>
              {customHabits.map((h, index) => {
                const earnsPoints = index < pointSlots;
                return (
                  <HabitRow
                    key={h.id}
                    habit={{ key: h.id, label: h.name, icon: h.emoji, verificationMethod: 'honour' }}
                    checked={checkedCustom.has(h.id)}
                    onToggle={() => toggleHabit(h.id, 'custom')}
                    disabled={submitted}
                    points={earnsPoints ? 25 : 0}
                    showUpgradeChip={!earnsPoints && (tier === 'free' || tier === 'basic')}
                  />
                );
              })}
            </View>
          </>
        )}

        {/* Submit section — button persists, colour transitions after mood modal */}
        <View style={styles.submitSection}>
          {submitted && (
            <View style={styles.submittedCard}>
              <Text style={styles.submittedEmoji}>🎉</Text>
              <Text style={styles.submittedTitle}>Day Submitted!</Text>
              <Text style={styles.submittedPoints}>{submittedData?.total_points?.toLocaleString() ?? pointsBreakdown.total} pts</Text>
              <View style={styles.submittedBadges}>
                {submittedData?.day_successful && (
                  <View style={styles.badge}><Text style={styles.badgeText}>✓ Successful Day</Text></View>
                )}
                {submittedData?.perfect_day && (
                  <View style={[styles.badge, styles.badgeGold]}><Text style={[styles.badgeText, styles.badgeTextGold]}>⭐ Perfect Day</Text></View>
                )}
              </View>
              {selectedMood ? (
                <Text style={styles.submittedMood}>
                  {['😩','😕','😐','😊','🔥'][selectedMood - 1]}
                  {' '}
                  {['Rough day','Not great','Okay','Good day','Amazing'][selectedMood - 1]}
                </Text>
              ) : null}
            </View>
          )}
          <Animated.View style={[styles.submitBtnWrap, { backgroundColor: submitBtnAnim.interpolate({ inputRange: [0, 1], outputRange: ['#4A7A68', '#C96A52'] }) }]}>
            <Pressable
              style={({ pressed }) => [styles.submitBtnInner, pressed && !submitted && styles.submitBtnPressed, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting || submitted}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>{submitted ? 'Day Submitted ✓' : 'Submit Today'}</Text>
              }
            </Pressable>
          </Animated.View>
          {!submitted && <Text style={styles.submitHint}>Once submitted, today's log is final.</Text>}
        </View>
      </ScrollView>

      {/* Mood Check-In */}
      <MoodCheckIn
        visible={showMoodModal}
        onSelect={handleMoodSelect}
        selectedMood={selectedMood}
      />

      {/* Confetti overlay */}
      <Confetti visible={showConfetti} />

      {/* 5-habit toast */}
      {showToast && (
        <Animated.View style={[styles.toast, { opacity: toastAnim }]} pointerEvents="none">
          <Text style={styles.toastText}>Successful Day Unlocked! 🎉</Text>
        </Animated.View>
      )}

      {/* Photo Upload Modal */}
      <Modal visible={showPhotoModal} transparent animationType="slide" onRequestClose={() => { setShowPhotoModal(false); setPendingPhotoHabit(null); }}>
        <Pressable style={styles.photoBackdrop} onPress={() => { setShowPhotoModal(false); setPendingPhotoHabit(null); }}>
          <View style={styles.photoSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.photoHandle} />
            <Text style={styles.photoTitle}>Verify your habit</Text>
            {uploadingPhoto ? (
              <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: spacing.xl }} />
            ) : (
              <>
                <Pressable style={styles.photoBtn} onPress={() => handlePickPhoto('camera')}>
                  <Text style={styles.photoBtnText}>📷  Take Photo</Text>
                </Pressable>
                <Pressable style={styles.photoBtn} onPress={() => handlePickPhoto('library')}>
                  <Text style={styles.photoBtnText}>🖼️  Upload from Library</Text>
                </Pressable>
                <Pressable style={styles.photoCancelBtn} onPress={() => { setShowPhotoModal(false); setPendingPhotoHabit(null); }}>
                  <Text style={styles.photoCancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Points Breakdown Modal */}
      <Modal visible={showBreakdown} transparent animationType="slide" onRequestClose={() => setShowBreakdown(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBreakdown(false)}>
          <View style={styles.breakdownSheet}>
            <View style={styles.breakdownHandle} />
            <Text style={styles.breakdownTitle}>Points breakdown</Text>
            <BreakdownRow label="Core habits" value={pointsBreakdown.core} />
            <BreakdownRow label="Library habits" value={pointsBreakdown.library} />
            {pointsBreakdown.custom > 0 && <BreakdownRow label="Personal habits" value={pointsBreakdown.custom} />}
            {pointsBreakdown.successBonus > 0 && <BreakdownRow label="Successful day bonus" value={pointsBreakdown.successBonus} accent />}
            {pointsBreakdown.perfectBonus > 0 && <BreakdownRow label="Perfect day bonus" value={pointsBreakdown.perfectBonus} accent />}
            <View style={styles.breakdownDivider} />
            <BreakdownRow label="Total" value={pointsBreakdown.total} bold />
            <BreakdownRow label="= Reward value" value={`$${(pointsBreakdown.total / 1000).toFixed(3)}`} muted />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SectionLabel({ label }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function BreakdownRow({ label, value, accent, bold, muted }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, muted && styles.breakdownMuted]}>{label}</Text>
      <Text style={[
        styles.breakdownValue,
        accent && styles.breakdownAccent,
        bold && styles.breakdownBold,
        muted && styles.breakdownMuted,
      ]}>
        {typeof value === 'number' ? `+${value} pts` : value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },

  // Header
  headerStrip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primaryLight,
    marginHorizontal: -spacing.xl, // bleed to edges
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  headerText: { flex: 1 },
  greeting: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.textPrimary },
  date: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary, marginTop: 2 },
  moodEmoji: { fontSize: 24 },

  // Points Card
  pointsCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pointsLabel: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: 4 },
  pointsValue: { fontFamily: fonts.bold, fontSize: fontSizes.display, color: colors.primary, lineHeight: 48 },
  pointsRight: { alignItems: 'flex-end', gap: 4, flex: 1, paddingLeft: spacing.lg },
  capLabel: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textSecondary },
  progressTrack: { width: '100%', height: 6, backgroundColor: colors.border, borderRadius: radius.full },
  progressFill: { height: 6, backgroundColor: colors.accent, borderRadius: radius.full },
  tapHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },

  // Successful Day Indicator
  successIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  successIndicatorGreen: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  successText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textSecondary },
  successTextGreen: { color: colors.primary, fontFamily: fonts.semiBold },
  perfectBadge: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.accent },

  // Section labels — sage green
  sectionLabel: {
    fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.primary,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  habitList: { gap: spacing.sm },

  // Submit
  submitSection: { gap: spacing.sm },
  submitBtnWrap: { borderRadius: radius.md, overflow: 'hidden' },
  submitBtnInner: { paddingVertical: 16, alignItems: 'center' },
  submitBtnPressed: { opacity: 0.8 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: '#FFFFFF', letterSpacing: 0.3 },
  submitHint: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center' },

  // 5-habit toast
  toast: {
    position: 'absolute', bottom: 100, left: spacing.xl, right: spacing.xl,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
  },
  toastText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: '#FFFFFF' },

  // Submitted Card
  submittedCard: {
    backgroundColor: colors.primaryLight, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.primary, padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
  },
  submittedEmoji: { fontSize: 40 },
  submittedTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.primary },
  submittedPoints: { fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: colors.primary },
  submittedBadges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  badge: {
    backgroundColor: colors.primaryLight, borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 4,
  },
  badgeText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.primary },
  badgeGold: { backgroundColor: '#FFF8E6', borderColor: colors.accent },
  badgeTextGold: { color: colors.accent },
  submittedMood: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textSecondary },

  // Breakdown modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  breakdownSheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl,
  },
  breakdownHandle: {
    width: 40, height: 4, backgroundColor: colors.border, borderRadius: radius.full,
    alignSelf: 'center', marginBottom: spacing.xl,
  },
  breakdownTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.lg },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  breakdownLabel: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.textSecondary },
  breakdownValue: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary },
  breakdownAccent: { color: colors.primary },
  breakdownBold: { fontFamily: fonts.bold, fontSize: fontSizes.md },
  breakdownMuted: { color: colors.textMuted },
  breakdownDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },

  // Monthly reward card
  rewardCard: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rewardLabel: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  rewardAmount: { fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: '#FFFFFF', lineHeight: 40 },
  rewardRight: { alignItems: 'flex-end', gap: spacing.xs, flex: 1, paddingLeft: spacing.lg },
  rewardCap: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: 'rgba(255,255,255,0.8)' },
  rewardProgressTrack: { width: '100%', height: 5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: radius.full },
  rewardProgressFill: { height: 5, backgroundColor: '#FFFFFF', borderRadius: radius.full },

  // Photo upload modal
  photoBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  photoSheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md,
  },
  photoHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: radius.full, alignSelf: 'center', marginBottom: spacing.sm },
  photoTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  photoBtn: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, paddingVertical: spacing.lg, alignItems: 'center',
  },
  photoBtnText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.textPrimary },
  photoCancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  photoCancelText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.textMuted },
});
