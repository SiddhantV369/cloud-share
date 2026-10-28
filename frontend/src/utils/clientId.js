/**
 * Anonymous Client Device Identity Manager
 * Provides a persistent UUID in localStorage to isolate uploaded files per device/browser session
 * without requiring any registration or login screen.
 */

const CLIENT_ID_KEY = 'clouddrop_client_id';

export function getClientId() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id || id.trim().length === 0) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      } else {
        id = 'cd_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      }
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch (err) {
    console.warn('localStorage not accessible, generating temporary session id:', err);
    return 'temp_' + Math.random().toString(36).substring(2, 12);
  }
}
