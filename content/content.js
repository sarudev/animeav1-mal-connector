// Content script para https://animeav1.com/media/*
// Detecta el anime/episodio actual y observa el botón de "visto" para
// avisar al background cuando cambia de estado.
;(() => {
  window.__malConnectorContentLoaded = true

  const MEDIA_PATH_REGEX = /^\/media\/([^/]+)(?:\/([^/]+))?/
  // No depender de la jerarqu?a de divs de AnimeAV1: cambia con frecuencia.
  const NAME_SELECTORS = ['main article header a[href^="/media/"]', 'main article header a', 'main header a[href^="/media/"]']
  const WATCH_BUTTON_SELECTOR = 'button:has(span.ic-eye), button:has(span.ic-eye-off)'

  let currentSlug = null
  let currentEpisode = null
  let lastSentName = null
  let lastSentSlug = null
  let lastKnownWatched = null
  let observedButton = null
  let lastAutoLinkKey = null
  let toastTimer = null

  function parseLocation() {
    const match = MEDIA_PATH_REGEX.exec(window.location.pathname)
    if (!match) return null

    const slug = match[1]
    const episodeSegment = match[2]
    // La extension solo actua en un episodio, no en /media/{name}.
    if (!/^\d+$/.test(episodeSegment || '')) return null
    const episode = parseInt(episodeSegment, 10)

    return { slug, episode }
  }

  function getAnimeName() {
    for (const selector of NAME_SELECTORS) {
      const el = document.querySelector(selector)
      const name = el?.textContent?.trim()
      if (name) return name
    }
    return null
  }

  function getWatchButton() {
    return document.querySelector(WATCH_BUTTON_SELECTOR)
  }

  function getWatchedStateFromButton(button) {
    const span = button.querySelector('span')
    if (!span) return null
    if (span.classList.contains('ic-eye-off')) return true
    if (span.classList.contains('ic-eye')) return false
    return null
  }

  function sendMessageSafe(message) {
    try {
      chrome.runtime.sendMessage(message)
    } catch {
      // El contexto de la extensión puede invalidarse (recarga/actualización);
      // no hay nada útil que hacer aquí.
    }
  }

  function showAutoLinkToast(title) {
    let toast = document.getElementById('mal-auto-link-toast')
    if (!toast) {
      toast = document.createElement('div')
      toast.id = 'mal-auto-link-toast'
      toast.setAttribute('role', 'status')
      toast.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;max-width:360px;padding:14px 18px;border-radius:8px;background:#2e7d32;color:#fff;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.28)'
      document.documentElement.appendChild(toast)
    }
    toast.textContent = `Vinculado automaticamente con MAL: ${title}`
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.remove(), 30000)
  }

  function maybeAutoLink(name) {
    const key = `${currentSlug}:${name}`
    if (key === lastAutoLinkKey) return
    lastAutoLinkKey = key
    chrome.runtime
      .sendMessage({ type: 'AUTO_LINK_ANIME', slug: currentSlug, name })
      .then(response => {
        if (response?.ok && response.autoLinked) showAutoLinkToast(response.link.title)
      })
      .catch(() => {})
  }

  function maybeSendNameUpdate() {
    if (!currentSlug) return
    const name = getAnimeName()
    // Enviar el slug aunque el encabezado todav?a no haya sido renderizado.
    // As? el popup reconoce el episodio durante la carga de la SPA.
    if (currentSlug !== lastSentSlug || (name && name !== lastSentName)) {
      lastSentSlug = currentSlug
      lastSentName = name
      sendMessageSafe({ type: 'PAGE_CONTEXT', slug: currentSlug, name })
    }
    if (name) maybeAutoLink(name)
  }

  // Registra el estado actual del botón como línea base, sin depender de
  // MutationObserver (SvelteKit suele reemplazar los nodos del ícono en vez
  // de mutar su atributo class, lo que hace que un observer atado a la
  // referencia vieja deje de funcionar tras el primer re-render).
  function syncButtonBaseline() {
    const button = getWatchButton()
    if (!button || button === observedButton) return
    observedButton = button
    lastKnownWatched = getWatchedStateFromButton(button)
  }

  // Detecta el toggle reaccionando al clic (delegado y en fase de captura,
  // para no depender de que el listener de Svelte no detenga la
  // propagación). El cambio de clase puede tardar (animeav1 espera la
  // respuesta del servidor antes de actualizar el ícono), así que se hace
  // polling en vez de un único setTimeout fijo.
  const WATCH_POLL_INTERVAL_MS = 150
  const WATCH_POLL_MAX_ATTEMPTS = 20 // ~3s en total

  function handleDocumentClick(event) {
    const clickedButton = event.target.closest(WATCH_BUTTON_SELECTOR)
    if (!clickedButton) return

    const slug = currentSlug
    const episode = currentEpisode
    const baselineWatched = lastKnownWatched
    let attempts = 0

    const poll = () => {
      attempts += 1
      const freshButton = getWatchButton()
      const watched = freshButton ? getWatchedStateFromButton(freshButton) : null

      if (watched !== null && watched !== baselineWatched) {
        lastKnownWatched = watched
        observedButton = freshButton

        if (slug == null || episode == null) return

        sendMessageSafe({
          type: 'TOGGLE_WATCHED',
          slug,
          episode,
          watched
        })
        return
      }

      if (attempts >= WATCH_POLL_MAX_ATTEMPTS) {
        return
      }

      setTimeout(poll, WATCH_POLL_INTERVAL_MS)
    }

    setTimeout(poll, WATCH_POLL_INTERVAL_MS)
  }

  document.addEventListener('click', handleDocumentClick, true)

  function handleNavigation() {
    const parsed = parseLocation()

    if (!parsed) {
      currentSlug = null
      currentEpisode = null
      lastSentName = null
      observedButton = null
      lastSentSlug = null
      lastAutoLinkKey = null

      updateLinkedView(null)

      return
    }

    const slugChanged = parsed.slug !== currentSlug

    currentSlug = parsed.slug
    currentEpisode = parsed.episode

    if (slugChanged) {
      lastSentName = null
      lastKnownWatched = null
      lastSentSlug = null
      lastAutoLinkKey = null
      observedButton = null
    }

    maybeSendNameUpdate()
    syncButtonBaseline()

    requestLinkedAnime()
  }

  // AnimeAv1 es una SPA: la URL puede cambiar sin recargar la página.
  let lastHref = window.location.href
  const rootObserver = new MutationObserver(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href
      handleNavigation()
    } else {
      maybeSendNameUpdate()
      syncButtonBaseline()
    }
  })

  rootObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  let linkFormSelectedResult = null

  function renderLinkedCard(link) {
    return `
      <div class="anime-card">
      ${link.pictureUrl ? `<img id="linked-image" class="anime-thumb" src="${link.pictureUrl}" alt="" hidden />` : ''}
      <p>
        ✅ Vinculado a
        <a id="mal-linked-title" href="https://myanimelist.net/anime/${link.malId}" target="_blank" rel="noopener noreferrer">
          ${link.title || '(sin título)'}
        </a>
        (ID <span id="mal-linked-id">${link.malId}</span>)
      </p>
    </div>
    
    <button id="mal-change-link-btn" type="button">
      Cambiar vínculo
    </button>
    `
  }

  function renderLinkForm() {
    return `
    <div class="search-row">
      <input id="mal-search-input" type="text" placeholder="Nombre del anime" />
      <button id="mal-search-btn" type="button">Buscar en MAL</button>
    </div>

    <ul id="mal-search-results"></ul>

    <div class="manual-row">
      <label for="manual-id-input">ID de MAL (manual)</label>
      <input id="mal-manual-id-input" type="number" min="1" placeholder="Ej: 21" />
    </div>

    <button id="mal-confirm-link-btn" type="button" disabled>Vincular</button>
    <p id="mal-link-error" class="error" hidden></p>
    `
  }

  function updateLinkedView(link) {
    const target = document.querySelector('body > div > div > div:nth-child(2)')
    if (!target) return

    let view = document.getElementById('mal-linked-view')
    if (!view) {
      view = document.createElement('div')
      view.id = 'mal-linked-view'
      target.prepend(view)
    }

    if (!currentSlug) {
      view.innerHTML = ''
      view.hidden = true
      return
    }

    view.hidden = false

    if (link) {
      view.innerHTML = renderLinkedCard(link) + styles
      view.querySelector('#mal-change-link-btn').addEventListener('click', () => showLinkForm(view))
    } else {
      showLinkForm(view)
    }
  }

  function showLinkForm(view) {
    linkFormSelectedResult = null
    view.innerHTML = renderLinkForm() + styles
    wireLinkForm(view)
  }

  function wireLinkForm(view) {
    const searchInput = view.querySelector('#mal-search-input')
    const searchBtn = view.querySelector('#mal-search-btn')
    const resultsList = view.querySelector('#mal-search-results')
    const manualInput = view.querySelector('#mal-manual-id-input')
    const confirmBtn = view.querySelector('#mal-confirm-link-btn')
    const errorEl = view.querySelector('#mal-link-error')

    searchInput.value = lastSentName || ''

    const showError = msg => {
      errorEl.textContent = msg || ''
      errorEl.hidden = !msg
    }
    const updateConfirmState = () => {
      confirmBtn.disabled = !manualInput.value.trim() && !linkFormSelectedResult
    }

    function renderResults(results) {
      resultsList.innerHTML = ''
      linkFormSelectedResult = null
      updateConfirmState()

      results.forEach(anime => {
        const li = document.createElement('li')
        const label = document.createElement('label')
        const radio = document.createElement('input')
        radio.type = 'radio'
        radio.name = 'mal-search-result'
        radio.value = String(anime.id)
        radio.addEventListener('change', () => {
          linkFormSelectedResult = anime
          manualInput.value = ''
          updateConfirmState()
        })

        const img = document.createElement('img')
        img.className = 'result-thumb'
        img.alt = ''
        if (anime.main_picture?.medium) img.src = anime.main_picture.medium

        const a = document.createElement('a')
        a.className = 'result-link'
        a.href = `https://myanimelist.net/anime/${anime.id}`
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        const eps = anime.num_episodes ? `${anime.num_episodes} eps` : 'eps ?'
        a.textContent = `${anime.title} (ID ${anime.id}, ${eps})`
        a.addEventListener('click', e => e.stopPropagation())

        label.append(radio, img, a)
        li.appendChild(label)
        resultsList.appendChild(li)
      })
    }

    searchBtn.addEventListener('click', async () => {
      const query = searchInput.value.trim()
      if (!query) return
      showError('')
      searchBtn.disabled = true
      try {
        const res = await chrome.runtime.sendMessage({ type: 'SEARCH_ANIME', query })
        if (!res?.ok) return showError(res?.error || 'Error al buscar en MAL')
        renderResults(res.results)
      } finally {
        searchBtn.disabled = false
      }
    })

    manualInput.addEventListener('input', () => {
      if (manualInput.value.trim()) {
        linkFormSelectedResult = null
        view.querySelectorAll('input[name="mal-search-result"]').forEach(r => (r.checked = false))
      }
      updateConfirmState()
    })

    confirmBtn.addEventListener('click', async () => {
      showError('')
      const manualId = manualInput.value.trim()
      const malId = manualId ? parseInt(manualId, 10) : linkFormSelectedResult?.id
      if (!malId) return showError('Selecciona un resultado o ingresa un ID manualmente.')

      const title = manualId ? null : linkFormSelectedResult?.title
      const pictureUrl = manualId ? null : linkFormSelectedResult?.main_picture?.medium || null

      confirmBtn.disabled = true
      try {
        const res = await chrome.runtime.sendMessage({ type: 'LINK_ANIME', slug: currentSlug, malId, title, pictureUrl })
        if (!res?.ok) return showError(res?.error || 'No se pudo vincular.')
        updateLinkedView({ malId, title: res.title ?? title, pictureUrl: res.pictureUrl ?? pictureUrl })
      } finally {
        confirmBtn.disabled = false
      }
    })
  }

  function requestLinkedAnime() {
    if (!currentSlug) return

    chrome.runtime.sendMessage(
      {
        type: 'GET_LINKED_ANIME',
        slug: currentSlug
      },
      response => {
        if (!response?.ok) {
          updateLinkedView(null)
          return
        }

        updateLinkedView(response.link)
      }
    )
  }

  handleNavigation()

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ ok: true })
      return
    }
  })

  const LINKS_STORAGE_KEY = 'animeLinks'

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[LINKS_STORAGE_KEY]) return
    if (!currentSlug) return

    const oldLinks = changes[LINKS_STORAGE_KEY].oldValue || {}
    const newLinks = changes[LINKS_STORAGE_KEY].newValue || {}

    const oldLink = oldLinks[currentSlug] || null
    const newLink = newLinks[currentSlug] || null

    // Evita re-render si no cambió nada para este slug en particular
    // (setLink/removeLink de otros animes también dispara este evento).
    if (JSON.stringify(oldLink) === JSON.stringify(newLink)) return

    updateLinkedView(newLink)
  })
})()

const styles = `
<style>
  #mal-linked-view {
    --paper: #111113;
    --paper-alt: #1c1c1f;
    --paper-highlight: #26262a;
    --ink: #e7e6e2;
    --muted: #8f8d89;
    --line: #333237;
    --indigo: #93a7c5;
    --indigo-deep: #3f4f6b;
    --indigo-deep-hover: #51648a;
    --oxblood: #d98f85;
    --oxblood-bg: #2c201f;
    --oxblood-border: #4a3330;
    --ok-bg: #1c231c;
    --ok-ink: #a8c79b;
    --ok-border: #35402f;
    --font-head: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
    --font-body: system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;

    position: relative;
    border-radius: 0.5rem;
    padding: 1rem;

    border: 1px solid rgb(var(--soft));
    background-color: rgb(var(--mute));
    margin-bottom: calc(var(--spacing) * 3);
  }

  #mal-linked-view::before {
    content: "";
    position: absolute;
    inset-inline: 1.5rem;
    top: 0;
    height: 1px;
    opacity: .5;

    background-image: linear-gradient(
      to right,
      transparent,
      rgb(var(--edge)),
      var(--tw-gradient-to, transparent)
    );
  }

  #mal-linked-view p {
    font-size: 12px;
    line-height: 1.5;
    margin: 3px 0;
    color: var(--muted);
  }

  #mal-linked-view strong {
    color: var(--ink);
    font-weight: 600;
  }

  #mal-linked-id {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink);
    background: var(--paper-alt);
    padding: 1px 5px;
    border-radius: 2px;
    border: 1px solid var(--line);
  }

  #mal-linked-view .anime-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--paper-alt);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 8px;
    margin-bottom: 8px;
  }

  #mal-linked-view .anime-thumb {
    width: 40px;
    height: 56px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
    background: var(--line);
    border: 1px solid var(--muted);
  }

  #mal-linked-view .search-row {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }

  #mal-linked-view .search-row input {
    flex: 1;
  }

  #mal-search-results {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: var(--paper-alt);
  }

  #mal-search-results:empty {
    border: none;
    background: none;
  }

  #mal-search-results li {
    font-size: 12px;
    padding: 5px 8px;
    border-bottom: 1px dashed var(--line);
  }

  #mal-search-results li:last-child {
    border-bottom: none;
  }

  #mal-search-results li:has(input:checked) {
    background: var(--paper-highlight);
  }

  #mal-search-results label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  #mal-linked-view .manual-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }

  #mal-linked-view .manual-row label {
    font-size: 11px;
    color: var(--muted);
  }

  #mal-linked-view .manual-row input {
    font-family: var(--font-mono);
  }

  #mal-linked-view input {
    min-height: unset;
    font-size: 12px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: var(--paper-alt);
    color: var(--ink);
  }

  #mal-linked-view input:focus-visible {
    outline: 2px solid var(--indigo);
    outline-offset: 1px;
  }

  #mal-linked-view button {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 3px;
    border: 1px solid var(--indigo-deep);
    background: var(--indigo-deep);
    color: var(--ink);
    cursor: pointer;
  }

  #mal-linked-view #mal-change-link-btn {
    background: transparent;
    color: var(--indigo);
    width: 100%;
  }

  #mal-linked-view button:hover {
    background: var(--indigo-deep-hover);
    border-color: var(--indigo-deep-hover);
  }

  #mal-linked-view button:focus-visible {
    outline: 2px solid var(--indigo);
    outline-offset: 2px;
  }

  #mal-linked-view button:disabled {
    background: transparent;
    color: var(--muted);
    border-color: var(--line);
    cursor: not-allowed;
  }

  #mal-change-link-btn button:hover {
    background: var(--paper-alt);
    color: var(--indigo);
  }

  #mal-linked-view .result-thumb {
    width: 28px;
    height: 40px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
    background: var(--line);
  }

  #mal-linked-title,
  #mal-linked-view .result-link {
    color: var(--indigo);
    text-decoration: none;
    font-weight: 600;
  }

  #mal-linked-title:hover,
  #mal-linked-view .result-link:hover {
    text-decoration: underline;
  }

  #mal-linked-view .error {
    color: var(--oxblood);
    font-size: 12px;
    margin-top: 6px;
  }
</style>
`
