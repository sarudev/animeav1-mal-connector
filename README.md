# AnimeAv1 ↔ MyAnimeList

Extensión de navegador que sincroniza automáticamente tu progreso de **animeav1.com** con tu lista de **MyAnimeList (MAL)**. Marcás un capítulo como visto en animeav1 y la extensión actualiza MAL por vos.

> **Versión actual:** v1.0.0
> Proyecto no oficial. No está afiliado ni respaldado por MyAnimeList ni por AnimeAV1.

---

## Características

- **Sincronización automática**: al marcar o desmarcar un capítulo como visto en animeav1, se actualiza tu lista de MAL.
- **Vinculación automática**: si el título del anime coincide exactamente con uno de MAL, se vincula solo.
- **Vinculación manual**: si no hay coincidencia, buscás por nombre o ingresás el ID de MAL directamente.
- **Tarjeta integrada en la página**: ves el póster, el estado, los episodios vistos y tu puntuación sin salir de animeav1.
- **Puntuación**: poné o cambiá tu nota del anime desde las opciones de la tarjeta.
- **Cambiar o quitar el vínculo** cuando te equivocás de anime.
- **Privacidad**: todo se guarda localmente en tu navegador (ver [Privacidad](#privacidad)).

## Reglas de sincronización

Al **marcar** un capítulo como visto:

| Situación | Qué hace la extensión |
|---|---|
| El anime no está en "Watching" | Lo pasa a *Watching* y fija la fecha de inicio (si no tenía). |
| Siempre | Actualiza el número de episodios vistos al del capítulo marcado. |
| Es el último episodio (y MAL conoce el total) | Lo pasa a *Completed* y fija la fecha de fin. |

Al **desmarcar** un capítulo:

- Normalmente **no modifica** MAL.
- Excepción: si el anime estaba *Completed* y desmarcás el **último** episodio, vuelve a *Watching* y el contador retrocede un episodio.

## Instalación
 
> La extensión todavía no está publicada en ninguna tienda. Se instala desde los archivos de la última [release](github.com/sarudev/animeav1-mal-connector/releases), disponible para **Chrome** (y navegadores basados en Chromium, como Edge o Brave) y para **Firefox**.
 
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
npm run build            # Chrome / Chromium → .output/chrome-mv3
npm run build:firefox    # Firefox → .output/firefox-mv2
```
 
Requiere [Node.js](https://nodejs.org/) (versión LTS). Después cargá la carpeta generada como se explica arriba.

## Configuración inicial

La extensión necesita acceso a tu cuenta de MAL. En esta versión lo hacés manualmente con tu propia app de MAL, así nadie más maneja tus credenciales.
Necesitás un poco de conocimiento para poder obtener tus credenciales, no se detalla acá.

### 1. Crear una app en MAL

1. Entrá a [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) y creá una app nueva.
2. En **App Type** elegí **other**.
3. Completá el resto del formulario. En **App Redirect URL** poné una URL que controles o una de prueba (por ejemplo `http://localhost:3000/callback`); la vas a usar en el paso siguiente.
4. Guardá y anotá el **Client ID**.

### 2. Obtener el refresh token

MAL usa OAuth2 con PKCE. Necesitás hacer el login una vez para obtener tu `refresh_token`:

1. Generá un `code_verifier`: un texto aleatorio de entre 43 y 128 caracteres (letras, números, `-`, `_`). Con el método `plain`, el `code_challenge` es **idéntico** al verifier.
2. Abrí en el navegador, reemplazando los valores:

   ```
   https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=TU_CLIENT_ID&code_challenge=TU_VERIFIER&code_challenge_method=plain
   ```

3. Aceptá el acceso con **Allow**. MAL te redirige a tu Redirect URL con un parámetro `?code=...`. Copiá ese código (es de un solo uso).
4. Canjealo por tus tokens:

   ```bash
   curl -X POST https://myanimelist.net/v1/oauth2/token \
     -d "client_id=TU_CLIENT_ID" \
     -d "code=EL_CODE" \
     -d "code_verifier=TU_VERIFIER" \
     -d "grant_type=authorization_code"
   ```

5. Guardá el `refresh_token` de la respuesta. **Tratalo como una contraseña**: da acceso a tu cuenta de MAL.

> Si MAL rechaza la autorización con `invalid_client`, revisá que el `client_id` sea correcto y que la Redirect URL registrada en tu app coincida con la que usás.

### 3. Conectar la extensión

1. Abrí un capítulo en [animeav1.com](https://animeav1.com).
2. En la tarjeta que aparece, completá `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET` y `MAL_REFRESH_TOKEN`.
3. Tocá **Conectar**. La extensión valida las credenciales y, si funcionan, las guarda.

Para cambiarlas después: **Opciones → Credenciales de MAL**.

## Uso

1. Abrí un capítulo de cualquier anime en animeav1 (`animeav1.com/media/<anime>/<episodio>`).
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

## Desarrollo

Construido con [WXT](https://wxt.dev), React, TypeScript, Tailwind CSS y Zustand.

```bash
npm run dev      # modo desarrollo con recarga automática
npm run build    # build de producción
```

Estructura general:

```
src/
├── entrypoints/
│   ├── background.ts      # service worker: mensajes y lógica de sincronización
│   └── content.tsx        # script inyectado en animeav1 (monta la tarjeta)
├── components/
│   └── anime-card/        # tarjeta: vista vinculada, formulario de vínculo y credenciales
└── utils/
    ├── mal.ts             # cliente de la API de MAL (OAuth2 y endpoints)
    ├── storage.ts         # credenciales y vínculos en storage.local
    └── types.ts           # tipos de mensajes entre content y background
```

## Hoja de ruta

- **v1.1.0**: inicio de sesión simplificado, solo con el `client_id` (sin copiar tokens a mano).
- **v1.2.0**: mejoras generales.

## Licencia

<!-- Completá con la licencia que elijas, por ejemplo MIT. -->

## Aviso legal

MyAnimeList es una marca de sus respectivos dueños. Este proyecto es independiente, no usa su logo y no tiene relación con MyAnimeList ni con AnimeAV1.
