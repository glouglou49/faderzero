import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { View } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

export const unstable_settings = {
  anchor: '(tabs)',
};

async function initializeDatabase(db: SQLiteDatabase) {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT,
        bpm INTEGER,
        key TEXT,
        text_content TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS setlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS setlist_songs (
        setlist_id TEXT,
        song_id TEXT,
        position INTEGER,
        segue INTEGER DEFAULT 0,
        annotation TEXT,
        pdf_show_bpm INTEGER DEFAULT 0,
        pdf_show_key INTEGER DEFAULT 0,
        pdf_show_duration INTEGER DEFAULT 0,
        PRIMARY KEY (setlist_id, song_id)
      );

      CREATE INDEX IF NOT EXISTS idx_setlist_songs_order
        ON setlist_songs (setlist_id, position);
    `);

    const songColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(songs)');
    if (!songColumns.some((column) => column.name === 'duration_seconds')) {
      await db.execAsync('ALTER TABLE songs ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;');
    }

    const setlistSongColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(setlist_songs)');
    if (!setlistSongColumns.some((column) => column.name === 'segue')) {
      await db.execAsync('ALTER TABLE setlist_songs ADD COLUMN segue INTEGER DEFAULT 0;');
    }
    if (!setlistSongColumns.some((column) => column.name === 'annotation')) {
      await db.execAsync('ALTER TABLE setlist_songs ADD COLUMN annotation TEXT;');
    }
    if (!setlistSongColumns.some((column) => column.name === 'pdf_show_bpm')) {
      await db.execAsync('ALTER TABLE setlist_songs ADD COLUMN pdf_show_bpm INTEGER DEFAULT 0;');
    }
    if (!setlistSongColumns.some((column) => column.name === 'pdf_show_key')) {
      await db.execAsync('ALTER TABLE setlist_songs ADD COLUMN pdf_show_key INTEGER DEFAULT 0;');
    }
    if (!setlistSongColumns.some((column) => column.name === 'pdf_show_duration')) {
      await db.execAsync('ALTER TABLE setlist_songs ADD COLUMN pdf_show_duration INTEGER DEFAULT 0;');
    }
    console.log('[SQLite] Table songs et transitions initialisées avec succès.');
  } catch (error) {
    console.error('[SQLite] Erreur lors de l\'initialisation de la table songs :', error);
  }
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="faderzero.db" onInit={initializeDatabase}>
      <View className="flex-1 bg-black">
        <ThemeProvider value={DarkTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="song/[id]" />
            <Stack.Screen name="setlist/[id]" />
            <Stack.Screen name="live/metronome" />
            <Stack.Screen name="live/prompter" />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </View>
    </SQLiteProvider>
  );
}
