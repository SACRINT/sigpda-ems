/**
 * Tipos e Interfaces TypeScript Oficiales para el Módulo de Horarios Escolares
 * SIGPDA-EMS — Motor de Generación y Edición de Horarios de Media Superior
 */

export interface EscuelaHorarios {
  id?: string;
  nombre?: string;
  school_name?: string;
  cct?: string;
  zonaEscolar?: string;
  zona?: string;
  municipio?: string;
  localidad?: string;
  telefono?: string;
  director?: string;
  director_nombre?: string;
  subsystem?: string;
  turno?: string;
  gruposPrimerAno?: number;
  gruposSegundoAno?: number;
  gruposTercerAno?: number;
  mapaCurricularCompletado?: boolean;
  cctValido?: boolean;
  [key: string]: any;
}

export interface GrupoHorario {
  id: string;
  nombre: string;
  semestre: number;
  turno?: string;
  horasPorDia?: number;
  horas_por_dia?: number;
  capacitacionNombre?: string;
  carreraTecnicaId?: string;
  carrera_tecnica_id?: string;
  versionPrograma?: string;
  version_programa?: string;
  materiaPropedutica5to?: string;
  materia_propedutica_5to?: string;
  customUacs?: CustomUacHorario[] | null;
  ffeoSocioemocional?: string;
  ffeOptativas?: string[];
  [key: string]: unknown;
}

export interface CustomUacHorario {
  id?: string;
  uacName: string;
  horasSemanales: number;
  horas?: number;
  tipo: string;
  esDividida?: boolean;
  esPersonalizada?: boolean;
  capNombre?: string;
  abrev?: string;
  [key: string]: unknown;
}

export interface DocenteHorario {
  id: string;
  nombreCompleto?: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  horasMaxDia?: number;
  horasMaximasSemana?: number;
  horasContratadas?: number;
  horasAsignadas?: number;
  horas_base?: number;
  diasNoDisponibles?: number[];
  diasIndisponibles?: number[];
  horasBloqueadas?: { dia: number; periodo: number }[];
  periodosIndisponibles?: { dia: number; periodo: number }[];
  [key: string]: unknown;
}

export interface AulaHorario {
  id?: string;
  nombre: string;
  tipo: string;
  capacidad?: number;
  [key: string]: unknown;
}

export interface CargaHoraria {
  id?: string;
  grupoId: string;
  asignaturaId: string;
  uacName?: string;
  docenteId: string;
  personalId?: string;
  horasSemanales: number;
  horas_semanales?: number;
  tipo?: string;
  esHoraDoblePermitida?: boolean;
  requiereAulaEspecial?: boolean;
  aulaEspecialId?: string;
  [key: string]: unknown;
}

export interface CeldaHorario {
  id?: string;
  diaSemana: number; // 1 a 5
  periodo: number;   // 1 a N
  grupoId: string;
  docenteId: string;
  asignaturaId: string;
  aulaId?: string;
  cargaId?: string;
  esBloqueado?: boolean;
  esFija?: boolean;
  [key: string]: unknown;
}

export interface HorarioGenerado {
  id?: string;
  escuelaId?: string;
  cicloEscolar?: { id?: string; nombre?: string } | string;
  config?: {
    horasPorDia?: number;
    diasLectivos?: number;
    horaInicio?: string;
    periodoActivo?: string;
    zonaEscolar?: string;
  };
  celdas: CeldaHorario[];
  conflictos?: string[];
  mensajesChat?: any[];
  scoreMetricas?: any;
  metricas?: {
    totalClasesProgramadas?: number;
    totalClasesRequeridas?: number;
    huecosDocentes?: number;
    huecosGrupos?: number;
    diasAisladosDocentes?: number;
    materiasSinDispersion?: number;
    bloquesDoblesExitosos?: number;
    softScore?: number;
    tiempoEjecucionMs?: number;
    slotsLibresBloqueados?: string[];
  };
  distribucionDocentes?: {
    docenteId: string;
    horasPorDia: number[];
    totalHoras: number;
    huecos: number;
    diasActivos: number;
  }[];
  [key: string]: any;
}

export interface ConfiguracionHorario {
  diasLectivos?: number;
  horasPorDia?: number;
  horas_por_dia?: number;
  subsystem?: string;
  horaInicio?: string;
  duracionBloqueMinutos?: number;
  periodoActivo?: string;
  zonaEscolar?: string;
  escuela?: EscuelaHorarios;
  [key: string]: any;
}
