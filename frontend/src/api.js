// Initialize strictly from Vite env var (set in frontend/.env or frontend/.env.production)
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

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
  
  // CRITICAL: Needed so cookies/tokens pass safely across origins
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