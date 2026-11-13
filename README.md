# Package Squad TV

Una pantalla de reconocimiento para conductores, con cumpleaños de **noviembre**, mensajes rotativos y modo TV. Interfaz completa en inglés y español; selector EN/ES con preferencia guardada en el navegador.

## Ejecutar

Requiere Node.js 22 o superior. No tiene dependencias externas ni build.

```sh
npm ci
npm start
```

Abre http://localhost:3000. El desarrollo escucha solo en loopback. La copia local verificada de la hoja se guarda en `data/november.json`, excluida de Git; no se publica en el repositorio. Sin datos, se muestra el estado de fuente pendiente.

## Datos y seguridad

- La hoja original permanece privada y no se modifica.
- Solo se procesan bloques `nombre | día | separador` de la pestaña `November`, tal como está estructurada actualmente. No se presume que existan columnas de estado ni la pestaña `Actual Drivers`.
- Google Apps Script valida un secreto en el cuerpo del POST antes de leer la hoja. Devuelve exclusivamente `name`, `day`, `month` por persona, además de fecha de actualización y mes de la fuente.
- Railway vuelve a validar y reconstruir esa proyección. No entrega correos, teléfonos, edad, año de nacimiento ni estados laborales al TV.
- En producción se requiere `SCREEN_CODE` de al menos 8 caracteres. Las rutas de datos están protegidas mediante cookie HttpOnly, Secure y SameSite=Strict. La sesión dura 30 días y sobrevive reinicios mientras no cambie el código.
- No se incluyen analíticas, fuentes remotas ni recursos de terceros en la pantalla.
- El código de pantalla y la URL/secreto del puente nunca se envían al JavaScript público. Quien tenga el código de pantalla puede ver nombres y cumpleaños: compártelo solo con el equipo.

## Conectar Google Apps Script

1. Con la cuenta que tiene acceso a la hoja, abre https://script.google.com y crea un proyecto llamado `Package Squad TV`.
2. Copia `apps-script/Code.gs` al editor. Activa la visualización de `appsscript.json` en la configuración y reemplázalo por el archivo incluido. El alcance solicitado es lectura de hojas de cálculo.
3. En **Configuración del proyecto → Propiedades del script**, agrega:
   - `SPREADSHEET_ID`: ID del documento de cumpleaños.
   - `BRIDGE_TOKEN`: un secreto aleatorio de al menos 32 caracteres. Debe ser el mismo valor de `APPS_SCRIPT_TOKEN` en Railway.
4. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como la cuenta propietaria; permitir solicitudes sin sesión de Google para que el servidor pueda llamar al puente. La hoja sigue privada: el código exige el secreto antes de leer o devolver datos. Si la política de Workspace impide este tipo de implementación, se necesita una integración autenticada aprobada por el administrador.
5. Autoriza los permisos de Google y copia la URL terminada en `/exec`.
6. Configura `APPS_SCRIPT_URL` y `APPS_SCRIPT_TOKEN` en Railway. Guarda y despliega el cambio de entorno. El servidor hará una primera sincronización al arrancar.

No uses la URL `/dev`. Un GET al puente no devuelve cumpleaños. No pongas el secreto en parámetros de URL, código del cliente o Git. Para actualizar el código del puente, publica una nueva versión de su implementación existente.

## Railway

Destino de despliegue: Railway. Conecta el repositorio `yiyilopez/pcks_bdays`, rama `main`, como un servicio nuevo. El Dockerfile usa Node 22 sin dependencias externas; `railway.json` define el arranque, healthcheck y una sola instancia siempre encendida (`sleepApplication: false`). No se cambia el plan de la cuenta.

Configura estas variables privadas en el servicio:

- `SCREEN_CODE`: código fuerte de acceso, al menos 8 caracteres.
- `DATA_FILE`: `/data/november.json` si adjuntas un volumen en `/data`; sin volumen puede ser `/app/data/november.json`.
- `INITIAL_BIRTHDAYS_JSON`: opcional, copia validada de noviembre para la primera publicación. Nunca se guarda en Git ni en la imagen Docker.
- `APPS_SCRIPT_URL`: URL `/exec` al implementar el puente de Google.
- `APPS_SCRIPT_TOKEN`: secreto de al menos 32 caracteres, igual a `BRIDGE_TOKEN` en Apps Script.

Adjunta un volumen en `/data` para conservar el último snapshot válido entre publicaciones y genera un dominio HTTPS para el servicio. El uso de CPU, memoria y volumen se factura según el plan existente de Railway; no es necesariamente gratuito por tener una suscripción.

La copia inicial aparece etiquetada como **saved snapshot / copia guardada** hasta que se conecte el puente. Se usa solo cuando no existe otro snapshot. Conserva los secretos fuera del repositorio.

La configuración anterior de Render se conserva como alternativa, pero no se ha desplegado ningún servicio allí.

## Actualización automática

- Al arrancar: consulta a Google Apps Script si está configurado.
- Todos los días, al alcanzar las **05:00 de America/New_York**, consulta la hoja aunque el televisor esté apagado. Un temporizador comprueba la hora cada 15 segundos, por lo que puede iniciar hasta 15 segundos después; no es un sistema de tiempo real. La zona contempla EST/EDT. Si hay una falla, reintenta sin borrar el último snapshot.
- Mientras hay una pantalla activa: refresca la fuente cada 5 minutos. El TV consulta la copia del servidor cada minuto y al recuperar visibilidad o conexión.
- El reloj y los cumpleaños de hoy usan el día de New Jersey. El mes de la hoja no se interpreta como el mes actual: fuera de noviembre no se muestran esos cumpleaños como si correspondieran a otro mes.
- Hoy: celebra a todas las personas que cumplen, alternando el nombre destacado. Sin cumpleaños hoy: destaca el próximo del mes. Después del último: mantiene el reconocimiento y el resumen de noviembre.
- Los mensajes y las páginas de próximos cumpleaños rotan cada 20 segundos.
- La pantalla conserva los últimos datos válidos ante fallas y muestra el estado de conexión; si no existe copia previa, informa que la fuente está pendiente.

## Usar en un televisor

Abre la URL HTTPS, ingresa el código de pantalla, selecciona EN o ES y pulsa el icono de pantalla completa. El diseño se verifica en 1920×1080 y 1366×768; también se adapta a móvil. El navegador solicita mantener la pantalla encendida cuando lo permite. Desactiva por separado el apagado automático del televisor o dispositivo.

## Verificación

```sh
npm test
```

Se comprueba minimización de datos, rechazo de fechas inválidas, medianoche de New Jersey, horario de verano, exclusión de noviembre fuera de ese mes y autorización/parseo del puente de Apps Script con el diseño real de la hoja. La prueba de integración del servidor comprueba bloqueo sin sesión y después de código incorrecto, cookie segura y rutas privadas inaccesibles como archivos estáticos. Los tests usan datos ficticios.
