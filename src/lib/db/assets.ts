import type { ImageAsset } from '@/types/planning';
import { sql } from './client';

// ─── Image Assets & Legal Attribution Engine ───────────────────────────────

export interface SaveImageAssetInput {
  planningId: string;
  blockIndex: number;
  missionIndex: number;
  source: 'openverse' | 'synthetic_svg' | 'upload';
  externalId?: string | null;
  title: string;
  creator?: string | null;
  creatorUrl?: string | null;
  license: string;
  licenseUrl?: string | null;
  sourceUrl?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  caption: string;
  width?: number | null;
  height?: number | null;
}

export function mapRawImageAsset(r: Record<string, unknown>): ImageAsset {
  return {
    id: r.id as string,
    planningId: r.planning_id as string,
    blockIndex: Number(r.block_index),
    missionIndex: Number(r.mission_index),
    source: r.source as ImageAsset['source'],
    externalId: (r.external_id as string) ?? null,
    title: String(r.title || ''),
    creator: (r.creator as string) ?? null,
    creatorUrl: (r.creator_url as string) ?? null,
    license: String(r.license || ''),
    licenseUrl: (r.license_url as string) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    imageUrl: String(r.image_url || ''),
    thumbnailUrl: (r.thumbnail_url as string) ?? null,
    caption: String(r.caption || ''),
    width: r.width != null ? Number(r.width) : null,
    height: r.height != null ? Number(r.height) : null,
    createdAt: r.created_at as Date,
  };
}

export async function saveImageAsset(asset: SaveImageAssetInput): Promise<ImageAsset> {
  const client = sql();
  const rows = await client`
    INSERT INTO image_assets (
      planning_id, block_index, mission_index, source, external_id,
      title, creator, creator_url, license, license_url, source_url,
      image_url, thumbnail_url, caption, width, height
    ) VALUES (
      ${asset.planningId}::uuid,
      ${asset.blockIndex},
      ${asset.missionIndex},
      ${asset.source},
      ${asset.externalId || null},
      ${asset.title},
      ${asset.creator || null},
      ${asset.creatorUrl || null},
      ${asset.license},
      ${asset.licenseUrl || null},
      ${asset.sourceUrl || null},
      ${asset.imageUrl},
      ${asset.thumbnailUrl || null},
      ${asset.caption},
      ${asset.width || null},
      ${asset.height || null}
    )
    RETURNING id, planning_id, block_index, mission_index, source, external_id,
              title, creator, creator_url, license, license_url, source_url,
              image_url, thumbnail_url, caption, width, height, created_at
  `;

  return mapRawImageAsset(rows[0] as Record<string, unknown>);
}

export async function getImageAssetsByBlock(planningId: string, blockIndex: number): Promise<ImageAsset[]> {
  const client = sql();
  const rows = await client`
    SELECT id, planning_id, block_index, mission_index, source, external_id,
           title, creator, creator_url, license, license_url, source_url,
           image_url, thumbnail_url, caption, width, height, created_at
    FROM image_assets
    WHERE planning_id = ${planningId}::uuid AND block_index = ${blockIndex}
    ORDER BY mission_index ASC, created_at ASC
  `;

  return rows.map((r: Record<string, unknown>) => mapRawImageAsset(r));
}

export async function getImageAssetByMission(
  planningId: string,
  blockIndex: number,
  missionIndex: number
): Promise<ImageAsset | null> {
  const client = sql();
  const rows = await client`
    SELECT id, planning_id, block_index, mission_index, source, external_id,
           title, creator, creator_url, license, license_url, source_url,
           image_url, thumbnail_url, caption, width, height, created_at
    FROM image_assets
    WHERE planning_id = ${planningId}::uuid
      AND block_index = ${blockIndex}
      AND mission_index = ${missionIndex}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!rows || rows.length === 0) return null;
  return mapRawImageAsset(rows[0] as Record<string, unknown>);
}

export async function deleteImageAsset(id: string): Promise<boolean> {
  const client = sql();
  await client`
    DELETE FROM image_assets
    WHERE id = ${id}::uuid
  `;
  return true;
}
