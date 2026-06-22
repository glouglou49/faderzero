import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

const BPM_OPTIONS = Array.from({ length: 271 }, (_, index) => index + 30);
const DURATION_MINUTE_OPTIONS = Array.from({ length: 100 }, (_, index) => index);
const DURATION_SECOND_OPTIONS = Array.from({ length: 60 }, (_, index) => index);
const BPM_OPTION_HEIGHT = 46;
const BPM_VISIBLE_ROWS = 7;
const BPM_WHEEL_HEIGHT = BPM_OPTION_HEIGHT * BPM_VISIBLE_ROWS;

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [showBpmPicker, setShowBpmPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [draftBpm, setDraftBpm] = useState(120);
  const [draftMinutes, setDraftMinutes] = useState(0);
  const [draftSeconds, setDraftSeconds] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const closeBpmPicker = () => {
    setShowBpmPicker(false);
    lastActionTypeRef.current = null;
  };

  const closeKeyPicker = () => {
    setShowKeyPicker(false);
    lastActionTypeRef.current = null;
  };

  const closeStatusPicker = () => {
    setShowStatusPicker(false);
    lastActionTypeRef.current = null;
  };

  const closeDurationPicker = () => {
    setShowDurationPicker(false);
    lastActionTypeRef.current = null;
  };

  // Historique Undo / Redo
  const [undoStack, setUndoStack] = useState<Song[]>([]);
  const [redoStack, setRedoStack] = useState<Song[]>([]);
  const shortcutOptions = [
    { label: '[Couplet]', insert: '\n[Couplet 1]\n' },
    { label: '[Intro]', insert: '\n[Intro]\n' },
    { label: '[Refrain]', insert: '\n[Refrain]\n' },
    { label: '[Pont]', insert: '\n[Pont]\n' },
    { label: '[Solo]', insert: '\n[Solo]\n' },
    { label: '[Outro]', insert: '\n[Outro]\n' },
    { label: 'Accord [ ]', insert: '[]' },
  ];

  // Références pour gérer l'autosave debouncé et le démontage du composant
  const saveTimeoutRef = useRef<any>(null);
  const latestSongRef = useRef<Song | null>(null);
  const bpmListRef = useRef<FlatList<number>>(null);
  const minuteListRef = useRef<FlatList<number>>(null);
  const secondListRef = useRef<FlatList<number>>(null);

  // Références de l'historique
  const lastActionTypeRef = useRef<string | null>(null);
  const lastPushTimeRef = useRef<number>(0);

  // Charger la chanson au démarrage
  useEffect(() => {
    async function fetchSong() {
      if (!id) return;
      const currentSongId = id;
      try {
        const result = await db.getFirstAsync<Song>(
          'SELECT * FROM songs WHERE id = ?',
          [currentSongId]
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

  const getBpmFromOffset = (offsetY: number) => {
    const index = Math.round(offsetY / BPM_OPTION_HEIGHT);
    const boundedIndex = Math.max(0, Math.min(BPM_OPTIONS.length - 1, index));
    return BPM_OPTIONS[boundedIndex];
  };

  const scrollToBpm = (bpm: number, animated = false) => {
    const boundedBpm = Math.max(30, Math.min(300, bpm));
    bpmListRef.current?.scrollToOffset({
      offset: (boundedBpm - 30) * BPM_OPTION_HEIGHT,
      animated,
    });
  };

  const commitBpmFromOffset = (offsetY: number) => {
    const nextBpm = getBpmFromOffset(offsetY);
    if (draftBpm !== nextBpm) {
      setDraftBpm(nextBpm);
    }

    if (song?.bpm !== nextBpm) {
      updateField('bpm', nextBpm);
    }
  };

  useEffect(() => {
    if (!showBpmPicker) return;

    const initialBpm = song?.bpm ?? 120;
    setDraftBpm(initialBpm);
    const timeoutId = setTimeout(() => {
      scrollToBpm(initialBpm);
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [showBpmPicker, song?.bpm]);

  useEffect(() => {
    if (!showDurationPicker) return;
    const duration = Math.max(0, song?.duration_seconds ?? 0);
    const minutes = Math.min(99, Math.floor(duration / 60));
    const seconds = duration % 60;
    setDraftMinutes(minutes);
    setDraftSeconds(seconds);
    const timeoutId = setTimeout(() => {
      minuteListRef.current?.scrollToOffset({ offset: minutes * BPM_OPTION_HEIGHT, animated: false });
      secondListRef.current?.scrollToOffset({ offset: seconds * BPM_OPTION_HEIGHT, animated: false });
    }, 80);
    return () => clearTimeout(timeoutId);
  }, [showDurationPicker, song?.duration_seconds]);

  const updateDuration = (minutes: number, seconds: number) => {
    const boundedMinutes = Math.max(0, Math.min(99, minutes));
    const boundedSeconds = Math.max(0, Math.min(59, seconds));
    setDraftMinutes(boundedMinutes);
    setDraftSeconds(boundedSeconds);
    updateField('duration_seconds', boundedMinutes * 60 + boundedSeconds);
  };

  // Fonction de sauvegarde brute dans la base SQLite
  const saveToDatabase = async (songToSave: Song) => {
    try {
      const now = new Date().toISOString();
      const updatedSong = { ...songToSave, updated_at: now };
      
      await db.runAsync(
        'UPDATE songs SET title = ?, status = ?, bpm = ?, key = ?, text_content = ?, duration_seconds = ?, updated_at = ? WHERE id = ?',
        [
          updatedSong.title,
          updatedSong.status,
          updatedSong.bpm,
          updatedSong.key,
          updatedSong.text_content,
          updatedSong.duration_seconds,
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
    if (!id) return;
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
        if (latestSongRef.current) {
          const songToSave = latestSongRef.current;
          const now = new Date().toISOString();
          db.runAsync(
            'UPDATE songs SET title = ?, status = ?, bpm = ?, key = ?, text_content = ?, duration_seconds = ?, updated_at = ? WHERE id = ?',
            [
              songToSave.title,
              songToSave.status,
              songToSave.bpm,
              songToSave.key,
              songToSave.text_content,
              songToSave.duration_seconds,
              now,
              songToSave.id,
            ]
          ).catch((error) => {
            console.error('[SQLite] Erreur lors de la sauvegarde finale de secours:', error);
          });
        }
      }
    };
  }, [db]);

  // Capturer les états dans l'historique
  const pushToHistoryState = (previousState: Song, actionType: string, isKeystroke = false, isWordBoundary = false) => {
    if (!previousState) return;

    const now = Date.now();
    let shouldPush = false;

    if (!isKeystroke) {
      // Action discrète immédiate : on pousse toujours
      shouldPush = true;
      lastActionTypeRef.current = null;
    } else {
      // Saisie continue (clavier ou défilement du tempo)
      if (lastActionTypeRef.current !== actionType) {
        shouldPush = true;
      } else if (isWordBoundary) {
        shouldPush = true;
      } else if (now - lastPushTimeRef.current > 2000) {
        shouldPush = true;
      }
      lastActionTypeRef.current = actionType;
    }

    if (shouldPush) {
      setUndoStack((prev) => {
        const next = [...prev, previousState];
        if (next.length > 50) next.shift(); // Limite de 50 états
        return next;
      });
      setRedoStack([]); // Vider la pile de redo à chaque nouvelle modification
      lastPushTimeRef.current = now;
    }
  };

  const handleUndo = () => {
    if (!song || undoStack.length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const currentState = { ...song };

    setUndoStack(newUndoStack);
    setRedoStack((prev) => [currentState, ...prev]);

    setSong(previousState);
    latestSongRef.current = previousState;

    saveToDatabase(previousState);

    // Réinitialiser le type d'action pour forcer une nouvelle entrée au prochain changement
    lastActionTypeRef.current = null;
  };

  const handleRedo = () => {
    if (!song || redoStack.length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const nextState = redoStack[0];
    const newRedoStack = redoStack.slice(1);
    const currentState = { ...song };

    setUndoStack((prev) => [...prev, currentState]);
    setRedoStack(newRedoStack);

    setSong(nextState);
    latestSongRef.current = nextState;

    saveToDatabase(nextState);

    // Réinitialiser le type d'action
    lastActionTypeRef.current = null;
  };

  // Gestionnaires de modification des champs
  const updateField = (field: keyof Song, value: any) => {
    if (!song) return;

    const previousState = { ...song };
    const updated = {
      ...song,
      [field]: value,
    };
    
    setSong(updated);
    latestSongRef.current = updated;
    triggerAutosave(updated);

    // Déterminer le type d'action pour l'historique
    let actionType = '';
    let isKeystroke = false;

    if (field === 'title') {
      actionType = 'typing_title';
      isKeystroke = true;
    } else if (field === 'text_content') {
      actionType = 'typing_lyrics';
      isKeystroke = true;
    } else if (field === 'bpm') {
      actionType = 'change_bpm';
      isKeystroke = true;
    } else if (field === 'duration_seconds') {
      actionType = 'change_duration';
      isKeystroke = true;
    } else if (field === 'key') {
      actionType = 'change_key';
      isKeystroke = false;
    } else if (field === 'status') {
      actionType = 'change_status';
      isKeystroke = false;
    }

    // Détection de limite de mot (espace / retour à la ligne)
    let isWordBoundary = false;
    if (isKeystroke && typeof value === 'string' && typeof song[field] === 'string') {
      const prevStr = song[field] as string;
      const nextStr = value;
      const prevEndsWithSpace = prevStr.endsWith(' ') || prevStr.endsWith('\n');
      const nextEndsWithSpace = nextStr.endsWith(' ') || nextStr.endsWith('\n');
      if (nextEndsWithSpace && !prevEndsWithSpace) {
        isWordBoundary = true;
      }
    }

    if (actionType) {
      pushToHistoryState(previousState, actionType, isKeystroke, isWordBoundary);
    }
  };

  const insertTextAtCursor = (textToInsert: string) => {
    if (!song) return;
    
    const previousState = { ...song };
    const currentText = song.text_content || '';
    const start = selection.start;
    const end = selection.end;
    
    const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);
    
    const updated = {
      ...song,
      text_content: newText,
    };

    setSong(updated);
    latestSongRef.current = updated;
    triggerAutosave(updated);

    pushToHistoryState(previousState, 'insert_tag', false);
  };

  const toggleEditMode = async () => {
    if (isEditMode) {
      await saveImmediately();
    }

    setIsEditMode((previousValue) => !previousValue);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!song) return null;

  const bottomSheetOffset = getModalBottomOffset(insets.bottom);
  const bottomSheetFooterPadding = getModalFooterBottomPadding(insets.bottom);

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      {/* En-tête de l'éditeur personnalisé */}
      <View className="px-5 py-3 border-b border-white/10 flex-row justify-between items-center bg-zinc-900/50 min-h-[56px]">
        {/* Conteneur gauche : Bouton retour icon-only */}
        <View className="w-[120px] flex-row items-center justify-start z-10">
          <TouchableOpacity
            onPress={() => {
              saveImmediately().then(() => {
                router.back();
              });
            }}
            activeOpacity={0.7}
            className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl items-center justify-center"
          >
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Titre de la chanson centré */}
        <View className="flex-1 items-center justify-center z-10">
          <Text className="text-white font-bold text-sm text-center" numberOfLines={1}>
            {song.title || 'Sans titre'}
          </Text>
        </View>

        {/* Conteneur droit : Indicateur & Boutons icon-only */}
        <View className="w-[120px] flex-row items-center justify-end gap-x-2 z-10">
          {/* Indicateur de sauvegarde automatique */}
          <View className="w-6 h-6 items-center justify-center">
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

          {/* Bouton de partage icon-only */}
          <TouchableOpacity
            onPress={() => {
              saveImmediately().then(() => {
                router.push({ pathname: '/sync/transmit', params: { songId: song.id } });
              });
            }}
            activeOpacity={0.7}
            className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl items-center justify-center"
          >
            <Ionicons name="share-social-outline" size={18} color="#818cf8" />
          </TouchableOpacity>

          {/* Bouton de suppression icon-only */}
          <TouchableOpacity
            onPress={() => setShowDeleteConfirm(true)}
            activeOpacity={0.7}
            className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-xl items-center justify-center"
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

        <ScrollView 
          className="flex-1 bg-black"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={isEditMode ? [1] : undefined}
        >
          <View className="p-5 pb-0">
            
            <View className="flex-row items-start justify-between gap-3 mb-5">
              <View className="flex-1">
                {isEditMode ? (
                  <TextInput
                    value={song.title}
                    onChangeText={(text) => updateField('title', text)}
                    onBlur={saveImmediately}
                    placeholder="Titre de la chanson"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    multiline
                    scrollEnabled={false}
                    className="text-3xl font-extrabold text-white tracking-tight p-0 bg-transparent"
                  />
                ) : (
                  <Text selectable className="text-3xl font-extrabold text-white tracking-tight">
                    {song.title || 'Sans titre'}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={toggleEditMode}
                activeOpacity={0.7}
                className={`mt-1 w-11 h-11 rounded-2xl items-center justify-center border ${isEditMode ? 'bg-white/10 border-white/15' : 'bg-indigo-500/10 border-indigo-500/25'}`}
              >
                <Ionicons
                  name={isEditMode ? 'checkmark' : 'pencil-outline'}
                  size={18}
                  color={isEditMode ? '#ffffff' : '#818cf8'}
                />
              </TouchableOpacity>
            </View>

            {/* Grid Statut / Tempo / Clé */}
            <View className="flex-row flex-wrap gap-2.5 mb-6">
              {/* Statut */}
              <TouchableOpacity
                onPress={() => {
                  if (!isEditMode) return;
                  setShowStatusPicker(true);
                }}
                disabled={!isEditMode}
                activeOpacity={0.7}
                className={`w-[48%] bg-white/5 border border-white/10 rounded-2xl p-3 ${!isEditMode ? 'opacity-60' : ''}`}
              >
                <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5" numberOfLines={1}>
                  Statut
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>
                    {song.status === 'Idee' ? 'Idée' : song.status === 'En cours' ? 'En cours' : 'Prêt'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#a1a1aa" />
                </View>
              </TouchableOpacity>

              {/* Tempo (BPM) */}
              <TouchableOpacity
                onPress={() => {
                  if (!isEditMode) return;
                  setShowBpmPicker(true);
                }}
                disabled={!isEditMode}
                activeOpacity={0.75}
                className={`w-[48%] bg-white/5 border border-white/10 rounded-2xl p-3 ${!isEditMode ? 'opacity-60' : ''}`}
              >
                <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5" numberOfLines={1}>
                  Tempo
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>
                    {song.bpm !== null ? `${song.bpm} BPM` : '—'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#a1a1aa" />
                </View>
              </TouchableOpacity>

              {/* Clé */}
              <TouchableOpacity
                onPress={() => {
                  if (!isEditMode) return;
                  setShowKeyPicker(true);
                }}
                disabled={!isEditMode}
                activeOpacity={0.7}
                className={`w-[48%] bg-white/5 border border-white/10 rounded-2xl p-3 ${!isEditMode ? 'opacity-60' : ''}`}
              >
                <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5" numberOfLines={1}>
                  Clé
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>
                    {song.key || '—'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#a1a1aa" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!isEditMode) return;
                  setShowDurationPicker(true);
                }}
                disabled={!isEditMode}
                activeOpacity={0.7}
                className={`w-[48%] bg-white/5 border border-white/10 rounded-2xl p-3 ${!isEditMode ? 'opacity-60' : ''}`}
              >
                <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5" numberOfLines={1}>
                  Durée
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-white" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
                    {`${String(Math.floor((song.duration_seconds ?? 0) / 60)).padStart(2, '0')}:${String((song.duration_seconds ?? 0) % 60).padStart(2, '0')}`}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#a1a1aa" />
                </View>
              </TouchableOpacity>
            </View>

          </View>

          {isEditMode ? (
            <View className="bg-black px-5 pt-3 pb-3">
              <View className="bg-white/5 border border-white/10 rounded-2xl px-4 pt-3 pb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5 pr-2 border-r border-white/10">
                    <TouchableOpacity
                      disabled={undoStack.length === 0}
                      onPress={handleUndo}
                      activeOpacity={0.7}
                      className={`bg-white/5 border border-white/10 w-9 h-9 rounded-xl items-center justify-center ${undoStack.length === 0 ? 'opacity-30' : ''}`}
                    >
                      <Ionicons name="arrow-undo-outline" size={16} color={undoStack.length === 0 ? '#71717a' : '#818cf8'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={redoStack.length === 0}
                      onPress={handleRedo}
                      activeOpacity={0.7}
                      className={`bg-white/5 border border-white/10 w-9 h-9 rounded-xl items-center justify-center ${redoStack.length === 0 ? 'opacity-30' : ''}`}
                    >
                      <Ionicons name="arrow-redo-outline" size={16} color={redoStack.length === 0 ? '#71717a' : '#818cf8'} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ alignItems: 'center', paddingLeft: 8, gap: 6 }}
                    className="flex-1"
                  >
                    {shortcutOptions.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => insertTextAtCursor(item.insert)}
                        activeOpacity={0.7}
                        className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl h-9 items-center justify-center"
                      >
                        <Text className="text-xs font-semibold text-zinc-300">
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          ) : null}

          <View className="px-5">
            <View className="bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[300px]">
              <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Paroles / Notes
              </Text>
              <TextInput
                value={song.text_content}
                onChangeText={(text) => updateField('text_content', text)}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                onBlur={saveImmediately}
                placeholder="Écrivez les paroles ou notez vos idées de structure ici..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                multiline={true}
                editable={isEditMode}
                showSoftInputOnFocus={isEditMode}
                scrollEnabled={false}
                textAlignVertical="top"
                className="text-white text-base leading-relaxed p-0 min-h-[250px] bg-transparent w-full"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>


      {/* Sélecteur de Tempo Modal */}
      <Modal
        visible={showBpmPicker}
        transparent
        animationType="slide"
        onRequestClose={closeBpmPicker}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeBpmPicker}
          className="flex-1 bg-black/50 justify-end"
          style={{ paddingBottom: bottomSheetOffset }}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-zinc-900 rounded-t-3xl p-6 border-t border-white/10"
            style={{ paddingBottom: bottomSheetFooterPadding }}
          >
            <View className="flex-row justify-between items-center mb-5">
              <View>
                <Text className="text-lg font-bold text-white">
                  Sélectionner le tempo
                </Text>
                <Text className="text-xs font-semibold text-zinc-500 mt-1">
                  Faites défiler de 30 à 300 BPM
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeBpmPicker}
                className="bg-white/10 border border-white/10 px-4 py-2 rounded-xl"
              >
                <Text className="text-white font-bold">OK</Text>
              </TouchableOpacity>
            </View>

            <View
              className="bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden relative"
              style={{ height: BPM_WHEEL_HEIGHT }}
            >
              <View
                pointerEvents="none"
                className="absolute left-4 right-4 bg-transparent border border-white/80 rounded-xl z-0"
                style={{
                  top: (BPM_WHEEL_HEIGHT - BPM_OPTION_HEIGHT) / 2,
                  height: BPM_OPTION_HEIGHT,
                }}
              />
              <FlatList
                ref={bpmListRef}
                data={BPM_OPTIONS}
                keyExtractor={(item) => String(item)}
                renderItem={({ item: bpm }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setDraftBpm(bpm);
                      scrollToBpm(bpm, true);
                      updateField('bpm', bpm);
                    }}
                    activeOpacity={0.75}
                    className="flex-row items-center justify-center"
                    style={{
                      height: BPM_OPTION_HEIGHT,
                    }}
                  >
                    <View className="w-16 items-end">
                      <Text
                        className="text-xl font-semibold text-white"
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {bpm}
                      </Text>
                    </View>
                    <View className="w-16 items-start ml-5">
                      <Text className="text-base font-semibold text-white">
                        BPM
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                snapToInterval={BPM_OPTION_HEIGHT}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onMomentumScrollEnd={(event) => {
                  commitBpmFromOffset(event.nativeEvent.contentOffset.y);
                }}
                getItemLayout={(_, index) => ({
                  length: BPM_OPTION_HEIGHT,
                  offset: BPM_OPTION_HEIGHT * index,
                  index,
                })}
                initialNumToRender={12}
                maxToRenderPerBatch={16}
                windowSize={7}
                removeClippedSubviews
                contentContainerStyle={{
                  paddingVertical: (BPM_WHEEL_HEIGHT - BPM_OPTION_HEIGHT) / 2,
                }}
                className="z-10"
              />

              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(9, 9, 11, 0.96)',
                  'rgba(9, 9, 11, 0.82)',
                  'rgba(9, 9, 11, 0.54)',
                  'rgba(9, 9, 11, 0.18)',
                  'rgba(9, 9, 11, 0)',
                ]}
                locations={[0, 0.28, 0.56, 0.82, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, zIndex: 20 }}
              />
              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(9, 9, 11, 0)',
                  'rgba(9, 9, 11, 0.18)',
                  'rgba(9, 9, 11, 0.54)',
                  'rgba(9, 9, 11, 0.82)',
                  'rgba(9, 9, 11, 0.96)',
                ]}
                locations={[0, 0.18, 0.44, 0.72, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 20 }}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Sélecteur de Statut Modal */}
      <Modal
        visible={showDurationPicker}
        transparent
        animationType="slide"
        onRequestClose={closeDurationPicker}
      >
        <TouchableOpacity activeOpacity={1} onPress={closeDurationPicker} className="flex-1 bg-black/50 justify-end" style={{ paddingBottom: bottomSheetOffset }}>
          <TouchableOpacity activeOpacity={1} className="bg-zinc-900 rounded-t-3xl p-6 border-t border-white/10" style={{ paddingBottom: bottomSheetFooterPadding }}>
            <View className="flex-row justify-between items-center mb-5">
              <View>
                <Text className="text-lg font-bold text-white">Sélectionner la durée</Text>
                <Text className="text-xs font-semibold text-zinc-500 mt-1">Minutes et secondes</Text>
              </View>
              <TouchableOpacity onPress={closeDurationPicker} className="bg-white/10 border border-white/10 px-4 py-2 rounded-xl">
                <Text className="text-white font-bold">OK</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden relative" style={{ height: BPM_WHEEL_HEIGHT }}>
              <View pointerEvents="none" className="absolute left-4 right-4 border border-white/80 rounded-xl z-0" style={{ top: (BPM_WHEEL_HEIGHT - BPM_OPTION_HEIGHT) / 2, height: BPM_OPTION_HEIGHT }} />
              <View className="flex-1 flex-row px-5">
                <View className="flex-1 flex-row items-center">
                  <FlatList
                    ref={minuteListRef}
                    data={DURATION_MINUTE_OPTIONS}
                    keyExtractor={(item) => `minute-${item}`}
                    renderItem={({ item: minutes }) => (
                      <TouchableOpacity
                        onPress={() => {
                          minuteListRef.current?.scrollToOffset({ offset: minutes * BPM_OPTION_HEIGHT, animated: true });
                          updateDuration(minutes, draftSeconds);
                        }}
                        className="items-end justify-center pr-3"
                        style={{ height: BPM_OPTION_HEIGHT }}
                      >
                        <Text className="text-xl font-semibold text-white" style={{ fontVariant: ['tabular-nums'] }}>{String(minutes).padStart(2, '0')}</Text>
                      </TouchableOpacity>
                    )}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={BPM_OPTION_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(event) => updateDuration(Math.round(event.nativeEvent.contentOffset.y / BPM_OPTION_HEIGHT), draftSeconds)}
                    getItemLayout={(_, index) => ({ length: BPM_OPTION_HEIGHT, offset: BPM_OPTION_HEIGHT * index, index })}
                    contentContainerStyle={{ paddingVertical: (BPM_WHEEL_HEIGHT - BPM_OPTION_HEIGHT) / 2 }}
                    className="flex-1 z-10"
                  />
                  <Text className="w-9 text-sm font-bold text-zinc-400">min</Text>
                </View>

                <View className="flex-1 flex-row items-center">
                  <FlatList
                    ref={secondListRef}
                    data={DURATION_SECOND_OPTIONS}
                    keyExtractor={(item) => `second-${item}`}
                    renderItem={({ item: seconds }) => (
                      <TouchableOpacity
                        onPress={() => {
                          secondListRef.current?.scrollToOffset({ offset: seconds * BPM_OPTION_HEIGHT, animated: true });
                          updateDuration(draftMinutes, seconds);
                        }}
                        className="items-end justify-center pr-3"
                        style={{ height: BPM_OPTION_HEIGHT }}
                      >
                        <Text className="text-xl font-semibold text-white" style={{ fontVariant: ['tabular-nums'] }}>{String(seconds).padStart(2, '0')}</Text>
                      </TouchableOpacity>
                    )}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={BPM_OPTION_HEIGHT}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(event) => updateDuration(draftMinutes, Math.round(event.nativeEvent.contentOffset.y / BPM_OPTION_HEIGHT))}
                    getItemLayout={(_, index) => ({ length: BPM_OPTION_HEIGHT, offset: BPM_OPTION_HEIGHT * index, index })}
                    contentContainerStyle={{ paddingVertical: (BPM_WHEEL_HEIGHT - BPM_OPTION_HEIGHT) / 2 }}
                    className="flex-1 z-10"
                  />
                  <Text className="w-9 text-sm font-bold text-zinc-400">sec</Text>
                </View>
              </View>

              <LinearGradient pointerEvents="none" colors={['rgba(9, 9, 11, 0.98)', 'rgba(9, 9, 11, 0.5)', 'rgba(9, 9, 11, 0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 115, zIndex: 20 }} />
              <LinearGradient pointerEvents="none" colors={['rgba(9, 9, 11, 0)', 'rgba(9, 9, 11, 0.5)', 'rgba(9, 9, 11, 0.98)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 115, zIndex: 20 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showStatusPicker}
        transparent
        animationType="slide"
        onRequestClose={closeStatusPicker}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeStatusPicker}
          className="flex-1 bg-black/40 justify-end"
          style={{ paddingBottom: bottomSheetOffset }}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-zinc-900 rounded-t-3xl p-6 border-t border-white/10"
            style={{ paddingBottom: bottomSheetFooterPadding }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-bold text-white">
                Statut de création
              </Text>
              <TouchableOpacity onPress={closeStatusPicker}>
                <Text className="text-emerald-400 font-bold">Fermer</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3 mb-4 justify-between">
              {([
                { value: 'Idee', label: 'Idée', color: 'bg-indigo-600 border-indigo-500' },
                { value: 'En cours', label: 'En cours', color: 'bg-blue-500 border-blue-500' },
                { value: 'Pret', label: 'Prêt', color: 'bg-emerald-500 border-emerald-500' }
              ] as const).map((opt) => {
                const isSelected = song.status === opt.value;
                if (isSelected) {
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        updateField('status', opt.value);
                        closeStatusPicker();
                      }}
                      className={`flex-1 py-3.5 rounded-xl items-center justify-center border ${opt.color}`}
                    >
                      <Text className="font-bold text-sm text-white">{opt.label}</Text>
                    </TouchableOpacity>
                  );
                } else {
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        updateField('status', opt.value);
                        closeStatusPicker();
                      }}
                      className="flex-1 py-3.5 rounded-xl items-center justify-center border bg-white/5 border-transparent"
                    >
                      <Text className="font-bold text-sm text-zinc-300">{opt.label}</Text>
                    </TouchableOpacity>
                  );
                }
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Sélecteur de Tonalité Modal */}
      <Modal
        visible={showKeyPicker}
        transparent
        animationType="slide"
        onRequestClose={closeKeyPicker}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeKeyPicker}
          className="flex-1 bg-black/40 justify-end"
          style={{ paddingBottom: bottomSheetOffset }}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-zinc-900 rounded-t-3xl p-6 border-t border-white/10"
            style={{ paddingBottom: bottomSheetFooterPadding }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-lg font-bold text-white">
                Sélectionner la Tonalité
              </Text>
              <TouchableOpacity onPress={closeKeyPicker}>
                <Text className="text-emerald-400 font-bold">Fermer</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-2 mb-4 justify-between">
              {/* Option Aucune (—) */}
              {song.key === null ? (
                <TouchableOpacity
                  onPress={() => {
                    updateField('key', null);
                    closeKeyPicker();
                  }}
                  className="w-[22%] py-3.5 mb-2 rounded-xl items-center justify-center border bg-emerald-600 border-emerald-600"
                >
                  <Text className="font-bold text-sm text-white">—</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    updateField('key', null);
                    closeKeyPicker();
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
                        closeKeyPicker();
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
                        closeKeyPicker();
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
        <View className="flex-1 bg-black/60 justify-center items-center px-6" style={{ paddingBottom: bottomSheetOffset }}>
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
