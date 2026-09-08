import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('scripts/bge-laboral-official-catalog.json', encoding='utf-8') as f:
    cat = json.load(f)

def show_uacs(name, semesters=None):
    uacs = cat[name]
    print(f"\n=== {name} ===")
    for u in uacs:
        if semesters and u['semester'] not in semesters:
            continue
        print(f"  Semestre {u['semester']} UAC{u['uac_num']} (pag.{u['page']}): {u['uac_name'][:60] if u['uac_name'] else '(sin nombre)'}")
        for a in u['activities']:
            print(f"    Act.{a['order']}: {a['name']}")
        if u['learning_outcome']:
            print(f"    Resultado: {u['learning_outcome'][:80]}...")
    
show_uacs("Instalaciones Residenciales", [3, 4])
show_uacs("Contabilidad", [3])
show_uacs("Turismo", [3])
show_uacs("Tecnologia Informatica", [3])
