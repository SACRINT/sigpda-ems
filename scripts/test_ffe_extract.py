import os, json, re, unicodedata, fitz

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def clean(s):
    return re.sub(r'\s+', ' ', s).strip()

def get_safe_path(p):
    ap = os.path.abspath(p)
    if os.name == 'nt' and not ap.startswith('\\\\?\\'):
        return '\\\\?\\' + ap
    return ap

bg_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG"
folder_2023 = [d for d in os.listdir(bg_dir) if '2023' in d][0]
dir_2023 = os.path.join(bg_dir, folder_2023)
ffe_opt_folder = [d for d in os.listdir(dir_2023) if 'optativas' in d.lower()][0]
ffe_base = os.path.join(dir_2023, ffe_opt_folder)
sem5_folder = [d for d in os.listdir(ffe_base) if 'quinto' in d.lower()][0]
sem6_folder = [d for d in os.listdir(ffe_base) if 'sexto' in d.lower()][0]
sem5_dir = os.path.join(ffe_base, sem5_folder)
sem6_dir = os.path.join(ffe_base, sem6_folder)

print("Sem5 dir exists:", os.path.exists(sem5_dir), "Files:", len(os.listdir(sem5_dir)))
print("Sem6 dir exists:", os.path.exists(sem6_dir), "Files:", len(os.listdir(sem6_dir)))

target_files = [
    "s5D0yncAde-Analisis-de-Fenomenos-y-Procesos-Biologicos.pdf",
    "Qf5BmvETdx-Organización del Flujo de Materia y Energía en los Organismos I.pdf",
    "nbYhSC6Ikv-Análisis de Fenómenos Físicos II.pdf",
    "salm0xvzvJ-Organización del flujo de materia y energía en los organismos II.pdf",
    "xGxKoMO2if-Temas-Selectos-de-Biologia.pdf",
    "Ufq4iGJ61m-Psicologia-I.pdf",
    "mzewQ7SweV-Pensamiento-Filosofico-II.pdf"
]

pattern = re.compile(r'^(?:Etapa de\s+)?(?:Progresi[oó]n|Prop[oó]sito)\s*(\d{1,2})\s*[\.:\-–]?\s*(.*)', re.I)

for d in [sem5_dir, sem6_dir]:
    for fname in os.listdir(d):
        norm_f = strip_accents(fname).lower()
        if any(strip_accents(t).lower() in norm_f for t in target_files):
            full_p = get_safe_path(os.path.join(d, fname))
            doc = fitz.open(full_p)
            progs = []
            for p_idx in range(min(len(doc), 45)):
                text = doc[p_idx].get_text()
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                for i, line in enumerate(lines):
                    m = pattern.match(line)
                    if m:
                        order = int(m.group(1))
                        desc = m.group(2).strip(' .:–-')
                        if not desc and i + 1 < len(lines):
                            parts = []
                            for j in range(i+1, min(i+6, len(lines))):
                                if pattern.match(lines[j]) or re.match(r'^(?:Metas?|Categor[ií]as?|Aprendizaje)\b', lines[j], re.I):
                                    break
                                parts.append(lines[j])
                            desc = ' '.join(parts).strip()
                        if desc and len(desc) > 8 and not any(p['order'] == order for p in progs):
                            progs.append({'order': order, 'name': clean(desc)})
            progs.sort(key=lambda x: x['order'])
            print(f"FOUND {fname}: {len(progs)} progs (Total pages: {len(doc)}, text len: {sum(len(p.get_text()) for p in doc)})")
            for p in progs[:2]:
                print(f"   Prog {p['order']}: {p['name'][:70]}...")
