import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IconSymbol } from './ui/icon-symbol';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showLiveMenu, setShowLiveMenu] = useState(false);

  const homeRoute = state.routes.find((r) => r.name === 'repertoire');
  const menuRoute = state.routes.find((r) => r.name === 'profile');

  const bottomInset = insets.bottom;
  const containerHeight = 76 + bottomInset;
  const paddingBottom = bottomInset > 0 ? bottomInset : 12;

  const renderTab = (route: typeof homeRoute, iconName: any, label: string, isFocused: boolean) => {
    if (!route) return null;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    if (isFocused) {
      return (
        <TouchableOpacity
          key={route.key}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          onPress={onPress}
          activeOpacity={0.7}
          style={styles.tabButton}
        >
          <View className="p-2.5 rounded-xl mb-1.5 bg-white/10 border border-white/10">
            <IconSymbol size={22} name={iconName} color="#ffffff" />
          </View>
          <Text className="text-[10px] font-bold tracking-wide text-white">
            {label}
          </Text>
        </TouchableOpacity>
      );
    } else {
      return (
        <TouchableOpacity
          key={route.key}
          accessibilityRole="button"
          accessibilityState={{ selected: false }}
          onPress={onPress}
          activeOpacity={0.7}
          style={styles.tabButton}
        >
          <View className="p-2.5 rounded-xl mb-1.5">
            <IconSymbol size={22} name={iconName} color="#A1A1AA" />
          </View>
          <Text className="text-[10px] font-bold tracking-wide text-zinc-400">
            {label}
          </Text>
        </TouchableOpacity>
      );
    }
  };

  const isHomeFocused = state.routes[state.index]?.name === 'repertoire';
  const isMenuFocused = state.routes[state.index]?.name === 'profile';

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.navBar, { paddingBottom: paddingBottom }]}>
        {/* Left Tab: Home */}
        {renderTab(homeRoute, 'house.fill', 'Home', isHomeFocused)}

        {/* Center Tab: Live (Bouton aligné) */}
        <TouchableOpacity
          onPress={() => setShowLiveMenu(true)}
          activeOpacity={0.85}
          style={styles.tabButton}
        >
          <View className="w-11 h-11 rounded-full bg-red-600 border border-red-500 items-center justify-center shadow-lg shadow-red-600/40 mb-1.5">
            <IconSymbol size={22} name="mic.fill" color="#ffffff" />
          </View>
          <Text className="text-[10px] font-bold tracking-wide text-red-500">
            Live
          </Text>
        </TouchableOpacity>

        {/* Right Tab: Menu */}
        {renderTab(menuRoute, 'gearshape.fill', 'Menu', isMenuFocused)}
      </View>

      {/* Modal / Overlay Mode Live */}
      <Modal
        visible={showLiveMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLiveMenu(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowLiveMenu(false)}
          className="flex-1 bg-black/60 justify-end"
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-zinc-950 border-t border-white/10 rounded-t-[32px] p-6"
            style={{ paddingBottom: bottomInset > 0 ? bottomInset + 16 : 32 }}
          >
            <View className="items-center mb-6">
              <View className="w-12 h-1 bg-zinc-800 rounded-full mb-4" />
              <Text className="text-lg font-extrabold text-white tracking-wider uppercase">
                🎤 Entrer en Mode Scène
              </Text>
              <Text className="text-xs text-zinc-400 mt-1 text-center font-medium">
                Sélectionnez l&apos;interface de scène souhaitée
              </Text>
            </View>

             <View className="flex-row gap-4 mb-6">
              <TouchableOpacity
                disabled={true}
                activeOpacity={0.8}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-5 items-center justify-center opacity-50 relative"
              >
                <View className="absolute top-2 right-2 bg-white/10 border border-white/5 px-2 py-0.5 rounded-md">
                  <Text className="text-[8px] font-extrabold text-white/50 uppercase tracking-widest">
                    Bientôt dispo
                  </Text>
                </View>
                <View className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 items-center justify-center mb-3">
                  <IconSymbol size={28} name="play.fill" color="#10B981" />
                </View>
                <Text className="text-sm font-bold text-white mb-1">
                  Métronome
                </Text>
                <Text className="text-[10px] text-zinc-400 text-center leading-relaxed">
                  Setlist & clic audio zéro-dérive
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowLiveMenu(false);
                  router.push('/live/prompter');
                }}
                activeOpacity={0.8}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-5 items-center justify-center"
              >
                <View className="w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-500/30 items-center justify-center mb-3">
                  <IconSymbol size={28} name="music.note.list" color="#6366f1" />
                </View>
                <Text className="text-sm font-bold text-white mb-1">
                  Prompteur
                </Text>
                <Text className="text-[10px] text-zinc-400 text-center leading-relaxed">
                  Défilement des paroles & accords
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowLiveMenu(false)}
              activeOpacity={0.8}
              className="w-full bg-zinc-900 border border-white/5 py-4 rounded-xl items-center justify-center"
            >
              <Text className="text-zinc-300 font-bold text-sm uppercase tracking-wide">
                Annuler
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 50,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(9, 9, 11, 0.5)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
