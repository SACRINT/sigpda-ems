'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import {
  FALLBACK_PLATFORM_NAME,
  setRuntimePlatformName,
} from '@/lib/platform/platform-name-shared';

const PlatformNameContext = createContext<string>(FALLBACK_PLATFORM_NAME);

export function PlatformNameProvider({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const platformName = value?.trim() || FALLBACK_PLATFORM_NAME;
  useEffect(() => {
    setRuntimePlatformName(platformName);
  }, [platformName]);
  return (
    <PlatformNameContext.Provider value={platformName}>
      {children}
    </PlatformNameContext.Provider>
  );
}

export function usePlatformName(): string {
  return useContext(PlatformNameContext);
}
