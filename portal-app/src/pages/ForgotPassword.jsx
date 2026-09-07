import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import { AuthLayout, Field } from '../components/AuthLayout.jsx';

/**
 * Reset in two steps: prove the mailbox with a code, then set the new
 * password. The reset signs the user straight in, so there is no trip back
 * through /login afterwards.
 */
export default function ForgotPassword() {
  const { user, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState('request'); // 'request' | 'reset'
  // Carried over from the sign-in form when the user got here from its link.
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  if (user) return <Navigate to="/dashboard" replace />;

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

  const sendCode = (e) => run(e, async () => {
    const { expires_in_minutes } = await api.auth.forgotPassword(email);
    setStep('reset');
    setNotice(`If ${email} has an account, a 6-digit code is on its way. It expires in ${expires_in_minutes} minutes.`);
  });

  const submitReset = (e) => run(e, async () => {
    await resetPassword({ email, code, password });
    navigate('/dashboard', { replace: true });
  });

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle={step === 'request'
        ? 'We’ll email you a one-time code to confirm it’s you.'
        : 'Enter the code we emailed, then choose a new password.'}
    >
      {step === 'request' ? (
        <form className="auth-form" onSubmit={sendCode}>
          <Field
            label="Email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="auth-error">{String(error.message)}</p>}
          <button className="auth-submit" disabled={busy}>
            <span>{busy ? 'Sending…' : 'Email me a code'}</span>
          </button>
          <p className="auth-switch">Remembered it? <Link to="/login">Back to sign in</Link></p>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submitReset}>
          <Field
            label="6-digit code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Field
            label="New password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters."
            trailing={
              <button type="button" className="field-toggle" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            }
          />
          {notice && !error && <p className="auth-notice">{notice}</p>}
          {error && <p className="auth-error">{String(error.message)}</p>}
          <button className="auth-submit" disabled={busy || code.length !== 6}>
            <span>{busy ? 'Saving…' : 'Set new password'}</span>
          </button>
          <p className="auth-switch">
            Didn’t get it?{' '}
            <button type="button" className="auth-link" onClick={sendCode} disabled={busy}>
              Send another code
            </button>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
