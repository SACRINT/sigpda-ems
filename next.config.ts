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

  // Server external packages with native/binary assets (must not be bundled by Turbopack)
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@resvg/resvg-js'],

  // La ruta del libro editorial lee templates/editorial/workbook-template.typ en
  // runtime para derivar la versión de plantilla del content_hash (cache-bust
  // automático). @vercel/nft no siempre traza ese fs.readFileSync, así que se
  // fuerza la inclusión en el bundle del serverless function.
  outputFileTracingIncludes: {
    '/api/pdf/libro-editorial/\\[id\\]': ['./templates/editorial/*.typ'],
  },
};

export default withNextIntl(nextConfig);
