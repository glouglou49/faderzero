import { supabase } from './client';
import { getSession } from './auth';

export function subscribeToWorkspaceChanges(
  workspaceId: string,
  onChange: (tableName: string) => void
) {
  const channel = supabase
    .channel(`workspace:${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      async (payload) => {
        try {
          const session = await getSession();
          const currentUserId = session?.user?.id;

          const lastModifiedBy = payload.new ? (payload.new as any).last_modified_by : null;

          if (currentUserId && lastModifiedBy === currentUserId) {
            // Ignorer car cette modification provient de l'utilisateur lui-même
            return;
          }

          onChange(payload.table);
        } catch (err) {
          console.error('[Realtime Event Handler Error]', err);
          // Fallback : notifier quand même par précaution
          onChange(payload.table);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
