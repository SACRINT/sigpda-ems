import sys, re
sys.stdout.reconfigure(encoding='utf-8')
with open('scratch/manual_paec_content.txt', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'3\. TABLA 3: "Análisis FODA.*?(?=5\. Matriz de Validaci)', text, re.DOTALL)
if m:
    print(m.group(0))
