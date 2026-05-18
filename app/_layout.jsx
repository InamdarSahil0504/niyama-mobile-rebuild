import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { setupNotificationHandler, scheduleAllRecurring, cancelAllNotifications } from '../src/notifications';
import { posthog, mixpanel, identifyUser, resetAnalytics } from '../src/analytics';

setupNotificationHandler();

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const hasTrackedOpen = useRef(false);

  // Fire app_opened once per cold launch (not on every re-render)
  useEffect(() => {
    if (hasTrackedOpen.current) return;
    hasTrackedOpen.current = true;
    try { posthog?.capture('app_opened'); } catch (_) {}
    try { mixpanel?.track('app_opened'); } catch (_) {}
  }, []);

  // Identify user in analytics when session is established; reset on sign-out
  useEffect(() => {
    if (session?.user?.id) {
      identifyUser(session.user.id);
    } else if (!session && !loading) {
      resetAnalytics();
    }
  }, [session?.user?.id, loading]);

  // Schedule recurring notifications when user is logged in with a profile
  useEffect(() => {
    if (session && profile) {
      scheduleAllRecurring(profile.wake_time_minutes ?? null);
    }
    if (!session) {
      cancelAllNotifications();
    }
  }, [session?.user?.id, profile?.wake_time]);

  // Navigate to Contact Us when user taps a support reply notification
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'contact') {
        router.push('/contact');
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inTabs = segments[0] === '(tabs)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && (inAuthGroup || (!inTabs && !inOnboarding))) {
      router.replace('/(tabs)/');
    }
  }, [session, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="contact" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
