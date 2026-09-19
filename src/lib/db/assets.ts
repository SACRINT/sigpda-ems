/* eslint-disable @typescript-eslint/no-explicit-any */
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

export function mapRawImageAsset(r: Record<string, any>): ImageAsset {
  return {
    id: r.id,
    planningId: r.planning_id,
    blockIndex: r.block_index,
    missionIndex: r.mission_index,
    source: r.source,
    externalId: r.external_id,
    title: r.title,
    creator: r.creator,
    creatorUrl: r.creator_url,
    license: r.license,
    licenseUrl: r.license_url,
    sourceUrl: r.source_url,
    imageUrl: r.image_url,
    thumbnailUrl: r.thumbnail_url,
    caption: r.caption,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
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

  return mapRawImageAsset(rows[0] as Record<string, any>);
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

  return rows.map((r: Record<string, any>) => mapRawImageAsset(r));
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
  return mapRawImageAsset(rows[0] as Record<string, any>);
}

export async function deleteImageAsset(id: string): Promise<boolean> {
  const client = sql();
  await client`
    DELETE FROM image_assets
    WHERE id = ${id}::uuid
  `;
  return true;
}
