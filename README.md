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
- Render vuelve a validar y reconstruir esa proyección. No entrega correos, teléfonos, edad, año de nacimiento ni estados laborales al TV.
- En producción se requiere `SCREEN_CODE` de al menos 8 caracteres. Las rutas de datos están protegidas mediante cookie HttpOnly, Secure y SameSite=Strict. La sesión dura 30 días y sobrevive reinicios mientras no cambie el código.
- No se incluyen analíticas, fuentes remotas ni recursos de terceros en la pantalla.
- El código de pantalla y la URL/secreto del puente nunca se envían al JavaScript público. Quien tenga el código de pantalla puede ver nombres y cumpleaños: compártelo solo con el equipo.

## Conectar Google Apps Script

1. Con la cuenta que tiene acceso a la hoja, abre https://script.google.com y crea un proyecto llamado `Package Squad TV`.
2. Copia `apps-script/Code.gs` al editor. Activa la visualización de `appsscript.json` en la configuración y reemplázalo por el archivo incluido. El alcance solicitado es lectura de hojas de cálculo.
3. En **Configuración del proyecto → Propiedades del script**, agrega:
   - `SPREADSHEET_ID`: ID del documento de cumpleaños.
   - `BRIDGE_TOKEN`: un secreto aleatorio de al menos 32 caracteres. Debe ser el mismo valor de `APPS_SCRIPT_TOKEN` en Render.
4. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como la cuenta propietaria; permitir solicitudes sin sesión de Google para que el servidor pueda llamar al puente. La hoja sigue privada: el código exige el secreto antes de leer o devolver datos. Si la política de Workspace impide este tipo de implementación, se necesita una integración autenticada aprobada por el administrador.
5. Autoriza los permisos de Google y copia la URL terminada en `/exec`.
6. Configura `APPS_SCRIPT_URL` y `APPS_SCRIPT_TOKEN` en Render. Guarda y despliega el cambio de entorno. El servidor hará una primera sincronización al arrancar.

No uses la URL `/dev`. Un GET al puente no devuelve cumpleaños. No pongas el secreto en parámetros de URL, código del cliente o Git. Para actualizar el código del puente, publica una nueva versión de su implementación existente.

## Render

El `render.yaml` define un servicio Node siempre encendido en Virginia y un disco privado de 1 GB para conservar el último snapshot válido. Se generan automáticamente el código de pantalla y el secreto del puente; puedes consultarlos en **Environment** del servicio. La URL de Apps Script queda pendiente hasta autorizar e implementar el proyecto de Google.

La primera publicación puede recibir `INITIAL_BIRTHDAYS_JSON` como variable privada de Render con la proyección validada de noviembre. No se incluye en Git ni en activos públicos. Esa copia aparece etiquetada como **saved snapshot / copia guardada** hasta que se conecte el puente. Con disco persistente se usa solo si aún no existe un snapshot.

El plan de infraestructura se debe revisar antes de aplicarlo. La instancia siempre encendida y el disco generan cargos; consultar los precios vigentes en https://render.com/pricing.

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
