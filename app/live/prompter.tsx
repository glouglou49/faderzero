import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import {
  getModalBottomOffset,
  getModalFooterBottomPadding,
} from '../../constants/navigation';

export type SongStatus = 'Idee' | 'En cours' | 'Pret';

interface Song {
  id: string;
  title: string;
  status: SongStatus;
  bpm: number | null;
  key: string | null;
  text_content: string;
  duration_seconds: number;
  updated_at: string;
}

interface SetlistOption {
  id: string;
  name: string;
  song_count: number;
  total_duration: number;
}

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds || 0);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

export default function PrompterLiveScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [prompterSpeed, setPrompterSpeed] = useState<0 | 1 | 2 | 3>(0);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(true);
  const [setlists, setSetlists] = useState<SetlistOption[]>([]);
  const [sourceName, setSourceName] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const isUserScrolling = useRef(false);
  // Plein écran immersif pour Android (barre de navigation du bas)
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
      }
    };
  }, []);

  // Charger les sources disponibles avant de démarrer le prompteur.
  useEffect(() => {
    async function loadSources() {
      try {
        const rows = await db.getAllAsync<SetlistOption>(`
          SELECT s.id, s.name, COUNT(ss.song_id) AS song_count,
                 COALESCE(SUM(song.duration_seconds), 0) AS total_duration
          FROM setlists s
          LEFT JOIN setlist_songs ss ON ss.setlist_id = s.id
          LEFT JOIN songs song ON song.id = ss.song_id
          GROUP BY s.id, s.name
          ORDER BY s.created_at DESC
        `);
        setSetlists(rows);
      } catch (error) {
        console.error('Erreur chargement sources prompteur:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSources();
  }, [db]);

  const applySongs = (rows: Song[], label: string) => {
    setSongs(rows);
    setSelectedSong(rows[0] ?? null);
    setSourceName(label);
    setPrompterSpeed(0);
    setShowSourcePicker(false);
  };

  const selectAllSongs = async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<Song>('SELECT * FROM songs ORDER BY title COLLATE NOCASE ASC');
      applySongs(rows, 'Toutes les chansons');
    } catch (error) {
      console.error('Erreur chargement du répertoire :', error);
    } finally {
      setLoading(false);
    }
  };

  const selectSetlist = async (setlist: SetlistOption) => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<Song>(`
        SELECT s.*
        FROM setlist_songs ss
        INNER JOIN songs s ON s.id = ss.song_id
        WHERE ss.setlist_id = ?
        ORDER BY ss.position ASC
      `, [setlist.id]);
      applySongs(rows, setlist.name);
    } catch (error) {
      console.error('Erreur chargement de la setlist :', error);
    } finally {
      setLoading(false);
    }
  };

  // Réinitialiser le scroll lors du changement de chanson
  useEffect(() => {
    if (!selectedSong) return;
    scrollY.current = 0;
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [selectedSong]);

  // Boucle de défilement automatique (auto-scroll)
  useEffect(() => {
    if (!selectedSong || prompterSpeed === 0) return;

    const interval = setInterval(() => {
      if (!isUserScrolling.current) {
        scrollY.current += prompterSpeed * 0.5;
        scrollViewRef.current?.scrollTo({ y: scrollY.current, animated: false });
      }
    }, 30);

    return () => {
      clearInterval(interval);
    };
  }, [prompterSpeed, selectedSong]);

  // Changer de morceau (prev/next)
  const navigateSong = (direction: 'prev' | 'next') => {
    if (!selectedSong || songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.id === selectedSong.id);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= songs.length) return;
    setSelectedSong(songs[nextIndex]);
  };

  const renderFormattedLyrics = (text: string) => {
    if (!text) {
      return <Text className="text-zinc-500 text-center italic mt-12">Aucune parole disponible.</Text>;
    }

    const lines = text.split('\n');
    return (
      <View className="flex-col gap-y-6 items-center">
        {lines.map((line, lineIndex) => {
          if (line.trim() === '') {
            return <View key={lineIndex} className="h-4" />;
          }

          const segments = line.split(/(\[[^\]]+\])/);

          return (
            <Text key={lineIndex} className="text-center">
              {segments.map((seg, segIndex) => {
                if (seg.startsWith('[') && seg.endsWith(']')) {
                  const chord = seg.slice(1, -1);
                  return (
                    <Text key={segIndex} className="text-emerald-400 font-bold text-base mx-1" style={{ textShadowColor: 'rgba(16, 185, 129, 0.4)', textShadowRadius: 8 }}>
                      {chord}{' '}
                    </Text>
                  );
                }
                return (
                  <Text key={segIndex} className="text-white/90 text-xl font-light">
                    {seg}
                  </Text>
                );
              })}
            </Text>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const currentSongIndex = selectedSong ? songs.findIndex((item) => item.id === selectedSong.id) : -1;
  const previousSong = currentSongIndex > 0 ? songs[currentSongIndex - 1] : null;
  const nextSong = currentSongIndex >= 0 && currentSongIndex < songs.length - 1 ? songs[currentSongIndex + 1] : null;
  const previousButtonClassName = previousSong
    ? 'flex-1 border border-white/15 h-24 rounded-2xl items-center justify-center px-3 shadow-2xl overflow-hidden'
    : 'flex-1 border border-white/10 h-24 rounded-2xl items-center justify-center px-3 shadow-2xl overflow-hidden';
  const nextButtonClassName = nextSong
    ? 'flex-1 border border-white/15 h-24 rounded-2xl items-center justify-center px-3 shadow-2xl overflow-hidden'
    : 'flex-1 border border-white/10 h-24 rounded-2xl items-center justify-center px-3 shadow-2xl overflow-hidden';
  const bottomNavigationInset = Math.max(insets.bottom, 16);
  const prompterControlsBottomOffset = bottomNavigationInset + 8;
  const prompterContentBottomPadding = bottomNavigationInset + 160;
  const bottomSheetOffset = getModalBottomOffset(insets.bottom);
  const bottomSheetFooterPadding = getModalFooterBottomPadding(insets.bottom);

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
              <Text className="text-white font-semibold text-sm">✕ Quitter</Text>
            </TouchableOpacity>

            <Text className="text-lg font-bold text-white tracking-wider uppercase">
              Prompteur Live
            </Text>

            <View className="flex-row items-center gap-x-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
              <View className="w-2 h-2 rounded-full bg-indigo-500" />
              <Text className="text-[11px] font-semibold text-zinc-400">Offline</Text>
            </View>
          </View>
        </View>

        {/* CONTENU PRINCIPAL */}
        {selectedSong && (
          <View className="flex-1">
            {/* Info morceau sélectionné */}
            <View className="border-b border-white/10 p-5 bg-zinc-950/20">
              <TouchableOpacity
                onPress={() => setShowSourcePicker(true)}
                activeOpacity={0.75}
                className="mb-3 self-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5"
              >
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-white">{sourceName} · Changer</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setShowSongPicker(true)}
                activeOpacity={0.7}
                className="flex-row items-center justify-center gap-x-1.5 mb-2.5"
              >
                <Text className="text-2xl font-bold text-white text-center tracking-tight">
                  {selectedSong.title}
                </Text>
                <Text className="text-zinc-400 text-sm">▼</Text>
              </TouchableOpacity>
              
              <View className="flex-row justify-between items-center w-full mt-2">
                {/* Groupe Métadonnées (Gauche) */}
                <View className="flex-row gap-2">
                  <View className="bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg">
                    <Text className="text-xs font-bold text-white/90">
                      {selectedSong.bpm ? `${selectedSong.bpm} BPM` : '— BPM'}
                    </Text>
                  </View>
                  <View className="bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg">
                    <Text className="text-xs font-bold text-white/90" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatDuration(selectedSong.duration_seconds)}
                    </Text>
                  </View>
                  <View className="bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-lg">
                    <Text className="text-xs font-bold text-white/90">
                      {selectedSong.key || '— Clé'}
                    </Text>
                  </View>
                </View>

                {/* Groupe Vitesse (Droite) */}
                <View className="flex-row gap-1.5">
                  {([0, 1, 2, 3] as const).map((speed) => {
                    const isActive = prompterSpeed === speed;
                    const label = speed === 0 ? 'Stop' : `x${speed}`;
                    if (isActive) {
                      return (
                        <TouchableOpacity
                          key={`${speed}-${isActive}`}
                          onPress={() => setPrompterSpeed(speed)}
                          activeOpacity={0.8}
                          className="px-3 py-1.5 rounded-lg border border-white/30 bg-white/15 shadow-lg animate-pulse"
                        >
                          <Text className="text-xs font-black text-white">
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    } else {
                      return (
                        <TouchableOpacity
                          key={`${speed}-${isActive}`}
                          onPress={() => setPrompterSpeed(speed)}
                          activeOpacity={0.8}
                          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5"
                        >
                          <Text className="text-xs font-bold text-zinc-400">
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  })}
                </View>
              </View>
            </View>

            {/* Paroles scrollables */}
            <ScrollView 
              ref={scrollViewRef}
              onScroll={(e) => {
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                isUserScrolling.current = true;
              }}
              onScrollEndDrag={(e) => {
                isUserScrolling.current = false;
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
              onMomentumScrollBegin={() => {
                isUserScrolling.current = true;
              }}
              onMomentumScrollEnd={(e) => {
                isUserScrolling.current = false;
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
              className="flex-1 p-6"
              contentContainerStyle={{ paddingBottom: prompterContentBottomPadding }}
              showsVerticalScrollIndicator={false}
            >
              {renderFormattedLyrics(selectedSong.text_content)}
              <Text className="text-zinc-600 text-center italic text-xs mt-12 mb-6">
                - Fin du morceau -
              </Text>
            </ScrollView>

            {/* Flèches de navigation en bas de page */}
            <View className="absolute left-0 right-0 px-6 flex-row justify-between gap-6" style={{ bottom: prompterControlsBottomOffset }}>
              <TouchableOpacity
                disabled={!previousSong}
                onPress={() => navigateSong('prev')}
                activeOpacity={0.8}
                className={previousButtonClassName}
              >
                <BlurView
                  intensity={previousSong ? 55 : 35}
                  tint="dark"
                  experimentalBlurMethod="dimezisBlurView"
                  className="absolute inset-0"
                />
                <View className={`absolute inset-0 ${previousSong ? 'bg-zinc-950/45' : 'bg-zinc-950/75'}`} />
                <Text className={`text-sm font-black uppercase tracking-wide ${previousSong ? 'text-zinc-300' : 'text-zinc-600'}`}>◀ Précédent</Text>
                <Text className={`mt-1 text-center text-sm font-bold ${previousSong ? 'text-white' : 'text-zinc-500'}`} numberOfLines={1}>{previousSong?.title ?? 'Début'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!nextSong}
                onPress={() => navigateSong('next')}
                activeOpacity={0.8}
                className={nextButtonClassName}
              >
                <BlurView
                  intensity={nextSong ? 55 : 35}
                  tint="dark"
                  experimentalBlurMethod="dimezisBlurView"
                  className="absolute inset-0"
                />
                <View className={`absolute inset-0 ${nextSong ? 'bg-zinc-950/45' : 'bg-zinc-950/75'}`} />
                <Text className={`text-sm font-black uppercase tracking-wide ${nextSong ? 'text-white' : 'text-zinc-500'}`}>Suivant ▶</Text>
                <Text className={`mt-1 text-center text-sm font-bold ${nextSong ? 'text-white' : 'text-zinc-500'}`} numberOfLines={1}>{nextSong?.title ?? 'Fin'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!selectedSong && !!sourceName && (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="mb-2 text-center text-xl font-extrabold text-white">Aucun morceau dans cette sélection</Text>
            <Text className="mb-6 text-center text-sm leading-6 text-zinc-400">Choisissez une autre setlist ou l’ensemble du répertoire.</Text>
            <TouchableOpacity onPress={() => setShowSourcePicker(true)} className="rounded-2xl bg-white px-6 py-4">
              <Text className="font-black text-black">Changer de sélection</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal
          visible={showSourcePicker}
          animationType="fade"
          onRequestClose={() => sourceName ? setShowSourcePicker(false) : router.back()}
        >
          <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
            <View className="flex-1 px-6 pb-6 pt-5">
              <View className="mb-7 flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-3xl font-black tracking-tight text-white">Que joue-t-on ?</Text>
                  <Text className="mt-2 text-sm leading-6 text-zinc-400">Choisissez une setlist préparée ou toutes les chansons du répertoire.</Text>
                </View>
                <TouchableOpacity
                  onPress={() => sourceName ? setShowSourcePicker(false) : router.back()}
                  className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
                >
                  <Text className="text-xl text-white">×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                <TouchableOpacity onPress={selectAllSongs} activeOpacity={0.78} className="rounded-3xl border border-white/25 bg-white/10 p-5">
                  <View className="flex-row items-center justify-between gap-4">
                    <View className="flex-1">
                      <Text className="text-lg font-black text-white">Toutes les chansons</Text>
                      <Text className="mt-1 text-sm text-zinc-400">Le répertoire complet, classé par titre</Text>
                    </View>
                    <Text className="text-2xl text-white">›</Text>
                  </View>
                </TouchableOpacity>

                <Text className="px-1 pb-1 pt-4 text-xs font-black uppercase tracking-[2px] text-zinc-500">Setlists</Text>
                {setlists.length === 0 ? (
                  <View className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <Text className="font-bold text-white">Aucune setlist</Text>
                    <Text className="mt-1 text-sm leading-5 text-zinc-500">Vous pouvez tout de même lancer toutes les chansons.</Text>
                  </View>
                ) : setlists.map((setlist) => (
                  <TouchableOpacity
                    key={setlist.id}
                    disabled={setlist.song_count === 0}
                    onPress={() => selectSetlist(setlist)}
                    activeOpacity={0.75}
                    className={`rounded-3xl border border-white/10 bg-white/5 p-5 ${setlist.song_count === 0 ? 'opacity-40' : ''}`}
                  >
                    <View className="flex-row items-center justify-between gap-4">
                      <View className="flex-1">
                        <Text className="text-base font-extrabold text-white">{setlist.name}</Text>
                        <Text className="mt-1 text-xs text-zinc-500">{setlist.song_count} {setlist.song_count === 1 ? 'morceau' : 'morceaux'} · {formatDuration(setlist.total_duration)}</Text>
                      </View>
                      <Text className="text-xl text-zinc-400">›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Modal Sélecteur de morceau */}
        <Modal
          visible={showSongPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSongPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowSongPicker(false)}
            className="flex-1 bg-black/60 justify-end"
            style={{ paddingBottom: bottomSheetOffset }}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="bg-zinc-950 rounded-t-3xl p-6 border-t border-white/10 max-h-[70%]"
              style={{ paddingBottom: bottomSheetFooterPadding }}
            >
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-lg font-bold text-white">Sélectionner un morceau</Text>
                <TouchableOpacity onPress={() => setShowSongPicker(false)}>
                  <Text className="text-emerald-400 font-bold">Fermer</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
                {songs.map((song) => {
                  const isSelected = selectedSong?.id === song.id;
                  if (isSelected) {
                    return (
                      <TouchableOpacity
                        key={`${song.id}-${isSelected}`}
                        onPress={() => {
                          setSelectedSong(song);
                          setShowSongPicker(false);
                        }}
                        className="p-4 mb-2.5 rounded-xl border bg-emerald-600/15 border-emerald-500"
                      >
                        <Text className="text-white font-semibold text-base">{song.title}</Text>
                        <Text className="text-zinc-400 text-xs mt-1">
                          {song.bpm ? `${song.bpm} BPM` : '— BPM'} • {song.key || '— Clé'}
                        </Text>
                      </TouchableOpacity>
                    );
                  } else {
                    return (
                      <TouchableOpacity
                        key={`${song.id}-${isSelected}`}
                        onPress={() => {
                          setSelectedSong(song);
                          setShowSongPicker(false);
                        }}
                        className="p-4 mb-2.5 rounded-xl border bg-white/5 border-transparent"
                      >
                        <Text className="text-white font-semibold text-base">{song.title}</Text>
                        <Text className="text-zinc-400 text-xs mt-1">
                          {song.bpm ? `${song.bpm} BPM` : '— BPM'} • {song.key || '— Clé'}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    </View>
  );
}
