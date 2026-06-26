import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
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
  pdf_show_bpm?: number;
  pdf_show_key?: number;
  pdf_show_duration?: number;
}

const singleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds || 0);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

const escapeHTML = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatPdfDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const sanitizePdfFileName = (value: string) => value
  .trim()
  .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getTransitionDetailParts = (song: SetlistSong) => {
  const parts: string[] = [];
  if (song.pdf_show_bpm === 1 && song.bpm) {
    parts.push(`${song.bpm} BPM`);
  }
  if (song.pdf_show_key === 1 && song.key) {
    parts.push(song.key);
  }
  if (song.pdf_show_duration === 1) {
    parts.push(formatDuration(song.duration_seconds));
  }

  return parts;
};

const getSongComment = (song: SetlistSong) => song.annotation?.trim() || '';
const getSongNotesLine = (song: SetlistSong) => {
  const parts: string[] = [];
  const comment = getSongComment(song);
  const metaParts = getTransitionDetailParts(song);

  if (comment) {
    parts.push(`[${comment}]`);
  }
  if (metaParts.length > 0) {
    parts.push(metaParts.join(' · '));
  }

  return parts.join(' · ');
};

const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
const PDF_PAGE_MARGIN_MM = 3;
const PDF_MM_TO_PX = 96 / 25.4;
const PDF_HEADER_BOTTOM_MARGIN = 8;
const PDF_CONTENT_WIDTH = 312;
const PDF_TITLE_FONT_SIZE = 12;
const PDF_TITLE_LINE_HEIGHT = 16;
const PDF_SONG_TITLE_FONT_SIZE = 16;
const PDF_SONG_TITLE_LINE_HEIGHT = 24;
const PDF_SONG_META_FONT_SIZE = 7;
const PDF_SONG_META_LINE_HEIGHT = 9;
const PDF_SONG_NOTE_FONT_SIZE = 7;
const PDF_SONG_NOTE_LINE_HEIGHT = 9;
const PDF_SONG_ENTRY_HEIGHT = 44;
const PDF_SONGS_LIST_LEFT_PADDING = 20;
const PDF_TRANSITION_ARROW_WIDTH = 20;
const PDF_TRANSITION_ARROW_HEIGHT = 46;
const PDF_MIN_CONTENT_SCALE = 1.85;
const PDF_MEDIUM_CONTENT_SCALE = 2.1;
const PDF_MAX_CONTENT_SCALE = 2.35;
const PDF_HEADER_HEIGHT_PX = PDF_TITLE_LINE_HEIGHT + PDF_HEADER_BOTTOM_MARGIN;

const getPdfContentScale = (songCount: number) => {
  if (songCount <= 8) return PDF_MAX_CONTENT_SCALE;
  if (songCount <= 12) return PDF_MEDIUM_CONTENT_SCALE;
  return PDF_MIN_CONTENT_SCALE;
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
  const [modalShowBpm, setModalShowBpm] = useState(false);
  const [modalShowKey, setModalShowKey] = useState(false);
  const [modalShowDuration, setModalShowDuration] = useState(false);

  const loadSetlist = useCallback(async () => {
    if (!setlistId) return;
    try {
      const [setlistRow, songRows] = await Promise.all([
        db.getFirstAsync<Setlist>('SELECT * FROM setlists WHERE id = ?', [setlistId]),
        db.getAllAsync<SetlistSong>(`
          SELECT
            s.id,
            s.title,
            s.bpm,
            s.key,
            s.duration_seconds,
            ss.position,
            ss.segue,
            ss.annotation,
            ss.pdf_show_bpm,
            ss.pdf_show_key,
            ss.pdf_show_duration
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
    setModalShowBpm(song.pdf_show_bpm === 1);
    setModalShowKey(song.pdf_show_key === 1);
    setModalShowDuration(song.pdf_show_duration === 1);
    setShowTransitionModal(true);
  };

  const saveTransition = async () => {
    if (!editingSong || !setlistId) return;
    try {
      const segueValue = modalSegue ? 1 : 0;
      const annotationValue = modalAnnotation.trim() || null;
      const showBpmValue = modalShowBpm ? 1 : 0;
      const showKeyValue = modalShowKey ? 1 : 0;
      const showDurationValue = modalShowDuration ? 1 : 0;
      await db.runAsync(
        `UPDATE setlist_songs
         SET segue = ?, annotation = ?, pdf_show_bpm = ?, pdf_show_key = ?, pdf_show_duration = ?
         WHERE setlist_id = ? AND song_id = ?`,
        [segueValue, annotationValue, showBpmValue, showKeyValue, showDurationValue, setlistId, editingSong.id]
      );
      setShowTransitionModal(false);
      await loadSetlist();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la transition :', error);
    }
  };

  const generateHTML = () => {
    if (!setlist) return '';
    const pdfContentScale = getPdfContentScale(songs.length);
    const pdfInnerPageHeightPx = ((PDF_PAGE_HEIGHT_MM - (PDF_PAGE_MARGIN_MM * 2)) * PDF_MM_TO_PX);
    const pdfScaledContentHeightPx = Math.max(0, (pdfInnerPageHeightPx - PDF_HEADER_HEIGHT_PX) / pdfContentScale);
    const pdfMaxSongsPerPage = Math.max(1, Math.floor(pdfScaledContentHeightPx / PDF_SONG_ENTRY_HEIGHT));
    const renderSongEntryHTML = (song: SetlistSong, globalIndex: number) => {
      const isLast = globalIndex === songs.length - 1;
      const notesLine = getSongNotesLine(song);
      const metaParts = notesLine ? [notesLine] : [];
      const commentText = '';
      const metaText = metaParts.length > 0 ? metaParts.join(' · ') : '';
      const arrowMarkerId = `transition-arrow-${globalIndex}`;

      return `
        <div class="song-entry">
          ${song.segue === 1 && !isLast ? `
            <svg class="transition-arrow" viewBox="0 0 64 84" aria-hidden="true">
              <defs>
                <marker id="${arrowMarkerId}" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
                  <polygon points="0 1, 6 4, 0 7" fill="#1c1917" />
                </marker>
              </defs>
              <path
                d="M 50,18 C 15,18 15,66 43,66"
                fill="none"
                stroke="#1c1917"
                stroke-width="3.5"
                stroke-linecap="round"
                marker-end="url(#${arrowMarkerId})"
              />
            </svg>
          ` : ''}
          ${metaText ? `<div class="song-meta">${escapeHTML(metaText)}</div>` : ''}
          ${commentText ? `<div class="song-comment">[${escapeHTML(commentText)}]</div>` : ''}
          <div class="song-title">${escapeHTML(song.title || 'Sans titre')}</div>
        </div>
      `;
    };

    const songPages: SetlistSong[][] = [];
    for (let index = 0; index < songs.length; index += pdfMaxSongsPerPage) {
      songPages.push(songs.slice(index, index + pdfMaxSongsPerPage));
    }

    const pagesHTML = songPages.map((pageSongs, pageIndex) => {
      const songRowsHTML = pageSongs
        .map((song, songIndex) => renderSongEntryHTML(song, (pageIndex * pdfMaxSongsPerPage) + songIndex))
        .join('');

      return `
        <div class="page">
          <div class="header">
            <h1 class="title">${escapeHTML(setlist.name)}</h1>
          </div>
          <div class="songs-content">
            <div class="songs-list">
              ${songRowsHTML}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHTML(setlist?.name ?? '')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: ${PDF_PAGE_WIDTH_MM}mm ${PDF_PAGE_HEIGHT_MM}mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
          }
          html,
          body {
            width: ${PDF_PAGE_WIDTH_MM}mm;
            min-height: ${PDF_PAGE_HEIGHT_MM}mm;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #000000;
          }
          .page {
            width: ${PDF_PAGE_WIDTH_MM}mm;
            min-height: ${PDF_PAGE_HEIGHT_MM}mm;
            padding: ${PDF_PAGE_MARGIN_MM}mm;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
          .page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .songs-content {
            width: calc(100% / ${pdfContentScale});
            transform: scale(${pdfContentScale});
            transform-origin: top left;
          }
          .header {
            margin-bottom: ${PDF_HEADER_BOTTOM_MARGIN}px;
          }
          .title {
            overflow: hidden;
            margin: 0;
            color: #1c1917;
            font-size: ${PDF_TITLE_FONT_SIZE}px;
            font-weight: 800;
            letter-spacing: 0.12em;
            line-height: ${PDF_TITLE_LINE_HEIGHT}px;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .songs-list {
            position: relative;
            width: 100%;
            padding: 0;
          }
          .song-entry {
            position: relative;
            width: 100%;
            height: ${PDF_SONG_ENTRY_HEIGHT}px;
            padding-left: ${PDF_SONGS_LIST_LEFT_PADDING}px;
          }
          .song-meta {
            width: 100%;
            height: ${PDF_SONG_META_LINE_HEIGHT}px;
            overflow: hidden;
            color: #737373;
            font-size: ${PDF_SONG_META_FONT_SIZE}px;
            font-weight: 800;
            letter-spacing: 0.08em;
            line-height: ${PDF_SONG_META_LINE_HEIGHT}px;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .song-comment {
            width: 100%;
            height: ${PDF_SONG_NOTE_LINE_HEIGHT}px;
            overflow: hidden;
            color: #a8a29e;
            font-size: ${PDF_SONG_NOTE_FONT_SIZE}px;
            font-style: italic;
            font-weight: 800;
            letter-spacing: 0.1em;
            line-height: ${PDF_SONG_NOTE_LINE_HEIGHT}px;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .song-title {
            display: block;
            width: 100%;
            height: ${PDF_SONG_TITLE_LINE_HEIGHT}px;
            overflow: hidden;
            color: #000000;
            font-size: ${PDF_SONG_TITLE_FONT_SIZE}px;
            font-weight: 900;
            letter-spacing: 0.025em;
            line-height: ${PDF_SONG_TITLE_LINE_HEIGHT}px;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .transition-arrow {
            position: absolute;
            z-index: 1;
            top: 0;
            left: 0;
            width: ${PDF_TRANSITION_ARROW_WIDTH}px;
            height: ${PDF_TRANSITION_ARROW_HEIGHT}px;
            overflow: visible;
          }
        </style>
      </head>
      <body>
        ${pagesHTML}
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
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        width: 612,
        height: 792,
        textZoom: Platform.OS === 'android' ? 112 : 100,
      });
      const exportDate = formatPdfDate(new Date());
      const setlistName = sanitizePdfFileName(setlist?.name || 'Setlist') || 'Setlist';
      const pdfFile = new File(uri);
      const pdfDirectoryUri = uri.slice(0, uri.lastIndexOf('/') + 1);
      const renamedPdfFile = new File(`${pdfDirectoryUri}${setlistName}_${exportDate}.pdf`);
      if (renamedPdfFile.exists) {
        renamedPdfFile.delete();
      }
      pdfFile.move(renamedPdfFile);
      if (Platform.OS === 'web') {
        return;
      }
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert('Partage indisponible', 'Le partage de fichiers n\'est pas disponible sur cet appareil.');
        return;
      }
      await Sharing.shareAsync(renamedPdfFile.uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Exporter la setlist ${setlist?.name} (${exportDate})`,
      });
    } catch (error) {
      console.error('Erreur lors de la génération du PDF :', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF.');
    }
  };

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);
  const totalDuration = useMemo(() => songs.reduce((total, song) => total + (song.duration_seconds || 0), 0), [songs]);
  const selectedPdfDetails = useMemo(() => {
    const details: string[] = [];
    if (modalShowBpm) details.push('Tempo');
    if (modalShowKey) details.push('Tonalité');
    if (modalShowDuration) details.push('Durée');
    return details;
  }, [modalShowBpm, modalShowDuration, modalShowKey]);
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
        renderItem={({ item, index }) => {
          const previousSong = index > 0 ? songs[index - 1] : null;
          const hasSegue = item.segue === 1;
          const songNotesLine = getSongNotesLine(item);
          const songDetailParts = songNotesLine ? [songNotesLine] : [];
          const songDetailsText = songDetailParts.length > 0 ? songDetailParts.join(' · ') : '';
          const songComment = '';
          const transitionDetailParts = songDetailParts;
          const hasTransitionDetails = transitionDetailParts.length > 0;

          return (
          <View>
            {true && (
              <TouchableOpacity
                onPress={() => openTransitionModal(item, index)}
                activeOpacity={0.7}
                className="mb-2 flex-row items-start pl-5 pr-2"
              >
                <View className="mr-2 w-8 items-center justify-start">
                  {hasSegue ? (
                    <Svg width={14} height={38} viewBox="0 0 14 38">
                      <Path
                        d="M 7 4 L 7 28"
                        stroke="#818cf8"
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                      />
                      <Path
                        d="M 3 24 L 7 30 L 11 24"
                        stroke="#818cf8"
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  ) : (
                    <View className="h-7 w-[2px] rounded bg-zinc-700" />
                  )}
                </View>

                <View className="flex-1 justify-center py-0.5">
                  {hasTransitionDetails ? (
                    <Text className="text-sm font-semibold italic text-zinc-400">
                      {transitionDetailParts.join(' · ')}
                    </Text>
                  ) : hasSegue ? (
                    <Text className="text-indigo-400/70 text-xs font-bold uppercase tracking-wider">Enchaînement direct</Text>
                  ) : (
                    <Text className="text-zinc-600/40 text-xs font-bold uppercase tracking-wider">Ajouter une transition...</Text>
                  )}
                  {songComment ? (
                    <Text className="mt-1 text-xs italic text-zinc-500" numberOfLines={1}>
                      [{songComment}]
                    </Text>
                  ) : null}
                </View>

                <View className="h-8 w-8 items-center justify-center rounded-xl border border-white/5 bg-white/5">
                  <Ionicons name="create-outline" size={14} color={hasSegue || hasTransitionDetails || !!songComment ? '#818cf8' : '#71717a'} />
                </View>
              </TouchableOpacity>
            )}

            <View className="flex-row items-center rounded-3xl border border-white/10 bg-white/5 p-4">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-indigo-400/10">
                <Text className="font-black text-indigo-300" style={{ fontVariant: ['tabular-nums'] }}>{index + 1}</Text>
              </View>
              <View className="flex-1 pr-3">
                <Text className="text-xs text-zinc-500">{item.bpm ? `${item.bpm} BPM` : '— BPM'} · {item.key || '— Ton'} · {formatDuration(item.duration_seconds)}</Text>
                <Text className="mt-1 font-extrabold text-white" numberOfLines={1}>{item.title || 'Sans titre'}</Text>
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

            {false && index < songs.length - 1 && (
              <TouchableOpacity
                onPress={() => openTransitionModal(item, index)}
                activeOpacity={0.7}
                className="mt-2 flex-row items-start pl-5 pr-2"
              >
                <View className="mr-2 w-8 items-center justify-start">
                  {item.segue === 1 ? (
                    <Svg width={14} height={38} viewBox="0 0 14 38">
                      <Path
                        d="M 7 4 L 7 28"
                        stroke="#818cf8"
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                      />
                      <Path
                        d="M 3 24 L 7 30 L 11 24"
                        stroke="#818cf8"
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  ) : (
                    <View className="h-7 w-[2px] rounded bg-zinc-700" />
                  )}
                </View>

                <View className="flex-1 justify-center py-0.5">
                  {hasTransitionDetails ? (
                    <Text className="text-sm font-semibold italic text-zinc-400">
                      {transitionDetailParts.join(' · ')}
                    </Text>
                  ) : item.segue === 1 ? (
                    <Text className="text-indigo-400/70 text-xs font-bold uppercase tracking-wider">Enchaînement direct</Text>
                  ) : (
                    <Text className="text-zinc-600/40 text-xs font-bold uppercase tracking-wider">Ajouter une transition...</Text>
                  )}
                </View>

                <View className="h-8 w-8 items-center justify-center rounded-xl border border-white/5 bg-white/5">
                  <Ionicons name="create-outline" size={14} color={item.segue === 1 || hasTransitionDetails ? '#818cf8' : '#71717a'} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}}
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
                      <Text className="text-xs text-zinc-500">{item.bpm ? `${item.bpm} BPM` : '— BPM'} · {item.key || '— Ton'} · {formatDuration(item.duration_seconds)}</Text>
                      <Text className="mt-1 font-bold text-white">{item.title || 'Sans titre'}</Text>
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

              <View className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Text className="mb-3 text-sm font-bold text-zinc-300">Ligne de note dans le PDF</Text>
                <Text className="mb-3 text-xs leading-5 text-zinc-400">
                  {selectedPdfDetails.length > 0
                    ? `Affiché actuellement : ${selectedPdfDetails.join(', ')}`
                    : 'Affiché actuellement : aucun détail'}
                </Text>

                <View className="gap-y-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 pr-4 text-sm text-zinc-300">Afficher le tempo</Text>
                    <TouchableOpacity
                      onPress={() => setModalShowBpm(!modalShowBpm)}
                      activeOpacity={0.8}
                      className={`h-7 w-12 rounded-full p-1 flex-row ${modalShowBpm ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'}`}
                    >
                      <View className="h-5 w-5 rounded-full bg-white" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 pr-4 text-sm text-zinc-300">Afficher la tonalité</Text>
                    <TouchableOpacity
                      onPress={() => setModalShowKey(!modalShowKey)}
                      activeOpacity={0.8}
                      className={`h-7 w-12 rounded-full p-1 flex-row ${modalShowKey ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'}`}
                    >
                      <View className="h-5 w-5 rounded-full bg-white" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 pr-4 text-sm text-zinc-300">Afficher la durée</Text>
                    <TouchableOpacity
                      onPress={() => setModalShowDuration(!modalShowDuration)}
                      activeOpacity={0.8}
                      className={`h-7 w-12 rounded-full p-1 flex-row ${modalShowDuration ? 'bg-indigo-600 justify-end' : 'bg-zinc-800 justify-start'}`}
                    >
                      <View className="h-5 w-5 rounded-full bg-white" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <Text className="text-[11px] uppercase tracking-wider text-zinc-500">Aperçu de la ligne de note</Text>
                  <Text className="mt-1 text-sm text-zinc-200">
                    {[
                      modalAnnotation.trim() || null,
                      modalShowBpm ? 'Tempo' : null,
                      modalShowKey ? 'Tonalité' : null,
                      modalShowDuration ? 'Durée' : null,
                    ].filter(Boolean).join(' · ') || 'Aucun élément affiché'}
                  </Text>
                </View>
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
