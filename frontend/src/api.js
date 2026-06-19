let apiBaseUrl = '';

export async function fetchConfig() {
  try {
    const res = await fetch('/config');
    const config = await res.json();
    const raw = (config.apiBaseUrl || '').trim();
    apiBaseUrl = (raw && raw !== '*') ? raw : '';
  } catch (err) {
    console.error("Failed to fetch server configuration.", err);
  }
}

export async function apiRequest(endpoint, options = {}) {
  const { suppressLog = false, ...fetchOptions } = options;
  fetchOptions.headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };
  fetchOptions.credentials = 'include';

  try {
    const fullUrl = `${apiBaseUrl}${endpoint}`;
    const res = await fetch(fullUrl, fetchOptions);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }
    return data;
  } catch (err) {
    if (!suppressLog && !(err instanceof TypeError)) {
      console.error(`API Error: ${endpoint}`, err);
    }
    throw err;
  }
}