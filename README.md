# AnimeAv1 ↔ MyAnimeList

Extensión de navegador que sincroniza automáticamente tu progreso de **animeav1.com** con tu lista de **MyAnimeList (MAL)**. Marcás un capítulo como visto en animeav1 y la extensión actualiza MAL por vos.

> **Versión actual:** v1.1.0
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

La extensión solo actúa dentro de páginas de **episodios**, no en la ficha general del anime.

## Privacidad

- Tus credenciales y los vínculos entre animeav1 y MAL se guardan **solo en tu navegador** (`storage.local`) y no salen de tu dispositivo.
- La extensión no usa servidores propios ni recolecta datos de uso.
- Las únicas conexiones de red son hacia `myanimelist.net` y `api.myanimelist.net`, y la lectura de la página `animeav1.com` donde se ejecuta.

## Limitaciones conocidas

- Solo funciona en `animeav1.com`.
- La detección depende de la estructura actual de la página; si el sitio cambia su diseño, puede dejar de detectar el nombre o el botón de "visto".
- La vinculación automática exige coincidencia **exacta** del título (sin distinguir mayúsculas).
- Configurar las credenciales requiere pasos manuales (ver arriba).

## Hoja de ruta

- **v1.2.0**: 
  - También disponible en página principal de un anime, no solo en un episodio.
  - Soporte al modal de editar anime (que también aparece al marcar como no visto un capitulo anterior al último visto).

## Licencia

MIT

## Aviso legal

MyAnimeList es una marca de sus respectivos dueños. Este proyecto es independiente y no tiene relación con MyAnimeList ni con AnimeAV1.
