// Initialize from Vite env var (set in frontend/.env or frontend/.env.production)
// Empty string = use Vite dev proxy (same-origin requests, no CORS issues)
let apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

// Ensure absolute apiBaseUrl has a correct protocol format if explicitly defined
if (apiBaseUrl && !apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
  // If explicitly developing on local localhost, preserve HTTP instead of forcing SSL HTTPS
  if (apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1')) {
    apiBaseUrl = 'http://' + apiBaseUrl;
  } else {
    apiBaseUrl = 'https://' + apiBaseUrl;
  }
}

// Fallback to same-origin if still empty (Crucial for Vite proxy targeting)
if (!apiBaseUrl) {
  apiBaseUrl = '';
}

/**
 * Fetches dynamic platform configurations from the backend at runtime.
 * This overrides build-time environment variables so you don't have to rebuild
 * the frontend when changing backend URLs.
 */
export async function fetchConfig() {
  try {
    // If apiBaseUrl is empty, this fetches natively from the same port relative origin '/config'
    const res = await fetch(`${apiBaseUrl}/config`);
    if (!res.ok) return; 
    
    const config = await res.json();
    const raw = (config.apiBaseUrl || '').trim();
    
    if (raw) {
      if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
        apiBaseUrl = raw.includes('localhost') ? 'http://' + raw : 'https://' + raw;
      } else {
        apiBaseUrl = raw;
      }
    }
  } catch (err) {
    // Suppressed locally since proxy abstracts this context step seamlessly during dev
    console.debug("Dynamic platform configuration lookup fallback applied:", err.message);
  }
}

/**
 * Global HTTP request wrapper for communicating with the CMC Delal API endpoints.
 * Automatically handles CORS credentials, JSON formatting, and robust error fallback.
 */
export async function apiRequest(endpoint, options = {}) {
  const { suppressLog = false, ...fetchOptions } = options;
  
  fetchOptions.headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };
  
  // CRITICAL: Needed so cookies/tokens pass safely across origins via your proxy setup
  fetchOptions.credentials = 'include';

  // Ensure path concatenation formats cleanly without duplicate slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${apiBaseUrl}${cleanEndpoint}`;

  try {
    const res = await fetch(fullUrl, fetchOptions);

    if (res.status === 204) return undefined;

    const contentType = res.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Server returned unexpected text format (${res.status}): ${text.slice(0, 150)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status code ${res.status}`);
    }
    return data;
  } catch (err) {
    if (!suppressLog) {
      console.error(`API Client Error on [${fetchOptions.method || 'GET'}] ${endpoint}:`, err.message);
    }
    throw err;
  }
}

/**
 * Helper to retrieve the current resolved base url if needed by components (e.g. image paths)
 */
export const getApiBaseUrl = () => apiBaseUrl;