import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { AuthLayout, Field } from '../components/AuthLayout.jsx';

const blank = { name: '', email: '', password: '' };

/* Registration is invite-only once the first account exists (the API
   enforces this — it 401s here rather than silently letting a stranger in).
   The very first registration bootstraps the whole system, so this page
   still has to be reachable while logged out. */
export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const strength = passwordStrength(form.password);

  return (
    <AuthLayout eyebrow="Get started" title="Create your account" subtitle="A few details and you're in.">
      <form className="auth-form" onSubmit={submit}>
        <Field label="Full name" required autoFocus autoComplete="name" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Field label="Email" type="email" required autoComplete="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field
          label="Password"
          type={showPassword ? 'text' : 'password'}
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          trailing={
            <button type="button" className="field-toggle" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          }
        />
        {form.password && (
          <div className="strength" data-level={strength.level}>
            <div className="strength__bar"><span /></div>
            <small>{strength.label}</small>
          </div>
        )}
        {error && <p className="auth-error">{String(error.message)}</p>}
        <button className="auth-submit" disabled={busy}>
          <span>{busy ? 'Creating account…' : 'Create account'}</span>
        </button>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

/** Rough client-side hint only — the API is the real gate on length/rules. */
function passwordStrength(password) {
  if (!password) return { level: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const levels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { level: Math.min(score, 4), label: levels[Math.min(score, 4)] };
}
