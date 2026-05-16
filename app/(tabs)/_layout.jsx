import { Tabs } from 'expo-router';
import TabBar from '../../src/components/TabBar';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/supabase';
import { trackEvent } from '../../src/config';

// Map Expo Router screen names to readable page names
const PAGE_NAMES = {
  index:     'home',
  analytics: 'stats',
  rewards:   'rewards',
  history:   'history',
  settings:  'settings',
};

export default function TabsLayout() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="index"
      screenListeners={{
        // Fires once each time a tab becomes active (initial load + subsequent switches)
        focus: (e) => {
          // e.target is "screenName-randomSuffix" from Expo Router
          const screenKey = e.target?.split('-')[0] ?? '';
          const page = PAGE_NAMES[screenKey] ?? screenKey;
          // Fire-and-forget; trackEvent handles null userId gracefully
          trackEvent(supabase, userId, 'page_viewed', { page });
        },
      }}
    >
      <Tabs.Screen name="rewards"   options={{ title: 'Rewards' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Stats' }} />
      <Tabs.Screen name="index"     options={{ title: 'Home' }} />
      <Tabs.Screen name="history"   options={{ title: 'History' }} />
      <Tabs.Screen name="settings"  options={{ title: 'Settings' }} />
    </Tabs>
  );
}
