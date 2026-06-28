import { supabase } from './client';
import { createId } from '@/lib/createId';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';

export async function uploadSongAsset(
  workspaceId: string,
  songId: string,
  file: File
): Promise<string> {
  const assetId = createId();
  const ext = file.name.split('.').pop() || 'mp3';
  const storagePath = `workspaces/${workspaceId}/songs/${songId}/${assetId}.${ext}`;

  // 1. Upload du binaire sur Supabase Storage (bucket privé faderzero-audio)
  const { error: uploadError } = await supabase.storage
    .from('faderzero-audio')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // 2. Création de l'enregistrement de métadonnées local (qui alimente la file syncQueue)
  await songAssetsRepository.create({
    id: assetId,
    songId,
    storagePath,
    filename: file.name,
    mimeType: file.type || 'audio/mpeg',
    sizeBytes: file.size,
  });

  return assetId;
}

export async function getSongAssetPlaybackUrl(
  _workspaceId: string,
  assetId: string
): Promise<string> {
  const asset = await songAssetsRepository.getById(assetId);
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  // Génération d'une URL signée temporaire (durée d'une heure)
  const { data, error } = await supabase.storage
    .from('faderzero-audio')
    .createSignedUrl(asset.storagePath, 3600);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
