import { Tabs } from 'expo-router';
import React from 'react';
import { CustomTabBar } from '../../components/CustomTabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFloatingTabBarHeight } from '../../constants/navigation';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          paddingBottom: getFloatingTabBarHeight(insets.bottom),
        },
      }}
    >
      <Tabs.Screen
        name="repertoire"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Menu',
        }}
      />
      <Tabs.Screen
        name="setlists"
        options={{
          title: 'Setlists',
        }}
      />
    </Tabs>
  );
}
