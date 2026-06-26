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
  textColor?: string;
  wide?: boolean;
}

function WaveColumn({
  height,
  color,
}: {
  height: number;
  color: string;
}) {
  return <View style={{ height, backgroundColor: color }} className="w-2 rounded-full" />;
}

function ActionTile({
  title,
  subtitle,
  icon,
  colors,
  onPress,
  accent = '#ffffff',
  textColor = '#ffffff',
  wide = false,
}: ActionTileProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      className={wide ? 'min-h-[172px] rounded-[30px]' : 'min-h-[168px] flex-1 rounded-[30px]'}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="flex-1 overflow-hidden rounded-[30px] border border-black/10 p-5"
      >
        <View className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20" />
        <View className="absolute bottom-4 right-4 flex-row items-end gap-1 opacity-30">
          <WaveColumn height={18} color={textColor} />
          <WaveColumn height={34} color={textColor} />
          <WaveColumn height={54} color={textColor} />
          <WaveColumn height={34} color={textColor} />
          <WaveColumn height={18} color={textColor} />
        </View>
        <View
          className="mb-9 h-12 w-12 items-center justify-center rounded-2xl border border-black/10"
          style={{ backgroundColor: 'rgba(17, 17, 17, 0.14)' }}
        >
          <Ionicons name={icon} size={24} color={accent} />
        </View>
        <View className="mt-auto">
          <Text className="mb-2 text-xl font-extrabold" style={{ color: textColor }}>
            {title}
          </Text>
          <Text className="text-sm leading-5" style={{ color: `${textColor}CC` }}>
            {subtitle}
          </Text>
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
    <SafeAreaView className="flex-1 bg-[#f5efe9]" edges={['top']}>
      <ScrollView
        className="flex-1 bg-[#f5efe9]"
        contentContainerStyle={{ paddingBottom: bottomContentPadding }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pb-6 pt-4">
          <LinearGradient
            colors={['#171717', '#2d1631']}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 1 }}
            className="overflow-hidden rounded-[34px] border border-black/10 px-6 py-6"
          >
            <View className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-[#c4b5fd]/25" />
            <View className="absolute -left-6 bottom-10 h-24 w-24 rounded-full bg-[#8b2f65]/25" />

            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text className="mb-2 text-xs font-black uppercase tracking-[3px] text-[#e9d7ff]">
                  FaderZero
                </Text>
                <Text className="max-w-[230px] text-3xl font-extrabold leading-9 text-[#fff8f4]">
                  {'Le cockpit de sc\u00E8ne qui vibre comme votre logo.'}
                </Text>
                <Text className="mt-3 max-w-[270px] text-sm leading-6 text-[#f5e7ff]/80">
                  Un accueil plus musical, plus contrasté, plus FaderZero.
                </Text>
              </View>

              <View className="items-center justify-center pt-1">
                <View className="h-[170px] w-[84px] items-center overflow-hidden rounded-[40px] bg-[#101010]">
                  <LinearGradient
                    colors={['#8f2f67', '#9e8df3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0"
                  />
                  <View className="absolute left-1/2 h-full w-2 -translate-x-1/2 bg-[#f8f1eb]" />
                  <View className="absolute left-1/2 top-[26px] h-[118px] w-[44px] -translate-x-1/2 rounded-[24px] bg-[#161616]" />
                  <View className="absolute left-1/2 top-[70px] h-[48px] w-[26px] -translate-x-1/2 rounded-2xl bg-[#f8f1eb]" />
                  <View className="absolute left-1/2 top-[82px] h-1.5 w-5 -translate-x-1/2 rounded-full bg-[#161616]" />
                  <View className="absolute left-1/2 top-[91px] h-1.5 w-5 -translate-x-1/2 rounded-full bg-[#161616]" />
                  <View className="absolute left-1/2 top-[100px] h-1.5 w-5 -translate-x-1/2 rounded-full bg-[#161616]" />
                </View>
              </View>
            </View>

            <View className="mt-6 flex-row items-end justify-center gap-2">
              <View className="mr-2 flex-row items-end gap-1">
                <WaveColumn height={16} color="#8f2f67" />
                <WaveColumn height={36} color="#8f2f67" />
                <WaveColumn height={60} color="#8f2f67" />
                <WaveColumn height={28} color="#8f2f67" />
              </View>
              <View className="flex-1 rounded-[22px] border border-white/10 bg-white/10 px-4 py-3">
                <Text className="text-2xl font-extrabold text-white">{stats.songs}</Text>
                <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-white/70">
                  morceaux
                </Text>
              </View>
              <View className="flex-1 rounded-[22px] border border-white/10 bg-white/10 px-4 py-3">
                <Text className="text-2xl font-extrabold text-white">{stats.setlists}</Text>
                <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-white/70">
                  setlists
                </Text>
              </View>
              <View className="flex-1 rounded-[22px] border border-white/10 bg-white/10 px-4 py-3">
                <Text className="text-2xl font-extrabold text-white">{stats.readySongs}</Text>
                <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-white/70">
                  prêts
                </Text>
              </View>
              <View className="ml-2 flex-row items-end gap-1">
                <WaveColumn height={28} color="#a59af8" />
                <WaveColumn height={60} color="#a59af8" />
                <WaveColumn height={36} color="#a59af8" />
                <WaveColumn height={16} color="#a59af8" />
              </View>
            </View>
          </LinearGradient>

          <View className="mb-4 mt-7 flex-row items-end justify-between">
            <View>
              <Text className="text-2xl font-extrabold text-[#171717]">Accès rapide</Text>
              <Text className="mt-1 text-sm text-[#5c5563]">
                Des tuiles habillées dans les codes du logo.
              </Text>
            </View>
            <Text className="text-xs font-bold uppercase tracking-[2px] text-[#8f2f67]">
              brand ui
            </Text>
          </View>

          <View className="gap-4">
            <ActionTile
              title="Répertoire"
              subtitle="Toutes vos chansons dans une tuile signature prune et lavande."
              icon="library"
              colors={['#8f2f67', '#9e8df3']}
              accent="#fff8f4"
              wide
              onPress={() => router.push('/repertoire')}
            />

            <View className="flex-row gap-4">
              <ActionTile
                title="Setlists"
                subtitle="Préparez le show avec une carte crème à l'esprit scène."
                icon="musical-notes"
                colors={['#fff8f4', '#efe2d8']}
                accent="#161616"
                textColor="#161616"
                onPress={() => router.push('/setlists')}
              />
              <ActionTile
                title="Prompteur"
                subtitle="Mode live avec contraste noir et halo violet."
                icon="mic"
                colors={['#18181b', '#4a2147']}
                accent="#f3e8ff"
                onPress={() => router.push('/live/prompter')}
              />
            </View>

            <View className="flex-row gap-4">
              <ActionTile
                title="Recevoir"
                subtitle="Scannez un partage avec une ambiance claire et technique."
                icon="scan"
                colors={['#d9d1ff', '#a59af8']}
                accent="#161616"
                textColor="#161616"
                onPress={() => router.push('/sync/receive')}
              />
              <ActionTile
                title="Menu"
                subtitle="Réglages et synchro dans une tuile noire comme l'icône app."
                icon="settings"
                colors={['#101010', '#2a2a2a']}
                accent="#f4e7ff"
                onPress={() => router.push('/profile')}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
