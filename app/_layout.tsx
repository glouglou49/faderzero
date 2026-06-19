import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { View } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

async function initializeDatabase(db: SQLiteDatabase) {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT,
        bpm INTEGER,
        key TEXT,
        text_content TEXT,
        updated_at TEXT
      );
    `);
    console.log('[SQLite] Table songs initialisée avec succès.');
  } catch (error) {
    console.error('[SQLite] Erreur lors de l\'initialisation de la table songs :', error);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SQLiteProvider databaseName="faderzero.db" onInit={initializeDatabase}>
      <View className="flex-1 bg-black">
        <ThemeProvider value={DarkTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="song/[id]" />
            <Stack.Screen name="live/metronome" />
            <Stack.Screen name="live/prompter" />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </View>
    </SQLiteProvider>
  );
}
