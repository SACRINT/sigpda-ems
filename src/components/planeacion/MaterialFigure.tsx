// src/components/planeacion/MaterialFigure.tsx
'use client';

import React, { useState } from 'react';
import { getMaterial, getMaterialImagePaths } from '@/lib/materials/materials-catalog';

export interface MaterialFigureProps {
  slug: string;
  label?: string;
  width?: number;
  className?: string;
}

/**
 * Componente que muestra la figura de un material de práctica o laboratorio.
 * Si el asset físico PNG no existe en /public/images/materiales/<slug>.png,
 * degrada inmediatamente a un SVG institucional inline sin realizar llamadas a la red (D4/D7).
 */
export function MaterialFigure({
  slug,
  label,
  width = 160,
  className = '',
}: MaterialFigureProps) {
  const [hasError, setHasError] = useState(false);
  const item = getMaterial(slug);
  const imagePaths = getMaterialImagePaths(slug);

  const displayLabel = label || item?.name || slug;
  const altText = item?.altText || `Material didáctico: ${displayLabel}`;

  if (hasError) {
    return (
      <figure
        className={`flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-slate-50 text-center dark:border-slate-800 dark:bg-slate-900/60 shadow-xs transition-colors ${className}`}
        style={{ width: `${width}px` }}
        aria-label={altText}
      >
        <svg
          viewBox="0 0 120 120"
          className="w-16 h-16 text-indigo-600 dark:text-indigo-400 mb-2 shrink-0"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="8"
            y="8"
            width="104"
            height="104"
            rx="12"
            fill="currentColor"
            fillOpacity="0.08"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="4 4"
          />
          <path
            d="M60 25 L60 48 M45 48 L75 48 M35 90 L85 90"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M40 90 C40 60 52 48 52 48 L68 48 C68 48 80 60 80 90 Z"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="60" cy="74" r="5" fill="currentColor" />
          <circle cx="68" cy="82" r="3" fill="currentColor" />
        </svg>

        <figcaption className="w-full text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
          {displayLabel}
        </figcaption>

        {item?.eppRequerido && item.eppRequerido.length > 0 && (
          <span className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            EPP req.
          </span>
        )}

        {item?.equivalenteVirtual && (
          <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
            {item.equivalenteVirtual.offline ? 'Simulador offline' : 'Simulador web'}
          </span>
        )}
      </figure>
    );
  }

  return (
    <figure
      className={`group relative flex flex-col items-center justify-between p-2 rounded-xl border border-slate-200 bg-white text-center dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all ${className}`}
      style={{ width: `${width}px` }}
    >
      <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-950/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagePaths.png}
          alt={altText}
          loading="lazy"
          className="object-contain w-full h-full p-1"
          onError={() => setHasError(true)}
        />
      </div>

      <figcaption className="mt-2 w-full text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
        {displayLabel}
      </figcaption>

      {item?.eppRequerido && item.eppRequerido.length > 0 && (
        <span className="mt-1 inline-block text-[10px] font-medium text-amber-700 dark:text-amber-400">
          ⚠️ Requiere EPP
        </span>
      )}
    </figure>
  );
}
