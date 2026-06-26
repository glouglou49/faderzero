import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';

export default function MetronomeLiveScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden={true} />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        {/* EN-TÊTE FLOTTANTE (GLASS PANEL) */}
        <View className="border-b border-white/10 relative z-20 overflow-hidden rounded-b-2xl bg-zinc-950/20">
          <BlurView intensity={30} tint="dark" className="absolute inset-0" />
          <View className="px-6 py-4 flex-row justify-between items-center bg-zinc-950/20">
            <TouchableOpacity 
              onPress={() => router.back()}
              activeOpacity={0.7}
              className="bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-xl flex-row items-center gap-x-1"
            >
              <Text className="text-white font-semibold text-sm">✕ Retour</Text>
            </TouchableOpacity>

            <Text className="text-lg font-bold text-white tracking-wider uppercase">
              Métronome
            </Text>

            <View className="w-14" />
          </View>
        </View>

        {/* CONTENU CENTRAL */}
        <View className="flex-1 justify-center items-center px-8">
          <View className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mb-6">
            <Text className="text-4xl text-emerald-400">⏱️</Text>
          </View>
          <Text className="text-xl font-bold text-white mb-2 text-center">
            Moteur de rythme en cours de développement
          </Text>
          <Text className="text-sm text-zinc-400 text-center leading-relaxed max-w-xs">
            Le métronome interactif et la gestion de setlist par BPM seront disponibles très prochainement.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
