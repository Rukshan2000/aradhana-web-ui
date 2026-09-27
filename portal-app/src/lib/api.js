// Thin wrapper around portal-api. In dev VITE_API_BASE is empty and Vite
// proxies /api to the API; in production set it to the deployed API origin.
const BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include', // send/receive the session cookie
    headers: options.body instanceof FormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `${res.status} ${res.statusText}`);
    err.status = res.status;
    // A session that expired or was revoked mid-use surfaces as a 401 on
    // whatever the page happened to call next; send the user back to sign
    // in rather than leaving every page stuck on a raw error. The auth
    // endpoints are exempt — a failed login attempt must not redirect.
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.location.href = '/login';
    }
    throw err;
  }
  return data;
}

const json = (body) => JSON.stringify(body);

/** A multipart upload that reports progress, which fetch cannot do: XHR
    calls `onProgress` with 0–100 as bytes go out. Errors and the 401
    redirect behave the same as `request`. */
function uploadWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);
    xhr.withCredentials = true;
    if (onProgress) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    }
    xhr.onload = () => {
      let data = null;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      const err = new Error(data?.error || `${xhr.status} ${xhr.statusText}`);
      err.status = xhr.status;
      if (xhr.status === 401) window.location.href = '/login';
      reject(err);
    };
    xhr.onerror = () => reject(new Error('Network error — upload failed'));
    xhr.send(formData);
  });
}

// Guest slugs are unique per wedding, so guest calls take an optional wedding
// slug that becomes ?wedding=<slug>.
const scoped = (path, wedding) => (wedding ? `${path}${path.includes('?') ? '&' : '?'}wedding=${encodeURIComponent(wedding)}` : path);

export const api = {
  health: () => request('/health'),

  auth: {
    me: () => request('/api/auth/me'),
    login: (email, password) => request('/api/auth/login', { method: 'POST', body: json({ email, password }) }),
    register: (fields) => request('/api/auth/register', { method: 'POST', body: json(fields) }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    // Passwordless sign-in: request a 6-digit code, then trade it for a session.
    requestLoginCode: (email) => request('/api/auth/login/code', { method: 'POST', body: json({ email }) }),
    verifyLoginCode: (email, code) => request('/api/auth/login/code/verify', { method: 'POST', body: json({ email, code }) }),
    // Password reset, same two steps, ending in a new password.
    forgotPassword: (email) => request('/api/auth/password/forgot', { method: 'POST', body: json({ email }) }),
    resetPassword: (fields) => request('/api/auth/password/reset', { method: 'POST', body: json(fields) }),
    // In-session password change: current password stands in for the emailed code.
    changePassword: (fields) => request('/api/auth/password/change', { method: 'POST', body: json(fields) }),
    updateProfile: (fields) => request('/api/auth/me', { method: 'PATCH', body: json(fields) }),
  },

  weddings: {
    list: () => request('/api/weddings'),
    get: (slug) => request(`/api/weddings/${slug}`),
    create: (wedding) => request('/api/weddings', { method: 'POST', body: json(wedding) }),
    update: (slug, fields) => request(`/api/weddings/${slug}`, { method: 'PATCH', body: json(fields) }),
    remove: (slug) => request(`/api/weddings/${slug}`, { method: 'DELETE' }),
    guests: (slug) => request(`/api/weddings/${slug}/guests`),
    revokeOpenLink: (slug) => request(`/api/weddings/${slug}/open-link/revoke`, { method: 'POST' }),
    restoreOpenLink: (slug) => request(`/api/weddings/${slug}/open-link/restore`, { method: 'POST' }),
    addGuest: (slug, guest) => request(`/api/weddings/${slug}/guests`, { method: 'POST', body: json(guest) }),
    // Printed-QR repair: URLs already on cards, pointed at live invitations.
    aliases: (slug) => request(`/api/weddings/${slug}/aliases`),
    addAlias: (slug, fields) => request(`/api/weddings/${slug}/aliases`, { method: 'POST', body: json(fields) }),
    removeAlias: (slug, id) => request(`/api/weddings/${slug}/aliases/${id}`, { method: 'DELETE' }),
  },

  guests: {
    // `source` splits the two portal tabs: 'invited' households the couple
    // added by name, 'self' the people who replied through the open link.
    list: (wedding, source) => request(scoped(`/api/guests${source ? `?source=${source}` : ''}`, wedding)),
    get: (slug, wedding) => request(scoped(`/api/guests/${slug}`, wedding)),
    create: (guest) => request('/api/guests', { method: 'POST', body: json(guest) }),
    update: (slug, fields, wedding) => request(scoped(`/api/guests/${slug}`, wedding), { method: 'PATCH', body: json(fields) }),
    rsvp: (slug, rsvp, wedding) => request(scoped(`/api/guests/${slug}/rsvp`, wedding), { method: 'POST', body: json(rsvp) }),
    // Retiring one invitation URL without touching the guest behind it.
    revoke: (slug, wedding) => request(scoped(`/api/guests/${slug}/revoke`, wedding), { method: 'POST' }),
    restore: (slug, wedding) => request(scoped(`/api/guests/${slug}/restore`, wedding), { method: 'POST' }),
    remove: (slug, wedding) => request(scoped(`/api/guests/${slug}`, wedding), { method: 'DELETE' }),
    stats: (wedding) => request(scoped('/api/guests/stats/summary', wedding)),
  },

  events: {
    list: ({ slug, wedding, event_type, limit = 200 } = {}) => {
      const q = new URLSearchParams();
      if (wedding) q.set('wedding', wedding);
      if (slug) q.set('slug', slug);
      if (event_type) q.set('event_type', event_type);
      q.set('limit', String(limit));
      return request(`/api/track?${q}`);
    },
    track: (event) => request('/api/track', { method: 'POST', body: json(event) }),
  },

  images: {
    list: ({ category, guest_id } = {}) => {
      const q = new URLSearchParams();
      if (category) q.set('category', category);
      if (guest_id) q.set('guest_id', String(guest_id));
      return request(`/api/uploads?${q}`);
    },
    upload: (formData, onProgress) => uploadWithProgress('/api/uploads', formData, onProgress),
    remove: (id) => request(`/api/uploads/${id}`, { method: 'DELETE' }),
  },
};
