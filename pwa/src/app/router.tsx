import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { MetronomePage } from '@/features/metronome/MetronomePage';
import { PrompterPage } from '@/features/prompter/PrompterPage';
import { SetlistDetailPage } from '@/features/setlists/SetlistDetailPage';
import { SetlistsPage } from '@/features/setlists/SetlistsPage';
import { SongDetailPage } from '@/features/songs/SongDetailPage';
import { SongsPage } from '@/features/songs/SongsPage';
import { SyncPage } from '@/features/sync/SyncPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/songs" replace />} />
        <Route path="/songs" element={<SongsPage />} />
        <Route path="/songs/:songId" element={<SongDetailPage />} />
        <Route path="/setlists" element={<SetlistsPage />} />
        <Route path="/setlists/:setlistId" element={<SetlistDetailPage />} />
        <Route path="/prompter" element={<PrompterPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/metronome" element={<MetronomePage />} />
      </Route>
    </Routes>
  );
}
