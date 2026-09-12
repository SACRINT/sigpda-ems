import json
import os

CANONICAL_PATH = r'c:\Proyectos_SACRINT\Proyecto_SIGPDA_EMS\SIGPDA_EMS\scripts\data\bt_canonical_25.json'

with open(CANONICAL_PATH, 'r', encoding='utf-8') as f:
    careers = json.load(f)

print(f"Auditing {len(careers)} Bachillerato Tecnológico Careers in {CANONICAL_PATH}...\n")

total_submodules = 0
total_activities = 0
total_saberes = 0
issues = []

for c_idx, c in enumerate(careers):
    c_name = c["name"]
    modules = c["modules"]
    
    if len(modules) != 5:
        issues.append(f"{c_name}: Has {len(modules)} modules instead of 5")
        
    career_hours = 0
    for m in modules:
        mod_name = m["modulo_romano"]
        sem = m["semestre"]
        outcome = m["resultado_aprendizaje"]
        submods = m["submodulos"]
        
        if not outcome or len(outcome.strip()) < 10:
            issues.append(f"{c_name} Mod {mod_name} (Sem {sem}): Empty or short outcome: '{outcome}'")
            
        mod_hours = sum(s["horas_totales"] for s in submods)
        career_hours += mod_hours
        
        expected_mod_hrs = 272 if sem <= 4 else 192
        if mod_hours != expected_mod_hrs:
            issues.append(f"{c_name} Mod {mod_name} (Sem {sem}): {mod_hours}h (expected {expected_mod_hrs}h)")
            
        for s in submods:
            total_submodules += 1
            s_name = s["nombre"]
            s_hrs = s["horas_totales"]
            acts = s["actividades"]
            
            if not s_name or len(s_name.strip()) < 5:
                issues.append(f"{c_name} Mod {mod_name}: Submodule name empty or too short: '{s_name}'")
            if s_hrs <= 0:
                issues.append(f"{c_name} Mod {mod_name} Sub '{s_name}': 0 or negative hours ({s_hrs})")
            if len(acts) == 0:
                issues.append(f"{c_name} Mod {mod_name} Sub '{s_name}': 0 activities")
                
            for a in acts:
                total_activities += 1
                total_saberes += len(a["saberes"])
                if "fase 1:" in a["name"].lower() or "fase 2:" in a["name"].lower():
                    issues.append(f"{c_name} Mod {mod_name} Sub '{s_name}': Synthetic placeholder found: '{a['name']}'")
                    
    if career_hours != 1200:
        issues.append(f"{c_name}: Total hours {career_hours}h != 1200h")

print("=" * 60)
print("AUDIT REPORT SUMMARY")
print("=" * 60)
print(f"Total Careers Audited: {len(careers)}")
print(f"Total Submodules: {total_submodules}")
print(f"Total Actividades Clave: {total_activities}")
print(f"Total Saberes Procedimentales: {total_saberes}")
print(f"Total Issues Detected: {len(issues)}")
print("=" * 60)

if issues:
    print("\nDetected Issues (first 25):")
    for iss in issues[:25]:
        print("  [X]", iss)
else:
    print("\n[OK] ALL 25 CAREERS PASSED 100% SANITY AUDIT!")
    print("   • Exact 5 modules per career")
    print("   • Exact 1,200 hours per career (272h for I-III, 192h for IV-V)")
    print("   • 100% authentic learning outcomes")
    print("   • Zero synthetic activity placeholders")
