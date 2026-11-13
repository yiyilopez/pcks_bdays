# Birthday Board

Pantalla sobria de cumpleaños del mes para proyectar en la estación. Lee el Google Sheet
"Birthday" (compartido con enlace público), muestra a cada persona durante 10 segundos con su
foto, luego la lista completa y un mensaje para los conductores. Textos en inglés y español.
Sin dependencias: solo Node.

La pantalla también incluye a Kenneth Nachbar (4 de noviembre), confirmado en
el reporte de cumpleaños, con la foto proporcionada. Esta incorporación se conserva
al actualizar la hoja y no se duplica si se añade allí con el mismo nombre y fecha.

## Cómo subirla (repo `yiyilopez/pcks_bdays` + Railway)

1. En GitHub abre el repo → "Add file" → "Upload files", arrastra **el contenido** de esta carpeta
   y pulsa "Commit changes". Estos archivos reemplazan `Dockerfile`, `railway.json`, `package.json`,
   `README.md` y `public/index.html` de la versión anterior.
2. Si Railway ya está conectado al repo, despliega solo. Si no: railway.com → "New Project" →
   "Deploy from GitHub repo" → `pcks_bdays`, y luego Settings → Networking → "Generate Domain".
3. Abre ese enlace en el computador del proyector, en pantalla completa.

Archivos de la versión anterior que ya no se usan y se pueden borrar: `server.mjs`, `lib/birthdays.mjs`,
`public/app.js`, `public/styles.css`, `apps-script/`, `test/`, `render.yaml`, `package-lock.json`, `.env.example`.
Las variables `SCREEN_CODE`, `APPS_SCRIPT_URL`, `APPS_SCRIPT_TOKEN`, `DATA_FILE` de Railway tampoco se usan.

## Cómo se actualiza

- El Sheet debe seguir compartido como "Cualquier persona con el enlace - Lector".
- Cada 10 minutos la página vuelve a leer el Sheet. No hay que volver a desplegar.
- Para el mes siguiente, agrega una pestaña con el nombre del mes (`December` o `Diciembre`)
  con el mismo formato: nombre en una celda, día en la celda de la derecha y la foto
  debajo del nombre. La pantalla cambia sola de pestaña cuando cambia el mes.

## Ajustes opcionales (Railway → Variables)

| Variable | Valor por defecto | Para qué sirve |
| --- | --- | --- |
| `ROTATE_SECONDS` | `10` | Segundos por persona |
| `REFRESH_MINUTES` | `10` | Cada cuánto se vuelve a leer el Sheet |
| `TIME_ZONE` | `America/New_York` | Zona horaria para "hoy" y el mes actual |
| `TEAM_NAME` | `Package Squad` | Texto de la esquina superior derecha |
| `SHEET_ID` | el Sheet "Birthday" | ID de otro Sheet, si algún día se cambia |

## Probarla en tu computador

Con Node 18 o superior: `npm start` y abre http://localhost:3000
