# -*- coding: utf-8 -*-
import os, fitz, re, sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def get_safe_path(p):
    s = os.path.abspath(str(p))
    if not s.startswith('\\\\?\\'):
        return '\\\\?\\' + s
    return s

f = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Quinto Semestre\s5D0yncAde-Analisis-de-Fenomenos-y-Procesos-Biologicos.pdf"
doc = fitz.open(get_safe_path(f))

# Let's search for the progresiones table or text
for p_idx in range(len(doc)):
    text = doc[p_idx].get_text()
    if "progresión 1" in text.lower() or "progresion 1" in text.lower() or "1." in text or "tabla" in text.lower():
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        for idx, l in enumerate(lines):
            if any(w in l.lower() for w in ["progresión", "progresion", "tabla"]):
                print(f"Pág {p_idx+1}: {l}")
                for next_l in lines[max(0, idx-1):min(len(lines), idx+6)]:
                    print(f"    {next_l}")
                break
