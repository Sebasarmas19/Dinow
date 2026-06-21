# Sistema de Deberes de la Casa — La Idea

> Documento de concepto. Explica qué es, para qué sirve y cómo funciona todo el sistema. El detalle de las reglas exactas vive en el documento aparte **"El Reglamento"**.

---
Este es un **motor genérico de gestión de deberes domésticos** que resuelve 
un problema común: en cualquier hogar con varias personas, hay tareas que 
se rotan, tareas opcionales, y nadie recuerda quién hizo qué. La app da 
respuesta: recordatorio automático, registro permanente, rotación justa, 
puntos y rankings que motivan a ayudar.

**Completamente configurable:** el admin define sus propios deberes (rotativos, 
reclamables, opcionales), sus propios participantes, sus propios valores de 
puntos. No está cableada para un caso específico.

> **Nota sobre el Administrador:** "El Admin" no es una persona específica ni un perfil exclusivo. Es una cuenta o panel compartido al que **cualquiera de los integrantes del hogar puede entrar** si conoce la contraseña maestra. Todas las acciones realizadas desde este panel quedan registradas públicamente en la bitácora de auditoría para garantizar transparencia.

**Ejemplo concreto (caso de uso):** Samuel (24) y sus dos hermanos comparten 
casa en Caracas. Tienen 3 deberes principales que rotan (Sofi el perro, 
cocinar, lavar platos), extras de la semana, y extras personales 
(cuarto, clóset). Esta app es lo que usan para organizarse sin peleas.

## 1. Para qué existe

Somos tres hermanos compartiendo una casa, y cada día hay tres deberes que sí o sí hay que cumplir: **atender a Sofi, cocinar y lavar los platos**. Hoy nos los rotamos de palabra, pero se nos olvida quién hizo qué, no queda registro de nada, y cuando alguien ayuda o falta no hay forma justa de reflejarlo.

Esta página web resuelve eso. Hace cuatro cosas:

1. **Nos recuerda** el deber que nos toca cada día.
2. **Deja registro permanente** de todo lo que hacemos, para siempre saber qué hizo cada quien.
3. **Mete un sistema de puntos** que premia cumplir y, sobre todo, ayudar al otro.
4. **Nos motiva** con competencia sana, logros mensuales y fotos que nos animan a hacer el deber.

---

## 3. La dinámica (Plan Semanal)

El administrador configura un **Plan Semanal** (plantilla) donde asigna qué deber obligatorio le toca a cada hermano cada día, buscando la mayor justicia posible y adaptándose a las rutinas reales de la casa (por ejemplo, si alguien trabaja de noche, no se le asigna cocinar).

Este plan es fijo y predecible. Cada semana, el sistema simplemente repite esta misma plantilla, garantizando la paz mental. Si las rutinas cambian, el administrador puede editar la plantilla.

| Día | Hermano A | Hermano B | Hermano C |
|-----|-----------|-----------|-----------|
| 1 | Sofi 🐾 | Cocinar 🍳 | Platos 🍽️ |
| 2 | Platos 🍽️ | Sofi 🐾 | Cocinar 🍳 |
| 3 | Cocinar 🍳 | Platos 🍽️ | Sofi 🐾 |
| 4 | (vuelve a empezar) | | |

Cada **domingo** confirmamos el plan de la semana, ajustado para que sea justo según el horario de cada uno (el que se levanta más temprano ese día cocina para todos, etc.). Durante la semana cada quien marca sus deberes cumplidos, y todo suma o resta puntos. A fin de **mes** se premia a los ganadores con logros que quedan para siempre en su perfil.

---

## 3. Los deberes

### deberes obligatorios (todos los días, rotativos)
Estos **tienen que cumplirse sea como sea**: Sofi, cocinar y platos. Valen **10 puntos** cada uno. Se marcan con un simple check (confianza, sin foto).

### extras de la semana
Nadie los tiene asignados: el que quiera los hace y se gana los puntos. Requieren foto de prueba. El admin define, por cada extra, **en qué días aparece** (toda la semana, fin de semana o días específicos) y **cuántas veces se puede reclamar en total** durante el período (semanal o mensual). El cupo es del hogar: varios pueden reclamar el mismo extra en días distintos hasta agotarlo.
- **Lavar ropa** (3 tandas) → 15 puntos (hasta 3 reclamos por semana)
- **Limpieza profunda** → 20 puntos
- **Bañar a Sofi** → 20 puntos (disponible cualquier día, máximo 1 reclamo al mes)

### extras personales (día por medio, toda la semana)
Cada quien cuida lo suyo. Requieren foto de prueba.
- **Cuarto ordenado** → 2.5 puntos
- **Clóset ordenado** → 2.5 puntos

> **Sobre los criterios de cada deber:** cada deber puede listar los criterios que definen qué significa "cumplido" (ej. para Sofi: bajarla, darle comida y agua). Esa lista se muestra **solo como referencia**: no se tilda criterio por criterio. Se marca el deber completo con un único botón **"Marcar como cumplido"**, lo que afirma que se cumplieron todos.

---

## 4. El sistema de puntos

El puntaje es el hilo que une todo. La idea central: **ayudar al otro paga más que cumplir lo tuyo**, pero solo si ya hiciste lo tuyo primero.

| Evento | Puntos |
|--------|--------|
| Cumplir tu deber obligatorio | +10 |
| Cubrir el deber de otro (con el tuyo hecho y el ayudado confirma) | +15 |
| Cubrir sin haber hecho el tuyo | 0 (no cuenta) |
| Fallar tu deber sin razón válida | −15 |
| Un obligatorio que no hizo nadie | −10 a los tres |
| Ausencia con razón válida | 0, no aplica |
| Lavar ropa (3 tandas) | +15 |
| Limpieza profunda | +20 |
| Bañar a Sofi (mensual) | +20 |
| Cuarto ordenado | +2.5 |
| Clóset ordenado | +2.5 |

Una falla sin excusa mueve **30 puntos** entre dos personas: el que falla pierde 15 y el que lo cubre gana 15. Así pesa de verdad.

---

## 5. Los cuatro rankings (mensuales)

Cada uno mide algo distinto, para que haya más de una forma de destacar:

1. **El General** — el que más puntos junta en total.
2. **El Confiable** (porcentaje) — deberes cumplidos ÷ deberes que te tocaban los días que estuviste en casa. Inmune a las ausencias: mide qué tan confiable eres cuando sí te toca.
3. **El Solidario** — el que más puntos gana ayudando a los demás.
4. **El Responsable de la Casa** — el que más puntos suma en deberes adicionales.

---

## 6. Los logros

Hay dos tipos:

- **Títulos del mes:** los ganadores de los cuatro rankings. Competitivos, uno por categoría, se reinician cada mes.
- **Medallas coleccionables:** se desbloquean al cumplir una condición y se quedan **para siempre** en tu perfil, con la fecha y el tema del logro. Varios hermanos pueden tener la misma. Tienen niveles (bronce, plata, oro). Ejemplos:
  - *Constancia:* "Imparable" (7/15/30 días seguidos sin fallar), "Mes perfecto".
  - *Solidaridad:* "Buen hermano", "Salvador" (rescataste un obligatorio que iba a quedar sin hacer).
  - *Orden y extras:* "Manos a la obra", "Finde productivo".
  - *Sofi:* "El consentido de Sofi".

**Todos los logros son positivos.** Lo malo se refleja en los puntos, nunca en medallas de la vergüenza.

A fin de mes hay una pequeña "ceremonia" en la app: se muestran los títulos y las medallas nuevas, y todo queda archivado en el perfil de cada uno.

---

## 7. La motivación: fotos y recordatorios

Cuando la app te recuerda un deber, te muestra una **foto que motiva**: una foto de Sofi para animarte a atenderla, o una foto de mamá sonriendo en otros recordatorios. Son emocionales, para empujarte a cumplir — no son prueba de nada.

Si agregamos la página a la pantalla de inicio del teléfono, puede mandar **notificaciones** (con permiso). Pase lo que pase, al abrirla siempre se ve claro el deber obligatorio del día.

---

## 8. El administrador

Hay un modo admin al que se entra con una contraseña maestra. **El perfil administrador no es una persona específica ni un participante del hogar.** Cualquier participante que conozca la contraseña maestra de la casa puede entrar a este modo. El admin puede:

- Crear y editar el plan de la semana desde la página (no a nivel de código, para que siempre se pueda ajustar).
- Editar, añadir o eliminar deberes adicionales, y configurar la **disponibilidad** (días en que aparecen) y los **cupos** de los extras (cuántas veces se reclaman en total y si el período es semanal o mensual).
- Editar deberes cumplidos: anular puntaje, añadir puntos por un deber olvidado, asignar o quitar deberes hechos.
- Ver y editar el puntaje de todos.
- Decidir puntaje parcial (ej. ropa con menos de 3 tandas).
- Gestionar quién está en la rotación, registrar ausencias y ajustar los valores de puntaje.

**Transparencia:** toda acción del admin queda en un registro visible para los tres (quién, qué, cuándo y por qué), para que nadie pueda decir "hiciste trampa".

---

## 10. El ritual del domingo

Cada domingo se confirma el plan de la semana: se ajusta a los horarios de cada quien para que sea lo más justo posible, se declaran las ausencias conocidas y se revisa la configuración de los extras de la semana. Si pasa algo imprevisto en la semana, el admin edita la excepción.

---

## 11. Lo que sigue

Con esto la idea queda completamente planteada. El siguiente paso es la conversación de **cómo lo construimos a nivel de sistema** (la parte técnica): dónde se guarda el registro compartido, cómo se ven las pantallas, cómo se manejan las notificaciones, etc.
