# Qué hace Kódea, explicado en la práctica

Esta es la guía de referencia para entender **todo lo que ya existe** en la
plataforma, sin tener que leer código. Está organizada por quién la usa.
Si en algún momento no te acuerdas si algo ya está hecho o no, este es el
archivo que hay que revisar primero.

Última actualización: septiembre de 2026, después de la sesión donde se
construyó Coordinación completa, el intérprete de PSeInt, la nota manual
del tutor, materiales educativos y el quiz en vivo.

---

## 1. Cuentas y acceso

- Cualquiera se registra como **estudiante** o **profesor** con correo y
  contraseña. Si pide "profesor", la cuenta queda como estudiante mientras
  un admin aprueba la solicitud (para que no cualquiera se autoasigne el rol).
- El registro pide el correo **dos veces** (no se puede pegar en el segundo
  campo, a propósito, para que se note si hay un error de dedo) y avisa si
  el dominio parece mal escrito (por ejemplo `unigujira.edu.co` en vez de
  `uniguajira.edu.co`).
- Confirmación por correo: Supabase manda un enlace. El correo institucional
  a veces lo bloquea o lo manda a Cuarentena — es el problema más frecuente
  que da soporte. Dos salidas:
  - El **coordinador** tiene una pestaña "Sin confirmar" en su panel para
    confirmar cuentas a mano, una por una o todas de un tirón (sección 4).
  - A mano por SQL, ver [`docs/EMAIL_CONFIRMATION.md`](./EMAIL_CONFIRMATION.md).
- Hay 4 roles: **estudiante**, **profesor/tutor**, **coordinador** (lo activa
  un admin) y **admin** (el dueño de la plataforma). Coordinador y admin son
  banderas (`is_coordinator`, `is_admin`) sobre una cuenta, no un rol aparte.

## 2. El estudiante

- **Inicio**: racha de días activos, XP total, ejercicios completados y
  pendientes, tarea en la que se quedó a medias ("Continúa donde quedaste").
- **Cursos**: se une con un código de 6 caracteres que le da el tutor. Ve
  sus cursos, entra a cada uno.
- Dentro de un curso ve:
  - **Materiales educativos**: lo que el tutor subió para que estudien (PDF,
    Word, PowerPoint o enlaces). Solo lectura para el estudiante.
  - **Horario**: el horario de las tutorías, uno por línea si hay varios
    días.
  - **Tareas**: cada una con su tipo de ejercicio (ver sección 6), fecha de
    cierre si la tiene, y si es modo examen.
  - **Tablero en vivo**: cuando el tutor está transmitiendo una clase, entra
    ahí a ver lo que dibuja/escribe el tutor en tiempo real, y puede tener
    su propio espacio de código en paralelo ("Mi código").
- **Resolver un ejercicio** (`/app/solve/:id`): editor de código (PSeInt,
  Java o Python) con botón "Ejecutar" que corre el código de verdad — PSeInt
  corre en el propio navegador (sección 7), Python y Java en un servidor
  externo gratuito. La consola es **interactiva**: si el programa pide un
  dato, aparece una casilla para escribirlo ahí mismo, en vez de pedir toda
  la entrada de una.
- Al enviar, la IA califica y explica (fortalezas, errores línea por línea,
  sugerencias). El tutor puede corregir esa nota después (sección 3) — si lo
  hace, el estudiante ve una tarjeta aparte "Nota final de tu tutor" con su
  comentario.
- **Práctica libre**: ejercicios que no dependen de ninguna tarea, para
  practicar cuando quiera. Puede pedirle a la IA que genere uno nuevo sobre
  un tema y lenguaje a elegir ("Práctica con IA"), o usar el "Editor libre"
  (un lienzo en blanco en el lenguaje que quiera, sin calificar).
- **Modo examen**: si el tutor marca una tarea como examen, el estudiante
  tiene un solo intento, puede tener límite de tiempo, y la plataforma
  registra (sin bloquear) si sale de la pantalla o pega texto — el tutor lo
  ve como indicio, no como prueba.
- **Quiz en vivo**: si el tutor arranca uno, el estudiante entra escaneando
  un QR o con un enlace, y responde desde el celular (sección 8).
- **Notificaciones**: la campanita avisa de tarea nueva, calificación (de la
  IA o del tutor), clase en vivo que empezó, tarea por vencer sin entregar,
  y cambios en sus grupos. Si el estudiante activó notificaciones, también
  le llegan como notificación del sistema, incluso con la app cerrada
  (sección 9).

## 3. El profesor / tutor

Todo lo del estudiante en sus propios cursos, más:

- **Crear curso**: título, descripción, color, asignatura (del catálogo
  académico, opcional pero recomendado — ver sección 5). Genera un código
  de unión automático.
- **Materiales educativos**: sube PDF, Word, PowerPoint (hasta 25 MB) o
  enlaces para que los estudiantes estudien. Solo él puede subir/borrar en
  su curso.
- **Horario**: propone opciones y los estudiantes votan, o lo pone a mano
  directamente (por ejemplo si nadie votó). Se puede escribir más de un
  horario, uno por línea, y se exporta a Excel con la tabla de los 7 días
  de la semana ya armada.
- **Tareas y ejercicios**: crea tareas con fecha de apertura/cierre, límite
  de tiempo, modo examen, puntos. Cada tarea tiene ejercicios de 4 tipos
  posibles (sección 6). Puede probar la solución de un ejercicio de código
  antes de publicarlo (botón "Ejecutar" dentro del formulario).
- **Calificar**: ve todas las entregas de un ejercicio, agrupadas por
  estudiante, con el código o la respuesta, el feedback de la IA, cuánto se
  demoró, y los indicios de modo examen. Puede **poner o corregir la nota a
  mano** y dejar un comentario — eso queda como la nota final, la IA no la
  vuelve a pisar después, y le llega notificación al estudiante.
- **Tablero en vivo**: "Abrir tablero en vivo" pone la clase en directo y
  avisa a los inscritos. Si sale de la pantalla sin apagarlo a mano, se
  apaga solo (para que no quede "en vivo" para siempre).
- **Quiz en vivo**: desde cualquier tarea con preguntas de opción múltiple,
  botón "Quiz en vivo" → elige el modo → QR para que entren → arranca
  cuando estén listos (sección 8).
- **Asistencia de tutorías**: registra sesiones (fecha, tema, quién asistió).
- **Informe periódico (BS-F-17)** y **Actas de reunión (AD-F-01)**: se
  generan en Word con el formato oficial de la universidad, con los datos
  ya rellenados (puede subir una foto de evidencia). Hay vista previa antes
  de descargar.
- **Eliminar curso**: al final del curso hay un botón para eliminarlo — es
  borrado suave, las tareas/entregas/notas quedan guardadas y se pueden
  recuperar por SQL si hace falta.
- **Solicitar ser profesor**: cuando alguien se registra pidiendo el rol de
  profesor, la solicitud le llega a un admin para aprobar en `/app/admin`.

## 4. El coordinador de tutoría

Ve y administra **todos** los cursos, no solo los suyos. Entra por
`/app/coordinacion`. Pestañas:

- **Resumen**: números globales — estudiantes, tutores, grupos, tareas,
  entregas, promedio general.
- **Grupos**: todos los cursos de todos los tutores. Puede crear un grupo
  nuevo (asigna un tutor por correo — si esa persona aún no era tutor, la
  convierte), inscribir estudiantes pegando una lista de correos, o quitar
  a alguien de un grupo.
- **Estudiantes** / **Tutores**: listas con búsqueda, actividad, promedio,
  número de ingresos. Exportables a Excel.
- **Sin confirmar**: cuentas que se registraron pero nunca confirmaron el
  correo. Se pueden confirmar una por una, todas de un tirón (las que no
  parecen tener el correo mal escrito), o borrar las que sí lo tienen mal
  escrito (solo borra cuentas sin datos, nunca una cuenta ya confirmada).
- **Plantillas**: sube los formatos oficiales .docx/.xlsx que la plataforma
  usa para generar los informes y actas — si la universidad cambia el
  formato, se reemplaza aquí sin tocar código.

## 5. Catálogo académico (Facultad → Carrera → Asignatura)

La Universidad de La Guajira ya viene cargada: 6 facultades, ~20 carreras,
con sus asignaturas. Un curso puede colgar de una asignatura del catálogo
(opcional). Esto sirve para dos cosas:

1. Los formatos oficiales (BS-F-17, AD-F-01) traen el nombre del programa y
   la asignatura automáticamente.
2. Una tarea que **no es de código** (el tutor la marca como "Lógica" al
   crearla) muestra, en vez de un ícono genérico de rompecabezas, el
   **ícono de la facultad real** del curso (por ejemplo el de una balanza
   para Derecho, un estetoscopio para Enfermería) y el nombre de la
   asignatura — así una tarea de Psicología no se ve como si fuera de
   programación. Un ícono por facultad (6), no por cada carrera (~20), para
   que una carrera nueva que agregue la universidad quede vestida sola.

Solo un admin puede editar el catálogo (agregar facultades/carreras).

## 6. Los 4 tipos de ejercicio (y para qué sirve cada uno, más allá de código)

Aunque nacieron para programación, sirven para cualquier materia:

| Tipo | Cómo califica | Para qué usarlo |
|---|---|---|
| **Código** | El estudiante corre y entrega código; la IA lo revisa | Programación (PSeInt/Java/Python) |
| **Opción múltiple** | Automático, al instante | Cualquier materia — también es la base del quiz en vivo |
| **Numérica** | Automático, con tolerancia de decimales | Matemáticas, física, cualquier cálculo |
| **Abierta (desarrollo)** | La IA califica contra una **rúbrica** que escribe el tutor | Ensayos, casos, definiciones — Derecho, Psicología, Enfermería, lo que sea. Es, en el fondo, un corrector de ensayos ya construido; el tutor solo necesita escribir bien la rúbrica |

## 7. El intérprete de PSeInt

PSeInt corre **dentro del navegador**, sin servidor ni costo — está escrito
a mano en [`src/lib/pseint.ts`](../src/lib/pseint.ts). Entiende `Definir`,
`Leer`/`Escribir` (con `Sin Saltar`), `Si/SiNo`, `Segun`, `Mientras`,
`Repetir`, `Para` (con paso), arreglos y matrices, funciones y subprocesos
(con `Por Referencia`), operadores `Y/O/NO/MOD`, y funciones como `Raiz`,
`Abs`, `Trunc`, `Longitud`, `Subcadena`. Los errores salen en español con
el número de línea. Un ciclo infinito se corta solo con un aviso, en vez de
colgar la página. La consola es interactiva (se detiene en cada `Leer` y
pide el dato ahí mismo), igual que Python y Java (esos sí van a un servidor
externo, con un parche que hace que la consola se comporte igual).

## 8. Quiz en vivo (QR, dos modos)

Sobre las preguntas de opción múltiple que ya tiene una tarea. El tutor
elige el modo al arrancar:

- **Al mismo tiempo** (como Kahoot): todos ven la misma pregunta a la vez;
  el tutor la avanza con un botón.
- **A su ritmo** (como Quizizz): cada estudiante avanza solo, sin esperar a
  nadie; el tutor solo mira el marcador y cierra el quiz cuando quiera.

Los estudiantes entran escaneando un **código QR** o con el enlace. El
marcador se actualiza en vivo para todos (Supabase Realtime), sin recargar
la página. Al terminar, cada quien ve su puntaje y su puesto.

**Lo que falta a propósito** (para no atrasar el lanzamiento): no hay
cronómetro por pregunta, y el tutor no ve "cuántos ya respondieron" mientras
la pregunta está activa en modo sincronizado — solo el marcador general. Se
puede agregar después.

## 9. Notificaciones (dentro de la app y con el celular cerrado)

- La campanita muestra las notificaciones dentro de la app, con un punto
  de color que dice si el "push" (avisos del sistema) está activado,
  desactivado o bloqueado por el navegador.
- Para que lleguen avisos con la app **cerrada**, hace falta un mecanismo
  llamado Web Push. Aquí hay una particularidad de este proyecto: la base
  de datos de Supabase **no puede llamarse a sí misma** (un límite de la
  plataforma, no un bug nuestro), así que no se pudo usar el disparador
  automático típico. La solución: un workflow de **GitHub Actions** llama
  cada 5 minutos a una función que revisa qué notificaciones faltan por
  mandar y las manda. Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para el
  detalle técnico.
- Recordatorio automático de tareas por vencer: si a un estudiante le
  quedan pocas horas para el cierre y no ha entregado, le llega un aviso
  solo (un `cron` dentro de la base de datos revisa esto cada 15 minutos).

## 10. Lo que sigue pendiente (no construido todavía)

Ordenado por lo que más valor da:

1. **Módulo de estudio personalizado**: que el estudiante suba sus propios
   apuntes (PDF, Word, PowerPoint o un enlace) y la plataforma le arme un
   examen de práctica con eso, y al final le diga en qué temas está flojo.
   Es grande — necesita sacarle el texto al archivo, generarle preguntas
   con IA, y etiquetarlas por tema para poder armar el informe de
   falencias. Se decidió construirlo como su **propio módulo aparte**, sin
   tocar tareas/ejercicios, justamente para no arriesgar lo que ya funciona.
2. **Auditoría de las reglas de seguridad (RLS)**: nunca se probó
   sistemáticamente que un estudiante no pueda ver datos de otro curso.
3. **Ensayo de restauración del respaldo**: el respaldo diario corre, pero
   restaurarlo en un proyecto de prueba nunca se probó de punta a punta.
4. **Modo oscuro** fuera del editor de código (el editor ya lo tiene).
5. **Unificar las dos librerías de Excel** (`exceljs` y `xlsx`) para
   aligerar la descarga de la app.

---

Para el detalle técnico (tablas, funciones de la base de datos, decisiones
de arquitectura) ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) y
[`DATABASE.md`](./DATABASE.md).
