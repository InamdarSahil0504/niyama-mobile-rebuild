import { Tabs } from 'expo-router';
import TabBar from '../../src/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="index"
    >
      <Tabs.Screen name="rewards"   options={{ title: 'Rewards' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Stats' }} />
      <Tabs.Screen name="index"     options={{ title: 'Home' }} />
      <Tabs.Screen name="history"   options={{ title: 'History' }} />
      <Tabs.Screen name="settings"  options={{ title: 'Settings' }} />
    </Tabs>
  );
}
