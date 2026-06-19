import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export type SongStatus = 'Idee' | 'En cours' | 'Pret';

export interface Song {
  id: string;
  title: string;
  status: SongStatus;
  bpm: number | null;
  key: string | null;
  text_content: string;
  updated_at: string;
}

// Robuste UUID v4 Generator compatible React Native / Expo
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Ignorer l'erreur et utiliser le fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function RepertoireScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [creationError, setCreationError] = useState('');

  // Charger les chansons depuis SQLite
  const loadSongs = useCallback(async () => {
    try {
      const result = await db.getAllAsync<Song>(
        'SELECT * FROM songs ORDER BY updated_at DESC'
      );
      setSongs(result || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des chansons:', error);
    }
  }, [db]);

  // Re-charger les chansons à chaque fois que la vue redevient active
  useFocusEffect(
    useCallback(() => {
      loadSongs();
    }, [loadSongs])
  );

  // Valider et créer une chanson en base avec contrôle d'unicité
  const validateAndCreateSong = async () => {
    const titleTrimmed = newSongTitle.trim();
    if (!titleTrimmed) {
      setCreationError('Le titre ne peut pas être vide.');
      return;
    }

    try {
      // Vérifier si une chanson avec ce titre exact existe déjà (insensible à la casse)
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM songs WHERE LOWER(title) = LOWER(?)',
        [titleTrimmed]
      );

      if (existing) {
        setCreationError('Ce titre existe déjà, veuillez le modifier.');
        return;
      }

      // Créer la chanson en base
      const newId = generateUUID();
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO songs (id, title, status, bpm, key, text_content, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newId, titleTrimmed, 'Idee', null, null, '', now]
      );

      // Réinitialiser les états et fermer la modale
      setNewSongTitle('');
      setCreationError('');
      setShowCreateModal(false);

      // Rediriger vers l'éditeur
      router.push(`/song/${newId}`);
    } catch (error) {
      console.error('Erreur lors de la validation/création de la chanson:', error);
      setCreationError('Une erreur est survenue lors de la création.');
    }
  };

  // Filtrer les chansons
  const filteredSongs = songs.filter(song =>
    (song.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Formatter la date de mise à jour
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Rendu de l'état du badge
  const renderStatusBadge = (status: SongStatus) => {
    switch (status) {
      case 'Idee':
        return (
          <View className="bg-amber-950/40 border border-amber-900/50 px-2.5 py-0.5 rounded-full">
            <Text className="text-xs font-semibold text-amber-400">Idée</Text>
          </View>
        );
      case 'En cours':
        return (
          <View className="bg-blue-950/40 border border-blue-900/50 px-2.5 py-0.5 rounded-full">
            <Text className="text-xs font-semibold text-blue-400">En cours</Text>
          </View>
        );
      case 'Pret':
        return (
          <View className="bg-emerald-950/40 border border-emerald-900/50 px-2.5 py-0.5 rounded-full">
            <Text className="text-xs font-semibold text-emerald-400">Prêt</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="flex-1 px-5 pt-4">
        {/* En-tête principal */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-3xl font-extrabold text-white tracking-tight">
              Répertoire
            </Text>
            <Text className="text-sm text-zinc-400 font-medium">
              {songs.length} {songs.length <= 1 ? 'chanson' : 'chansons'} au total
            </Text>
          </View>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => {
                setShowCreateModal(true);
                setNewSongTitle('');
                setCreationError('');
              }}
              activeOpacity={0.8}
              className="bg-indigo-600 dark:bg-indigo-500 px-3.5 py-2.5 rounded-xl shadow-md flex-row items-center"
            >
              <Text className="text-white font-bold text-sm">
                + Nouvelle
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Barre de recherche */}
        {songs.length > 0 && (
          <View className="mb-4">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher une chanson..."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm"
            />
          </View>
        )}

        {/* Liste ou État Vide */}
        {filteredSongs.length === 0 ? (
          <View className="flex-1 items-center justify-center py-10">
            <View className="w-20 h-20 bg-white/5 rounded-full items-center justify-center mb-4 border border-white/10">
              <Text className="text-3xl">🎵</Text>
            </View>
            <Text className="text-lg font-bold text-white text-center mb-2">
              {searchQuery ? 'Aucun résultat trouvé' : 'Votre répertoire est vide'}
            </Text>
            <Text className="text-sm text-zinc-400 text-center max-w-[280px] leading-relaxed mb-6">
              {searchQuery
                ? 'Essayez de modifier votre recherche ou videz le filtre.'
                : 'Créez votre première idée de chanson en cliquant sur le bouton ci-dessous.'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(true);
                  setNewSongTitle('');
                  setCreationError('');
                }}
                activeOpacity={0.8}
                className="bg-indigo-600 dark:bg-indigo-500 px-6 py-3.5 rounded-xl shadow-md"
              >
                <Text className="text-white font-bold text-base">
                  Créer ma première chanson
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredSongs}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/song/${item.id}`)}
                activeOpacity={0.7}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3.5 flex-row justify-between items-center"
              >
                <View className="flex-1 mr-4">
                  <Text className="text-base font-bold text-white mb-1" numberOfLines={1}>
                    {item.title || 'Chanson sans titre'}
                  </Text>
                  
                  <View className="flex-row items-center flex-wrap gap-x-2.5 gap-y-1 mt-1.5">
                    {/* BPM & Key */}
                    {(item.bpm !== null || item.key) ? (
                      <Text className="text-xs font-semibold text-zinc-400">
                        {item.bpm ? `${item.bpm} BPM` : '— BPM'} • {item.key || '— Ton'}
                      </Text>
                    ) : (
                      <Text className="text-xs font-semibold text-zinc-500">
                        Paramètres non définis
                      </Text>
                    )}
                    
                    {/* Séparateur */}
                    <Text className="text-[10px] text-zinc-700">•</Text>

                    {/* Date */}
                    <Text className="text-xs text-zinc-400">
                      Modifié le {formatDate(item.updated_at)}
                    </Text>
                  </View>
                </View>

                {/* Badge de statut */}
                <View className="justify-center items-end">
                  {renderStatusBadge(item.status)}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Modal de Création de Chanson */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <Text className="text-lg font-bold text-white mb-4">
              Nouvelle Chanson
            </Text>

            <TextInput
              value={newSongTitle}
              onChangeText={(text) => {
                setNewSongTitle(text);
                if (creationError) setCreationError('');
              }}
              placeholder="Saisissez le titre de la chanson"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              autoFocus
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-2"
            />

            {creationError ? (
               <Text className="text-xs font-semibold text-rose-500 mb-4 px-1">
                 {creationError}
               </Text>
            ) : (
               <View className="h-4 mb-2" />
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                activeOpacity={0.7}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 items-center justify-center"
              >
                <Text className="text-zinc-300 font-semibold text-sm">
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={validateAndCreateSong}
                activeOpacity={0.7}
                className="flex-1 bg-indigo-600 rounded-xl py-3 items-center justify-center"
              >
                <Text className="text-white font-bold text-sm">
                  Créer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
