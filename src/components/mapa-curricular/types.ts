export interface GrupoConfigItem {
  capacitacionNombre: string;
  ffeOptativas: string[];
  ffeoSocioemocional: string;
  carreraTecnicaId?: string;
  versionPrograma?: "nuevo" | "anterior";
  materiaPropedutica5to?: string;
}

export interface GrupoInicialItem {
  nombre?: string;
  semestre?: number;
  capacitacionNombre?: string;
  ffeOptativas?: string | string[];
  ffeoSocioemocional?: string;
  carreraTecnicaId?: string;
  versionPrograma?: "nuevo" | "anterior" | string;
  materiaPropedutica5to?: string;
}

