import fitz
import re

folder = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio Tecnologicos\Carreras_Tecnicas'

test_files = [
    "vBrm4pCEKV-PROGRAMACION.pdf",
    "BaicwgARuD-CONTABILIDAD1.pdf",
    "lJmOA2k5Pp-Ciberseguridad_presencial.pdf"
]

for filename in test_files:
    path = f"{folder}\\{filename}"
    doc = fitz.open(path)
    print(f"\n==================================================")
    print(f"FILE: {filename} ({len(doc)} pages)")
    print(f"==================================================")
    
    # 1. Buscar "Mapa de competencias"
    for i in range(min(25, len(doc))):
        t = doc[i].get_text("text")
        if "mapa de competencias" in t.lower():
            print(f"\n--- MAPA DE COMPETENCIAS (Pág {i+1}) ---")
            lines = [l.strip() for l in t.split('\n') if l.strip()]
            for l in lines[:30]:
                print(" ", l)
                
        # 2. Buscar tabla de horas / estructura curricular
        if "estructura curricular" in t.lower() and "horas" in t.lower():
            print(f"\n--- ESTRUCTURA / HORAS (Pág {i+1}) ---")
            for l in t.split('\n')[:25]:
                if l.strip():
                    print(" ", l.strip())
