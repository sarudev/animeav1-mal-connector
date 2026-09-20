// Content script para https://animeav1.com/media/*
// Detecta el anime/episodio actual y observa el botón de "visto" para
// avisar al background cuando cambia de estado.
(() => {
  const MEDIA_PATH_REGEX = /^\/media\/([^/]+)(?:\/([^/]+))?/;
  // No depender de la jerarqu?a de divs de AnimeAV1: cambia con frecuencia.
  const NAME_SELECTORS = [
    'main article header a[href^="/media/"]',
    'main article header a',
    'main header a[href^="/media/"]',
  ];
  const WATCH_BUTTON_SELECTOR =
    'button:has(span.ic-eye), button:has(span.ic-eye-off)';

  let currentSlug = null;
  let currentEpisode = null;
  let lastSentName = null;
  let lastSentSlug = null;
  let lastKnownWatched = null;
  let observedButton = null;

  function parseLocation() {
    const match = MEDIA_PATH_REGEX.exec(window.location.pathname);
    if (!match) return null;

    const slug = match[1];
    const episodeSegment = match[2];
    // Un cap?tulo usa un segmento num?rico (p. ej. /media/nombre/12). No
    // extraer n?meros de posibles rutas futuras como "temporada-2".
    const episode = /^\d+$/.test(episodeSegment || '')
      ? parseInt(episodeSegment, 10)
      : null;

    return { slug, episode };
  }

  function getAnimeName() {
    for (const selector of NAME_SELECTORS) {
      const el = document.querySelector(selector);
      const name = el?.textContent?.trim();
      if (name) return name;
    }
    return null;
  }

  function getWatchButton() {
    return document.querySelector(WATCH_BUTTON_SELECTOR);
  }

  function getWatchedStateFromButton(button) {
    const span = button.querySelector('span');
    if (!span) return null;
    if (span.classList.contains('ic-eye-off')) return true;
    if (span.classList.contains('ic-eye')) return false;
    return null;
  }

  function sendMessageSafe(message) {
    try {
      chrome.runtime.sendMessage(message);
    } catch {
      // El contexto de la extensión puede invalidarse (recarga/actualización);
      // no hay nada útil que hacer aquí.
    }
  }

  function maybeSendNameUpdate() {
    if (!currentSlug) return;
    const name = getAnimeName();
    // Enviar el slug aunque el encabezado todav?a no haya sido renderizado.
    // As? el popup reconoce el episodio durante la carga de la SPA.
    if (currentSlug !== lastSentSlug || (name && name !== lastSentName)) {
      lastSentSlug = currentSlug;
      lastSentName = name;
      sendMessageSafe({ type: 'PAGE_CONTEXT', slug: currentSlug, name });
    }
  }

  // Registra el estado actual del botón como línea base, sin depender de
  // MutationObserver (SvelteKit suele reemplazar los nodos del ícono en vez
  // de mutar su atributo class, lo que hace que un observer atado a la
  // referencia vieja deje de funcionar tras el primer re-render).
  function syncButtonBaseline() {
    const button = getWatchButton();
    if (!button || button === observedButton) return;
    observedButton = button;
    lastKnownWatched = getWatchedStateFromButton(button);
  }

  // Detecta el toggle reaccionando al clic (delegado y en fase de captura,
  // para no depender de que el listener de Svelte no detenga la
  // propagación). El cambio de clase puede tardar (animeav1 espera la
  // respuesta del servidor antes de actualizar el ícono), así que se hace
  // polling en vez de un único setTimeout fijo.
  const WATCH_POLL_INTERVAL_MS = 150;
  const WATCH_POLL_MAX_ATTEMPTS = 20; // ~3s en total

  function handleDocumentClick(event) {
    const clickedButton = event.target.closest(WATCH_BUTTON_SELECTOR);
    if (!clickedButton) return;

    const slug = currentSlug;
    const episode = currentEpisode;
    const baselineWatched = lastKnownWatched;
    let attempts = 0;

    const poll = () => {
      attempts += 1;
      const freshButton = getWatchButton();
      const watched = freshButton ? getWatchedStateFromButton(freshButton) : null;

      if (watched !== null && watched !== baselineWatched) {
        lastKnownWatched = watched;
        observedButton = freshButton;

        if (slug == null || episode == null) return;

        sendMessageSafe({
          type: 'TOGGLE_WATCHED',
          slug,
          episode,
          watched,
        });
        return;
      }

      if (attempts >= WATCH_POLL_MAX_ATTEMPTS) {
        return;
      }

      setTimeout(poll, WATCH_POLL_INTERVAL_MS);
    };

    setTimeout(poll, WATCH_POLL_INTERVAL_MS);
  }

  document.addEventListener('click', handleDocumentClick, true);

  function handleNavigation() {
    const parsed = parseLocation();

    if (!parsed) {
      currentSlug = null;
      currentEpisode = null;
      lastSentName = null;
      observedButton = null;
      lastSentSlug = null;
      return;
    }

    const slugChanged = parsed.slug !== currentSlug;
    currentSlug = parsed.slug;
    currentEpisode = parsed.episode;

    if (slugChanged) {
      lastSentName = null;
      lastKnownWatched = null;
      lastSentSlug = null;
      observedButton = null;
    }

    maybeSendNameUpdate();
    syncButtonBaseline();
  }

  // AnimeAv1 es una SPA: la URL puede cambiar sin recargar la página.
  let lastHref = window.location.href;
  const rootObserver = new MutationObserver(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      handleNavigation();
    } else {
      maybeSendNameUpdate();
      syncButtonBaseline();
    }
  });

  rootObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  handleNavigation();
})();

