# AnimeAv1 ↔ MyAnimeList

Extensión de navegador que sincroniza automáticamente tu progreso de **animeav1.com** con tu lista de **MyAnimeList (MAL)**. Marcás un capítulo como visto en animeav1 y la extensión actualiza MAL por vos.

> **Versión actual:** v1.2.0
> Proyecto no oficial. No está afiliado ni respaldado por MyAnimeList ni por AnimeAV1.

---

## Características

- **Sincronización automática**: al marcar o desmarcar un capítulo como visto en animeav1, se actualiza tu lista de MAL.
- **Vinculación automática**: si el título del anime coincide exactamente con uno de MAL, se vincula solo.
- **Vinculación manual**: si no hay coincidencia, buscás por nombre o ingresás el ID de MAL directamente.
- **Tarjeta integrada en la página**: ves el póster, el estado, los episodios vistos y tu puntuación sin salir de animeav1.
- **Puntuación**: poné o cambiá tu nota del anime desde las opciones de la tarjeta.
- **Cambiar o quitar el vínculo**: cuando te equivocás de anime.
- **Privacidad**: todo se guarda localmente en tu navegador (ver [Privacidad](#privacidad)).

- Normalmente **no modifica** MAL.
- Excepción: si el anime estaba *Completed* y desmarcás el **último** episodio, vuelve a *Watching* y el contador retrocede un episodio.

## Instalación
 
> La extensión todavía no está publicada en ninguna tienda. Se instala desde los archivos de la última [release](https://github.com/sarudev/animeav1-mal-connector/releases), disponible para **Chrome** (y navegadores basados en Chromium, como Edge o Brave) y para **Firefox**.
 
### Chrome / Edge / Brave
 
1. Descargá el archivo de Chrome desde la últime [release](https://github.com/sarudev/animeav1-mal-connector/releases) y descomprimilo en una carpeta que no vayas a borrar.
2. Abrí `chrome://extensions` (o `edge://extensions`).
3. Activá el **Modo de desarrollador**.
4. Tocá **Cargar descomprimida** y elegí la carpeta donde descomprimiste la extensión (la que contiene el `manifest.json`).
### Firefox
 
1. Descargá el archivo de Firefox desde la últime [release](https://github.com/sarudev/animeav1-mal-connector/releases).
2. Abrí `about:debugging#/runtime/this-firefox`.
3. Tocá **Cargar complemento temporal…** y elegí el archivo descargado (o su `manifest.json` si lo descomprimiste).
> Los complementos temporales de Firefox se quitan al cerrar el navegador y hay que volver a cargarlos en cada sesión.
 
### Compilar desde el código fuente
 
Si preferís compilarla vos:
 
```bash
git clone https://github.com/sarudev/animeav1-mal-connector.git
cd animeav1-mal-connector
npm install
npm run build
```
 
Requiere [Node.js](https://nodejs.org/) (versión LTS). Después cargá la carpeta generada como se explica arriba.

## Configuración inicial

La extensión necesita acceso a tu cuenta de MyAnimeList. Para eso vas a crear **tu propia app en MAL** (es gratis y toma un par de minutos) y conectarla con la extensión. Así tus credenciales nunca pasan por terceros.

### 1. Crear tu app en MAL

1. Abrí un capítulo en [animeav1.com](https://animeav1.com). En la tarjeta de la extensión aparece la **URL de redirección**; dejá esa pestaña abierta, la vas a necesitar.
2. En otra pestaña, entrá a [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) con tu cuenta y tocá **Create ID**.
3. Completá el formulario:

   | Campo | Qué poner |
   |---|---|
   | **App Name** | El nombre que quieras (por ejemplo `animeav1-connector`). |
   | **App Type** | **other** |
   | **App Description** | Una descripción de mínimo 50 caracteres (por ejemplo `Sincroniza mi progreso de animeav1 con mi cuenta de MAL`). |
   | **App Redirect URL** | La **URL de redirección** que muestra la extensión. Usá el botón de copiar y pegala **tal cual**, con la barra final. |
   | **Homepage URL** | Cualquier URL válida, por ejemplo https://animeav1.com |
   | **Commercial / Non-commercial** | **Non-commercial** |
   | **Name / Company Name** | Tu nombre o un alias. |
   | **Purpose of Use** | **Hobbyist** |

4. Aceptá los términos de uso de la API de MAL y tocá **Submit**.
5. Si todo sale bien te va aparecer una pantalla de exito y abajo un link `Return to list`, dale click y te va a devolver a la lista
6. Abajo aparecen listados todos tus clientes, incluido el que acabaste de crear, dale al botón `Edit` que está a la derecha.
7. Copiá el **Client ID**. Tiene 32 caracteres aproximadamente y son solo números y letras minúsculas. Está encima del mensaje rojo `Client ID and Client Secret must not be disclosed.`

### 2. Conectar la extensión

1. Volvé a la tarjeta de la extensión en animeav1 y pegá el **Client ID** en el campo `Client ID`.
2. Tocá **Obtener credenciales**. Se abre una ventana de MAL pidiendo acceso a tu cuenta.
3. Iniciá sesión en MAL si te lo pide y tocá **Allow**.
4. La ventana se cierra sola y la tarjeta muestra tu anime vinculado. Listo.

Para cambiar de cuenta o volver a conectar: **Opciones → Credenciales de MAL**.

### Problemas frecuentes

- **Se abre un cuadro pidiendo usuario y contraseña, o aparece un error de MAL**: la URL de redirección de tu app no coincide con la de la extensión. Entrá a [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig), editá tu app y pegá de nuevo la URL que muestra la tarjeta, sin cambiar nada.
- **Dejó de funcionar tras reinstalar la extensión o moverla de carpeta**: la URL de redirección depende de cómo se instaló la extensión y puede haber cambiado. Copiá la nueva desde la tarjeta y actualizala en tu app de MAL.
- **Usás más de un navegador**: cada uno muestra una URL de redirección distinta. Registrá la de cada navegador en tu app de MAL o creá una app por navegador.
- **Cerraste la ventana de MAL sin aceptar**: no pasa nada, tocá **Obtener credenciales** otra vez.

## Uso

1. Abrí un capítulo de cualquier anime en animeav1.
2. La tarjeta intenta vincularlo con MAL automáticamente. Si no encuentra una coincidencia exacta, te muestra el formulario de vinculación.
3. Marcá el capítulo como visto con el botón de animeav1: tu lista de MAL se actualiza y aparece una notificación.

La extensión actúa tanto en la ficha de un anime como en las páginas de **episodios**.

## Sincronización de listas y modal de diferencias

Además de marcar capítulos, la extensión mantiene alineada tu lista de **MAL** con la de **AnimeAV1** (estado, episodios vistos, fecha de inicio y fecha de fin).

- **Del sitio hacia MAL**: al guardar el formulario "Agregar a lista" de AnimeAV1 o cambiar el estado con el desplegable, se actualiza MAL. Si MAL no responde, verás un aviso y la diferencia se detecta la próxima vez que recargues la página.
- **Estado y fechas al marcar capítulos**: al marcar o desmarcar un capítulo, MAL puede pasar a "Viendo" o "Completado" y registra las fechas de inicio y fin. La extensión copia ese estado y esas fechas a AnimeAV1 (las fechas solo si ahí están vacías).
- **Cualquier cambio hecho en el sitio**: la extensión detecta las requests de lista de AnimeAV1 (desplegable de estado, "marcar hasta el episodio anterior"…) y copia el resultado a MAL si difiere. Si el sitio deja un anime como "Completado" con episodios sin ver (por ejemplo, al marcar hasta el episodio anterior), pasa a "Viendo" en ambos sitios.
- **Anime completado**: si el estado final es "Completado" y se conoce el total de episodios, los episodios vistos se fijan en ese total, tanto al guardar el formulario como en el modal de diferencias (AnimeAV1 ignora el número en ese caso).
- **Puntuación**: la nota que pones con el slider de la extensión (1 a 10) se refleja también en AnimeAV1, redondeada a su escala de 1 a 5. Si cambias la nota desde el formulario del sitio, solo se envía a MAL cuando no es equivalente a la que ya tienes, para no perder precisión, y una nota vacía nunca borra la de MAL.
- **Eliminar de la lista**: "Eliminar de lista" en el desplegable de AnimeAV1 **no elimina nada en MAL**; solo se muestra un aviso. Para eliminar de ambos sitios usa el botón discreto **Eliminar** (en rojo) de las opciones de la tarjeta, que solo aparece si el anime está en alguna de las dos listas. Se pide confirmación y no se puede deshacer.
- **Recarga**: cuando la extensión escribe datos en AnimeAV1 (modal de diferencias, eliminación, o desmarcar un capítulo que cambia su estado), la página se recarga sola para que su interfaz lea los datos nuevos, y el aviso se muestra después. Marcar un capítulo como visto y los cambios de puntuación no recargan.
- **Fechas**: AnimeAV1 no admite fechas vacías, así que una fecha vacía nunca la borra; y si MAL tiene `2017-03`, un `2017-03-01` del formulario no la modifica (si el día es otro, sí).

### Modal "Tu lista no coincide"

Cuando el anime ya está vinculado y los datos de MAL y de AnimeAV1 son distintos, aparece un modal con las dos listas lado a lado. Los valores que difieren se resaltan. No se puede cerrar hasta elegir qué datos conservar:

- **Elegir una lista completa**: tocá el título (**MAL** o **AnimeAV1**). Esa lista se toma como fuente de verdad y **reemplaza por completo** a la otra, incluidas las fechas vacías.
- **Elegir campo por campo**: tocá un dato concreto (estado, episodios, inicio o fin) de cualquiera de los dos lados. Al elegir uno, su equivalente del otro lado se deselecciona; volvé a tocarlo para quitar la elección. Podés partir de una lista completa y cambiar solo algunos campos.
- **Continuar**: se habilita cuando todos los datos que difieren tienen una elección. Los datos elegidos se aplican en ambos lados.
- Si el anime solo está en una de las listas, puedes elegir la que tiene datos (se crea la otra) o **elegir la lista vacía**: aparece una advertencia en rojo y el botón pasa a "Eliminar y continuar", que **elimina el anime del otro sitio** sin posibilidad de deshacer.
- Las fechas incompletas de MAL (solo año, o año y mes) se consideran iguales a la fecha completa de AnimeAV1 que empiece igual, así que no generan el modal por sí solas. Al escribirlas en AnimeAV1 se completan con `01` (por ejemplo, `2024` pasa a `2024-01-01`).
- **Puntuación**: AnimeAV1 usa 5 niveles y MAL 10, así que se comparan en la escala de AnimeAV1 (la nota de MAL se redondea hacia arriba: 7 u 8 equivalen a 4/5) y "sin nota" en un lado equivale a "sin nota" en el otro. Notas equivalentes no se consideran una diferencia y MAL conserva su valor preciso.
- Las notas del formulario del sitio no forman parte de esta comparación.
- **Teclado**: el modal se puede usar sin mouse. Las flechas te mueven entre datos, `Enter` o `Espacio` eligen, `1` elige toda la lista de MAL, `2` toda la de AnimeAV1 y `Ctrl+Enter` continúa. `Tab` no sale del modal.

### Preferencia de resolución de diferencias

Si no quieres que te pregunte cada vez, puedes elegir cómo resolver las diferencias desde el botón **Preferencias** del modal o desde **Sincronización** en las opciones de la tarjeta:

- **Preguntar siempre** (predeterminado): se muestra el modal.
- **Usar siempre MAL** / **Usar siempre AnimeAV1**: la lista elegida reemplaza a la otra sin mostrar el modal. Verás un aviso con el resultado.
- **Usar MAL durante…** / **Usar AnimeAV1 durante…**: igual que lo anterior, pero solo durante la cantidad de días que indiques (1 a 365), contados desde que guardas la preferencia. Al vencer, vuelve a preguntar. Las opciones muestran cuántos días quedan.

Por defecto la preferencia es global (vale para todos los animes). Al guardarla puedes marcar **Solo para este anime**: ese anime pasa a tener su propia preferencia, que manda sobre la global mientras esté vigente. Para volver a la global, elige **Usar la preferencia global** y guarda.

Por seguridad:

- Una resolución automática **nunca elimina** un anime: si el lado elegido no tiene el anime en su lista, se muestra el modal igualmente.
- Un vínculo recién creado (o cambiado) siempre muestra el modal la primera vez. Se considera confirmado cuando ambas listas tienen el anime y no difieren (se toleran las diferencias de precisión en fechas y puntuación), cuando resuelves el modal, o cuando haces un cambio desde AnimeAV1 que se refleja en MAL (marcar un capítulo, cambiar el formulario, el estado o la puntuación).
- Si la resolución automática falla, también se muestra el modal.

## Privacidad

- Tus credenciales y los vínculos entre animeav1 y MAL se guardan **solo en tu navegador** (`storage.local`) y no salen de tu dispositivo.
- La extensión no usa servidores propios ni recolecta datos de uso.
- Las únicas conexiones de red son hacia `myanimelist.net` y `api.myanimelist.net`, y la lectura y escritura de tu lista en `animeav1.com`, donde se ejecuta.

## Limitaciones conocidas

- Solo funciona en `animeav1.com`.
- La detección depende de la estructura actual de la página; si el sitio cambia su diseño, puede dejar de detectar el nombre o el botón de "visto".
- La vinculación automática exige coincidencia **exacta** del título (sin distinguir mayúsculas).
- Configurar las credenciales requiere pasos manuales (ver arriba).

## Hoja de ruta

- **v1.3.0** Sin planes

## Licencia

MIT

## Aviso legal

MyAnimeList es una marca de sus respectivos dueños. Este proyecto es independiente y no tiene relación con MyAnimeList ni con AnimeAV1.
