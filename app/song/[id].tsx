import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '../../components/ui/icon-symbol';

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

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  // Références pour gérer l'autosave debouncé et le démontage du composant
  const saveTimeoutRef = useRef<any>(null);
  const latestSongRef = useRef<Song | null>(null);

  // Charger la chanson au démarrage
  useEffect(() => {
    async function fetchSong() {
      try {
        const result = await db.getFirstAsync<Song>(
          'SELECT * FROM songs WHERE id = ?',
          [id]
        );
        if (result) {
          setSong(result);
          latestSongRef.current = result;
        } else {
          console.error('Chanson non trouvée');
          router.replace('/repertoire');
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la chanson:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSong();
  }, [id, db, router]);

  // Fonction de sauvegarde brute dans la base SQLite
  const saveToDatabase = async (songToSave: Song) => {
    try {
      const now = new Date().toISOString();
      const updatedSong = { ...songToSave, updated_at: now };
      
      await db.runAsync(
        'UPDATE songs SET title = ?, status = ?, bpm = ?, key = ?, text_content = ?, updated_at = ? WHERE id = ?',
        [
          updatedSong.title,
          updatedSong.status,
          updatedSong.bpm,
          updatedSong.key,
          updatedSong.text_content,
          updatedSong.updated_at,
          updatedSong.id,
        ]
      );
      setSaveStatus('saved');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde automatique:', error);
      setSaveStatus('error');
    }
  };

  // Déclencher la sauvegarde automatique avec debounce (600ms)
  const triggerAutosave = (updatedSong: Song) => {
    setSaveStatus('saving');
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await saveToDatabase(updatedSong);
    }, 600);
  };

  // Sauvegarde immédiate (sur Blur ou au démontage)
  const saveImmediately = async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (latestSongRef.current) {
      setSaveStatus('saving');
      await saveToDatabase(latestSongRef.current);
    }
  };

  // Suppression de la chanson
  const handleDeleteSong = async () => {
    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      latestSongRef.current = null;
      setSaveStatus('saved');
      
      await db.runAsync('DELETE FROM songs WHERE id = ?', [id]);
      
      setShowDeleteConfirm(false);
      router.replace('/repertoire');
    } catch (error) {
      console.error('Erreur lors de la suppression de la chanson:', error);
    }
  };

  // Nettoyage et sauvegarde de secours au démontage du composant
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (latestSongRef.current && saveStatus === 'saving') {
        const songToSave = latestSongRef.current;
        const now = new Date().toISOString();
        db.runAsync(
          'UPDATE songs SET title = ?, status = ?, bpm = ?, key = ?, text_content = ?, updated_at = ? WHERE id = ?',
          [
            songToSave.title,
            songToSave.status,
            songToSave.bpm,
            songToSave.key,
            songToSave.text_content,
            now,
            songToSave.id,
          ]
        ).catch((error) => {
          console.error('[SQLite] Erreur lors de la sauvegarde finale de secours:', error);
        });
      }
    };
  }, [db, saveStatus]);

  // Gestionnaires de modification des champs
  const updateField = (field: keyof Song, value: any) => {
    if (!song) return;

    const updated = {
      ...song,
      [field]: value,
    };
    
    setSong(updated);
    latestSongRef.current = updated;
    triggerAutosave(updated);
  };

  const insertTextAtCursor = (textToInsert: string) => {
    if (!song) return;
    const currentText = song.text_content || '';
    const start = selection.start;
    const end = selection.end;
    
    const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);
    updateField('text_content', newText);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!song) return null;

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      {/* En-tête de l'éditeur personnalisé */}
      <View className="px-5 py-3 border-b border-white/10 flex-row justify-between items-center bg-zinc-900/50 relative min-h-[56px]">
        <TouchableOpacity
          onPress={() => {
            saveImmediately().then(() => {
              router.back();
            });
          }}
          activeOpacity={0.7}
          className="bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl flex-row items-center justify-center gap-x-1.5 z-10"
        >
          <IconSymbol size={16} name="chevron.left" color="#ffffff" />
          <Text className="text-white font-semibold text-sm">
            Retour
          </Text>
        </TouchableOpacity>

        {/* Titre de la chanson centré */}
        <View pointerEvents="none" className="absolute left-0 right-0 top-0 bottom-0 justify-center items-center">
          <Text className="text-white font-bold text-sm max-w-[45%] text-center" numberOfLines={1}>
            {song.title || 'Sans titre'}
          </Text>
        </View>

        {/* Conteneur droit : Indicateur & Bouton Supprimer */}
        <View className="flex-row items-center gap-x-3.5 z-10">
          {/* Indicateur de sauvegarde automatique */}
          <View className="flex-row items-center justify-center min-w-[20px]">
            {saveStatus === 'saved' && (
              <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            )}
            {saveStatus === 'saving' && (
              <ActivityIndicator size="small" color="#6366f1" className="scale-75" />
            )}
            {saveStatus === 'error' && (
              <View className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            )}
          </View>

          {/* Bouton de suppression */}
          <TouchableOpacity
            onPress={() => setShowDeleteConfirm(true)}
            activeOpacity={0.7}
            className="bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl"
          >
            <Text className="text-rose-400 font-semibold text-sm">
              Supprimer
            </Text>
          </TouchableOpacity>
        </View>
      </View>

        <ScrollView 
          className="flex-1 bg-black"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="p-5">
            
            {/* Titre (Style Notion / sans bordure) */}
            <TextInput
              value={song.title}
              onChangeText={(text) => updateField('title', text)}
              onBlur={saveImmediately}
              placeholder="Titre de la chanson"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
              scrollEnabled={false}
              className="text-3xl font-extrabold text-white tracking-tight mb-5 p-0 bg-transparent"
            />

            {/* Sélecteur de statut */}
            <View className="mb-6">
              <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Statut de création
              </Text>
              <View className="flex-row bg-white/5 rounded-xl p-1 border border-white/10">
                {(['Idee', 'En cours', 'Pret'] as SongStatus[]).map((statusOption) => {
                  const isActive = song.status === statusOption;
                  let label = 'Idée';
                  let activeBg = 'bg-amber-500';
                  if (statusOption === 'En cours') {
                    label = 'En cours';
                    activeBg = 'bg-blue-500';
                  } else if (statusOption === 'Pret') {
                    label = 'Prêt';
                    activeBg = 'bg-emerald-500';
                  }

                  if (isActive) {
                    return (
                      <TouchableOpacity
                        key={`${statusOption}-${isActive}`}
                        onPress={() => updateField('status', statusOption)}
                        activeOpacity={0.8}
                        className={`flex-1 py-2 rounded-lg items-center justify-center ${activeBg}`}
                      >
                        <Text className="text-xs font-bold text-white">
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  } else {
                    return (
                      <TouchableOpacity
                        key={`${statusOption}-${isActive}`}
                        onPress={() => updateField('status', statusOption)}
                        activeOpacity={0.8}
                        className="flex-1 py-2 rounded-lg items-center justify-center"
                      >
                        <Text className="text-xs font-bold text-zinc-500">
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                })}
              </View>
            </View>

            {/* Grid BPM / Clé */}
            <View className="flex-row gap-4 mb-6">
              {/* BPM */}
              <View className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3.5">
                <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Tempo (BPM)
                </Text>
                <TextInput
                  value={song.bpm !== null ? String(song.bpm) : ''}
                  onChangeText={(text) => {
                    const parsed = text === '' ? null : parseInt(text, 10);
                    updateField('bpm', isNaN(parsed as number) ? null : parsed);
                  }}
                  onBlur={saveImmediately}
                  placeholder="Ex: 120"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  keyboardType="numeric"
                  className="text-base font-bold text-white p-0 bg-transparent"
                />
              </View>

              {/* Clé */}
              <TouchableOpacity
                onPress={() => setShowKeyPicker(true)}
                activeOpacity={0.7}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3.5"
              >
                <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Tonalité / Clé
                </Text>
                <Text className="text-base font-bold text-white">
                  {song.key || '—'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Paroles / Contenu */}
            <View className="bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[300px]">
              <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Paroles / Notes
              </Text>
              
              {/* Barre d'outils Markdown / Accords */}
              <View className="flex-row flex-wrap gap-1.5 mb-3 border-b border-white/5 pb-2.5">
                {[
                  { label: '[Couplet 1]', insert: '\n[Couplet 1]\n' },
                  { label: '[Refrain]', insert: '\n[Refrain]\n' },
                  { label: '[Pont]', insert: '\n[Pont]\n' },
                  { label: 'Accord [ ]', insert: '[]' }
                ].map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => insertTextAtCursor(item.insert)}
                    activeOpacity={0.7}
                    className="bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl"
                  >
                    <Text className="text-xs font-semibold text-zinc-300">
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                value={song.text_content}
                onChangeText={(text) => updateField('text_content', text)}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                onBlur={saveImmediately}
                placeholder="Écrivez les paroles ou notez vos idées de structure ici..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline={true}
                textAlignVertical="top"
                className="flex-1 text-white text-base leading-relaxed p-0 min-h-[250px] bg-transparent"
              />
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sélecteur de Tonalité Modal */}
      <Modal
        visible={showKeyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowKeyPicker(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowKeyPicker(false)}
          className="flex-1 bg-black/40 justify-end"
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-zinc-900 rounded-t-3xl p-6 border-t border-white/10"
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-bold text-white">
                Sélectionner la Tonalité
              </Text>
              <TouchableOpacity onPress={() => setShowKeyPicker(false)}>
                <Text className="text-emerald-400 font-bold">Fermer</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-2 mb-4 justify-between">
              {/* Option Aucune (—) */}
              {song.key === null ? (
                <TouchableOpacity
                  onPress={() => {
                    updateField('key', null);
                    setShowKeyPicker(false);
                  }}
                  className="w-[22%] py-3.5 mb-2 rounded-xl items-center justify-center border bg-emerald-600 border-emerald-600"
                >
                  <Text className="font-bold text-sm text-white">—</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    updateField('key', null);
                    setShowKeyPicker(false);
                  }}
                  className="w-[22%] py-3.5 mb-2 rounded-xl items-center justify-center border bg-white/5 border-transparent"
                >
                  <Text className="font-bold text-sm text-zinc-300">—</Text>
                </TouchableOpacity>
              )}

              {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => {
                const isSelected = song.key === k;
                if (isSelected) {
                  return (
                    <TouchableOpacity
                      key={`${k}-${isSelected}`}
                      onPress={() => {
                        updateField('key', k);
                        setShowKeyPicker(false);
                      }}
                      className="w-[22%] py-3.5 mb-2 rounded-xl items-center justify-center border bg-emerald-600 border-emerald-600"
                    >
                      <Text className="font-bold text-sm text-white">{k}</Text>
                    </TouchableOpacity>
                  );
                } else {
                  return (
                    <TouchableOpacity
                      key={`${k}-${isSelected}`}
                      onPress={() => {
                        updateField('key', k);
                        setShowKeyPicker(false);
                      }}
                      className="w-[22%] py-3.5 mb-2 rounded-xl items-center justify-center border bg-white/5 border-transparent"
                    >
                      <Text className="font-bold text-sm text-zinc-300">{k}</Text>
                    </TouchableOpacity>
                  );
                }
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal de confirmation de suppression */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            {/* Icône d'avertissement */}
            <View className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl items-center justify-center mb-4">
              <Text className="text-xl">⚠️</Text>
            </View>

            <Text className="text-lg font-bold text-white mb-2">
              Supprimer la chanson ?
            </Text>
            
            <Text className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Cette action est irréversible. Êtes-vous sûr de vouloir supprimer définitivement la chanson « <Text className="font-semibold text-white">{song.title || 'Sans titre'}</Text> » ?
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(false)}
                activeOpacity={0.7}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 items-center justify-center"
              >
                <Text className="text-zinc-300 font-semibold text-sm">
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeleteSong}
                activeOpacity={0.7}
                className="flex-1 bg-rose-600 rounded-xl py-3 items-center justify-center"
              >
                <Text className="text-white font-bold text-sm">
                  Supprimer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
