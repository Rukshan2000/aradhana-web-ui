import { useState } from 'react';
import { Page } from '../components/Page.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import Icon from '../components/Icon.jsx';

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function saveName(e) {
    e.preventDefault();
    setNameError(null);
    setNameSaved(false);
    setSavingName(true);
    try {
      await updateProfile({ name });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setNameError(err);
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(new Error('the new passwords do not match'));
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err) {
      setPasswordError(err);
    } finally {
      setSavingPassword(false);
    }
  }

  if (!user) return null;

  return (
    <Page title="Profile">
      <form className="card form" onSubmit={saveName}>
        <h2 style={{ marginTop: 0 }}>Account</h2>
        <div className="grid">
          <label>
            Name
            <input value={name} required onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input value={user.email} disabled title="Email cannot be changed here" />
          </label>
        </div>
        {nameError && <p className="error">{String(nameError.message)}</p>}
        <div className="content-editor__actions">
          <button className="primary" disabled={savingName || !name.trim() || name === user.name}>
            <Icon name="save" /> {savingName ? 'Saving…' : 'Save name'}
          </button>
          {nameSaved && <span className="content-editor__saved">Saved</span>}
        </div>
      </form>

      <form className="card form" onSubmit={savePassword}>
        <h2 style={{ marginTop: 0 }}>Change password</h2>
        <div className="grid">
          <label>
            Current password
            <input
              type="password"
              value={currentPassword}
              required
              autoComplete="current-password"
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              required
              minLength={8}
              autoComplete="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              required
              minLength={8}
              autoComplete="new-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        </div>
        {passwordError && <p className="error">{String(passwordError.message)}</p>}
        <div className="content-editor__actions">
          <button className="primary" disabled={savingPassword || !currentPassword || newPassword.length < 8}>
            <Icon name={savingPassword ? 'spinner' : 'key'} /> {savingPassword ? 'Saving…' : 'Change password'}
          </button>
          {passwordSaved && <span className="content-editor__saved">Password changed</span>}
        </div>
      </form>
    </Page>
  );
}
