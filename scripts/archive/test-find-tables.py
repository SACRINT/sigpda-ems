import os
import fitz

pdf_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Curriculum Laboral BGE 2024"

doc = fitz.open(os.path.join(pdf_dir, "Instalaciones_Residenciales_2024.pdf"))
for page_num in [16, 17, 18]:
    page = doc[page_num - 1]
    tabs = page.find_tables()
    print(f"Page {page_num} tables found: {len(tabs.tables)}")
    for t in tabs.tables:
        df = t.extract()
        for row in df:
            print("ROW:", [cell.replace('\n', ' ') if cell else '' for cell in row])
