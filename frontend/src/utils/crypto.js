/**
 * CloudDrop Zero-Knowledge Client-Side Cryptography
 * Uses modern Web Cryptography API (window.crypto.subtle)
 * Algorithm: AES-256-GCM (Hardware-accelerated authenticated symmetric encryption)
 * Key Derivation: PBKDF2 (100,000 iterations, SHA-256)
 */

const KEYS_STORAGE_KEY = 'clouddrop_file_keys';

// --- Base64 & Base64URL Helpers ---

export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToBase64Url(buffer) {
  return bufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64ToBuffer(base64);
}

// --- Local Key Cache (stores uploader's decryption keys locally) ---

export function saveFileKey(shareCode, keyString) {
  if (!shareCode || !keyString) return;
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY) || '{}';
    const keys = JSON.parse(raw);
    keys[shareCode] = keyString;
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.warn('Could not save key in localStorage:', err);
  }
}

export function getFileKey(shareCode) {
  if (!shareCode) return null;
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY) || '{}';
    const keys = JSON.parse(raw);
    return keys[shareCode] || null;
  } catch (err) {
    return null;
  }
}

// --- Web Cryptography API Core Functions ---

/**
 * Generate a random 256-bit AES-GCM Key
 */
export async function generateRandomKey() {
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await window.crypto.subtle.exportKey('raw', key);
  const keyString = bufferToBase64Url(exported);
  return { key, keyString };
}

/**
 * Import a raw key from a URL fragment string (#key=...)
 */
export async function importKeyFromString(keyString) {
  const rawBuffer = base64UrlToBuffer(keyString);
  return await window.crypto.subtle.importKey(
    'raw',
    rawBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive 256-bit AES-GCM key from password and salt via PBKDF2 (100,000 rounds)
 */
export async function deriveKeyFromPassword(password, saltBuffer) {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate cryptographically secure 12-byte random IV
 */
export function generateIv() {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Generate cryptographically secure 16-byte random Salt
 */
export function generateSalt() {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Encrypt an ArrayBuffer with AES-256-GCM
 */
export async function encryptBuffer(arrayBuffer, cryptoKey, iv) {
  return await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128,
    },
    cryptoKey,
    arrayBuffer
  );
}

/**
 * Decrypt an ArrayBuffer with AES-256-GCM
 */
export async function decryptBuffer(ciphertextBuffer, cryptoKey, iv) {
  return await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128,
    },
    cryptoKey,
    ciphertextBuffer
  );
}

/**
 * Parse decryption key from URL hash fragment (e.g. #key=xyz)
 */
export function extractKeyFromUrlHash() {
  if (typeof window === 'undefined' || !window.location.hash) {
    return null;
  }
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('key') || null;
}
