import { shortSubjectCode } from '@/lib/short-filename';

export type PlanningPackageFormat = 'docx' | 'pdf';

export interface PlanningPackageItem {
  label: string;
  url: string;
  fileName: string;
}

export interface PlanningPackageSpec {
  format: PlanningPackageFormat;
  subjectCode: string;
  href: string;
  zipFileName: string;
  title: string;
  items: PlanningPackageItem[];
}

/**
 * SSoT de los 9 entregables consolidados del Paquete Completo (Word/PDF + PPTX ZIP).
 * Reutilizado tanto en el Centro de Descargas de cada planeación como en los atajos de "Mis planeaciones".
 */
export function buildPlanningPackageSpec(
  planningId: string,
  uacName: string | null | undefined,
  format: PlanningPackageFormat
): PlanningPackageSpec {
  const subjectCode = shortSubjectCode(uacName || 'UAC');

  if (format === 'pdf') {
    return {
      format,
      subjectCode,
      href: `/api/pdf/extra/bulk?planningId=${planningId}`,
      zipFileName: `Paquete_${subjectCode}_PDF.zip`,
      title: 'Descargar los 9 entregables consolidados en un archivo ZIP (PDF y Presentaciones PPTX)',
      items: [
        { label: '01 Planeación', url: `/api/planeaciones/${planningId}/pdf`, fileName: `01_Planeacion_${subjectCode}.pdf` },
        { label: '02 Secuencia', url: `/api/planeaciones/${planningId}/secuencia/pdf`, fileName: `02_Secuencia_${subjectCode}.pdf` },
        { label: '03 Planes de clase', url: `/api/pdf/extra/combined?planningId=${planningId}&type=lesson_plan`, fileName: `03_Planes_Clase_${subjectCode}.pdf` },
        { label: '04 Solucionario', url: `/api/pdf/extra/combined?planningId=${planningId}&type=teacher_guide`, fileName: `04_Solucionario_${subjectCode}.pdf` },
        { label: '05 Guías de práctica', url: `/api/pdf/extra/combined?planningId=${planningId}&type=practice_guide`, fileName: `05_Guias_Practica_${subjectCode}.pdf` },
        { label: '06 Libro semestral', url: `/api/pdf/libro-semestral/${planningId}`, fileName: `06_Libro_Semestral_${subjectCode}.pdf` },
        { label: '07 Instrumentos', url: `/api/pdf/extra/combined?planningId=${planningId}&type=evaluation`, fileName: `07_Instrumentos_${subjectCode}.pdf` },
        { label: '08 Presentaciones', url: `/api/planeaciones/${planningId}/presentacion/combinada`, fileName: `08_Presentaciones_${subjectCode}.pptx` },
        { label: '09 Infografías', url: `/api/planeaciones/${planningId}/infografia/combinada?format=pdf`, fileName: `09_Infografias_${subjectCode}.pdf` },
      ],
    };
  }

  return {
    format,
    subjectCode,
    href: `/api/docx/extra/bulk?planningId=${planningId}`,
    zipFileName: `Paquete_${subjectCode}_Word.zip`,
    title: 'Descargar los 9 entregables consolidados en un archivo ZIP (Word y Presentaciones PPTX)',
    items: [
      { label: '01 Planeación', url: `/api/docx/${planningId}`, fileName: `01_Planeacion_${subjectCode}.docx` },
      { label: '02 Secuencia', url: `/api/docx/secuencia/${planningId}`, fileName: `02_Secuencia_${subjectCode}.docx` },
      { label: '03 Planes de clase', url: `/api/docx/extra/combined?planningId=${planningId}&type=lesson_plan`, fileName: `03_Planes_Clase_${subjectCode}.docx` },
      { label: '04 Solucionario', url: `/api/docx/extra/combined?planningId=${planningId}&type=teacher_guide`, fileName: `04_Solucionario_${subjectCode}.docx` },
      { label: '05 Guías de práctica', url: `/api/docx/extra/combined?planningId=${planningId}&type=practice_guide`, fileName: `05_Guias_Practica_${subjectCode}.docx` },
      { label: '06 Libro semestral', url: `/api/docx/libro-semestral/${planningId}`, fileName: `06_Libro_Semestral_${subjectCode}.docx` },
      { label: '07 Instrumentos', url: `/api/docx/extra/combined?planningId=${planningId}&type=evaluation`, fileName: `07_Instrumentos_${subjectCode}.docx` },
      { label: '08 Presentaciones', url: `/api/planeaciones/${planningId}/presentacion/combinada`, fileName: `08_Presentaciones_${subjectCode}.pptx` },
      { label: '09 Infografías', url: `/api/planeaciones/${planningId}/infografia/combinada?format=pdf`, fileName: `09_Infografias_${subjectCode}.pdf` },
    ],
  };
}
