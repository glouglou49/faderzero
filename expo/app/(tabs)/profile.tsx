import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getFloatingTabBarContentPadding } from '../../constants/navigation';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomContentPadding = getFloatingTabBarContentPadding(insets.bottom);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomContentPadding }}
        className="px-6 pt-8"
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête Profil */}
        <View className="items-center mb-10 mt-4">
          <View className="w-24 h-24 rounded-full bg-white/5 items-center justify-center border border-white/10 shadow-sm mb-4">
            <Text className="text-3xl">🎸</Text>
          </View>
          <Text className="text-2xl font-bold text-white tracking-tight">
            FaderZero Profil
          </Text>
          <Text className="text-sm text-zinc-400 text-center max-w-[280px] leading-relaxed mt-2">
            Gérez votre profil de musicien et vos paramètres ici. (Bientôt disponible)
          </Text>
        </View>

        {/* Section Synchronisation */}
        <View className="w-full">
          <Text className="text-zinc-500 text-xs font-bold tracking-widest uppercase mb-4 px-1">
            Synchronisation de groupe
          </Text>

          {/* Bouton Recevoir */}
          <TouchableOpacity
            onPress={() => router.push('/sync/receive')}
            activeOpacity={0.7}
            className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex-row items-center"
          >
            <View className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mr-4">
              <Ionicons name="scan-outline" size={24} color="#10b981" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-white mb-0.5">
                Recevoir une Setlist (Scanner QR)
              </Text>
              <Text className="text-xs text-zinc-400">
                Scanne une séquence QR depuis un autre écran
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#52525b" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
