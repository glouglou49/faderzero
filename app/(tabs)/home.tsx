import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFloatingTabBarContentPadding } from '../../constants/navigation';

interface DashboardStats {
  songs: number;
  setlists: number;
  readySongs: number;
}

interface ActionTileProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  onPress: () => void;
  accent?: string;
  wide?: boolean;
}

function ActionTile({
  title,
  subtitle,
  icon,
  colors,
  onPress,
  accent = '#ffffff',
  wide = false,
}: ActionTileProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className={wide ? 'min-h-[172px] rounded-[28px]' : 'min-h-[164px] flex-1 rounded-[28px]'}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="flex-1 overflow-hidden rounded-[28px] border border-white/10 p-5"
      >
        <View className="absolute -right-6 -top-4 h-24 w-24 rounded-full bg-white/10" />
        <View className="absolute -bottom-8 right-6 h-20 w-20 rounded-full bg-black/10" />
        <View className="mb-8 h-12 w-12 items-center justify-center rounded-2xl bg-black/20">
          <Ionicons name={icon} size={24} color={accent} />
        </View>
        <View className="mt-auto">
          <Text className="mb-2 text-xl font-extrabold text-white">{title}</Text>
          <Text className="text-sm leading-5 text-white/75">{subtitle}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats>({
    songs: 0,
    setlists: 0,
    readySongs: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      const [songCount, setlistCount, readyCount] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM songs'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM setlists'),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM songs WHERE status = 'Pret'"),
      ]);

      setStats({
        songs: songCount?.count ?? 0,
        setlists: setlistCount?.count ?? 0,
        readySongs: readyCount?.count ?? 0,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques de la home :', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const bottomContentPadding = getFloatingTabBarContentPadding(insets.bottom);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottomContentPadding }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pb-6 pt-4">
          <LinearGradient
            colors={['#1d4ed8', '#0f172a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="overflow-hidden rounded-[32px] border border-white/10 px-6 py-6"
          >
            <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cyan-300/20" />
            <View className="absolute -bottom-12 left-0 h-28 w-28 rounded-full bg-indigo-400/20" />
            <Text className="mb-2 text-xs font-black uppercase tracking-[3px] text-cyan-100/80">
              FaderZero
            </Text>
            <Text className="max-w-[240px] text-3xl font-extrabold leading-9 text-white">
              {'Votre cockpit sc\u00E8ne, pr\u00EAt pour la r\u00E9p\u00E8te.'}
            </Text>
            <Text className="mt-3 max-w-[280px] text-sm leading-6 text-white/75">
              Retrouvez vos morceaux, lancez vos setlists et ouvrez les outils live en un geste.
            </Text>

            <View className="mt-6 flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Text className="text-2xl font-extrabold text-white">{stats.songs}</Text>
                <Text className="text-xs font-semibold uppercase tracking-wide text-white/65">
                  morceaux
                </Text>
              </View>
              <View className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Text className="text-2xl font-extrabold text-white">{stats.setlists}</Text>
                <Text className="text-xs font-semibold uppercase tracking-wide text-white/65">
                  setlists
                </Text>
              </View>
              <View className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Text className="text-2xl font-extrabold text-white">{stats.readySongs}</Text>
                <Text className="text-xs font-semibold uppercase tracking-wide text-white/65">
                  pr{'\u00EA'}ts
                </Text>
              </View>
            </View>
          </LinearGradient>

          <View className="mb-4 mt-7 flex-row items-end justify-between">
            <View>
              <Text className="text-2xl font-extrabold text-white">{'Acc\u00E8s rapide'}</Text>
              <Text className="mt-1 text-sm text-zinc-400">{'Des tuiles pens\u00E9es pour jouer vite.'}</Text>
            </View>
            <Text className="text-xs font-bold uppercase tracking-[2px] text-zinc-500">
              Mobile first
            </Text>
          </View>

          <View className="gap-4">
            <ActionTile
              title={'R\u00E9pertoire'}
              subtitle={'Parcourez vos chansons, cherchez un titre et ouvrez l\u2019\u00E9diteur.'}
              icon="library"
              colors={['#18181b', '#27272a']}
              accent="#f8fafc"
              wide
              onPress={() => router.push('/repertoire')}
            />

            <View className="flex-row gap-4">
              <ActionTile
                title="Setlists"
                subtitle="Construisez le fil du show et gardez l'ordre sous la main."
                icon="musical-notes"
                colors={['#312e81', '#1d4ed8']}
                onPress={() => router.push('/setlists')}
              />
              <ActionTile
                title="Prompteur"
                subtitle={'Passez en mode sc\u00E8ne pour faire d\u00E9filer les paroles.'}
                icon="mic"
                colors={['#3f1d7a', '#7c3aed']}
                onPress={() => router.push('/live/prompter')}
              />
            </View>

            <View className="flex-row gap-4">
              <ActionTile
                title="Recevoir"
                subtitle={'Scannez une chanson envoy\u00E9e depuis un autre \u00E9cran.'}
                icon="scan"
                colors={['#0f3d2e', '#059669']}
                onPress={() => router.push('/sync/receive')}
              />
              <ActionTile
                title="Menu"
                subtitle="Retrouvez les options du profil et la synchro de groupe."
                icon="settings"
                colors={['#3f3f46', '#18181b']}
                onPress={() => router.push('/profile')}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
