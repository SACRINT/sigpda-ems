'use client';

import { useEffect } from 'react';

/**
 * Recovers automatically from Next.js deployment skew (ChunkLoadError / 404 on static chunks).
 * When a new deployment is pushed to Vercel, active browser sessions might have references
 * to older chunks that were replaced by the new build.
 * This listener catches failed chunk scripts and automatically triggers a fresh reload once,
 * seamlessly synchronizing the client to the newest deployment without user friction.
 */
export default function ChunkErrorListener() {
  useEffect(() => {
    function handleResourceError(event: ErrorEvent | Event) {
      const target = event.target as HTMLElement | null;

      // 1. Check if a Next.js script or CSS chunk failed to load (HTTP 404 / ERR_ABORTED)
      const isFailedChunkScript =
        target &&
        target.tagName === 'SCRIPT' &&
        (target as HTMLScriptElement).src?.includes('/_next/static/chunks/');

      const isFailedChunkStyle =
        target &&
        target.tagName === 'LINK' &&
        (target as HTMLLinkElement).href?.includes('/_next/static/css/');

      // 2. Check if a ChunkLoadError occurred in JavaScript runtime
      const isChunkLoadErrorMessage =
        'message' in event &&
        typeof (event as ErrorEvent).message === 'string' &&
        ((event as ErrorEvent).message.includes('ChunkLoadError') ||
          (event as ErrorEvent).message.includes('Loading chunk') ||
          (event as ErrorEvent).message.includes('Failed to fetch dynamically imported module'));

      if (isFailedChunkScript || isFailedChunkStyle || isChunkLoadErrorMessage) {
        console.warn('[DeploymentSkew] Detected stale chunk failure due to new deployment. Reloading to sync latest version...');

        const RELOAD_KEY = 'sigpda_chunk_reload_ts';
        const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
        const now = Date.now();

        // Prevent infinite loops: only auto-reload if we haven't reloaded in the last 15 seconds
        if (now - lastReload > 15000) {
          sessionStorage.setItem(RELOAD_KEY, now.toString());
          window.location.reload();
        }
      }
    }

    // Capture phase listener for DOM element load failures (script / link tags)
    window.addEventListener('error', handleResourceError, true);

    // Listener for unhandled promise rejections (dynamic imports failing)
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason?.message || (typeof reason === 'string' ? reason : '');
      if (
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk') ||
        message.includes('Failed to fetch dynamically imported module')
      ) {
        console.warn('[DeploymentSkew] Detected unhandled dynamic chunk rejection. Reloading to sync latest version...');
        const RELOAD_KEY = 'sigpda_chunk_reload_ts';
        const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
        const now = Date.now();

        if (now - lastReload > 15000) {
          sessionStorage.setItem(RELOAD_KEY, now.toString());
          window.location.reload();
        }
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleResourceError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
