import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

export type SongStatus = 'Idee' | 'En cours' | 'Pret';

interface Song {
  id: string;
  title: string;
  status: SongStatus;
  bpm: number | null;
  key: string | null;
  text_content: string;
  updated_at: string;
}

const MOCK_SONGS: Song[] = [
  { id: 'mock-1', title: "Intro / Ambiance", bpm: null, key: null, status: 'Pret', text_content: 'Aucune parole pour l\'intro.', updated_at: new Date().toISOString() },
  { id: 'mock-2', title: "Bohemian Rhapsody", bpm: 72, key: 'Bb', status: 'Pret', text_content: '[Bb6] Is this the real life?\n[C7] Is this just fantasy?\n[F7] Caught in a landslide\n[Bb] No escape from reality\n\n[Gm] Open your eyes\n[Bb7] Look up to the skies and [Eb] see\n\nI\'m just a poor boy, I need no sympathy\nBecause I\'m easy come, easy go\nLittle high, little low', updated_at: new Date().toISOString() },
  { id: 'mock-3', title: "Don't Stop Me Now", bpm: 82, key: 'F', status: 'Pret', text_content: '[F] Tonight I\'m gonna have [Am] myself a real [Dm] good time\nI feel a[Gm]live\nAnd the [C] world I\'ll turn it inside [F] out, yeah\nAnd [Bb] floating in [Gm] ecstasy so', updated_at: new Date().toISOString() },
  { id: 'mock-4', title: "Another One Bites", bpm: 110, key: 'Fm', status: 'Pret', text_content: '[Fm] Steve walks warily down the street\nWith the brim pulled [Bbm] low\nAin\'t no sound but the sound of his feet\n[Fm] Machine guns ready to go', updated_at: new Date().toISOString() },
  { id: 'mock-5', title: "Under Pressure", bpm: 110, key: 'D', status: 'Pret', text_content: '[D] Pressure on [A] people\n[G] People on [A] streets\n[D] Pressure [A] down on me\nPressing down on [G] you, no man ask [A] for', updated_at: new Date().toISOString() },
  { id: 'mock-6', title: "Radio Ga Ga", bpm: 156, key: 'F', status: 'Pret', text_content: '[F] I\'d sit alone and [Bb] watch your [F] light\nMy [Bb] only friend through [F] teenage [Bb] nights\nAnd [F] everything I [Bb] had to [F] know\nI [Gm] heard it on my [C] radio', updated_at: new Date().toISOString() }
];

export default function PrompterLiveScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [prompterSpeed, setPrompterSpeed] = useState<0 | 1 | 2 | 3>(0);
  const [showSongPicker, setShowSongPicker] = useState(false);

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

  // Charger les morceaux depuis SQLite
  useEffect(() => {
    async function loadSongs() {
      try {
        const result = await db.getAllAsync<Song>(
          'SELECT * FROM songs ORDER BY updated_at DESC'
        );
        if (result && result.length > 0) {
          setSongs(result);
          setSelectedSong(result[0]);
        } else {
          setSongs(MOCK_SONGS);
          setSelectedSong(MOCK_SONGS[1]);
        }
      } catch (error) {
        console.error('Erreur chargement morceaux prompteur:', error);
        setSongs(MOCK_SONGS);
        setSelectedSong(MOCK_SONGS[1]);
      } finally {
        setLoading(false);
      }
    }
    loadSongs();
  }, [db]);

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

    let nextIndex = currentIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % songs.length;
    } else {
      nextIndex = (currentIndex - 1 + songs.length) % songs.length;
    }
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
              contentContainerStyle={{ paddingBottom: 180 }} 
              showsVerticalScrollIndicator={false}
            >
              {renderFormattedLyrics(selectedSong.text_content)}
              <Text className="text-zinc-600 text-center italic text-xs mt-12 mb-6">
                - Fin du morceau -
              </Text>
            </ScrollView>

            {/* Flèches de navigation en bas de page */}
            <View className="absolute bottom-6 left-0 right-0 px-6 flex-row justify-between gap-6">
              <TouchableOpacity
                onPress={() => navigateSong('prev')}
                activeOpacity={0.8}
                className="flex-1 bg-zinc-900/95 border border-white/15 h-24 rounded-2xl items-center justify-center shadow-2xl"
              >
                <Text className="text-white text-xl font-black uppercase tracking-wide">◀ Précédent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigateSong('next')}
                activeOpacity={0.8}
                className="flex-1 bg-zinc-900/95 border border-white/15 h-24 rounded-2xl items-center justify-center shadow-2xl"
              >
                <Text className="text-white text-xl font-black uppercase tracking-wide">Suivant ▶</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
          >
            <TouchableOpacity
              activeOpacity={1}
              className="bg-zinc-950 rounded-t-3xl p-6 border-t border-white/10 max-h-[70%]"
            >
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-lg font-bold text-white">Sélectionner un morceau</Text>
                <TouchableOpacity onPress={() => setShowSongPicker(false)}>
                  <Text className="text-emerald-400 font-bold">Fermer</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ gap: 10 }}>
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
