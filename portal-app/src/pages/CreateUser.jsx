import { useState } from 'react';
import { Page } from '../components/Page.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import Icon from '../components/Icon.jsx';

/* Invitation sections this account gets; must match FEATURES in portal-api/src/auth.js. */
const FEATURES = [
  ['countdown', 'Countdown — days until the wedding'],
  ['story', 'Story — the love-story carousel'],
  ['gallery', 'Photo gallery'],
  ['schedule', "Order of the evening — the day's schedule"],
  ['wishes', "Wishes — carousel of guests' notes"],
  ['music', 'Background music'],
];
const allOn = Object.fromEntries(FEATURES.map(([key]) => [key, true]));
const blank = { name: '', email: '', password: '', features: allOn };

/* Internal: admins create portal accounts here (self sign-up is closed).
   Not linked from the sidebar; reach it at /admin/users. */
export default function CreateUser() {
  const { user } = useAuth();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggle = (key) => (e) => setForm({ ...form, features: { ...form.features, [key]: e.target.checked } });

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setBusy(true);
    try {
      setCreated(await api.auth.createUser(form));
      setForm(blank);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!user?.is_admin) return <Page title="Create account"><p className="empty">Only admins can create accounts.</p></Page>;

  return (
    <Page title="Create account">
      <form className="card form" onSubmit={submit}>
        <div className="grid">
          <label>
            Name
            <input value={form.name} required onChange={set('name')} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} required autoComplete="off" onChange={set('email')} />
          </label>
          <label>
            Password
            <input type="text" value={form.password} required minLength={8} autoComplete="new-password" onChange={set('password')} />
          </label>
        </div>
        <p>Features on the invitation</p>
        <div className="grid">
          {FEATURES.map(([key, label]) => (
            <label key={key} className="checkbox">
              <input type="checkbox" checked={form.features[key]} onChange={toggle(key)} />
              {label}
            </label>
          ))}
        </div>
        {error && <p className="error">{String(error.message)}</p>}
        <div className="content-editor__actions">
          <button className="primary" disabled={busy}>
            <Icon name="user-plus" /> {busy ? 'Creating…' : 'Create account'}
          </button>
          {created && <span className="content-editor__saved">Created {created.email}</span>}
        </div>
      </form>
    </Page>
  );
}
