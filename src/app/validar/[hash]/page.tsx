import { sql } from '@/lib/db';
import { buildVerificationPageHtml, type SignatureData } from '@/lib/digital-signature';
import { getPlatformName } from '@/lib/platform/platform-name';

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const platformName = await getPlatformName();

  let signature: SignatureData | null = null;

  try {
    const result = await sql()`
      SELECT * FROM document_signatures
      WHERE hash = ${hash}
      LIMIT 1
    `;
    if (result.length > 0) {
      signature = {
        hash: result[0].hash,
        timestamp: result[0].timestamp,
        signerName: result[0].signer_name,
        signerRole: result[0].signer_role,
        cct: result[0].cct,
        documentType: result[0].document_type,
        documentId: result[0].document_id,
      };
    }
  } catch {
    // Table may not exist yet
  }

  if (!signature) {
    return (
      <html lang="es">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Verificación — {platformName}</title>
        </head>
        <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❓</div>
            <h1 style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>Firma no encontrada</h1>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>El código de verificación no coincide con ningún documento firmado en {platformName}.</p>
            <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 24, fontFamily: 'monospace', wordBreak: 'break-all' }}>{hash}</p>
          </div>
        </body>
      </html>
    );
  }

  const html = buildVerificationPageHtml(signature, true);

  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Verificación de Documento — {platformName}</title>
      </head>
      <body dangerouslySetInnerHTML={{ __html: html.split('<body>')[1]?.replace('</body>', '').replace('</html>', '') || '' }} />
    </html>
  );
}
