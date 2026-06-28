import { useEffect } from 'react';
import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/components/LoginPage';
import { WorkspaceSelectionPage } from '@/components/WorkspaceSelectionPage';

function AppContent() {
  const { session, activeWorkspace, loading, initialize, initialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] text-[#f5f0ea]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-orange-500 mx-auto mb-4" />
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/40">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  if (!activeWorkspace) {
    return <WorkspaceSelectionPage />;
  }

  return <AppRouter />;
}

export function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}
