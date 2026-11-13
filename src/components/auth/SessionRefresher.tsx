'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Fuerza un refresh del JWT (trigger === 'update') una sola vez al montar.
 * Se usa tras activar Stripe/Welcome para que el proxy vea el nuevo estado.
 */
export default function SessionRefresher() {
  const { update } = useSession();
  const refreshed = useRef(false);

  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    void update();
  }, [update]);

  return null;
}
