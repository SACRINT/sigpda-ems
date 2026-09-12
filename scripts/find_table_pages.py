import fitz, os

bg_dir = r"C:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\documentos_referencia\[02] Programas_de_Estudio BG"
folder_2023 = [d for d in os.listdir(bg_dir) if '2023' in d][0]
dir_2023 = os.path.join(bg_dir, folder_2023)
ffe_opt_folder = [d for d in os.listdir(dir_2023) if 'optativas' in d.lower()][0]
ffe_base = os.path.join(dir_2023, ffe_opt_folder)
sem5_folder = [d for d in os.listdir(ffe_base) if 'quinto' in d.lower()][0]
sem6_folder = [d for d in os.listdir(ffe_base) if 'sexto' in d.lower()][0]
p1 = os.path.join(ffe_base, sem5_folder, "Ufq4iGJ61m-Psicologia-I.pdf")
p2 = os.path.join(ffe_base, sem6_folder, "mzewQ7SweV-Pensamiento-Filosofico-II.pdf")

for name, path in [("Psicologia I", p1), ("Pensamiento Filosofico II", p2)]:
    doc = fitz.open("\\\\?\\" + os.path.abspath(path))
    print(f"\n=== {name} ({len(doc)} pages) ===")
    for i in range(len(doc)):
        t = doc[i].get_text()
        if "progresi" in t.lower() or "tabla" in t.lower() or "etapa" in t.lower() or "contenido" in t.lower() or "aprendizaje" in t.lower():
            print(f"Page {i+1}: text len {len(t)} | {t[:100]}...")
