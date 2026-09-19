// Cliente de la API de MyAnimeList (OAuth2 + endpoints de anime y lista de usuario).
import { getMalAuth, setMalAuth } from './storage.js';

const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const API_BASE = 'https://api.myanimelist.net/v2';

async function refreshAccessToken(auth) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`No se pudo refrescar el token de MAL (${res.status}): ${text}`);
  }

  const data = await res.json();
  // MAL rota el refresh_token en cada renovación: hay que persistir el nuevo.
  const updated = {
    ...auth,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || auth.refreshToken,
    accessTokenExpiry: Date.now() + (data.expires_in || 0) * 1000 - 60000,
  };
  await setMalAuth(updated);
  return updated;
}

export async function getAccessToken() {
  let auth = await getMalAuth();
  if (!auth || !auth.clientId || !auth.clientSecret || !auth.refreshToken) {
    throw new Error(
      'Faltan credenciales de MyAnimeList. Configúralas en las opciones de la extensión.'
    );
  }

  if (!auth.accessToken || !auth.accessTokenExpiry || Date.now() >= auth.accessTokenExpiry) {
    auth = await refreshAccessToken(auth);
  }

  return auth.accessToken;
}

async function malFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Error de la API de MAL (${res.status}): ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getCurrentUser() {
  return malFetch('/users/@me?fields=name');
}

export async function searchAnime(query) {
  const params = new URLSearchParams({
    q: query.slice(0, 64),
    limit: '10',
    fields: 'id,title,alternative_titles,main_picture,num_episodes,media_type,status',
  });
  const data = await malFetch(`/anime?${params.toString()}`);
  return (data.data || []).map((item) => item.node);
}

export async function getAnimeDetails(id) {
  const params = new URLSearchParams({
    fields: 'id,title,main_picture,num_episodes,my_list_status',
  });
  return malFetch(`/anime/${id}?${params.toString()}`);
}

export async function updateListStatus(id, fields) {
  const body = new URLSearchParams(fields);
  return malFetch(`/anime/${id}/my_list_status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}
