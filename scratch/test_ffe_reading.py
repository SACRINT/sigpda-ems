# -*- coding: utf-8 -*-
import os, re, fitz
from pathlib import Path

p = Path(r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG\Programas de Estudio para la Generación 2023 - 2026\Formación Fundamental Extendido (UAC optativas)\Quinto Semestre")

print(f"Directory exists: {p.exists()}")
files = list(p.glob("*.pdf"))
print(f"Files found: {len(files)}")

extracted = 0
not_extracted = []

for f in files:
    try:
        data = f.read_bytes()
        doc = fitz.open(stream=data, filetype="pdf")
        progresiones = []
        outcome = None
        for p_idx in range(min(len(doc), 35)):
            text = doc[p_idx].get_text()
            if not outcome and ("propósito formativo" in text.lower() or "meta de aprendizaje" in text.lower()):
                # look for outcome paragraph
                lines = text.split("\n")
                for li, l in enumerate(lines):
                    if any(k in l.lower() for k in ["propósito formativo", "meta de aprendizaje"]):
                        candidate = " ".join([x.strip() for x in lines[li+1:li+4] if len(x.strip()) > 10])
                        if len(candidate) > 20:
                            outcome = candidate[:200]
                            break

            for line in text.split("\n"):
                m = re.match(r'^(?:Progresi[oó]n|Prop[oó]sito)\s*(\d{1,2})\s*[:\-–]?\s*(.*)', line.strip(), re.I)
                if m and len(m.group(2).strip()) > 5:
                    progresiones.append((int(m.group(1)), m.group(2).strip()[:40]))
        if progresiones:
            extracted += 1
        else:
            not_extracted.append((f.name, outcome))
    except Exception as e:
        print(f"Error on {f.name}: {e}")

print(f"Sem 5 total: {len(files)} | Extracted: {extracted} | Not extracted: {len(not_extracted)}")
for name, out in not_extracted[:5]:
    print(f" - {name}: outcome={out}")
