import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import { AuthLayout, Field } from '../components/AuthLayout.jsx';

/**
 * Two ways in, sharing one email field so switching tabs never makes the user
 * retype it: the password they set, or a one-time code emailed to them.
 */
export default function Login() {
  const { user, login, loginWithCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [method, setMethod] = useState('password'); // 'password' | 'code'
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  if (user) return <Navigate to={location.state?.from || '/dashboard'} replace />;

  const done = () => navigate(location.state?.from || '/dashboard', { replace: true });

  function pick(next) {
    setMethod(next);
    setError(null);
    setNotice(null);
  }

  /** Every submit path is the same shape: run it, show the failure, unlock. */
  async function run(e, action) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const submitPassword = (e) => run(e, async () => {
    await login(email, password);
    done();
  });

  const sendCode = (e) => run(e, async () => {
    const { expires_in_minutes } = await api.auth.requestLoginCode(email);
    setCodeSent(true);
    setNotice(`We sent a 6-digit code to ${email}. It expires in ${expires_in_minutes} minutes.`);
  });

  const submitCode = (e) => run(e, async () => {
    await loginWithCode(email, code);
    done();
  });

  const emailField = (
    <Field
      label="Email"
      type="email"
      required
      autoFocus
      autoComplete="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  );

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in" subtitle="Pick up right where you left off.">
      <div className="auth-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={method === 'password'} className={method === 'password' ? 'active' : ''} onClick={() => pick('password')}>
          Password
        </button>
        <button type="button" role="tab" aria-selected={method === 'code'} className={method === 'code' ? 'active' : ''} onClick={() => pick('code')}>
          Email code
        </button>
      </div>

      {method === 'password' ? (
        <form className="auth-form" onSubmit={submitPassword}>
          {emailField}
          <Field
            label="Password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button type="button" className="field-toggle" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          />
          <p className="auth-aside">
            <Link to="/forgot-password" state={{ email }}>Forgot your password?</Link>
          </p>
          {error && <p className="auth-error">{String(error.message)}</p>}
          <button className="auth-submit" disabled={busy}>
            <span>{busy ? 'Signing in…' : 'Sign in'}</span>
          </button>
          <p className="auth-switch">No account yet? <Link to="/register">Request access</Link></p>
        </form>
      ) : !codeSent ? (
        <form className="auth-form" onSubmit={sendCode}>
          {emailField}
          <p className="auth-aside">We'll email you a one-time code — no password needed.</p>
          {error && <p className="auth-error">{String(error.message)}</p>}
          <button className="auth-submit" disabled={busy}>
            <span>{busy ? 'Sending…' : 'Email me a code'}</span>
          </button>
          <p className="auth-switch">No account yet? <Link to="/register">Request access</Link></p>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submitCode}>
          <Field
            label="6-digit code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            className="field-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {notice && !error && <p className="auth-notice">{notice}</p>}
          {error && <p className="auth-error">{String(error.message)}</p>}
          <button className="auth-submit" disabled={busy || code.length !== 6}>
            <span>{busy ? 'Verifying…' : 'Sign in'}</span>
          </button>
          <p className="auth-switch">
            Didn't get it?{' '}
            <button type="button" className="auth-link" onClick={(e) => { setCode(''); sendCode(e); }} disabled={busy}>
              Send another code
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
