import { supabase } from './client';
import { getSession } from './auth';

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const session = await getSession();
  if (!session || !session.user) {
    throw new Error('User must be authenticated to create a workspace');
  }
  const userId = session.user.id;

  // 1. Insertion du workspace
  const { data: workspaceData, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: name.trim(),
      created_by: userId,
    })
    .select()
    .single();

  if (wsError) throw wsError;

  // 2. Ajout de l'utilisateur comme owner dans le workspace
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceData.id,
      user_id: userId,
      role: 'owner',
    });

  if (memberError) {
    // Tentative de nettoyage si la liaison membre échoue
    await supabase.from('workspaces').delete().eq('id', workspaceData.id);
    throw memberError;
  }

  return {
    id: workspaceData.id,
    name: workspaceData.name,
    createdBy: workspaceData.created_by,
    createdAt: workspaceData.created_at,
    updatedAt: workspaceData.updated_at,
  };
}

export async function getUserWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*');

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
