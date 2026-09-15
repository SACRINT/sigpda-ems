import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/logger';

export async function getUserLibraryContext(email: string): Promise<string> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const docs = await sql`
      SELECT file_name, extracted_text
      FROM user_library_docs
      WHERE teacher_email = ${email}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    if (docs.length === 0) {
      return '';
    }

    let context = '--- CONTEXTO DE LA BIBLIOTECA DEL DOCENTE ---\n';
    context += 'El docente ha proporcionado los siguientes documentos de contexto de su escuela/zona:\n\n';

    for (const doc of docs) {
      if (doc.extracted_text) {
        context += `[Documento: ${doc.file_name}]\n`;
        // Limit text length per document to avoid overflowing context window
        const text = doc.extracted_text.substring(0, 3000); 
        context += `${text}...\n\n`;
      }
    }

    context += '--- FIN DEL CONTEXTO DE LA BIBLIOTECA ---\n';
    return context;
  } catch (error) {
    logger.error('Error in getUserLibraryContext:', error);
    return ''; // Failsafe, do not block generation if DB fails
  }
}
