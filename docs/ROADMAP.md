# Roadmap

Qué está construido y qué falta. Para el detalle de **cómo usar** cada
cosa ya construida, ver [`FUNCIONALIDADES.md`](./FUNCIONALIDADES.md).

## ✅ Ya construido

### Base
- [x] Auth (registro, login, recuperar contraseña), roles (estudiante,
  profesor, coordinador, admin) y ruteo protegido por rol
- [x] Layout mobile-first (bottom-nav + sidebar), PWA instalable
- [x] Cursos: crear, unirse por código, inscritos, catálogo académico
  (Facultad → Carrera → Asignatura, precargado)

### Tareas y ejercicios
- [x] 4 tipos de ejercicio: código, opción múltiple, numérica, abierta
  (con rúbrica calificada por IA)
- [x] Editor Monaco con ejecución real de PSeInt (intérprete propio),
  Python y Java (motores externos), consola interactiva en los tres
- [x] Modo examen: un intento, límite de tiempo, registro anti-trampa
- [x] Corte de plazos validado también en el servidor (no solo en el
  cliente)

### Calificación
- [x] IA califica automático (código y abierta), con rúbrica opcional
- [x] Prompt ajustado para priorizar si el código funciona sobre errores
  menores de estilo
- [x] Nota manual del tutor (corrige o pone la nota, deja comentario),
  protegida para que ni la IA ni el estudiante la puedan pisar

### En vivo
- [x] Tablero de clase en vivo (dibujo + código compartido), se apaga
  solo si el tutor sale sin apagarlo
- [x] Quiz en vivo con QR, dos modos (sincronizado y a su ritmo)

### Comunicación
- [x] Notificaciones dentro de la app (tarea nueva, calificado, clase en
  vivo, recordatorio de vencimiento, cambios de grupo)
- [x] Web Push (avisos con el celular cerrado), vía sondeo externo por
  GitHub Actions cada 5 min (pg_net no puede llamarse a sí mismo en este
  proyecto — ver `ARCHITECTURE.md`)
- [x] Recordatorio automático de tareas por vencer sin entregar

### Documentos institucionales
- [x] Informe periódico (BS-F-17) y Acta de reunión (AD-F-01), generados
  en Word con el formato oficial, vista previa antes de descargar
- [x] Plantillas reemplazables desde Coordinación sin tocar código
- [x] Horario de tutorías (por votación o a mano, varios días), exportable
  a Excel con la tabla de los 7 días

### Coordinación
- [x] Panel completo: resumen, grupos, estudiantes, tutores, cuentas sin
  confirmar, plantillas — con exportación a Excel

### Materiales educativos
- [x] El tutor sube PDF/Word/PowerPoint o enlaces por curso

### Calidad y operación
- [x] ~86 pruebas automáticas (Vitest)
- [x] CI en cada push/PR (lint + pruebas + build)
- [x] Respaldo diario cifrado de la base de datos
- [x] Monitoreo de errores opcional (Sentry, sin costo si no se configura)
- [x] Registro/aviso de errores mejorado en vez de mensajes técnicos crudos

## 🔜 Pendiente, en orden de prioridad

1. **Módulo de estudio personalizado** (el más grande): el estudiante sube
   sus propios apuntes y la plataforma le arma un examen de práctica +
   informe de en qué está flojo. Se decidió como módulo aparte, sin tocar
   tareas/ejercicios existentes. Ver el detalle de por qué es grande en
   [`FUNCIONALIDADES.md`](./FUNCIONALIDADES.md#10-lo-que-sigue-pendiente-no-construido-todavía).
2. **Auditoría de RLS**: nunca se probó sistemáticamente que un estudiante
   no pueda leer datos de un curso ajeno.
3. **Ensayo real de restauración** del respaldo en un proyecto de prueba
   (el respaldo corre, pero restaurarlo nunca se ensayó de punta a punta).
4. **Modo oscuro** en el resto de la app (el editor de código ya lo tiene).
5. **Unificar `exceljs` y `xlsx`** en una sola librería para aligerar la
   descarga.
6. **Quiz en vivo**: cronómetro por pregunta, contador de "cuántos ya
   respondieron" en modo sincronizado — se dejaron fuera a propósito del
   primer lanzamiento.
7. **Detección de copias** entre entregas de distintos estudiantes (hoy
   solo se detecta pegado, no se comparan entregas entre sí).
