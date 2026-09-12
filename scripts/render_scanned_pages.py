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

for doc_name, pdf_path in [("psicologia1", p1), ("filosofia2", p2)]:
    doc = fitz.open("\\\\?\\" + os.path.abspath(pdf_path))
    # Render pages 2, 3, 4, 5, 14, 15, 16, 17, 18, 19, 20
    for p_num in [2, 3, 4, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]:
        if p_num < len(doc):
            pix = doc[p_num].get_pixmap(dpi=150)
            pix.save(os.path.join(out_dir, f"{doc_name}_p{p_num+1}.png"))
print("Pages rendered successfully to", out_dir)
