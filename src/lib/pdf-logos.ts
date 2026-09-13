/**
 * pdf-logos.ts — Servicio de carga y caché en Base64 de logotipos oficiales SEP Puebla
 * SIGPDA-EMS · Membrete Institucional
 */

let cachedLogoGobierno: string | null = null;
let cachedLogoSep: string | null = null;
let cachedLogoSupervision: string | null = null;

/**
 * Convierte un Blob o ArrayBuffer a Data URL Base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Error al convertir imagen a Base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Carga una imagen desde una URL pública en el cliente y la transforma a Data URL Base64
 * optimizada a un ancho máximo de 400px y formato JPEG (calidad 80).
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  if (typeof window !== 'undefined') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo cargar la imagen desde ${url} (${response.status})`);
    }
    const blob = await response.blob();

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 400;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          blobToBase64(blob).then(resolve);
          return;
        }
        // Fondo blanco para que no se oscurezca la transparencia al convertir a JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => {
        blobToBase64(blob).then(resolve);
      };
      img.src = URL.createObjectURL(blob);
    });
  }

  // Fallback para ejecución en entorno Node / Server con sharp
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'public', url.startsWith('/') ? url.slice(1) : url);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      try {
        const sharp = (await import('sharp')).default;
        const resizedBuffer = await sharp(buffer)
          .flatten({ background: '#FFFFFF' })
          .resize({ width: 400, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        return `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;
      } catch (sharpErr) {
        console.warn(`[pdf-logos] sharp resize falló para ${url}, usando buffer directo:`, sharpErr);
        return `data:image/png;base64,${buffer.toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn(`[pdf-logos] Fallback de lectura de imagen falló para ${url}:`, err);
  }

  return '';
}

/**
 * Retorna el logo de Gobierno de Puebla en Base64 con caché en memoria.
 */
export async function getLogoGobierno(): Promise<string> {
  if (cachedLogoGobierno) return cachedLogoGobierno;
  try {
    cachedLogoGobierno = await fetchImageAsBase64('/images/logo-gobierno-puebla.png');
  } catch (e) {
    console.error('Error cargando logo Gobierno de Puebla:', e);
    return '';
  }
  return cachedLogoGobierno;
}

/**
 * Retorna el logo de la Secretaría de Educación Pública de Puebla en Base64 con caché en memoria.
 */
export async function getLogoSep(): Promise<string> {
  if (cachedLogoSep) return cachedLogoSep;
  try {
    cachedLogoSep = await fetchImageAsBase64('/images/logo-sep-puebla.png');
  } catch (e) {
    console.error('Error cargando logo SEP Puebla:', e);
    return '';
  }
  return cachedLogoSep;
}

/**
 * Retorna el logo de la Supervisión Escolar 004 en Base64 con caché en memoria.
 */
export async function getLogoSupervision(): Promise<string> {
  if (cachedLogoSupervision) return cachedLogoSupervision;
  try {
    cachedLogoSupervision = await fetchImageAsBase64('/images/logo-supervision-004.png');
  } catch (e) {
    console.error('Error cargando logo Supervisión 004:', e);
    return '';
  }
  return cachedLogoSupervision;
}

/**
 * Carga los 3 logotipos en paralelo.
 */
export async function loadAllLogos(): Promise<{
  gobierno: string;
  sep: string;
  supervision: string;
}> {
  const [gobierno, sep, supervision] = await Promise.all([
    getLogoGobierno(),
    getLogoSep(),
    getLogoSupervision(),
  ]);
  return { gobierno, sep, supervision };
}
