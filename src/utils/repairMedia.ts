import { supabase } from '../lib/supabase';

export interface RepairMediaItem {
  name: string;
  path: string; // repairs/<ticket_id>/media/<file>
  url: string;  // public or signed URL
  mime_type?: string | null;
  type: 'image' | 'video' | 'other';
  size?: number | null;
  created_at?: string | null;
}

function inferTypeFromName(name: string): 'image' | 'video' | 'other' {
  const n = name.toLowerCase();
  if (n.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/)) return 'image';
  if (n.match(/\.(mp4|mov|webm|m4v|avi|mkv)$/)) return 'video';
  return 'other';
}

export async function listRepairMedia(ticketId: string, bucket = 'app-assets', useSignedUrl = false): Promise<RepairMediaItem[]> {
  // Supporte 2 conventions de chemins historiques:
  // - repairs/<ticketId>/media/*
  // - repair-tickets/<ticketId>/* (diagram-*, pattern-*, media-*)
  const prefixes = [
    `repairs/${ticketId}/media`,
    `repair-tickets/${ticketId}`
  ];
  try {
    const results: RepairMediaItem[] = [];
    for (const prefix of prefixes) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 1000,
        sortBy: { column: 'name', order: 'desc' }
      } as any);
      if (error) {
        console.warn('[repairMedia] list error for', prefix, error);
        continue;
      }
      const items = Array.isArray(data) ? data : [];
      for (const it of items) {
        const name = it.name as string;
        const path = `${prefix}/${name}`;
        let url: string = '';
        if (useSignedUrl) {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
          url = signed?.signedUrl || '';
        } else {
          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
          url = pub?.publicUrl || '';
        }
        results.push({
          name,
          path,
          url,
          mime_type: undefined,
          type: inferTypeFromName(name),
          size: (it as any).metadata?.size ?? null,
          created_at: (it as any).metadata?.lastModified ? new Date((it as any).metadata.lastModified).toISOString() : null
        });
      }
    }
    // Dédupliquer au cas où
    const seen = new Set<string>();
    return results.filter(it => {
      if (seen.has(it.path)) return false;
      seen.add(it.path);
      return true;
    });
  } catch (e) {
    console.warn('[repairMedia] list exception:', e);
    return [];
  }
}
