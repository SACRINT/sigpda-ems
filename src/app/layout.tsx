import type { Metadata } from 'next';
import './globals.css';
import { getPlatformName } from '@/lib/platform/platform-name';

export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName();
  return {
    title: platformName,
    description: `Sistema Integral de Gestión de Planeación Didáctica Automatizada — Educación Media Superior`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
