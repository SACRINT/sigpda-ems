import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Vercel Skew Protection (routes older client sessions to matching build chunks)
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID || undefined,

  // Vercel Blob - allow images from blob storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },

  // Server external packages for PDF parsing (must not be bundled by Turbopack)
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
};

export default withNextIntl(nextConfig);
