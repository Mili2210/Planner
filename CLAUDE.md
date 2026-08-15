# Planner de equipo

Herramienta construida en el Laboratorio Code, con el agente `tidu-co-constructor`.

## Qué es

Cada persona entra escribiendo su nombre, gestiona su propia lista de pendientes, y hay un tablero que muestra el avance de todo el equipo.

## Tecnología

- **Next.js** (App Router) con React, para la pantalla.
- **Tailwind** para los estilos.
- **Supabase** (plan gratuito) como base de datos. Tablas: `members` y `todos`.
- **Vercel** (plan gratuito) para publicarla.

## Decisiones tomadas

- **Sin login real.** Cada persona entra solo escribiendo su nombre, sin contraseña. Fue una decisión explícita para mantener el costo en $0 y no complicar el primer proyecto.
- **Reglas de acceso (RLS) abiertas, pero acotadas.** Como no hay login, cualquiera con el link puede leer y escribir en las tablas `members` y `todos`, y solo en esas dos tablas. Si el equipo crece o empieza a guardar información sensible, agregar un login real es el siguiente paso natural.
- **Sin ambiente de prueba ni pruebas automáticas todavía.** Se puede agregar más adelante si se pide explícitamente.

## Variables de entorno

Se necesitan estas dos, tanto en local (`.env.local`, no se sube a GitHub) como en Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Cómo correrla en local

```
npm install
npm run dev
```
