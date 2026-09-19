// Almacenamiento local: credenciales de MAL y vínculos animeav1(slug) -> MAL(id).
// Se usa chrome.storage.local (no sync) para que las credenciales nunca salgan del dispositivo.

const AUTH_KEY = 'malAuth';
const LINKS_KEY = 'animeLinks';

export async function getMalAuth() {
  const data = await chrome.storage.local.get(AUTH_KEY);
  return data[AUTH_KEY] || null;
}

export async function setMalAuth(auth) {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

export async function getAnimeLinks() {
  const data = await chrome.storage.local.get(LINKS_KEY);
  return data[LINKS_KEY] || {};
}

export async function getLink(slug) {
  const links = await getAnimeLinks();
  return links[slug] || null;
}

export async function setLink(slug, link) {
  const links = await getAnimeLinks();
  links[slug] = link;
  await chrome.storage.local.set({ [LINKS_KEY]: links });
}

export async function removeLink(slug) {
  const links = await getAnimeLinks();
  delete links[slug];
  await chrome.storage.local.set({ [LINKS_KEY]: links });
}
