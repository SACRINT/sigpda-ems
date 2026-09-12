import fitz
import os

folder = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2025 - 2028\Curriculum Laboral BGE 2024"
files = [f for f in os.listdir(folder) if f.endswith(".pdf")]
files.sort()

print(f"Total PDFs encontrados: {len(files)}")
total_uacs = 0
for f in files:
    doc = fitz.open(os.path.join(folder, f))
    uac_count = len([b for page in doc for b in page.get_text('blocks') if 'Actividad Clave 1' in b[4]])
    print(f"  {f}: {uac_count} UACs (Páginas: {len(doc)})")
    total_uacs += uac_count

print(f"TOTAL UACs laborales detectadas: {total_uacs}")
