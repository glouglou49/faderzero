import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext } from 'expo-sqlite';
import LZString from 'lz-string';

interface Song {
  id?: string;
  title: string;
  status?: string;
  bpm?: number | null;
  key?: string | null;
  text_content?: string;
  lyrics?: string;
  tempo?: number | null;
  tone?: string | null;
  duration_seconds?: number;
  updated_at?: string;
}

// Générateur robuste UUID v4 compatible React Native
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ReceiveScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [permission, requestPermission] = useCameraPermissions();

  const isScanningRef = useRef(true);
  const [isScanning, setIsScanning] = useState(true);
  const [chunksMap, setChunksMap] = useState<Record<number, string>>({});
  const [totalChunks, setTotalChunks] = useState<number | null>(null);

  // Réinitialiser le scanner pour recommencer
  const resetScanner = () => {
    setChunksMap({});
    setTotalChunks(null);
    isScanningRef.current = true;
    setIsScanning(true);
  };

  // Reconstitution et sauvegarde en base de données SQLite (Upsert intelligent)
  const handleSuccess = async (completedChunks: Record<number, string>, total: number) => {
    try {
      // 1. Concaténer les morceaux dans l'ordre exact
      let fullCompressedString = '';
      for (let i = 1; i <= total; i++) {
        const chunk = completedChunks[i];
        if (!chunk) {
          throw new Error(`Morceau manquant à l'index ${i}`);
        }
        fullCompressedString += chunk;
      }

      // 2. Décompresser
      const decompressed = LZString.decompressFromEncodedURIComponent(fullCompressedString);
      if (!decompressed) {
        throw new Error('Échec de la décompression.');
      }

      // 3. Parser le JSON
      const receivedData = JSON.parse(decompressed) as Song;
      if (!receivedData || typeof receivedData !== 'object') {
        throw new Error('Format de données invalide.');
      }

      // Mapper les propriétés de manière robuste (supporte le schéma de FaderZero et le format alternatif)
      const title = receivedData.title || 'Sans titre';
      const textContent = receivedData.text_content || receivedData.lyrics || '';
      
      let bpm: number | null = null;
      if (receivedData.bpm !== undefined && receivedData.bpm !== null) {
        bpm = Number(receivedData.bpm);
      } else if (receivedData.tempo !== undefined && receivedData.tempo !== null) {
        bpm = Number(receivedData.tempo);
      }
      
      const key = receivedData.key || receivedData.tone || null;
      const status = receivedData.status || 'Idee';
      const durationSeconds = Math.max(0, Number(receivedData.duration_seconds) || 0);

      const songData = { title, textContent, bpm, key, status, durationSeconds };

      // 4. Vérifier si une chanson avec le même titre existe déjà (insensible à la casse)
      const existingSong = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM songs WHERE LOWER(title) = LOWER(?)',
        [title.trim()]
      );

      if (existingSong) {
        // Demander s'il faut remplacer ou annuler
        Alert.alert(
          'Chanson existante',
          `Une chanson avec le titre "${title}" existe déjà. Voulez-vous la remplacer par la version reçue ou annuler ?`,
          [
            {
              text: 'Annuler',
              style: 'cancel',
              onPress: () => {
                resetScanner();
              },
            },
            {
              text: 'Remplacer',
              style: 'destructive',
              onPress: () => updateExistingSong(existingSong.id, songData),
            },
          ],
          { cancelable: false }
        );
      } else {
        // Demander s'il faut ajouter ou annuler
        Alert.alert(
          'Chanson reçue !',
          `Chanson reçue : "${title}". L'ajouter à votre répertoire ?`,
          [
            {
              text: 'Annuler',
              style: 'cancel',
              onPress: () => {
                resetScanner();
              },
            },
            {
              text: 'Oui, ajouter',
              style: 'default',
              onPress: () => insertNewSong(songData),
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      console.error('[Sync Receive] Reconstitution error:', error);
      Alert.alert('Erreur', 'Les données du QR Code scanné sont invalides ou corrompues.');
      resetScanner();
    }
  };

  // Mettre à jour une chanson existante en base
  const updateExistingSong = async (
    id: string,
    songData: {
      title: string;
      textContent: string;
      bpm: number | null;
      key: string | null;
      status: string;
      durationSeconds: number;
    }
  ) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        'UPDATE songs SET title = ?, status = ?, bpm = ?, key = ?, text_content = ?, duration_seconds = ?, updated_at = ? WHERE id = ?',
        [
          songData.title,
          songData.status,
          songData.bpm,
          songData.key,
          songData.textContent,
          songData.durationSeconds,
          now,
          id,
        ]
      );

      Alert.alert('Synchronisation réussie !', `La chanson "${songData.title}" a été mise à jour avec succès !`, [
        {
          text: 'Super',
          onPress: () => {
            router.replace('/repertoire');
          },
        },
      ]);
    } catch (error) {
      console.error('[Sync Receive] Update error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour de la chanson.');
      resetScanner();
    }
  };

  // Enregistrer une nouvelle chanson en base
  const insertNewSong = async (songData: {
    title: string;
    textContent: string;
    bpm: number | null;
    key: string | null;
    status: string;
    durationSeconds: number;
  }) => {
    try {
      const newId = generateUUID();
      const now = new Date().toISOString();

      await db.runAsync(
        'INSERT INTO songs (id, title, status, bpm, key, text_content, duration_seconds, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newId,
          songData.title,
          songData.status,
          songData.bpm,
          songData.key,
          songData.textContent,
          songData.durationSeconds,
          now,
        ]
      );

      Alert.alert('Synchronisation réussie !', `La chanson "${songData.title}" a été ajoutée à votre répertoire !`, [
        {
          text: 'Super',
          onPress: () => {
            router.replace('/repertoire');
          },
        },
      ]);
    } catch (error) {
      console.error('[Sync Receive] Insert error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la création de la chanson.');
      resetScanner();
    }
  };

  // Handler appelé à chaque scan de QR Code
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanningRef.current) return;

    // Format attendu: index/total|data
    const match = data.match(/^(\d+)\/(\d+)\|(.+)$/);
    if (!match) return; // Ignore les QR codes non conformes

    const index = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    const chunkData = match[3];

    if (isNaN(index) || isNaN(total) || !chunkData) return;

    // Valider le nombre total de morceaux
    if (totalChunks === null) {
      setTotalChunks(total);
    } else if (totalChunks !== total) {
      // Ignorer si le total de ce scan ne correspond pas
      return;
    }

    setChunksMap((prev) => {
      // Si on a déjà ce morceau, ne rien faire
      if (prev[index]) return prev;

      const next = { ...prev, [index]: chunkData };
      const receivedCount = Object.keys(next).length;

      // Si tous les morceaux ont été reçus
      if (receivedCount === total) {
        isScanningRef.current = false;
        setIsScanning(false);
        // Exécuter la reconstitution après un léger délai pour éviter les freezes UI
        setTimeout(() => handleSuccess(next, total), 100);
      }

      return next;
    });
  };

  const renderContent = () => {
    // 1. En cours de chargement des permissions
    if (!permission) {
      return (
        <View key="loading" className="flex-1 items-center justify-center bg-black">
          <Text className="text-zinc-400 text-base">Chargement des permissions...</Text>
        </View>
      );
    }

    // 2. Permission refusée / non demandée
    if (!permission.granted) {
      return (
        <View key="denied" className="flex-1 items-center justify-center bg-black px-6">
          <View className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 items-center justify-center mb-6">
            <Ionicons name="camera-outline" size={40} color="#ef4444" />
          </View>
          <Text className="text-white text-xl font-bold text-center mb-2">
            Accès Caméra Requis
          </Text>
          <Text className="text-zinc-400 text-sm text-center mb-8 max-w-[280px] leading-relaxed">
            Pour recevoir une chanson, FaderZero doit pouvoir utiliser votre appareil photo afin de scanner les QR Codes.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            activeOpacity={0.8}
            className="bg-zinc-900 border border-white/10 px-8 py-3.5 rounded-xl shadow-lg active:bg-zinc-800"
          >
            <Text className="text-white font-bold text-sm uppercase tracking-wider">
              Autoriser la Caméra
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    const receivedCount = Object.keys(chunksMap).length;
    const progressText = totalChunks
      ? `Reçu : ${receivedCount} / ${totalChunks} morceaux`
      : 'Scannez le QR Code de la chanson...';

    // 3. Permission accordée
    return (
      <View key="camera-view" className="flex-1 bg-black relative">
        {isScanning && (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        )}

        {/* Overlay d'ombrage et cadre de visée */}
        <View className="absolute inset-0 bg-black/40 items-center justify-center">
          {/* Cadre de visée */}
          <View className="w-[280px] h-[280px] border-2 border-emerald-500 rounded-3xl relative items-center justify-center bg-black/10">
            {/* Coins décoratifs du scanner */}
            <View className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-md" />
            <View className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-md" />
            <View className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-md" />
            <View className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-md" />
            
            <Ionicons
              name={isScanning ? 'scan-outline' : 'checkmark-circle-outline'}
              size={56}
              color={isScanning ? '#10b981' : '#34d399'}
              className="opacity-70"
            />
          </View>

          {/* Statut & Progression */}
          <View className="items-center mt-8 px-6">
            <Text className="text-white text-base font-semibold tracking-wide bg-black/60 px-4 py-2.5 rounded-full overflow-hidden text-center">
              {progressText}
            </Text>

            {receivedCount > 0 && (
              <TouchableOpacity
                onPress={resetScanner}
                activeOpacity={0.7}
                className="mt-4 bg-zinc-900/80 border border-zinc-800 px-5 py-2.5 rounded-full"
              >
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                  Réinitialiser le scan
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      {/* En-tête / Barre de navigation */}
      <View className="flex-row items-center px-4 py-3 border-b border-zinc-900 z-10 bg-black">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="flex-row items-center justify-center py-2 pr-4"
        >
          <Ionicons name="chevron-back" size={22} color="white" style={{ marginRight: 4 }} />
          <Text className="text-white text-base font-medium">Retour</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center pr-16">
          <Text className="text-white text-lg font-bold tracking-tight">Recevoir</Text>
        </View>
      </View>

      {/* Contenu principal */}
      {renderContent()}
    </SafeAreaView>
  );
}
