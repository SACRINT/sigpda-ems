# -*- coding: utf-8 -*-
import os, fitz, re, sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def get_safe_path(p):
    s = os.path.abspath(str(p))
    if not s.startswith('\\\\?\\'):
        return '\\\\?\\' + s
    return s

files = [
    r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Quinto Semestre\Qf5BmvETdx-Organización del Flujo de Materia y Energía en los Organismos I.pdf",
    r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Quinto Semestre\s5D0yncAde-Analisis-de-Fenomenos-y-Procesos-Biologicos.pdf",
    r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Quinto Semestre\Ufq4iGJ61m-Psicologia-I.pdf",
    r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Sexto Semestre\mzewQ7SweV-Pensamiento-Filosofico-II.pdf",
    r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Sexto Semestre\nbYhSC6Ikv-Análisis de Fenómenos Físicos II.pdf",
    r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Sexto Semestre\salm0xvzvJ-Organización del flujo de materia y energía en los organismos II.pdf",
    r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Sexto Semestre\xGxKoMO2if-Temas-Selectos-de-Biologia.pdf"
]

for f in files:
    safe_p = get_safe_path(f)
    print(f"\n=======================================================")
    print(f"ARCHIVO: {os.path.basename(f)}")
    print(f"=======================================================")
    if not os.path.exists(safe_p):
        print("  ❌ NO EXISTE EN LA RUTA")
        continue
    doc = fitz.open(safe_p)
    total_text = sum(len(doc[p].get_text().strip()) for p in range(len(doc)))
    print(f"  Páginas: {len(doc)} | Total caracteres texto: {total_text}")
    
    if total_text < 100:
        print("  ⚠️ ESCANEO / IMAGEN PURA (Sin texto seleccionable)")
        continue

for f in [files[3]]:
    safe_p = get_safe_path(f)
    print(f"\nARCHIVO: {os.path.basename(f)}")
    doc = fitz.open(safe_p)
    print(f"Páginas: {len(doc)}")
    for p in range(min(20, len(doc))):
        t = doc[p].get_text().strip()
        imgs = doc[p].get_images()
        print(f"  Pág {p+1}: {len(t)} chars texto, {len(imgs)} imágenes. Muestra: {t[:40]!r}")
