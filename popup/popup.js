const state = {
  tabId: null,
  slug: null,
  name: null,
  link: null,
  selectedResult: null
}

const els = {
  connectionStatus: document.getElementById('connection-status'),
  noContext: document.getElementById('no-context'),
  contextInfo: document.getElementById('context-info'),
  detectedName: document.getElementById('detected-name'),
  detectedSlug: document.getElementById('detected-slug'),
  linkedView: document.getElementById('linked-view'),
  linkedImage: document.getElementById('linked-image'),
  linkedTitle: document.getElementById('linked-title'),
  linkedId: document.getElementById('linked-id'),
  changeLinkBtn: document.getElementById('change-link-btn'),
  linkView: document.getElementById('link-view'),
  searchInput: document.getElementById('search-input'),
  searchBtn: document.getElementById('search-btn'),
  searchResults: document.getElementById('search-results'),
  manualIdInput: document.getElementById('manual-id-input'),
  confirmLinkBtn: document.getElementById('confirm-link-btn'),
  linkError: document.getElementById('link-error'),
  optionsLink: document.getElementById('options-link')
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message)
}

function showError(message) {
  els.linkError.textContent = message || ''
  els.linkError.hidden = !message
}

function malAnimeUrl(id) {
  return `https://myanimelist.net/anime/${id}`
}

function renderLinked() {
  els.linkView.hidden = true
  els.linkedView.hidden = false
  els.linkedTitle.textContent = state.link.title || '(sin título)'
  els.linkedTitle.href = malAnimeUrl(state.link.malId)
  els.linkedId.textContent = state.link.malId

  if (state.link.pictureUrl) {
    els.linkedImage.src = state.link.pictureUrl
    els.linkedImage.hidden = false
  } else {
    els.linkedImage.removeAttribute('src')
    els.linkedImage.hidden = true
  }
}

function renderLinkForm() {
  els.linkedView.hidden = true
  els.linkView.hidden = false
  showError('')
}

function updateConfirmButtonState() {
  const hasManualId = els.manualIdInput.value.trim().length > 0
  els.confirmLinkBtn.disabled = !hasManualId && !state.selectedResult
}

function renderSearchResults(results) {
  els.searchResults.innerHTML = ''
  state.selectedResult = null
  updateConfirmButtonState()

  results.forEach(anime => {
    const li = document.createElement('li')
    const label = document.createElement('label')
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'search-result'
    radio.value = String(anime.id)

    radio.addEventListener('change', () => {
      state.selectedResult = anime
      els.manualIdInput.value = ''
      updateConfirmButtonState()
    })

    const img = document.createElement('img')
    img.className = 'result-thumb'
    img.alt = ''
    if (anime.main_picture?.medium) {
      img.src = anime.main_picture.medium
    }

    const link = document.createElement('a')
    link.className = 'result-link'
    link.href = malAnimeUrl(anime.id)
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    const episodesText = anime.num_episodes ? `${anime.num_episodes} eps` : 'eps ?'
    link.textContent = `${anime.title} (ID ${anime.id}, ${episodesText})`
    // Evita que el clic en el enlace también marque/desmarque el radio.
    link.addEventListener('click', event => event.stopPropagation())

    label.appendChild(radio)
    label.appendChild(img)
    label.appendChild(link)
    li.appendChild(label)
    els.searchResults.appendChild(li)
  })
}

async function checkConnection() {
  const res = await sendMessage({ type: 'TEST_MAL_CONNECTION' })
  if (res && res.ok) {
    els.connectionStatus.textContent = `✅ Conectado a MAL como ${res.user?.name ?? ''}`
    els.connectionStatus.className = 'status ok'
  } else {
    els.connectionStatus.textContent = `⚠️ Sin conexión con MAL: ${res?.error ?? 'desconocido'}`
    els.connectionStatus.className = 'status error'
  }
}

async function loadContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) return
  state.tabId = tab.id

  const res = await sendMessage({ type: 'GET_TAB_CONTEXT', tabId: tab.id })
  if (!res?.ok || !res.context) {
    els.noContext.hidden = false
    els.contextInfo.hidden = true
    return
  }

  state.slug = res.context.slug
  state.name = res.context.name
  state.link = res.link

  els.noContext.hidden = true
  els.contextInfo.hidden = false
  els.detectedName.textContent = state.name || '(nombre no detectado)'
  els.detectedSlug.textContent = state.slug

  els.searchInput.value = state.name || ''

  if (state.link) {
    renderLinked()
  } else {
    renderLinkForm()
  }
}

els.changeLinkBtn.addEventListener('click', () => {
  renderLinkForm()
})

els.searchBtn.addEventListener('click', async () => {
  const query = els.searchInput.value.trim()
  if (!query) return
  showError('')
  els.searchBtn.disabled = true
  try {
    const res = await sendMessage({ type: 'SEARCH_ANIME', query })
    if (!res?.ok) {
      showError(res?.error || 'Error al buscar en MAL')
      return
    }
    renderSearchResults(res.results)
  } finally {
    els.searchBtn.disabled = false
  }
})

els.manualIdInput.addEventListener('input', () => {
  if (els.manualIdInput.value.trim()) {
    state.selectedResult = null
    document.querySelectorAll('input[name="search-result"]').forEach(radio => (radio.checked = false))
  }
  updateConfirmButtonState()
})

els.confirmLinkBtn.addEventListener('click', async () => {
  showError('')
  const manualId = els.manualIdInput.value.trim()
  const malId = manualId ? parseInt(manualId, 10) : state.selectedResult?.id

  if (!malId) {
    showError('Selecciona un resultado o ingresa un ID manualmente.')
    return
  }

  const title = manualId ? null : state.selectedResult?.title
  const pictureUrl = manualId ? null : state.selectedResult?.main_picture?.medium || null

  els.confirmLinkBtn.disabled = true
  try {
    const res = await sendMessage({
      type: 'LINK_ANIME',
      slug: state.slug,
      malId,
      title,
      pictureUrl,
      tabId: state.tabId
    })
    if (!res?.ok) {
      showError(res?.error || 'No se pudo vincular.')
      return
    }
    state.link = {
      malId,
      title: res.title ?? title,
      pictureUrl: res.pictureUrl ?? pictureUrl
    }

    renderLinked()
  } finally {
    els.confirmLinkBtn.disabled = false
  }
})

els.optionsLink.addEventListener('click', event => {
  event.preventDefault()
  chrome.runtime.openOptionsPage()
})

async function ensureContentScript(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'PING'
    })

    if (response?.ok) {
      return
    }
  } catch {
    // No existe el content script.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js']
  })
}

;(async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  if (!tab?.id) return

  await ensureContentScript(tab.id)

  checkConnection()
  loadContext()
})()
