/**
 * computacion-redes.ts — Malla y trayectoria curricular DAG de Computación y Redes (BGE Puebla, 2024).
 *
 * Fuente: `Redes_y_Mantenimiento_2024.pdf` (SEP Puebla, Acuerdo 09/08/23),
 * páginas 20–24 (mapa de competencias) y 25–205 (desglose de UACs y saberes).
 *
 * Valida formalmente con `trajectory-validator.ts`:
 * - 4 semestres (3.° a 6.°)
 * - 8 UACs canónicas oficiales
 * - 24 actividades clave de 18 horas cada una = 432 horas totales
 * - DAG estricto sin ciclos
 * - Proyecto Integrador: "Taller Comunitario de Mantenimiento de Cómputo y Conectividad Escolar"
 */

import type { CurriculumTrajectory } from '../trajectory-types';

const SINCO_COMPUTO_REDES = [
  '2651 — Auxiliar en la instalación y reparación de redes, equipos y sistemas computacionales',
  '3114 — Técnicos en redes de cómputo y telecomunicaciones',
];

const SCIAN_COMPUTO_REDES = [
  '811211 — Reparación y mantenimiento de equipo de cómputo y de equipo periférico',
  '541512 — Servicios de diseño de sistemas de cómputo e integración de tecnologías de la información',
  '611122 — Escuelas de educación media superior del sector público',
];

export const COMPUTACION_REDES_TRAJECTORY: CurriculumTrajectory = {
  id: 'computacion-redes-bge-2024',
  name: 'Computación y Redes',
  subsystem: 'bge',
  curriculumName: 'Formación Laboral Básico — Redes y Mantenimiento',
  generation: 'Generación 2023–2026',
  agreement: 'Acuerdo 09/08/23',
  durationSemesters: 4,
  totalUacs: 8,
  totalHours: 432,
  sourceDocument: 'Redes_y_Mantenimiento_2024.pdf',
  sourcePages: '20–24 (mapa de competencias) y 25–205 (UACs)',
  nodes: [
    {
      id: 'CR-3.1',
      uacName: 'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante',
      semester: 3,
      order: 1,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante.',
      keyActivities: [
        {
          id: 'CR-3.1-A1',
          name: 'Realiza reparaciones menores al hardware siguiendo especificaciones de instalación con supervisión de un profesional',
          hours: 18,
          contents: [
            'Arquitectura y componentes internos y externos de equipos de cómputo',
            'Especificaciones técnicas del fabricante y compatibilidad de periféricos',
            'Normas de seguridad eléctrica y prevención de descargas electrostáticas (ESD)',
          ],
          description:
            'Diagnóstico físico de componentes internos y externos de equipos de cómputo; reemplazo de partes dañadas bajo manuales técnicos del fabricante y verificación operativa.',
        },
        {
          id: 'CR-3.1-A2',
          name: 'Actualiza software para satisfacer las necesidades operativas del usuario con supervisión de un profesional',
          hours: 18,
          contents: [
            'Sistemas operativos, particionado de almacenamiento y firmware UEFI/BIOS',
            'Instalación y actualización de controladores oficiales de hardware',
            'Software utilitario, suites ofimáticas y herramientas de diagnóstico',
          ],
          description:
            'Instalación, actualización y configuración de sistemas operativos y controladores de dispositivos en computadoras escolares, asegurando compatibilidad y rendimiento.',
        },
        {
          id: 'CR-3.1-A3',
          name: 'Verifica rendimiento de la red y sus dispositivos con supervisión de un profesional',
          hours: 18,
          contents: [
            'Tarjetas de interfaz de red (NIC), módems y concentradores',
            'Parámetros de conectividad, ancho de banda y latencia básica',
            'Protocolos de prueba de enlace físico y lógico en entornos de red',
          ],
          description:
            'Evaluación operativa de adaptadores de red y periféricos de enlace en equipos intervenidos, registrando mediciones en bitácoras técnicas estandarizadas.',
        },
      ],
      contents: [
        'Arquitectura y componentes internos y externos de equipos de cómputo',
        'Especificaciones técnicas del fabricante y compatibilidad de periféricos',
        'Normas de seguridad eléctrica y prevención de descargas electrostáticas (ESD)',
        'Sistemas operativos, particionado de almacenamiento y firmware UEFI/BIOS',
        'Instalación y actualización de controladores oficiales de hardware',
        'Tarjetas de interfaz de red (NIC), módems y concentradores',
      ],
      sinco: SINCO_COMPUTO_REDES,
      scian: SCIAN_COMPUTO_REDES,
      prerequisites: [],
      projectMilestone: 'Diagnóstico técnico inicial del parque de cómputo del plantel escolar',
    },
    {
      id: 'CR-3.2',
      uacName: 'Usa técnicas y estrategias de mantenimiento del equipo de cómputo',
      semester: 3,
      order: 2,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Aplica técnicas y estrategias de mantenimiento preventivo y correctivo al equipo de cómputo.',
      keyActivities: [
        {
          id: 'CR-3.2-A1',
          name: 'Realiza mantenimiento preventivo con supervisión de un profesional',
          hours: 18,
          contents: [
            'Técnicas de limpieza física con aire comprimido y solventes dieléctricos',
            'Inspección y sustitución de pasta térmica en microprocesadores',
            'Rutinas periódicas de desfragmentación, depuración y respaldo de datos',
          ],
          description:
            'Ejecución sistemática de limpieza física profunda y optimización lógica de equipos de cómputo para prevenir sobrecalentamiento y fallas operativas.',
        },
        {
          id: 'CR-3.2-A2',
          name: 'Realiza mantenimiento correctivo con supervisión de un profesional',
          hours: 18,
          contents: [
            'Metodología de diagnóstico de fallas comunes de hardware y software',
            'Sustitución de unidades de almacenamiento, fuentes de poder y memorias RAM',
            'Recuperación de arranque de sistema y resolución de conflictos lógicos',
          ],
          description:
            'Aislamiento y corrección de averías operacionales en estaciones de trabajo escolares con sustitución de componentes defectuosos.',
        },
        {
          id: 'CR-3.2-A3',
          name: 'Aplica software de gestión y planificación de mantenimiento con supervisión de un profesional',
          hours: 18,
          contents: [
            'Programación y calendario de mantenimientos preventivos programados',
            'Sistemas de tickets de servicio y órdenes de trabajo técnicas',
            'Hojas de control de inventario de partes, refacciones e insumos',
          ],
          description:
            'Diseño e implementación de un plan calendarizado de mantenimiento asistido por software de inventario y registro de incidencias técnicas.',
        },
      ],
      contents: [
        'Técnicas de limpieza física con aire comprimido y solventes dieléctricos',
        'Inspección y sustitución de pasta térmica en microprocesadores',
        'Metodología de diagnóstico de fallas comunes de hardware y software',
        'Sustitución de unidades de almacenamiento, fuentes de poder y memorias RAM',
        'Programación y calendario de mantenimientos preventivos programados',
        'Sistemas de tickets de servicio y órdenes de trabajo técnicas',
      ],
      sinco: SINCO_COMPUTO_REDES,
      scian: SCIAN_COMPUTO_REDES,
      prerequisites: ['CR-3.1'],
      projectMilestone: 'Jornada escolar de mantenimiento preventivo y correctivo a computadoras del plantel',
    },
    {
      id: 'CR-4.1',
      uacName: 'Establece seguridad informática en equipos de cómputo',
      semester: 4,
      order: 1,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Implementa medidas de seguridad informática y protección de datos en equipos de cómputo.',
      keyActivities: [
        {
          id: 'CR-4.1-A1',
          name: 'Protege red de una organización con las medidas de seguridad de los sistemas operativos con supervisión de un profesional',
          hours: 18,
          contents: [
            'Cortafuegos local (firewall) y directivas de seguridad del sistema operativo',
            'Cuentas de usuario restringidas, roles y privilegios de acceso',
            'Políticas de contraseñas robustas y autenticación segura',
          ],
          description:
            'Configuración de directivas de seguridad en sistemas operativos cliente para mitigar vulnerabilidades de acceso y ejecución indebida.',
        },
        {
          id: 'CR-4.1-A2',
          name: 'Utiliza Apps y programas de amenazas exteriores para proteger sistemas, datos y redes con supervisión de un profesional',
          hours: 18,
          contents: [
            'Detección y neutralización de malware, virus, ransomware y spyware',
            'Configuración de soluciones antivirus perimetrales y de host',
            'Buenas prácticas de navegación segura y prevención de phishing',
          ],
          description:
            'Despliegue y análisis con software antivirus y antimalware para salvaguardar la integridad de estaciones de trabajo y datos escolares.',
        },
        {
          id: 'CR-4.1-A3',
          name: 'Mantiene seguros los datos de una organización a través de la infraestructura, las aplicaciones y las plataformas en línea con supervisión de un profesional',
          hours: 18,
          contents: [
            'Estrategias de respaldo 3-2-1 en medios locales cifrados y almacenamiento seguro en nube',
            'Restauración de copias de seguridad e integridad de la información',
            'Normativas de privacidad y protección de datos personales en el entorno educativo',
          ],
          description:
            'Creación de planes de respaldo automatizado y procedimientos de contingencia para la continuidad operativa de la información escolar.',
        },
      ],
      contents: [
        'Cortafuegos local (firewall) y directivas de seguridad del sistema operativo',
        'Cuentas de usuario restringidas, roles y privilegios de acceso',
        'Detección y neutralización de malware, virus, ransomware y spyware',
        'Estrategias de respaldo 3-2-1 en medios locales cifrados y nube',
        'Normativas de privacidad y protección de datos personales',
      ],
      sinco: SINCO_COMPUTO_REDES,
      scian: SCIAN_COMPUTO_REDES,
      prerequisites: ['CR-3.2'],
      projectMilestone: 'Blindaje de seguridad lógica y políticas de protección de datos en el aula de cómputo',
    },
    {
      id: 'CR-4.2',
      uacName: 'Planea infraestructura de red internet e intranet en un entorno con supervisión del experto',
      semester: 4,
      order: 2,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Diseña y dimensiona la infraestructura física y lógica de una red local institucional.',
      keyActivities: [
        {
          id: 'CR-4.2-A1',
          name: 'Desglosa puntos de red en un entorno',
          hours: 18,
          contents: [
            'Levantamiento de requerimientos y plano arquitectónico del área de trabajo',
            'Normas de cableado estructurado TIA/EIA-568 y estándares de canalización',
            'Ubicación óptima de nodos de red, tomas de datos y paneles de parcheo (patch panels)',
          ],
          description:
            'Diseño del croquis de distribución y cálculo de puntos de conexión de red LAN en el laboratorio escolar considerando distancia y atenuación.',
        },
        {
          id: 'CR-4.2-A2',
          name: 'Configura dispositivos pasivos y activos de una red',
          hours: 18,
          contents: [
            'Dispositivos pasivos: cable UTP Cat 5e/6, conectores RJ-45, jacks y canaletas',
            'Dispositivos activos: switches, routers inalámbricos, access points y tarjetas de red',
            'Especificaciones técnicas y criterios de selección de equipamiento de red',
          ],
          description:
            'Selección y preparación de medios de transmisión física y componentes activos para la infraestructura de conectividad escolar.',
        },
        {
          id: 'CR-4.2-A3',
          name: 'Desglosa reparto de dispositivos activos y pasivos de una red',
          hours: 18,
          contents: [
            'Topologías físicas y lógicas de red (estrella extendida, árbol)',
            'Dimensionamiento del rack de telecomunicaciones y organizadores de cables',
            'Presupuesto técnico de materiales, costos y cronograma de instalación',
          ],
          description:
            'Elaboración del proyecto técnico integral de instalación de red local con memoria de cálculo y diagrama de distribución de dispositivos.',
        },
      ],
      contents: [
        'Levantamiento de requerimientos y plano arquitectónico del área de trabajo',
        'Normas de cableado estructurado TIA/EIA-568 y estándares de canalización',
        'Dispositivos pasivos: cable UTP Cat 5e/6, conectores RJ-45, jacks y canaletas',
        'Dispositivos activos: switches, routers inalámbricos, access points',
        'Topologías físicas y lógicas de red (estrella extendida, árbol)',
        'Presupuesto técnico de materiales, costos y cronograma de instalación',
      ],
      sinco: SINCO_COMPUTO_REDES,
      scian: SCIAN_COMPUTO_REDES,
      prerequisites: ['CR-4.1'],
      projectMilestone: 'Proyecto ejecutivo de diseño de cableado estructurado para el aula de medios',
    },
    {
      id: 'CR-5.1',
      uacName: 'Administra redes de acuerdo con las condiciones y requerimientos de una organización',
      semester: 5,
      order: 1,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Gestiona, configura y monitorea el funcionamiento de una red de comunicaciones.',
      keyActivities: [
        {
          id: 'CR-5.1-A1',
          name: 'Elabora conexiones según el diseño aprobado con supervisión de un profesional',
          hours: 18,
          contents: [
            'Terminación de cables UTP bajo norma TIA/EIA-568A y 568B',
            'Ponchado de conectores macho RJ-45 y jacks hembra con herramientas de impacto',
            'Canalización estética en canaleta plástica y tubería conduit metálica',
          ],
          description:
            'Tendido de cableado estructurado, conectorización certificada y peinado de cables en el rack de telecomunicaciones escolar.',
        },
        {
          id: 'CR-5.1-A2',
          name: 'Conecta dispositivos de acuerdo con diagrama aprobado bajo supervisión de un profesional',
          hours: 18,
          contents: [
            'Interconexión de switches de distribución con routers de borde y servidores',
            'Configuración de direccionamiento IPv4 estático y dinámico (servidor DHCP)',
            'Enrutamiento básico, máscaras de subred y puertas de enlace predeterminadas',
          ],
          description:
            'Conexión física y configuración lógica de parámetros TCP/IP en estaciones de trabajo y dispositivos de red locales.',
        },
        {
          id: 'CR-5.1-A3',
          name: 'Realiza pruebas de conectividad entre los equipos de red con supervisión de un profesional',
          hours: 18,
          contents: [
            'Uso de probadores de continuidad física (lan tester) y mapeadores de cables',
            'Comandos de diagnóstico de red: ping, traceroute/tracert, ipconfig/ifconfig, nslookup',
            'Detección y solución de conflictos de IP, pérdida de paquetes y atenuación',
          ],
          description:
            'Certificación de enlaces físicos y validación de comunicación extremo a extremo en la red escolar con reporte técnico formal.',
        },
      ],
      contents: [
        'Terminación de cables UTP bajo norma TIA/EIA-568A y 568B',
        'Ponchado de conectores macho RJ-45 y jacks hembra con herramientas de impacto',
        'Configuración de direccionamiento IPv4 estático y dinámico (servidor DHCP)',
        'Uso de probadores de continuidad física (lan tester) y mapeadores de cables',
        'Comandos de diagnóstico de red: ping, traceroute, ipconfig, nslookup',
      ],
      sinco: SINCO_COMPUTO_REDES,
      scian: SCIAN_COMPUTO_REDES,
      prerequisites: ['CR-4.2'],
      projectMilestone: 'Montaje, conectorización y certificación operativa de la red LAN escolar',
    },
    {
      id: 'CR-5.2',
      uacName: 'Brinda soporte en software de aplicación y hardware según los requerimientos del usuario',
      semester: 5,
      order: 2,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Proporciona asistencia técnica presencial y remota a usuarios de software y hardware.',
      keyActivities: [
        {
          id: 'CR-5.2-A1',
          name: 'Registra usuarios según los protocolos de la organización con supervisión de un profesional',
          hours: 18,
          contents: [
            'Creación y administración de cuentas de usuario en entornos cliente-servidor',
            'Políticas de grupos de trabajo y control de acceso a recursos compartidos',
            'Formatos de registro de nuevos usuarios y asignación de identificadores',
          ],
          description:
            'Gestión administrativa de credenciales y accesos de estudiantes y docentes a la red escolar y carpetas compartidas de trabajo.',
        },
        {
          id: 'CR-5.2-A2',
          name: 'Establece atributos a usuarios de acuerdo con los requerimientos de la organización bajo supervisión de un profesional',
          hours: 18,
          contents: [
            'Permisos NTFS y de red: lectura, modificación, control total y denegación',
            'Cuotas de almacenamiento en disco y restricciones de ejecución de programas',
            'Perfiles móviles y perfiles locales de usuario en laboratorios compartidos',
          ],
          description:
            'Asignación rigurosa de privilegios de acceso y cuotas de uso de recursos digitales para salvaguardar el orden operativo del laboratorio.',
        },
        {
          id: 'CR-5.2-A3',
          name: 'Realiza cambios y actualizaciones en la red conforme a las necesidades de la organización con supervisión de un profesional',
          hours: 18,
          contents: [
            'Incorporación de nuevos nodos y dispositivos móviles a la red Wi-Fi institucional',
            'Actualización de firmware de switches y puntos de acceso inalámbrico',
            'Monitoreo del tráfico y optimización de la calidad del servicio de internet',
          ],
          description:
            'Mantenimiento continuo y escalamiento de la red institucional para atender requerimientos crecientes de conectividad escolar.',
        },
      ],
      contents: [
        'Creación y administración de cuentas de usuario en entornos cliente-servidor',
        'Permisos NTFS y de red: lectura, modificación, control total',
        'Cuotas de almacenamiento en disco y restricciones de ejecución',
        'Incorporación de nuevos nodos y dispositivos móviles a la red Wi-Fi',
        'Monitoreo del tráfico y optimización de la calidad del servicio de internet',
      ],
      sinco: SINCO_COMPUTO_REDES,
      scian: SCIAN_COMPUTO_REDES,
      prerequisites: ['CR-5.1'],
      projectMilestone: 'Puesta en marcha del sistema de gestión de usuarios y mesa de ayuda del plantel',
    },
    {
      id: 'CR-6.1',
      uacName: 'Asesora sobre directrices de seguridad en redes y equipos de cómputo a usuarios',
      semester: 6,
      order: 1,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Capacita y asesora a la comunidad en buenas prácticas de ciberseguridad y prevención de riesgos.',
      keyActivities: [
        {
          id: 'CR-6.1-A1',
          name: 'Apoya usuarios de una organización en administrar la red de la organización con supervisión de un profesional',
          hours: 18,
          contents: [
            'Capacitación a usuarios no técnicos en el uso correcto de recursos compartidos',
            'Manuales breves y guías rápidas de usuario para conexión a la red institucional',
            'Técnicas de comunicación pedagógica asertiva y empatía con el usuario',
          ],
          description:
            'Elaboración de manuales de buenas prácticas y acompañamiento a docentes y alumnos en el aprovechamiento seguro de la red escolar.',
        },
        {
          id: 'CR-6.1-A2',
          name: 'Apoya usuarios de una organización a identificar incidentes de seguridad en la web con supervisión de un profesional',
          hours: 18,
          contents: [
            'Identificación de amenazas comunes: phishing, enlaces fraudulentos y descargas sospechosas',
            'Uso de certificados digitales SSL/TLS y verificación de autenticidad de sitios web',
            'Talleres comunitarios de concientización sobre ciberseguridad e higiene digital',
          ],
          description:
            'Impartición de sesiones formativas dirigidas a la comunidad escolar sobre prevención de fraudes digitales y robo de identidad.',
        },
        {
          id: 'CR-6.1-A3',
          name: 'Apoya usuarios de una organización en la recuperación de incidentes menores con supervisión de un profesional',
          hours: 18,
          contents: [
            'Protocolos de respuesta inmediata ante sospecha de infección o compromiso de cuentas',
            'Restauración de sistemas a puntos de control previos y saneamiento de unidades USB',
            'Desinfección de navegadores y remoción de extensiones maliciosas',
          ],
          description:
            'Atención técnica a usuarios afectados por incidentes informáticos menores con remediación y orientación preventiva personalizada.',
        },
      ],
      contents: [
        'Capacitación a usuarios no técnicos en el uso correcto de recursos compartidos',
        'Identificación de amenazas comunes: phishing, enlaces fraudulentos',
        'Uso de certificados digitales SSL/TLS y verificación de sitios',
        'Protocolos de respuesta inmediata ante sospecha de infección',
        'Restauración de sistemas a puntos de control previos',
      ],
      sinco: SINCO_COMPUTO_REDES,
      scian: SCIAN_COMPUTO_REDES,
      prerequisites: ['CR-5.2'],
      projectMilestone: 'Campaña comunitaria de ciberseguridad y talleres prácticos de higiene digital',
    },
    {
      id: 'CR-6.2',
      uacName: 'Ofrece soporte en software de aplicación y hardware según los requerimientos del usuario',
      semester: 6,
      order: 2,
      totalHours: 54,
      weeklyHours: 3,
      blocks: 3,
      learningOutcome: 'Brinda soporte técnico multicanal integral garantizando la continuidad operativa de los servicios de TI.',
      keyActivities: [
        {
          id: 'CR-6.2-A1',
          name: 'Utiliza canales digitales de respuesta inmediata para asistir al usuario en problemáticas simples con supervisión de un profesional',
          hours: 18,
          contents: [
            'Herramientas de mensajería técnica y chat de soporte en tiempo real',
            'Guías de resolución paso a paso para incidencias frecuentes de software',
            'Registro y seguimiento de tickets digitales de soporte técnico',
          ],
          description:
            'Atención inmediata a solicitudes de asistencia de software ofimático y educativo mediante plataformas digitales de comunicación.',
        },
        {
          id: 'CR-6.2-A2',
          name: 'Usa servicios de videotelefonía para ayudar al usuario en problemáticas simples con supervisión de un profesional',
          hours: 18,
          contents: [
            'Herramientas de control remoto asistido y compartición de pantalla segura',
            'Diagnóstico remoto guiado de problemas de configuración de software',
            'Protocolos de privacidad y consentimiento explícito en soporte remoto',
          ],
          description:
            'Resolución a distancia de configuraciones de software e impresoras mediante videollamada y escritorio remoto con autorización del usuario.',
        },
        {
          id: 'CR-6.2-A3',
          name: 'Auxilia usuario de forma presencial en problemáticas simples y de varias instrucciones con supervisión de un profesional',
          hours: 18,
          contents: [
            'Intervención en sitio en estaciones de trabajo, impresoras y periféricos',
            'Demostración pedagógica presencial para el fortalecimiento de habilidades digitales del usuario',
            'Cierre formal de orden de servicio con encuesta de satisfacción y firma de conformidad',
          ],
          description:
            'Asistencia técnica presencial en las diferentes áreas administrativas y académicas del plantel con entrega documentada de la solución.',
        },
      ],
      contents: [
        'Herramientas de mensajería técnica y chat de soporte en tiempo real',
        'Herramientas de control remoto asistido y compartición de pantalla segura',
        'Diagnóstico remoto guiado de problemas de configuración de software',
        'Intervención en sitio en estaciones de trabajo, impresoras y periféricos',
        'Cierre formal de orden de servicio con encuesta de satisfacción',
      ],
      sinco: SINCO_COMPUTO_REDES,
      scian: SCIAN_COMPUTO_REDES,
      prerequisites: ['CR-6.1'],
      projectMilestone: 'Operación continua y entrega formal del Taller Comunitario de Soporte Técnico',
    },
  ],
  project: {
    name: 'Taller Comunitario de Mantenimiento de Cómputo y Conectividad Escolar',
    description:
      'Proyecto integrador articulado a lo largo de 4 semestres (3.° a 6.°) que diseña, rehabilita, asegura y opera un centro escolar y comunitario de servicio técnico para prolongar la vida útil de equipos de cómputo y brindar conectividad robusta y segura.',
    finalProduct:
      'Taller Comunitario de Mantenimiento de Cómputo y Red Escolar Certificada en Plena Operación, con Manual de Procedimientos, Bitácoras de Servicio y Mesa de Ayuda',
    milestones: [
      {
        semester: 3,
        title: 'Diagnóstico y Mantenimiento Integral de Equipos de Cómputo',
        description:
          'Diagnóstico inicial del hardware y software del plantel, limpieza física profunda, optimización lógica y jornadas comunitarias de mantenimiento preventivo y correctivo.',
        linkedUacs: ['CR-3.1', 'CR-3.2'],
        evidence: 'Reporte técnico de diagnóstico y bitácora de mantenimiento preventivo y correctivo de 30+ equipos escolares.',
      },
      {
        semester: 4,
        title: 'Seguridad Informática y Diseño de Red Local',
        description:
          'Blindaje de seguridad en estaciones de trabajo escolares, implementación de copias de seguridad 3-2-1 y diseño ejecutivo del cableado estructurado del aula de medios.',
        linkedUacs: ['CR-4.1', 'CR-4.2'],
        evidence: 'Proyecto técnico de cableado estructurado bajo norma TIA/EIA-568 y manual de políticas de ciberseguridad escolar.',
      },
      {
        semester: 5,
        title: 'Instalación de Cableado, Configuración de Red y Gestión de Usuarios',
        description:
          'Tendido, conectorización y prueba de cableado estructurado, configuración de direccionamiento IP y gestión de cuentas de usuario con cuotas y permisos.',
        linkedUacs: ['CR-5.1', 'CR-5.2'],
        evidence: 'Memoria técnica de certificación de red LAN con mapa de puntos de red y directorio de usuarios activos.',
      },
      {
        semester: 6,
        title: 'Mesa de Ayuda, Soporte Multicanal y Ciberseguridad Comunitaria',
        description:
          'Capacitación comunitaria en prevención de incidentes digitales y operación en vivo de una mesa de ayuda multicanal para soporte presencial y remoto.',
        linkedUacs: ['CR-6.1', 'CR-6.2'],
        evidence: 'Bitácora general del Taller Comunitario con órdenes de servicio atendidas, encuestas de satisfacción y manual del usuario.',
      },
    ],
  },
};
