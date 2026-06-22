import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import LZString from 'lz-string';
import QRCode from 'react-native-qrcode-svg';

const CHUNK_SIZE = 250;

interface Song {
  id: string;
  title: string;
  status: string;
  bpm: number | null;
  key: string | null;
  text_content: string;
  duration_seconds: number;
  updated_at: string;
}

export default function TransmitScreen() {
  const router = useRouter();
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const db = useSQLiteContext();

  const [isLoading, setIsLoading] = useState(true);
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [songTitle, setSongTitle] = useState<string>('');

  // 1. Charger et traiter la chanson au montage
  useEffect(() => {
    let isMounted = true;

    async function loadAndPrepareData() {
      try {
        if (!songId) {
          setErrorMsg('Aucun identifiant de chanson fourni.');
          setIsLoading(false);
          return;
        }

        // Récupérer uniquement la chanson correspondant à l'ID
        const song = await db.getFirstAsync<Song>(
          'SELECT * FROM songs WHERE id = ?',
          [songId]
        );
        
        if (!isMounted) return;

        if (!song) {
          setErrorMsg('Chanson introuvable dans le répertoire.');
          setIsLoading(false);
          return;
        }

        setSongTitle(song.title || 'Sans titre');

        // Convertir la chanson en JSON string
        const jsonString = JSON.stringify(song);

        // Compresser en URI component sécurisé
        const compressed = LZString.compressToEncodedURIComponent(jsonString);

        // Découper en morceaux de CHUNK_SIZE (250) caractères
        const rawChunks: string[] = [];
        for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
          rawChunks.push(compressed.substring(i, i + CHUNK_SIZE));
        }

        const total = rawChunks.length;
        // Formater chaque chunk : index/total|data
        const formattedChunks = rawChunks.map((data, index) => `${index + 1}/${total}|${data}`);

        setChunks(formattedChunks);
        setErrorMsg(null);
        setIsLoading(false);
      } catch (error) {
        console.error('[Sync Transmit] Échec de la préparation de la chanson:', error);
        if (isMounted) {
          setErrorMsg('Erreur lors de la préparation des données de la chanson.');
          setIsLoading(false);
        }
      }
    }

    loadAndPrepareData();

    return () => {
      isMounted = false;
    };
  }, [db, songId]);

  // 2. Animer la boucle de QR Codes à intervalle de 200ms
  useEffect(() => {
    if (chunks.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentChunkIndex((prev) => (prev + 1) % chunks.length);
    }, 200);

    return () => clearInterval(interval);
  }, [chunks]);

  const currentChunk = chunks[currentChunkIndex];

  const renderQRSection = () => {
    if (isLoading) {
      return (
        <View key="loader" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ 
            width: 300, 
            height: 300, 
            borderWidth: 1, 
            borderStyle: 'dashed', 
            borderColor: '#3f3f46', 
            borderRadius: 24, 
            backgroundColor: 'rgba(24, 24, 27, 0.3)', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginBottom: 24 
          }}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
          <Text className="text-zinc-400 text-base font-medium tracking-wide">
            Préparation de la chanson...
          </Text>
        </View>
      );
    }

    if (errorMsg) {
      return (
        <View key="error" style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <View style={{ 
            width: 300, 
            height: 300, 
            borderWidth: 1, 
            borderStyle: 'dashed', 
            borderColor: 'rgba(239, 68, 68, 0.4)', 
            borderRadius: 24, 
            backgroundColor: 'rgba(127, 29, 29, 0.1)', 
            alignItems: 'center', 
            justifyContent: 'center', 
            marginBottom: 24 
          }}>
            <Ionicons name="alert-circle-outline" size={64} color="#f87171" />
          </View>
          <Text className="text-red-400 text-sm text-center font-medium max-w-[280px]">
            {errorMsg}
          </Text>
        </View>
      );
    }

    return (
      <View key="qr-section" style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* Titre de la chanson partagée */}
        <Text className="text-white text-lg font-bold tracking-tight mb-6 text-center max-w-[280px]" numberOfLines={1}>
          Partage de : {songTitle}
        </Text>

        {/* Conteneur pour le centrage du QRCode avec style en ligne pur pour éviter tout conflit CSS interop */}
        <View style={{ 
          width: 300, 
          height: 300, 
          backgroundColor: 'white', 
          borderRadius: 24, 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: 24, 
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 5
        }}>
          <QRCode
            value={currentChunk || "loading"}
            size={250}
            color="black"
            backgroundColor="white"
          />
        </View>
        
        {/* Statut de la transmission */}
        <View className="items-center">
          <Text className="text-white text-base font-bold tracking-wide">
            Envoi en cours...
          </Text>
          <Text className="text-zinc-400 text-sm font-medium mt-1">
            Partie {currentChunkIndex + 1} / {chunks.length}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      {/* En-tête / Barre de navigation */}
      <View className="flex-row items-center px-4 py-3 border-b border-zinc-900">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="flex-row items-center justify-center py-2 pr-4"
        >
          <Ionicons name="chevron-back" size={22} color="white" style={{ marginRight: 4 }} />
          <Text className="text-white text-base font-medium">Retour</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center pr-16">
          <Text className="text-white text-lg font-bold tracking-tight">Partager</Text>
        </View>
      </View>

      {/* Contenu principal */}
      <View className="flex-1 items-center justify-center px-6">
        {renderQRSection()}
      </View>
    </SafeAreaView>
  );
}
