// Todo lo que la extensión asume de animeav1.com vive aquí: si el sitio cambia algo, este es el único archivo a revisar.

export const SITE = {
  // /media/<slug> o /media/<slug>/<episodio>
  mediaPath: /^\/media\/([^/]+)(?:\/([^/]+))?/,

  // SvelteKit expone los datos de la página (incluida la biblioteca del usuario) en formato devalue.
  libraryDataUrl: (slug: string) => `/media/${slug}/__data.json`,

  // Form action que usa el modal "Agregar a lista" (también lo usamos para guardar). Exige este header.
  libraryActionUrl: '/cuenta/listas?/library',
  // Usado por el dropdown de estado: { mediaId, status }. Status -1 elimina la entrada.
  libraryApiPath: '/api/user/library',
  actionHeaders: { 'x-sveltekit-action': 'true' } as Record<string, string>,

  hydrationMarkerId: 'svelte-announcer',

  selectors: {
    listForm: 'form[action*="/cuenta/listas?/library"]',
    ratingRadio: (value: number) => `input[name="rating"][value="${value}"]`,
    // Botón que muestra el estado y abre el modal; su hermano (con aria-haspopup) es el dropdown.
    statusButton: 'button[aria-label="Lista"]:not([aria-haspopup])',
    dropdownItem: '[data-dropdown-menu-item]',
    watchButton: 'button:has(span.ic-eye), button:has(span.ic-eye-off)',
    watchIconWatched: 'ic-eye-off',
    watchIconUnwatched: 'ic-eye',
    animeName: {
      episode: ['main article header a[href^="/media/"]', 'main article header a', 'main header a[href^="/media/"]'],
      anime: ['main article header h1']
    },
    episodeAnchor: 'body > div > div > div:nth-child(2)',
    animeAnchor: 'body > div > div.container > main > article'
  },

  // El dropdown de estado hace POST a /api/user/library { mediaId, status } (no observable desde aquí),
  // así que se identifica la acción por el texto del item.
  dropdownActions: {
    viendo: 0,
    'por ver': 1,
    completado: 2,
    pausado: 3,
    descartado: 4,
    'eliminar de lista': 'delete'
  } as Record<string, number | 'delete'>
}
