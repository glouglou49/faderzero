import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  getModalBottomOffset,
  getModalFooterBottomPadding,
} from '../../constants/navigation';

interface Setlist {
  id: string;
  name: string;
  created_at: string;
}

interface Song {
  id: string;
  title: string;
  bpm: number | null;
  key: string | null;
  duration_seconds: number;
}

interface SetlistSong extends Song {
  position: number;
  segue?: number;
  annotation?: string | null;
}

const singleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds || 0);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

export default function SetlistDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const setlistId = singleParam(params.id);
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<SetlistSong[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [movingSongId, setMovingSongId] = useState<string | null>(null);
  const [showSongModal, setShowSongModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [editingSong, setEditingSong] = useState<SetlistSong | null>(null);
  const [modalSegue, setModalSegue] = useState(false);
  const [modalAnnotation, setModalAnnotation] = useState('');

  const loadSetlist = useCallback(async () => {
    if (!setlistId) return;
    try {
      const [setlistRow, songRows] = await Promise.all([
        db.getFirstAsync<Setlist>('SELECT * FROM setlists WHERE id = ?', [setlistId]),
        db.getAllAsync<SetlistSong>(`
          SELECT s.id, s.title, s.bpm, s.key, s.duration_seconds, ss.position, ss.segue, ss.annotation
          FROM setlist_songs ss
          INNER JOIN songs s ON s.id = ss.song_id
          WHERE ss.setlist_id = ?
          ORDER BY ss.position ASC
        `, [setlistId]),
      ]);
      setSetlist(setlistRow ?? null);
      setSongs(songRows);
    } catch (error) {
      console.error('Erreur lors du chargement de la setlist :', error);
    } finally {
      setLoading(false);
    }
  }, [db, setlistId]);

  useEffect(() => {
    loadSetlist();
  }, [loadSetlist]);

  const openSongModal = async () => {
    try {
      const rows = await db.getAllAsync<Song>('SELECT id, title, bpm, key, duration_seconds FROM songs ORDER BY title COLLATE NOCASE ASC');
      setAllSongs(rows);
      setSelectedIds(new Set(songs.map((song) => song.id)));
      setShowSongModal(true);
    } catch (error) {
      console.error('Erreur lors du chargement du répertoire :', error);
    }
  };

  const toggleSong = (songId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  const saveSongSelection = async () => {
    if (!setlistId) return;
    const existingIds = songs.filter((song) => selectedIds.has(song.id)).map((song) => song.id);
    const appendedIds = allSongs
      .filter((song) => selectedIds.has(song.id) && !existingIds.includes(song.id))
      .map((song) => song.id);
    const orderedIds = [...existingIds, ...appendedIds];

    setSavingSelection(true);
    try {
      await db.withTransactionAsync(async () => {
        if (orderedIds.length === 0) {
          await db.runAsync('DELETE FROM setlist_songs WHERE setlist_id = ?', [setlistId]);
        } else {
          const placeholders = orderedIds.map(() => '?').join(',');
          await db.runAsync(
            `DELETE FROM setlist_songs WHERE setlist_id = ? AND song_id NOT IN (${placeholders})`,
            [setlistId, ...orderedIds]
          );
          for (let position = 0; position < orderedIds.length; position += 1) {
            await db.runAsync(
              `INSERT INTO setlist_songs (setlist_id, song_id, position) 
               VALUES (?, ?, ?) 
               ON CONFLICT(setlist_id, song_id) 
               DO UPDATE SET position = excluded.position`,
              [setlistId, orderedIds[position], position]
            );
          }
        }
      });
      setShowSongModal(false);
      await loadSetlist();
    } catch (error) {
      console.error('Erreur lors de la mise à jour des morceaux :', error);
    } finally {
      setSavingSelection(false);
    }
  };

  const moveSong = async (index: number, direction: -1 | 1) => {
    if (!setlistId || movingSongId) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= songs.length) return;

    const currentSong = songs[index];
    const targetSong = songs[targetIndex];
    const reordered = [...songs];
    reordered[index] = { ...targetSong, position: currentSong.position };
    reordered[targetIndex] = { ...currentSong, position: targetSong.position };
    setSongs(reordered);
    setMovingSongId(currentSong.id);

    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'UPDATE setlist_songs SET position = ? WHERE setlist_id = ? AND song_id = ?',
          [targetSong.position, setlistId, currentSong.id]
        );
        await db.runAsync(
          'UPDATE setlist_songs SET position = ? WHERE setlist_id = ? AND song_id = ?',
          [currentSong.position, setlistId, targetSong.id]
        );
      });
    } catch (error) {
      console.error('Erreur lors du réordonnancement :', error);
      await loadSetlist();
    } finally {
      setMovingSongId(null);
    }
  };

  const deleteSetlist = async () => {
    if (!setlistId) return;
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM setlist_songs WHERE setlist_id = ?', [setlistId]);
        await db.runAsync('DELETE FROM setlists WHERE id = ?', [setlistId]);
      });
      setShowDeleteConfirm(false);
      router.replace('/setlists');
    } catch (error) {
      console.error('Erreur lors de la suppression de la setlist :', error);
    }
  };

  const openTransitionModal = (song: SetlistSong, index: number) => {
    setEditingSong(song);
    setModalSegue(song.segue === 1);
    setModalAnnotation(song.annotation || '');
    setShowTransitionModal(true);
  };

  const saveTransition = async () => {
    if (!editingSong || !setlistId) return;
    try {
      const segueValue = modalSegue ? 1 : 0;
      const annotationValue = modalAnnotation.trim() || null;
      await db.runAsync(
        'UPDATE setlist_songs SET segue = ?, annotation = ? WHERE setlist_id = ? AND song_id = ?',
        [segueValue, annotationValue, setlistId, editingSong.id]
      );
      setShowTransitionModal(false);
      await loadSetlist();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la transition :', error);
    }
  };

  const generateHTML = () => {
    if (!setlist) return '';
    const formattedDate = new Date(setlist.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const songRowsHTML = songs.map((song, index) => {
      const isLast = index === songs.length - 1;
      const hasTransition = !isLast && (song.segue === 1 || song.annotation);

      const songHTML = `
        <div class="song-row">
          <div class="song-number">${index + 1}</div>
          <div class="song-details">
            <div class="song-title">${song.title || 'Sans titre'}</div>
            <div class="song-meta">
              ${song.bpm ? `<span>${song.bpm} BPM</span>` : ''}
              ${song.key ? `<span> · Ton : ${song.key}</span>` : ''}
              <span> · ${formatDuration(song.duration_seconds)}</span>
            </div>
          </div>
        </div>
      `;

      let transitionHTML = '';
      if (hasTransition) {
        transitionHTML = `
          <div class="transition-row">
            <div class="transition-indicator-col">
              ${song.segue === 1 ? `
                <svg width="24" height="32" viewBox="0 0 30 40">
                  <path d="M 25,2 C 2,2 2,38 25,38" stroke="#4f46e5" stroke-width="3" fill="none" stroke-linecap="round"/>
                  <path d="M 17,32 L 25,38 L 17,44" stroke="#4f46e5" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              ` : ''}
            </div>
            <div class="transition-content-col">
              ${song.annotation ? `<span class="annotation-text">${song.annotation}</span>` : ''}
            </div>
          </div>
        `;
      }

      return songHTML + transitionHTML;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${setlist.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1f2937;
            margin: 40px;
            padding: 0;
            background-color: #ffffff;
          }
          .header {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .title {
            font-size: 32px;
            font-weight: 800;
            color: #111827;
            margin: 0 0 8px 0;
          }
          .subtitle {
            font-size: 14px;
            color: #6b7280;
            font-weight: 500;
          }
          .songs-list {
            display: flex;
            flex-direction: column;
          }
          .song-row {
            display: flex;
            align-items: center;
            padding: 12px 8px;
          }
          .song-number {
            width: 36px;
            height: 36px;
            background-color: #f3f4f6;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            color: #4b5563;
            margin-right: 14px;
            font-size: 14px;
          }
          .song-details {
            flex: 1;
          }
          .song-title {
            font-size: 18px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 4px;
          }
          .song-meta {
            font-size: 12px;
            color: #6b7280;
            font-weight: 500;
          }
          .transition-row {
            display: flex;
            align-items: center;
            min-height: 32px;
            margin-top: -6px;
            margin-bottom: -6px;
          }
          .transition-indicator-col {
            width: 36px;
            margin-right: 14px;
            display: flex;
            justify-content: center;
          }
          .transition-content-col {
            flex: 1;
            display: flex;
            align-items: center;
          }
          .annotation-text {
            font-style: italic;
            color: #4b5563;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${setlist.name}</h1>
          <div class="subtitle">
            Créée le ${formattedDate} · ${songs.length} ${songs.length === 1 ? 'morceau' : 'morceaux'} · Durée totale : ${formatDuration(totalDuration)}
          </div>
        </div>
        <div class="songs-list">
          ${songRowsHTML}
        </div>
      </body>
      </html>
    `;
  };

  const exportToPDF = async () => {
    if (songs.length === 0) {
      Alert.alert('Setlist vide', 'Ajoutez des chansons à votre setlist avant de l\'exporter.');
      return;
    }
    try {
      const Print = await import('expo-print');
      const Sharing = await import('expo-sharing');
      const htmlContent = generateHTML();
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (Platform.OS === 'web') {
        return;
      }
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert('Partage indisponible', 'Le partage de fichiers n\'est pas disponible sur cet appareil.');
        return;
      }
      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Exporter la setlist ${setlist?.name}`,
      });
    } catch (error) {
      console.error('Erreur lors de la génération du PDF :', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    }
  };

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);
  const totalDuration = useMemo(() => songs.reduce((total, song) => total + (song.duration_seconds || 0), 0), [songs]);
  const pageBottomPadding = Math.max(insets.bottom, 16) + 24;
  const modalBottomOffset = getModalBottomOffset(insets.bottom);
  const modalFooterBottomPadding = getModalFooterBottomPadding(insets.bottom);

  if (loading) {
    return <View className="flex-1 items-center justify-center bg-black"><ActivityIndicator color="#6366f1" size="large" /></View>;
  }

  if (!setlist || !setlistId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-black px-6">
        <Text className="mb-5 text-center text-lg font-bold text-white">Cette setlist est introuvable.</Text>
        <TouchableOpacity onPress={() => router.back()} className="rounded-2xl bg-white/10 px-5 py-3">
          <Text className="font-bold text-white">Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center border-b border-white/10 px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Ionicons name="chevron-back" size={21} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1 px-4">
          <Text className="text-center text-base font-extrabold text-white" numberOfLines={1}>{setlist.name}</Text>
          <Text className="text-center text-xs text-zinc-500">{songs.length} {songs.length === 1 ? 'morceau' : 'morceaux'} · {formatDuration(totalDuration)}</Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            accessibilityLabel="Exporter en PDF"
            onPress={exportToPDF}
            className="h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10"
          >
            <Ionicons name="share-outline" size={19} color="#818cf8" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Supprimer la setlist"
            onPress={() => setShowDeleteConfirm(true)}
            className="h-11 w-11 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10"
          >
            <Ionicons name="trash-outline" size={19} color="#fb7185" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: pageBottomPadding, gap: 12 }}
        ListHeaderComponent={
          <TouchableOpacity onPress={openSongModal} activeOpacity={0.75} className="mb-2 flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4">
            <Ionicons name="add-circle-outline" size={20} color="#818cf8" />
            <Text className="font-extrabold text-indigo-300">Ajouter des chansons</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pb-20">
            <Text className="mb-2 text-center text-lg font-bold text-white">La scène attend ses morceaux</Text>
            <Text className="text-center text-sm leading-6 text-zinc-400">Ajoutez des chansons, puis fixez leur ordre avec les flèches.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            <View className="flex-row items-center rounded-3xl border border-white/10 bg-white/5 p-4">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-indigo-400/10">
                <Text className="font-black text-indigo-300" style={{ fontVariant: ['tabular-nums'] }}>{index + 1}</Text>
              </View>
              <View className="flex-1 pr-3">
                <Text className="font-extrabold text-white" numberOfLines={1}>{item.title || 'Sans titre'}</Text>
                <Text className="mt-1 text-xs text-zinc-500">{item.bpm ? `${item.bpm} BPM` : '— BPM'} · {item.key || '— Ton'} · {formatDuration(item.duration_seconds)}</Text>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  accessibilityLabel={`Monter ${item.title}`}
                  disabled={index === 0 || movingSongId !== null}
                  onPress={() => moveSong(index, -1)}
                  className={`h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 ${index === 0 ? 'opacity-25' : ''}`}
                >
                  <Ionicons name="arrow-up" size={17} color="#d4d4d8" />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={`Descendre ${item.title}`}
                  disabled={index === songs.length - 1 || movingSongId !== null}
                  onPress={() => moveSong(index, 1)}
                  className={`h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 ${index === songs.length - 1 ? 'opacity-25' : ''}`}
                >
                  <Ionicons name="arrow-down" size={17} color="#d4d4d8" />
                </TouchableOpacity>
              </View>
            </View>

            {index < songs.length - 1 && (
              <TouchableOpacity
                onPress={() => openTransitionModal(item, index)}
                activeOpacity={0.7}
                className="mt-3 flex-row items-center px-4"
              >
                <View className="w-9 mr-3 items-center justify-center">
                  {item.segue === 1 ? (
                    <Svg width={24} height={32} viewBox="0 0 30 40">
                      <Path
                        d="M 25,2 C 2,2 2,38 25,38"
                        stroke="#818cf8"
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                      />
                      <Path
                        d="M 17,32 L 25,38 L 17,44"
                        stroke="#818cf8"
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  ) : (
                    <View className="w-[2px] h-6 bg-zinc-800 rounded" />
                  )}
                </View>

                <View className="flex-1 justify-center py-1">
                  {item.annotation ? (
                    <Text className="text-zinc-400 italic font-semibold text-sm">{item.annotation}</Text>
                  ) : item.segue === 1 ? (
                    <Text className="text-indigo-400/60 text-xs font-bold uppercase tracking-wider">Enchaînement direct</Text>
                  ) : (
                    <Text className="text-zinc-600/30 text-xs font-bold uppercase tracking-wider">Ajouter une transition...</Text>
                  )}
                </View>

                <View className="h-8 w-8 items-center justify-center rounded-xl border border-white/5 bg-white/5">
                  <Ionicons name="create-outline" size={14} color={item.segue === 1 || item.annotation ? '#818cf8' : '#71717a'} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <Modal visible={showSongModal} transparent animationType="slide" onRequestClose={() => setShowSongModal(false)}>
        <View className="flex-1 justify-end bg-black/70" style={{ paddingBottom: modalBottomOffset }}>
          <View className="max-h-[82%] overflow-hidden rounded-t-[32px] border-t border-white/15 bg-zinc-950">
            <View className="flex-row items-center justify-between border-b border-white/10 p-5">
              <View>
                <Text className="text-lg font-extrabold text-white">Ajouter des chansons</Text>
                <Text className="mt-1 text-xs text-zinc-400">{selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSongModal(false)} className="h-10 w-10 items-center justify-center rounded-full bg-white/5">
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}>
              {allSongs.length === 0 ? (
                <Text className="py-12 text-center text-zinc-400">Aucune chanson dans le répertoire.</Text>
              ) : allSongs.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <TouchableOpacity key={item.id} onPress={() => toggleSong(item.id)} activeOpacity={0.75} className={`flex-row items-center rounded-2xl border p-4 ${isSelected ? 'border-indigo-400/50 bg-indigo-400/10' : 'border-white/10 bg-white/5'}`}>
                    <View className={`mr-4 h-6 w-6 items-center justify-center rounded-md border ${isSelected ? 'border-indigo-500 bg-indigo-600' : 'border-zinc-600'}`}>
                      {isSelected && <Ionicons name="checkmark" size={17} color="#fff" />}
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-white">{item.title || 'Sans titre'}</Text>
                      <Text className="mt-1 text-xs text-zinc-500">{item.bpm ? `${item.bpm} BPM` : '— BPM'} · {item.key || '— Ton'} · {formatDuration(item.duration_seconds)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="border-t border-white/10 px-5 pt-5" style={{ paddingBottom: modalFooterBottomPadding }}>
              <TouchableOpacity disabled={savingSelection} onPress={saveSongSelection} className="items-center rounded-2xl bg-indigo-600 py-4">
                {savingSelection ? <ActivityIndicator color="#fff" /> : <Text className="font-black text-white">Valider la sélection</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTransitionModal} transparent animationType="slide" onRequestClose={() => setShowTransitionModal(false)}>
        <View className="flex-1 justify-end bg-black/70" style={{ paddingBottom: modalBottomOffset }}>
          <View className="overflow-hidden rounded-t-[32px] border-t border-white/15 bg-zinc-950 p-6">
            <View className="flex-row items-center justify-between border-b border-white/10 pb-4 mb-6">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-extrabold text-white">Transition après le morceau</Text>
                <Text className="mt-1 text-xs text-zinc-400" numberOfLines={1}>
                  {editingSong?.title}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTransitionModal(false)} className="h-10 w-10 items-center justify-center rounded-full bg-white/5">
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View className="gap-y-6">
              <View className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <View className="flex-1 pr-4">
                  <Text className="font-bold text-white text-base">Enchaînement direct</Text>
                  <Text className="text-xs text-zinc-400 mt-1">Affiche une flèche indiquant que le morceau suivant s{"'"}enchaîne sans pause.</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setModalSegue(!modalSegue)}
                  activeOpacity={0.8}
                  className={`h-7 w-12 rounded-full p-1 flex-row ${modalSegue ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'}`}
                >
                  <View className="h-5 w-5 rounded-full bg-white" />
                </TouchableOpacity>
              </View>

              <View>
                <Text className="text-sm font-bold text-zinc-300 mb-2">Note / Annotation</Text>
                <TextInput
                  value={modalAnnotation}
                  onChangeText={setModalAnnotation}
                  placeholder="Ex. Changement d'instrument, intro guitare..."
                  placeholderTextColor="#71717a"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-base text-white"
                />
              </View>
            </View>

            <View className="border-t border-white/10 mt-6 pt-5" style={{ paddingBottom: modalFooterBottomPadding }}>
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setShowTransitionModal(false)} className="flex-1 items-center rounded-2xl border border-white/10 bg-white/5 py-4">
                  <Text className="font-bold text-zinc-300">Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveTransition} className="flex-1 items-center rounded-2xl bg-indigo-600 py-4">
                  <Text className="font-black text-white">Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View className="flex-1 items-center justify-center bg-black/75 px-6" style={{ paddingBottom: modalBottomOffset }}>
          <View className="w-full max-w-sm rounded-[28px] border border-white/10 bg-zinc-900 p-6">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
              <Ionicons name="trash-outline" size={22} color="#fb7185" />
            </View>
            <Text className="mb-2 text-xl font-extrabold text-white">Supprimer cette setlist ?</Text>
            <Text className="mb-6 text-sm leading-6 text-zinc-400">
              « {setlist.name} » sera supprimée. Les chansons de votre répertoire resteront intactes.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} className="flex-1 items-center rounded-2xl border border-white/10 bg-white/5 py-3.5">
                <Text className="font-bold text-zinc-300">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteSetlist} className="flex-1 items-center rounded-2xl bg-rose-500 py-3.5">
                <Text className="font-black text-white">Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
