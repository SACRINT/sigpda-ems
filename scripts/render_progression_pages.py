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

out_dir = r"c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\extracted_pages"
os.makedirs(out_dir, exist_ok=True)

# Psicologia I: pages 15 to 36 (0-indexed 14 to 35)
doc1 = fitz.open("\\\\?\\" + os.path.abspath(p1))
for p in range(14, min(37, len(doc1))):
    pix = doc1[p].get_pixmap(dpi=150)
    pix.save(os.path.join(out_dir, f"psicologia1_p{p+1}.png"))

# Pensamiento Filosofico II: pages 17 to 40 (0-indexed 16 to 39)
doc2 = fitz.open("\\\\?\\" + os.path.abspath(p2))
for p in range(16, min(40, len(doc2))):
    pix = doc2[p].get_pixmap(dpi=150)
    pix.save(os.path.join(out_dir, f"filosofia2_p{p+1}.png"))

print("Rendered progression pages for both PDFs successfully.")
