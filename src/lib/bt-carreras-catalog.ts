/**
 * Catálogo Oficial Auténtico de Carreras Técnicas y Módulos Profesionales
 * Bachilleratos Tecnológicos (DGETI, DGETAyCM, CBTIS, CBTA, CECyTE)
 * Fuente Oficial: Documentos de Referencia SEP / COSFAC
 * Total de Carreras Catalogadas: 66
 */

export interface BTSubmodulo {
  nombre: string;
  abreviatura: string;
  horasSemanales: number;
  horasTotales: number; // Base 16 semanas de mediación docente
}

export interface BTModulo {
  nombre: string;
  semestre: number; // 2, 3, 4, 5, 6
  horasSemanales: number; // 17 h/sem (Sem 2-4) o 12 h/sem (Sem 5-6)
  submodulos: BTSubmodulo[];
}

export interface BTCarrera {
  id: string;
  nombre: string;
  tipoPrograma: 'nuevo' | 'anterior';
  acuerdo: string;
  edicion: string;
  horasTotales: number; // 1200 hrs oficiales
  modulos: BTModulo[];
}

// Catálogo Tipado de Carreras Técnicas Oficiales de Bachillerato Tecnológico
export const CARRERAS_TECNICAS_BT: BTCarrera[] = [
  {
    "id": "acuacultura",
    "nombre": "Acuacultura",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Julio, 2016",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Identifica aspectos básicos de la acuacultura",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 3,
            "horasTotales": 48
          },
          {
            "nombre": "Identifica sistemas de producción acuícola",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Relaciona procesos de biotecnología acuícola",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Relaciona procesos de biotecnología acuícola",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Produce fitoplancton en condiciones controladas",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce zooplancton en condiciones controladas",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Selecciona reproductores para el desove",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Incuba huevos de peces",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Controla el desarrollo durante la engorda",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Selecciona reproductores de moluscos",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 3,
            "horasTotales": 48
          },
          {
            "nombre": "Obtiene semilla de moluscos",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Engorda de moluscos",
            "abreviatura": "SUB3-MV",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      }
    ]
  },
  {
    "id": "administracion-de-recursos-humanos",
    "nombre": "Administración de Recursos Humanos",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Ejecuta procedimientos administrativos del área de recursos humanos",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Gestiona documentación del área de recursos humanos",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Gestiona el proceso de reclutamiento, selección y admisión del talento humano",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Gestiona los procesos de inducción y permanencia del talento humano",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Gestiona los procesos de capacitación para el desarrollo del talento humano",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Promueve condiciones de trabajo saludables en la organización",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Gestiona la aplicación de la evaluación del desempeño humano",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Mide el desempeño del talento humano",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "administracion-emprendimientos",
    "nombre": "Administracion Emprendimientos",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Gestiona la producción de productos o servicios",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Determina la estrategia de comercialización de productos o servicios",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Elabora estados financieros del plan de negocios",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Elabora estados financieros del plan de negocios",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo II (Parte 2)",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 11,
            "horasTotales": 176
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "administracion-en-mipymes",
    "nombre": "Administración en MiPyMEs",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Identifica la naturaleza, entorno y documentación básica de las MiPyMEs",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Realiza el proceso administrativo en las MiPyMEs",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza el proceso de atención al cliente",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Realiza el proceso de venta de bienes y servicios",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Distingue fuentes de financiamiento para las MiPyMEs",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Aplica los procedimientos legales para las MiPyMEs",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Aplica las obligaciones fiscales para las MiPyMEs",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Elabora un modelo de negocios",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Presenta un modelo de negocios",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Identifica la naturaleza, entorno y documentación básica de las MiPyMEs",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      }
    ]
  },
  {
    "id": "administracion-para-el-emprendimiento-agropecuario",
    "nombre": "Administración para el Emprendimiento Agropecuario",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Octubre , 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Participa en el Diseño de los Sistemas Administrativos para Empresas rurales",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Participa en la Implementación del Proceso Administrativo para Empresas rurales",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Participa en la elaboración del estudio de mercado",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Participa en la estructuración del plan de negocio",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Apoya en la realización de trámites jurídico – administrativos",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Apoya en la realización de trámites jurídico – administrativos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Apoya en la proyección de la información financiera del plan negocio",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Apoya en la evaluación de los recursos materiales del plan de negocio",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Apoya en la evaluación de los recursos humanos del plan de negocio",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 3,
            "horasTotales": 48
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Apoya en la identificación de la mezcla de mercadotecnia en un plan de negocio",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      }
    ]
  },
  {
    "id": "agricultura-protegida",
    "nombre": "Agricultura Protegida",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Abril, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Establece el cultivo",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Administra el ambiente",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Aplica buenas prácticas agrícolas",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Aplica buenas prácticas agrícolas",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Diseña estructuras bioclimáticas",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Instala estructuras bioclimáticas",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Mantiene estructuras bioclimáticas",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Instala sensores",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Opera sensores",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Interpreta resultados",
            "abreviatura": "SUB3-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Interpreta resultados",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Diseña sistema de riego presurizado",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "agricultura-sustentable",
    "nombre": "Agricultura Sustentable",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza una producción agrícola sustentable",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza una producción forestal sustentable",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Diseña espacios para el bienestar animal",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Desarrolla prácticas de manejo sustentable en especies animales",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 11,
            "horasTotales": 176
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Determina los atributos de un terreno a través de levantamientos topográficos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza obras de conservación de suelo y agua",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Elabora un plan de manejo sustentable del agroecosistema",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Utiliza ecotecnias para el buen manejo de agroecosistemas",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Ejecuta el plan de manejo sustentable",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Evalúa el plan de manejo sustentable",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "agroindustrias",
    "nombre": "Agroindustrias",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Prepara la materia prima para el proceso de in- dustrialización",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Acondiciona subproductos o residuos para su comercialización",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Transforma materia prima de origen vegetal me- diante métodos físicos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Procesa subproductos o residuos de origen ve- getal para su comercialización",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo V",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Transforma materia prima de origen animal mediante métodos físicos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Procesa subproductos o residuos de origen animal para su comercialización",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Procesa materia prima de origen vegetal para elaborar productos no alimenticios",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 4,
            "horasTotales": 68
          },
          {
            "nombre": "Procesa materia prima de origen animal para elaborar productos no alimenticios",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 60
          },
          {
            "nombre": "Elabora productos de origen animal y vegetal para el cuidado personal",
            "abreviatura": "SUB3-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V. Asiste en el análisis financiero de una entidad económica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Elabora productos de origen animal y vegetal para el cuidado personal",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      }
    ]
  },
  {
    "id": "agroindustrias-alimentarias",
    "nombre": "Agroindustrias Alimentarias",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Junio, 2015",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Maneja y acondiciona materias primas en la agroindustria alimentaria",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 12,
            "horasTotales": 192
          },
          {
            "nombre": "Conserva y transforma alimentos, por medio de agentes biológicos",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Verifica la factibilidad de un proyecto agroindustrial alimentario",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo II (Parte 2)",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "agromatica",
    "nombre": "Agromática",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Identifica procesos de producción agrícola",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Identifica procesos de producción pecuaria",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Emplea algoritmos en los procesos productivos agropecuarios",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Emplea algoritmos en los procesos productivos agropecuarios",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Diseña bases de datos",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Diseña circuitos electrónicos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Maneja placas electrónicas programables",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Administra bases de datos",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Desarrolla aplicaciones móviles",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Opera placas electrónicas programables",
            "abreviatura": "SUB3-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Opera placas electrónicas programables",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Analiza modelos de simulación agroclimáticos",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "agropecuario",
    "nombre": "Agropecuario",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce cultivos agrícolas a cielo abierto",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Produce cultivos en agricultura protegida",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Produce insumos orgánicos para la agricultura",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce insumos orgánicos para la agricultura",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Maneja especies monogástricas para la producción",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Maneja especies poligástricas para la producción",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Maneja aves y especies alternas para la producción",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "apicultura",
    "nombre": "Apicultura",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Abril, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Maneja la colmena en las diferentes etapas del ciclo de producción",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Construye, rehabilita y mantiene el material apícola",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Cosecha miel, cera, polen, jalea real, apitoxina y propóleos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Extrae y maneja miel bajo condiciones de inocuidad alimentaria",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Produce abejas reinas mejoradas",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce abejas reinas mejoradas",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Realiza la calendarización para la producción de material biológico",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Selecciona el material biológico para la reproducción",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Transforma productos de la colmena",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Comercializa productos y subproductos de la colmena",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      }
    ]
  },
  {
    "id": "biotecnologia",
    "nombre": "Biotecnología",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Analiza muestras orgánicas con técnicas microbiológicas",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Analiza muestras orgánicas con técnicas fisicoquímicas",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Aplica tratamiento biotecnológico a residuos sólidos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplica tratamiento biotecnológico a residuos líquidos",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "biotecnologia-plan-anterior",
    "nombre": "Biotecnología (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Septiembre, 2018",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Aplicar el tratamiento de residuos líquidos utilizando sistemas biológicos",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Aplica diferentes técnicas de propagación in vitro",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Aclimata plantas in vitro en invernaderos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Obtiene productos fermentados utilizando procesos biotecnológicos industriales",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "buceo-deportivo",
    "nombre": "Buceo Deportivo",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Practica natación y salvamento acuático",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Practica técnicas de buceo libre y apnea",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Practica buceo en aguas confinadas",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Practica buceo en aguas abiertas",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Practica buceos de especialidad",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Primeros auxilios y buceo de rescate",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Guía actividades de buceo",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Asiste a instructores de buceo",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Opera embarcaciones menores",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Brinda servicios de apoyo al buceo SCUBA",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "ciberseguridad",
    "nombre": "Ciberseguridad",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Diseña algoritmos de problemas de seguridad",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Configura sistemas operativos en ambiente físico",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Configura sistemas operativos en la nube",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Detecta vulnerabilidades en sistemas informáticos",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Corrige vulnerabilidades en sistemas informáticos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Configura sistemas de seguridad en la red de datos",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Detecta vulnerabilidades en la red de datos",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Genera escenarios de ataque en sistemas informáticos",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Aplica la cadena de custodia para preservar la ciberseguridad",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "construccion-y-reparacion-naval",
    "nombre": "Construcción y Reparación Naval",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Septiembre, 2018",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Fabrica estructuras metálicas utilizando procesos de pailería",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 12,
            "horasTotales": 192
          },
          {
            "nombre": "Fabrica elementos de tuberías utilizando procesos de pailería",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Corta piezas metálicas",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Suelda piezas metálicas",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 13,
            "horasTotales": 208
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Fabrica modelos y moldes utilizando plástico reforzado con fibra de vidrio",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 13,
            "horasTotales": 208
          },
          {
            "nombre": "Fabrica piezas utilizando plástico reforzado con fibra de vidrio",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Verifica alineación de ejes y toma de huelgos",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Verifica instalación eléctrica",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Verifica proceso de pintura",
            "abreviatura": "SUB3-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Verifica proceso de pintura",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Delinea planos",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "contabilidad",
    "nombre": "Contabilidad",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Registra operaciones contables",
            "abreviatura": "REG-CONT",
            "horasSemanales": 14,
            "horasTotales": 224
          },
          {
            "nombre": "Formula información financiera",
            "abreviatura": "FORM-INF",
            "horasSemanales": 3,
            "horasTotales": 48
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Elabora contabilidad de costos",
            "abreviatura": "CONT-COST",
            "horasSemanales": 12,
            "horasTotales": 192
          },
          {
            "nombre": "Realiza nómina de forma electrónica",
            "abreviatura": "NOM-ELEC",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Determina contribuciones fiscales de personas físicas",
            "abreviatura": "FISC-FIS",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Determina contribuciones fiscales de personas morales",
            "abreviatura": "FISC-MOR",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Verifica operaciones contables",
            "abreviatura": "VERIF-CONT",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Asiste en el cierre de auditoría",
            "abreviatura": "ASIST-AUD",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Colabora en el análisis financiero de una entidad económica",
            "abreviatura": "ANAL-FIN",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Contribuye en la planeación financiera de una entidad económica",
            "abreviatura": "PLAN-FIN",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "contabilidad-plan-anterior",
    "nombre": "Contabilidad (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Julio, 2016",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Registra información contable de diversas entidades económicas",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 14,
            "horasTotales": 224
          },
          {
            "nombre": "Formula estados financieros de las empresas",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 3,
            "horasTotales": 48
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Registra información contable en forma electrónica",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 11,
            "horasTotales": 176
          },
          {
            "nombre": "Registra información de los recursos materiales",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 3,
            "horasTotales": 48
          },
          {
            "nombre": "Registra información de los recursos financieros",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 3,
            "horasTotales": 48
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Registra información de los recursos financieros",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 3,
            "horasTotales": 48
          },
          {
            "nombre": "Registra información contable de diversas entidades fabriles",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 12,
            "horasTotales": 192
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Genera nóminas en forma electrónica",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Genera información fiscal de las personas físicas",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Genera información fiscal de las personas morales",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Controla cuentas por cobrar y por pagar de las empresas",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "desarrollo-comunitario",
    "nombre": "Desarrollo Comunitario",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Septiembre, 2018",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Elabora el documento final del diagnóstico comunitario",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Promueve la incubación de microempresas para impulsar su desarrollo",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Detecta problemas en las organizaciones sociales y económicas comunitarias",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Propone alternativas para promover el desarrollo comunitario",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Elabora estudio de factibilidad para formular el proyecto",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Formula proyecto de desarrollo comunitario",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Ejecuta proyecto de desarrollo comunitario",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Evalúa los resultados del proyecto implementado",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "desarrollo-integral-comunitario",
    "nombre": "Desarrollo Integral Comunitario",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Diciembre, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza diagnóstico participativo",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Identifica las fuentes de financiamiento y sus reglas de operación",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Integra a los sujetos de desarrollo en grupos organizados",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Diseña proyectos con enfoque de desarrollo territorial",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Auxilia en el diseño de programas de capacitación",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Auxilia en el diseño de programas de asistencia técnica",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Auxilia en el diseño de programas de transferencia de tecnología",
            "abreviatura": "SUB3-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Auxilia en el diseño de programas de transferencia de tecnología",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Fortalece elementos culturales significativos de la comunidad",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Recupera prácticas agrícolas tradicionales con enfoque sustentable",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Aprovecha la energía replicando ecotecnias",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "desarrollo-sustentable",
    "nombre": "Desarrollo Sustentable",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Diciembre, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce de forma sustentable e integral en el ramo agrícola y forestal",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Maneja residuos del sector agrícola y forestal",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce de forma sustentable e integral en el ramo pecuario y acuacultura",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Maneja residuos del sector pecuario y acuacultura",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza obras de conservación de suelo y agua en agroecosistemas",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Rehabilita los ecosistemas",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Ubica geográficamente las unidades de conservación con el uso de SIG",
            "abreviatura": "SUB3-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Ubica geográficamente las unidades de conservación con el uso de SIG",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Maneja energías alternativas",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Maneja y conserva el agua",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Construye e instala baños ecológicos y biodigestores",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "diseno-grafic-digital",
    "nombre": "Diseño Grafic  Digital",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza ilustraciones para comunicar ideas",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Produce objetos visuales vectoriales",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Realiza dibujos para animación básica",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza dibujos para animación básica",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Produce soportes gráficos físicos para expresión visual",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce fotografías para diseños gráficos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Produce animaciones para aplicaciones multimedia",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "diseno-y-fabricacion-de-muebles-de-madera",
    "nombre": "Diseño y Fabricación de Muebles de Madera",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Elabora dibujos a mano alzada de acuerdo con las necesidades del cliente",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Diseña muebles de madera asistido por computadora",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce modelos de muebles de madera considerando los diferentes materiales",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Elabora piezas para la fabricación de muebles de madera",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 13,
            "horasTotales": 208
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Fabrica piezas de acuerdo con las especificaciones del diseño",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Ensambla, arma piezas y componentes de muebles de madera",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Aplica acabados en muebles de madera",
            "abreviatura": "SUB3-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Aplica acabados en muebles de madera",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Organiza los procesos industriales en muebles de madera",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Elabora dibujos a mano alzada de acuerdo con las necesidades del cliente -",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Elabora dibujos a mano alzada de acuerdo con las necesidades del cliente -",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "electronica",
    "nombre": "Electrónica",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Conecta componentes de circuitos electrónicos RLC",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Conecta componentes de circuitos electrónicos semiconductores",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Diseña circuitos electrónicos digitales",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Arma circuitos electrónicos digitales",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza mantenimiento a sistemas eléctricos de potencia",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Programa PLC para sistemas automatizados",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Programa circuitos con microcontroladores",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Arma circuitos con microcontroladores en plataformas modulares",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "explotacion-ganadera",
    "nombre": "Explotación Ganadera",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Abril, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. I Alimenta al ganado de acuerdo al sistema de producción",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Asiste en el manejo de producción de ganado",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Aplica técnicas de manejo y contención en el ganado",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Maneja parámetros productivos básicos del ganado",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo II. Alimenta al ganado de acuerdo al sistema de producción",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Maneja parámetros productivos básicos del ganado",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Aplica nutrición animal",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 12,
            "horasTotales": 192
          }
        ]
      },
      {
        "nombre": "Módulo III. Aplica programas de prevención y sanidad en el ganado",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Utiliza técnicas de producción y conservación de forrajes",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Aplica bioseguridad animal",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Aplica programas reproductivos en el ganado",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza control sanitario del ganado",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza cirugía menor en el ganado",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Maneja especies alternativas",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza reproducción natural en el ganado",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Aplica inseminación artificial en el ganado",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      }
    ]
  },
  {
    "id": "forestal",
    "nombre": "Forestal",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Abril, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Obtiene germoplasma de acuerdo a estándares de calidad",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Produce plantas de calidad",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Establece plantaciones",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Establece plantaciones",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Obtiene información de campo en sitios de muestreo",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Aplica tratamientos silvícolas",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Aplica actividades de protección forestal",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Organiza el aprovechamiento forestal",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Organiza el abastecimiento forestal",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Determina las actividades de aserrío",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Organiza las actividades de secado de madera",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Dirige las actividades de preservación de la madera",
            "abreviatura": "SUB3-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "fruticultura",
    "nombre": "Fruticultura",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Relaciona los factores socioeconómicos, biológicos y ambientales del entorno",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Distingue los fenómenos meteorológicos, para la protección de frutales",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Aplica técnicas de propagación de plantas frutícolas",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Establece el huerto frutícola",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Integra el sistema de asociación de cultivos",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Integra el sistema de asociación de cultivos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Aplica técnicas de riego y nutrición de especies frutícolas",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Controla plagas, enfermedades y arvenses",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Realiza podas y producción forzada",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrolla procesos para la cosecha",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Aplica los procesos de postcosecha",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "fuentes-alternas-de-energia",
    "nombre": "Fuentes Alternas de Energía",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Instala sistemas de energía solar térmica",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Opera sistemas de energía solar térmica",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza mantenimiento a sistemas de ener- gía solar térmica",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza mantenimiento a sistemas de ener- gía solar térmica",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Instala sistemas de energía solar fotovoltaica",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Opera sistemas de energía solar fotovoltaica",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza mantenimiento de sistemas solares fotovoltaicos",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Instala sistemas de energía eólica",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Opera sistemas de energía eólica",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza mantenimiento a sistemas de energía eólica",
            "abreviatura": "SUB3-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza mantenimiento a sistemas de energía eólica",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Instala sistemas de energía hidráulica",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "guia-de-turistas-trilingue",
    "nombre": "Guía de Turistas Trilingüe",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Abril, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Proporciona información turística en español",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Proporciona información turística en francés",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Guía al turista en sitios de interés cultural en español",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Guía al turista en sitios de interés cultural en francés",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Guía al turista en sitios de interés general en español",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Guía al turista en sitios de interés general en francés",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Planea recorridos de acuerdo al contexto y región en español",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Planea recorridos de acuerdo al contexto y región en francés",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Vende servicios de guía en español",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Vende servicios de guía en inglés",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 3,
            "horasTotales": 48
          },
          {
            "nombre": "Vende servicios de guía en francés",
            "abreviatura": "SUB3-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "instrumentacion-industrial",
    "nombre": "Instrumentación Industrial",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo I (Parte 1)",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo I (Parte 2)",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo II (Parte 1)",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo II (Parte 2)",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "instrumentacion-industrial-plan-anterior",
    "nombre": "Instrumentación Industrial (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo I (Parte 1)",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo I (Parte 2)",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo II (Parte 1)",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo II (Parte 2)",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "inteligencia-artificial",
    "nombre": "Inteligencia Artificial",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrolla algoritmos para solucionar pro- blemas",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Elabora proyectos con programación lógica",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Soluciona problemas con machine learning",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Soluciona problemas con lenguaje natural",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Soluciona problemas con visión artificial",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Soluciona problemas con visión artificial",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Construye modelos con inteligencia artifi- cial",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Configura parámetros operativos de mode- los de inteligencia artificial",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Automatiza procesos para el sector indus- trial",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Automatiza procesos para el sector servi- cios",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Implementa sistemas con inteligencia arti- ficial en el sector industrial",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "laboratorista-ambiental",
    "nombre": "Laboratorista Ambiental",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Julio, 2016",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Toma muestras de agua",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Toma muestras de suelo",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Toma muestras de aire",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Toma muestras de aire",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Ejecuta análisis físico químicos del agua",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Ejecuta análisis biológicos del agua",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Ejecuta análisis físico químicos del suelo",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Ejecuta análisis biológicos del suelo",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Realiza análisis de contaminantes físico-químicos y biológicos del aire",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Aplica organismos vivos como indicadores de las condiciones ambientales",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Colabora en la implementación y operación de sistemas de tratamiento de agua",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "logistica",
    "nombre": "Logística",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Adquiere mercancías y servicios en la cadena de suministros",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Documenta la adquisición de mercancías y servicios",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Recibe mercancías en almacén",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Organiza mercancías en almacén",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Controla mercancías en almacén",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Controla mercancías en almacén",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Gestiona la transportación de mercancías de importación y exportación",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Organiza la distribución de mercancías al cliente",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Brinda servicio al cliente en la distribución de mercancías",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "mantenimiento-industrial",
    "nombre": "Mantenimiento Industrial",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza mantenimiento a los componentes eléctricos pasivos en la industria",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza mantenimiento a los componentes eléctricos activos en la industria",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Realiza mantenimiento a los componentes eléctricos de control en la industria",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza mantenimiento a los componentes eléctricos de control en la industria",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Mantiene en funcionamiento equipos de control electrónico",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Mantiene en funcionamiento instalaciones neumática industriales",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Mantiene en funcionamiento instalaciones hidráulicas industriales",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Repara activos mecánicos mediante proce- sos de soldadura",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Repara activos mecánicos mediante proce- sos aditivos y sustractivos",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza mantenimiento preventivo a siste- mas industriales",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Repara fallas de los sistemas industriales",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      }
    ]
  },
  {
    "id": "mecanica-naval",
    "nombre": "Mecánica Naval",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo I (Parte 1)",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo I (Parte 2)",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo II (Parte 1)",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo II (Parte 2)",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "mecatronica",
    "nombre": "Mecatrónica",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Dibuja planos de elementos mecánicos",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Comprueba el funcionamiento de circuitos electrónicos",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Ensambla circuitos electrónicos analógicos",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Diseña circuitos electrónicos digitales",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Diseña circuitos electrónicos digitales",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Dibuja planos de elementos mecánicos",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Construye mecanismos de sistemas mecatrónicos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Instala elementos de potencia y control",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Programa controladores lógicos",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Programa sistemas embebidos",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "navegacion-y-pesca",
    "nombre": "Navegación y Pesca",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Conduce embarcaciones menores",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Planea la navegación de embarcaciones menores",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Mantiene embarcaciones menores",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Mantiene embarcaciones menores",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Conduce embarcaciones mayores",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Planea la navegación de embarcaciones mayores",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Captura producto pesquero con técnicas de pesca sustentable ribereña",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 12,
            "horasTotales": 192
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Maneja producto de pesca ribereña",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Captura producto pesquero con técnicas de pesca sustentable de costa",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Maneja producto a bordo de embarcaciones mayores",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Captura producto pesquero con técnicas de pesca sustentable de altura",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      }
    ]
  },
  {
    "id": "ofimatica",
    "nombre": "Ofimática",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Instala sistemas operativos en equipo de cómputo",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Administra sistemas operativos en equipo de cómputo",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Implementa conectividad en equipo de cómputo",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Implementa conectividad en equipo de cómputo",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Elabora documentos utilizando herramientas informáticas",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Procesa datos utilizando herramientas de hojas de cálculo",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Elabora presentaciones utilizando herramientas de vanguardia tecnológica",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Gestiona correo electrónico para ordenar y salvaguardar documentos",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Administra archivos utilizando almacenamiento en la nube",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Auxilia en procesos de auditoría utilizando herramientas tecnológicas",
            "abreviatura": "SUB3-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Auxilia en procesos de auditoría utilizando herramientas tecnológicas",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "ofimatica-plan-anterior",
    "nombre": "Ofimática (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Instala y configura el equipo de cómputo y periféricos",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Instala y configura sistemas operativos y aplicaciones de la ofimática",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Gestiona archivos y dispositivos ofimáticos",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Gestiona archivos y dispositivos ofimáticos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Gestiona información mediante el uso de procesadores de texto",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Gestiona información mediante el uso de hojas de cálculo",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Gestiona información mediante el uso de software de presentaciones",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Gestiona información mediante el uso de software en línea",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Gestiona recursos mediante el uso de redes de computadoras",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Diseña bases de datos ofimáticas",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Gestiona información a través de plataformas digitales",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      }
    ]
  },
  {
    "id": "operacion-portuaria",
    "nombre": "Operación Portuaria",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Septiembre, 2018",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Reconoce el puerto y las instancias portuarias",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Identifica el proceso de entrada y salida de buques",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Selecciona la documentación para la prestación de los servicios portuarios",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Selecciona la documentación para la prestación de los servicios portuarios",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Determina el equipo portuario según la carga",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Selecciona las áreas de regulación según la carga",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Organiza operaciones a costado de buque",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza las operaciones en áreas fiscal y fiscalizado",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Revisa la documentación de las maniobras de las áreas operativas fiscalizadas",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Tramita documentos para la importación y exportación",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Tramita documentación de la operación del transporte entre origen y destino",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "pesca-deportiva-y-buceo",
    "nombre": "Pesca Deportiva y Buceo",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza natación, salvamento acuático y primeros auxilios",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Opera embarcaciones de pesca deportiva y buceo",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza buceo SCUBA",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza buceo SCUBA aplicado al ámbito de la pesca deportiva",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza eventos de pesca deportiva",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Realiza el jueceo en torneos de pesca deportiva",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Promueve la actividad de la pesca deportiva",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Opera embarcaciones en el desarrollo de la pesca deportiva",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Aplica seguridad acuática en embarcaciones para la pesca deportiva y buceo -",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Aplica seguridad acuática en embarcaciones para la pesca deportiva y buceo -",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      }
    ]
  },
  {
    "id": "preparacion-de-alimentos-y-bebidas",
    "nombre": "Preparación de Alimentos y Bebidas",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Prepara entradas de acuerdo con la receta estándar y el presupuesto",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Prepara platillos de cocina mexicana con recetario base",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Prepara platillos de cocina internacional con recetario base",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Prepara panadería con recetario base",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Prepara repostería con recetario base",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "produccion-e-industrializacion-del-agave",
    "nombre": "Producción e Industrialización del Agave",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Abril, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Reproduce y trasplanta el agave de variedad azul",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza labores culturales al cultivo e inventario con fines sanitarios",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza la jima del agave",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza la jima del agave",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Produce tequila con cocimiento en horno de mampostería",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Produce tequila con cocimiento en autoclave",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Clasifica la materia prima en su recepción",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza el proceso de destilación aplicando la fórmula de jugos de cocimiento",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza el tratamiento por filtración con carbón activado y maduración",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Planea el mantenimiento predictivo y preventivo de maquinaria y equipo",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Mantiene en operación el equipo y maquinaria",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "produccion-industrial-de-alimentos",
    "nombre": "Producción Industrial de Alimentos",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Julio, 2016",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Maneja la legislación, reglamentación y normativa vigente",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Realiza análisis físicos y químicos",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Realiza análisis microbiológico",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza análisis microbiológico",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Realiza los análisis físicos, químicos y microbiológicos pertinentes",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza los procesos de transformación de los diferentes productos lácteos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 11,
            "horasTotales": 176
          },
          {
            "nombre": "Realiza los análisis físicos, químicos y microbiológicos pertinentes",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza los procesos de transformación de diferentes productos cárnicos",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 11,
            "horasTotales": 176
          },
          {
            "nombre": "Realiza los análisis físicos, químicos y microbiológicos pertinentes",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza los procesos de transformación de diferentes productos hortofrutícolas",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "programacion",
    "nombre": "Programación",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Diseña software de sistemas informáticos",
            "abreviatura": "DIS-SOFT",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Codifica software de sistemas informáticos",
            "abreviatura": "COD-SOFT",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Implementa software de sistemas informáticos",
            "abreviatura": "IMP-SOFT",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Emplea frameworks para el desarrollo de software",
            "abreviatura": "FRAME-SOFT",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Aplica metodologías ágiles para el desarrollo de software",
            "abreviatura": "MET-AGIL",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Implementa bases de datos relacionales en un sistema de información",
            "abreviatura": "BD-REL",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Implementa bases de datos no relacionales en un sistema de información",
            "abreviatura": "BD-NOREL",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Construye aplicaciones web",
            "abreviatura": "APP-WEB",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Implementa aplicaciones web",
            "abreviatura": "IMP-WEB",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Diseña aplicaciones móviles multiplataforma",
            "abreviatura": "DIS-MOV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Implementa aplicaciones móviles multiplataforma",
            "abreviatura": "IMP-MOV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      }
    ]
  },
  {
    "id": "recreaciones-acuaticas-plan-anterior",
    "nombre": "Recreaciones Acuáticas (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Septiembre, 2018",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Proporciona servicios de natación",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Rescata a personas en actividades acuáticas",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza snorkeling",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Proporciona servicios de snorkeling",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza buceo SCUBA en aguas confinadas y Someras",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza buceo SCUBA en aguas abiertas",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Conduce juegos y deportes acuáticos",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Realiza deportes náuticos",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Proporciona servicios de actividades acuáticas",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Conduce campismo y senderismo cercanos a cuerpos de agua",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "recreaciones-y-servicios-acuaticos",
    "nombre": "Recreaciones y Servicios Acuáticos",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Auxilia en el desarrollo de habilidades de nata- ción",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Aplica seguridad integral y técnicas de rescate",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Organiza juegos y deportes acuáticos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Auxilia en el desarrollo de deportes náuticos en embarcaciones ligeras",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza buceo SCUBA en aguas someras o con- finadas",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza buceo SCUBA en aguas abiertas",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Prepara embarcaciones menores para su ope- ración",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Ejecuta maniobras de embarcaciones meno- res para su navegación",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "recursos-hidricos",
    "nombre": "Recursos Hídricos",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Analiza la estructura hidrográfica de los ecosistemas",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Monitorea la dinámica de cuerpos de agua superficial y subterránea",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza análisis físico-químicos de recursos hídricos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Realiza análisis microbiológicos de recursos hídricos",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Asiste en el tratamiento de agua potable",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Asiste en el tratamiento de agua residual",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "recursos-hidricos-plan-anterior",
    "nombre": "Recursos Hídricos (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Clasifica variables físicas, químicas y biológicas",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Obtiene muestras de agua",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza análisis físicos y químicos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Realiza análisis biológicos",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Asiste en la operación de sistemas de agua potable",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Asiste en la operación de sistemas de agua residual",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Apoya en la medición de variables hidrológicas",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Integra información de recursos hídricos",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Promueve la conservación",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Propone innovaciones tecnológicas",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "refrigeracion-y-aire-acondicionado",
    "nombre": "Refrigeración y Aire Acondicionado",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Instala sistemas domésticos y comerciales de refrigeración",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 11,
            "horasTotales": 176
          },
          {
            "nombre": "Auxilia en la instalación de sistemas indus- triales de refrigeración",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Instala sistemas de aire acondicionado do- mésticos y comerciales",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Auxilia en la instalación de sistemas de aire acondicionado industriales",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "refrigeracion-y-climatizacion-plan-anterior",
    "nombre": "Refrigeración y Climatización (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Agosto, 2016",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Mantenimiento a sistemas de refrigeración",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Instalación y puesta en marcha de sistemas de refrigeración",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 11,
            "horasTotales": 176
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Repara sistemas de refrigeración",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Actualiza sistemas de refrigeración",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Mantiene sistemas de climatización",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Instalación y puesta en marcha de sistemas de climatización",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Repara sistemas de climatización",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Actualiza sistemas de climatización",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "rehabilitacion-y-mejoramiento-ambiental",
    "nombre": "Rehabilitación y Mejoramiento Ambiental",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Abril, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. I Valora los problemas causantes del desequilibrio ecológico",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza levantamiento de inventario de los recursos naturales",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Evalúa los factores que afectan la distribución de los recursos naturales",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza el diagnóstico sobre el aprovechamiento de los recursos naturales",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Valora los problemas causantes del desequilibrio ecológico",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza el diagnóstico sobre el aprovechamiento de los recursos naturales",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Clasifica los residuos contaminantes de acuerdo a su estado y origen",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III. Formación Profesional",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Elabora propuesta de intervención para el mejoramiento del ambiente",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Realiza prácticas ecológicas que respondan a las necesidades regionales",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo IV. Propone y aplica alternativas para el mejoramiento del ambiente",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Propone medidas de mitigación para la rehabilitación del ambiente",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Evalúa los factores que afectan la distribución de los recursos naturales",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Diseña estrategias aplicando la tecnología en la rehabilitación del ambiente",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Evalúa los factores que afectan la distribución de los recursos naturales",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Evalúa los factores que afectan la distribución de los recursos naturales",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "responsabilidad-social-e-inocuidad-alimentaria",
    "nombre": "Responsabilidad Social e Inocuidad Alimentaria",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Julio,   2018",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Identifica el marco normativo de responsabilidad social",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Distingue los procesos de certificación de responsabilidad social",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Identifica las buenas prácticas de los procesos productivos",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Identifica los peligros y riesgos de contaminación en los procesos productivos",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Distingue los programas de certificación de inocuidad",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Distingue los programas de certificación de inocuidad",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Identifica los aspectos de la seguridad industrial",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Determina los riesgos de trabajo",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Elabora un programa básico de seguridad industrial",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Identifica los aspectos de sustentabilidad ambiental",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Selecciona los programas de sustentabilidad ambiental",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      }
    ]
  },
  {
    "id": "salud-integral-y-estilos-de-vida-saludables",
    "nombre": "Salud Integral y Estilos de Vida Saludables",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo I (Parte 1)",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo I (Parte 2)",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo II (Parte 1)",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo II (Parte 2)",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "servicios-de-hospedaje",
    "nombre": "Servicios de Hospedaje",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Valora el servicio de atención al huésped con base en sus necesidades",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Registra la entrada y salida del huésped en el servicio de hospedaje",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Supervisa la limpieza de habitaciones y áreas comunes",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Orienta al huésped sobre Patrimonio turístico de la región",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza la reservación del servicio de hospedaje",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Auxilia en las reservaciones de paquetes de hospedaje",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Auxilia en la ejecución y control de eventos en establecimientos de hospedaje",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "servicios-de-hospedaje-plan-anterior",
    "nombre": "Servicios de Hospedaje (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Septiembre, 2018",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Adopta la filosofía del servicio en los establecimientos de hospedaje",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Organiza actividades de animación y recreación",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Supervisa limpieza de habitaciones",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Supervisa limpeza de áreas públicas",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Opera sistemas de reservaciones",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Atiende al huésped durante su alojamiento",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 11,
            "horasTotales": 176
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Crea productos y servicios turísticos relacionados con el hospedaje",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Colabora en la planeación de eventos",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Colabora en la operación de eventos",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "sistemas-de-informacion-geografica",
    "nombre": "Sistemas de Información Geográfica",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Julio, 2016",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Maneja y desarrolla conceptos de información geográfica",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Gestiona datos con software SIG",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Genera la georreferenciación para desarrollar información espacial",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Desarrolla bibliotecas digitales",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Combina y manipula bases de datos para análisis espacial",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Formula análisis espacial para la toma de decisiones",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Compila información geográfica para diseñar cartografía temática",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Maneja y desarrolla conceptos de información geográfica -",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Maneja y desarrolla conceptos de información geográfica -",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Maneja y desarrolla conceptos de información geográfica -",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      }
    ]
  },
  {
    "id": "sistemas-de-produccion-agricola",
    "nombre": "Sistemas de Producción Agrícola",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Diciembre, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Organiza al personal para la producción agrícola",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Diagnostica el entorno agroecológico",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Diseña proyectos agrícolas sustentables",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Diseña proyectos agrícolas sustentables",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Realiza análisis químico del suelo y agua para la producción agrícola",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza análisis físico del suelo y agua para la producción agrícola",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Realiza análisis microbiológico del suelo y agua para la producción agrícola",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Reproduce los cultivos sexual, asexual e in vitro",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza el control fitosanitario de ácaros e insectos",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza el control fitosanitario de micro organismos patógenos",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza el control fitosanitario de arvenses",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "sistemas-de-produccion-pecuaria",
    "nombre": "Sistemas de Producción Pecuaria",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Diciembre, 2013",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza el manejo zootécnico en especies pecuarias",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Maneja a especies pecuarias aplicando técnicas de contención",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Realiza cirugía menor en especies pecuarias",
            "abreviatura": "SUB3-MI",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza cirugía menor en especies pecuarias",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Reproduce aves de interés zootécnico de acuerdo al programa de reproducción",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo III (Parte 1)",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "sistemas-de-riego",
    "nombre": "Sistemas de Riego",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Interpreta las propiedades biológicas del agua",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Analiza las propiedades fisicoquímicas del suelo, para un sistema de riego",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Analiza las condiciones agroecológicas para establecer un sistema de riego",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 4,
            "horasTotales": 64
          },
          {
            "nombre": "Determina el balance hídrico en los sistemas de producción agrícola",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Determina los requerimientos hídricos de los cultivos",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Determina los requerimientos hídricos de los cultivos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Aplica métodos de riego superficial",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Aplica el método de riego por aspersión",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Aplica el método de riego localizado",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Evalúa los factores para establecer un sistema de riego",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Diseña un sistema de riego para un cultivo",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "soporte-y-gestion-de-tecnologias-de-la-informacion",
    "nombre": "Soporte y Gestión de Tecnologías de la Información",
    "tipoPrograma": "nuevo",
    "acuerdo": "09/05/24",
    "edicion": "Tercera edición 2024",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Módulo I de la Carrera Técnica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Instala hardware en equipos de cómputo",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 12,
            "horasTotales": 192
          },
          {
            "nombre": "Instala software en equipos de cómputo y dis- positivos móviles",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo II. Módulo II de la Carrera Técnica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza mantenimiento preventivo a compu- tadoras y dispositivos móviles",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Realiza mantenimiento correctivo a computadoras y dispositivos móviles",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo III. Módulo III de la Carrera Técnica",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Implementa soluciones digitales para optimización de procesos",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo III (Parte 2)",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV de la Carrera Técnica",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo IV (Parte 1)",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo IV (Parte 2)",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Desarrollo de competencias profesionales del Módulo V (Parte 1)",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Aplicación y práctica profesional del Módulo V (Parte 2)",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 4,
            "horasTotales": 64
          }
        ]
      }
    ]
  },
  {
    "id": "soporte-y-mantenimiento-de-equipo-de-computo-plan-anterior",
    "nombre": "Soporte y Mantenimiento de Equipo de Cómputo (Plan Anterior)",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Ensambla e instala controladores y dispositivos periféricos",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Instala y configura software",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Realiza mantenimiento preventivo",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Realiza mantenimiento correctivo",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 10,
            "horasTotales": 160
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Brinda soporte técnico de manera presencial",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Brinda soporte técnico a distancia",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 11,
            "horasTotales": 176
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Clasifica los elementos básicos de la red LAN",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Diseña la red LAN",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Instala una red LAN",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Opera una red LAN",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  },
  {
    "id": "vida-saludable",
    "nombre": "Vida Saludable",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Identifica la anatomía y la fisiología del cuerpo humano",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 10,
            "horasTotales": 160
          },
          {
            "nombre": "Distingue las enfermedades crónicas no transmisibles",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 7,
            "horasTotales": 112
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Identifica factores de riesgo por mala alimentación y sedentarismo",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Identifica factores de riesgo por hábitos de higiene y sustancias nocivas",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Proporciona información nutricional",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 8,
            "horasTotales": 128
          },
          {
            "nombre": "Fomenta la alimentación saludable como un estilo de vida",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 9,
            "horasTotales": 144
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Proporciona información de actividad física",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Fomenta la actividad física como un estilo de vida saludable",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Diseña programa de actividades integrales de salud",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 7,
            "horasTotales": 112
          },
          {
            "nombre": "Coordina actividades integrales de salud",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      }
    ]
  },
  {
    "id": "viticultura",
    "nombre": "Viticultura",
    "tipoPrograma": "anterior",
    "acuerdo": "653",
    "edicion": "Plan Anterior",
    "horasTotales": 1200,
    "modulos": [
      {
        "nombre": "Módulo I. Registra información financiera de una entidad económica",
        "semestre": 2,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Distingue la morfología, fisiología y fenología de la vid",
            "abreviatura": "SUB1-MI",
            "horasSemanales": 9,
            "horasTotales": 144
          },
          {
            "nombre": "Emplea técnicas de propagación de plantas de vid",
            "abreviatura": "SUB2-MI",
            "horasSemanales": 8,
            "horasTotales": 128
          }
        ]
      },
      {
        "nombre": "Módulo II. Registra costos y nómina de una entidad económica",
        "semestre": 3,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Prepara el suelo para establecer el viñedo",
            "abreviatura": "SUB1-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Traza el viñedo",
            "abreviatura": "SUB2-MII",
            "horasSemanales": 5,
            "horasTotales": 80
          },
          {
            "nombre": "Instala sistemas de espalderas, riego y plantación",
            "abreviatura": "SUB3-MII",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo III. Realiza operaciones tributarias de personas físicas y morales",
        "semestre": 4,
        "horasSemanales": 17,
        "submodulos": [
          {
            "nombre": "Instala sistemas de espalderas, riego y plantación",
            "abreviatura": "SUB1-MIII",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Aplica riego y nutrición sustentable en el cultivo de la vid",
            "abreviatura": "SUB2-MIII",
            "horasSemanales": 5,
            "horasTotales": 80
          }
        ]
      },
      {
        "nombre": "Módulo IV. Módulo IV. Formación Profesional",
        "semestre": 5,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Realiza podas, raleo y conducción en viñedo",
            "abreviatura": "SUB1-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Realiza labores culturales en el viñedo",
            "abreviatura": "SUB2-MIV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      },
      {
        "nombre": "Módulo V. Módulo V de la Carrera Técnica",
        "semestre": 6,
        "horasSemanales": 12,
        "submodulos": [
          {
            "nombre": "Emplea manejo integrado de enfermedades en el viñedo",
            "abreviatura": "SUB1-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          },
          {
            "nombre": "Emplea manejo integrado de plagas en el viñedo",
            "abreviatura": "SUB2-MV",
            "horasSemanales": 6,
            "horasTotales": 96
          }
        ]
      }
    ]
  }
];

// ── Métodos Helper de Consulta ────────────────────────────────────────────────

export function getCarreraPorId(id: string): BTCarrera | undefined {
  const norm = (id || '').toLowerCase().trim();
  return CARRERAS_TECNICAS_BT.find(c => c.id === norm || c.nombre.toLowerCase() === norm);
}

export function getModulosPorSemestreBT(carreraId: string, semestre: number): BTModulo | undefined {
  const carrera = getCarreraPorId(carreraId);
  if (!carrera) return undefined;
  return carrera.modulos.find(m => m.semestre === semestre);
}

export function getCarrerasNuevas(): BTCarrera[] {
  return CARRERAS_TECNICAS_BT.filter(c => c.tipoPrograma === 'nuevo');
}

export function getCarrerasAnteriores(): BTCarrera[] {
  return CARRERAS_TECNICAS_BT.filter(c => c.tipoPrograma === 'anterior');
}

// ── Aliases para Compatibilidad Retroactiva Total con Código Existente ──────────
export type CarreraTecnica = BTCarrera;
export type ModuloCarrera = BTModulo;
export type SubmoduloCarrera = BTSubmodulo;
export const CARRERAS_TECNOLOGICAS = CARRERAS_TECNICAS_BT;
export const getModulosPorSemestre = (carreraId: string, semestre: number, _version?: string) =>
  getModulosPorSemestreBT(carreraId, semestre);

export const CATALOGO_PROPEDUTICAS_5TO: { nombre: string; area: string; horas: number }[] = [
  // Económico-Administrativa
  { nombre: "Derecho y Sociedad I", area: "Económico-Administrativa", horas: 3 },
  { nombre: "Introducción a la Economía", area: "Económico-Administrativa", horas: 3 },
  { nombre: "Introducción a la Administración", area: "Económico-Administrativa", horas: 3 },
  // Físico-Matemática
  { nombre: "Temas de Física", area: "Físico-Matemática", horas: 3 },
  { nombre: "Dibujo Técnico", area: "Físico-Matemática", horas: 3 },
  { nombre: "Matemáticas Aplicadas", area: "Físico-Matemática", horas: 3 },
  // Químico-Biológica
  { nombre: "Bioquímica", area: "Químico-Biológica", horas: 3 },
  { nombre: "Biología Contemporánea", area: "Químico-Biológica", horas: 3 },
  { nombre: "Ciencias de la Salud I", area: "Químico-Biológica", horas: 3 },
  // Humanidades y Ciencias Sociales
  { nombre: "Sociología", area: "Humanidades y Ciencias Sociales", horas: 3 },
  { nombre: "Antropología", area: "Humanidades y Ciencias Sociales", horas: 3 },
  { nombre: "Psicología", area: "Humanidades y Ciencias Sociales", horas: 3 },
];

