/**
 * Phase 6D: Digital Signature & QR Verification
 * Creates cryptographic seals and QR codes for document validation.
 */

export interface SignatureData {
  hash: string;
  timestamp: string;
  signerName: string;
  signerRole: string;
  cct: string;
  documentType: string;
  documentId: string;
}

const esc = (s: string | null | undefined): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));


export interface VerificationResult {
  valid: boolean;
  signature?: SignatureData;
  error?: string;
}

/**
 * Generate SHA-256 hash of document content
 */
export async function generateDocumentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create digital signature for a document
 */
export async function signDocument(
  content: string,
  signerName: string,
  signerRole: string,
  cct: string,
  documentType: string,
  documentId: string
): Promise<SignatureData> {
  const hash = await generateDocumentHash(content);

  const signature: SignatureData = {
    hash,
    timestamp: new Date().toISOString(),
    signerName,
    signerRole,
    cct,
    documentType,
    documentId,
  };

  return signature;
}

/**
 * Generate verification URL for QR code
 */
export function getVerificationUrl(hash: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://sigpda-ems.vercel.app');
  return `${base}/validar/${hash}`;
}

/**
 * Verify a document by its hash
 */
export async function verifyDocument(
  hash: string,
  storedSignatures: SignatureData[]
): Promise<VerificationResult> {
  const signature = storedSignatures.find(s => s.hash === hash);

  if (!signature) {
    return { valid: false, error: 'Firma no encontrada en el sistema' };
  }

  // Check if signature is not too old (30 days)
  const sigDate = new Date(signature.timestamp);
  const now = new Date();
  const daysSinceSigning = (now.getTime() - sigDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceSigning > 30) {
    return {
      valid: true,
      signature,
      error: 'Advertencia: La firma tiene más de 30 días. Verifique vigencia con el plantel.'
    };
  }

  return { valid: true, signature };
}

/**
 * Generate QR code SVG using qrcode library (server-safe)
 */
export async function generateQRCodeSvg(text: string): Promise<string> {
  // Dynamic import to avoid SSR issues
  const QRCode = await import('qrcode');
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    color: {
      dark: '#1A3A5C',
      light: '#FFFFFF',
    },
    width: 120,
  });
}

/**
 * Generate QR code data URL for embedding in documents
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(text, {
    margin: 1,
    color: {
      dark: '#1A3A5C',
      light: '#FFFFFF',
    },
    width: 120,
  });
}

/**
 * Build the verification page HTML
 */
export function buildVerificationPageHtml(signature: SignatureData, valid: boolean): string {
  const statusColor = valid ? '#10b981' : '#ef4444';
  const statusText = valid ? 'DOCUMENTO VERIFICADO ✓' : 'FIRMA NO VÁLIDA';
  const statusDetail = valid
    ? 'Este documento ha sido firmado digitalmente y su integridad está verificada.'
    : 'La firma de este documento no pudo ser verificada. Puede haber sido modificado.';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificación de Documento — SIGPDA-EMS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f0f4f8; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 480px; width: 100%; overflow: hidden; }
    .header { padding: 32px 24px 24px; text-align: center; }
    .status-icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; }
    .status-icon.valid { background: #d1fae5; color: #10b981; }
    .status-icon.invalid { background: #fee2e2; color: #ef4444; }
    .status-text { font-size: 18px; font-weight: 700; color: ${statusColor}; margin-bottom: 8px; }
    .status-detail { font-size: 13px; color: #6b7280; line-height: 1.5; }
    .details { padding: 0 24px 24px; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .detail-label { color: #9ca3af; font-weight: 500; }
    .detail-value { color: #1f2937; font-weight: 600; text-align: right; max-width: 60%; word-break: break-all; }
    .hash-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-top: 16px; }
    .hash-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .hash-value { font-family: 'Courier New', monospace; font-size: 11px; color: #374151; word-break: break-all; line-height: 1.4; }
    .footer { padding: 16px 24px; background: #f9fafb; text-align: center; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="status-icon ${valid ? 'valid' : 'invalid'}">${valid ? '✓' : '✗'}</div>
      <div class="status-text">${esc(statusText)}</div>
      <div class="status-detail">${esc(statusDetail)}</div>
    </div>
    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Firmado por</span>
        <span class="detail-value">${esc(signature.signerName)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Rol</span>
        <span class="detail-value">${esc(signature.signerRole)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">CCT</span>
        <span class="detail-value">${esc(signature.cct)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Tipo de documento</span>
        <span class="detail-value">${esc(signature.documentType)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Fecha de firma</span>
        <span class="detail-value">${esc(new Date(signature.timestamp).toLocaleString('es-MX'))}</span>
      </div>
      <div class="hash-box">
        <div class="hash-label">Hash SHA-256</div>
        <div class="hash-value">${esc(signature.hash)}</div>
      </div>
    </div>
    <div class="footer">
      Verificado por SIGPDA-EMS · Sistema Integral de Gestión Pedagógica y Docente<br>
      Estado de Puebla · Ciclo Escolar ${new Date().getFullYear()}-${new Date().getFullYear() + 1}
    </div>
  </div>
</body>
</html>`;
}
