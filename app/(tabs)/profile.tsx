import React from 'react';
import { View, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-black p-6 pb-24">
      <View className="items-center space-y-4">
        <View className="w-24 h-24 rounded-full bg-white/5 items-center justify-center border border-white/10 shadow-sm">
          <Text className="text-3xl">🎸</Text>
        </View>
        <Text className="text-2xl font-bold text-white tracking-tight mt-4">
          FaderZero Profil
        </Text>
        <Text className="text-sm text-zinc-400 text-center max-w-[280px] leading-relaxed">
          Gérez votre profil de musicien et vos paramètres ici. (Bientôt disponible)
        </Text>
      </View>
    </View>
  );
}
