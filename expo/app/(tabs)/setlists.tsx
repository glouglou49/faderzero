import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getFloatingTabBarContentPadding,
  getModalBottomOffset,
} from '../../constants/navigation';

interface SetlistSummary {
  id: string;
  name: string;
  created_at: string;
  song_count: number;
  total_duration: number;
}

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds || 0);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function SetlistsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [setlists, setSetlists] = useState<SetlistSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const loadSetlists = useCallback(async () => {
    try {
      const rows = await db.getAllAsync<SetlistSummary>(`
        SELECT s.id, s.name, s.created_at, COUNT(ss.song_id) AS song_count,
               COALESCE(SUM(song.duration_seconds), 0) AS total_duration
        FROM setlists s
        LEFT JOIN setlist_songs ss ON ss.setlist_id = s.id
        LEFT JOIN songs song ON song.id = ss.song_id
        GROUP BY s.id, s.name, s.created_at
        ORDER BY s.created_at DESC
      `);
      setSetlists(rows);
    } catch (loadError) {
      console.error('Erreur lors du chargement des setlists :', loadError);
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    loadSetlists();
  }, [loadSetlists]));

  const createSetlist = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Donnez un nom à cette setlist.');
      return;
    }

    try {
      const id = createId();
      await db.runAsync(
        'INSERT INTO setlists (id, name, created_at) VALUES (?, ?, ?)',
        [id, trimmedName, new Date().toISOString()]
      );
      setShowCreateModal(false);
      setName('');
      setError('');
      await loadSetlists();
      router.push({ pathname: '/setlist/[id]', params: { id } });
    } catch (createError) {
      console.error('Erreur lors de la création de la setlist :', createError);
      setError('Impossible de créer la setlist.');
    }
  };

  const openCreateModal = () => {
    setName('');
    setError('');
    setShowCreateModal(true);
  };

  const formatDate = (value: string) => new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const bottomContentPadding = getFloatingTabBarContentPadding(insets.bottom);
  const centeredModalBottomOffset = getModalBottomOffset(insets.bottom);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="flex-1 px-5 pt-4">
        <View className="mb-6 flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-3xl font-extrabold tracking-tight text-white">Setlists</Text>
            <Text className="text-sm font-medium text-zinc-400">
              {setlists.length} {setlists.length === 1 ? 'liste de concert' : 'listes de concert'}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Créer une setlist"
            onPress={openCreateModal}
            activeOpacity={0.8}
            className="h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/40 bg-indigo-600"
          >
            <Text className="text-3xl font-light leading-8 text-white">+</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={setlists}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomContentPadding, gap: 12 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8 pb-20">
              <View className="mb-5 h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Text className="text-3xl">♫</Text>
              </View>
              <Text className="mb-2 text-center text-xl font-bold text-white">Préparez votre premier show</Text>
              <Text className="mb-6 text-center text-sm leading-6 text-zinc-400">
                Créez une setlist, choisissez les morceaux et verrouillez leur ordre de passage.
              </Text>
              <TouchableOpacity onPress={openCreateModal} className="rounded-2xl bg-indigo-600 px-6 py-3.5">
                <Text className="font-extrabold text-white">Créer une setlist</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/setlist/[id]', params: { id: item.id } })}
              activeOpacity={0.72}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <View className="flex-row items-center justify-between gap-4">
                <View className="flex-1">
                  <Text className="mb-2 text-lg font-extrabold text-white" numberOfLines={1}>{item.name}</Text>
                  <Text className="text-xs font-medium text-zinc-400">
                    Créée le {formatDate(item.created_at)} · {item.song_count} {item.song_count === 1 ? 'morceau' : 'morceaux'} · {formatDuration(item.total_duration)}
                  </Text>
                </View>
                <View className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <Text className="text-lg text-indigo-300">›</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/70 px-6" style={{ paddingBottom: centeredModalBottomOffset }}>
          <View className="w-full max-w-sm rounded-[28px] border border-white/15 bg-zinc-900 p-6">
              <Text className="mb-1 text-xl font-extrabold text-white">Nouvelle setlist</Text>
              <Text className="mb-5 text-sm text-zinc-400">Un nom court reste lisible dans le feu de l’action.</Text>
              <TextInput
                value={name}
                onChangeText={(value) => { setName(value); setError(''); }}
                onSubmitEditing={createSetlist}
                placeholder="Ex. Festival d’été"
                placeholderTextColor="#71717a"
                autoFocus
                returnKeyType="done"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-base text-white"
              />
              <View className="h-8 justify-center px-1">
                {!!error && <Text className="text-xs font-semibold text-rose-400">{error}</Text>}
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setShowCreateModal(false)} className="flex-1 items-center rounded-2xl border border-white/10 bg-white/5 py-3.5">
                  <Text className="font-bold text-zinc-300">Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={createSetlist} className="flex-1 items-center rounded-2xl bg-indigo-600 py-3.5">
                  <Text className="font-extrabold text-white">Créer</Text>
                </TouchableOpacity>
              </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
