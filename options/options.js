const els = {
  form: document.getElementById('auth-form'),
  clientId: document.getElementById('client-id'),
  clientSecret: document.getElementById('client-secret'),
  refreshToken: document.getElementById('refresh-token'),
  testBtn: document.getElementById('test-btn'),
  statusMsg: document.getElementById('status-msg'),
};

function showStatus(message, isError) {
  els.statusMsg.textContent = message;
  els.statusMsg.hidden = !message;
  els.statusMsg.className = `status ${isError ? 'error' : 'ok'}`;
}

async function loadAuth() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_MAL_AUTH' });
  if (res?.ok && res.auth) {
    els.clientId.value = res.auth.clientId || '';
    els.clientSecret.value = res.auth.clientSecret || '';
    els.refreshToken.value = res.auth.refreshToken || '';
  }
}

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const res = await chrome.runtime.sendMessage({
    type: 'SAVE_MAL_AUTH',
    clientId: els.clientId.value.trim(),
    clientSecret: els.clientSecret.value.trim(),
    refreshToken: els.refreshToken.value.trim(),
  });
  if (res?.ok) {
    showStatus('Credenciales guardadas.', false);
  } else {
    showStatus(res?.error || 'No se pudieron guardar las credenciales.', true);
  }
});

els.testBtn.addEventListener('click', async () => {
  showStatus('Probando conexión…', false);
  const res = await chrome.runtime.sendMessage({ type: 'TEST_MAL_CONNECTION' });
  if (res?.ok) {
    showStatus(`Conectado correctamente como ${res.user?.name ?? ''}.`, false);
  } else {
    showStatus(res?.error || 'No se pudo conectar con MAL.', true);
  }
});

loadAuth();
