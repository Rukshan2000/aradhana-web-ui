import { useState } from 'react';
import QRCode from 'qrcode';
import Icon from './Icon.jsx';

/**
 * Downloads one invitation link as a QR code PNG.
 *
 * Every link the portal shows gets its own button, since each one is a
 * different invitation: a household's personalised card, or the open link
 * anyone can reply through. The code is generated in the browser — the URL
 * never goes to a third-party QR service, which would leak who was invited.
 *
 * 1024px with a quiet margin is large enough to print on a card and still
 * scan; the ink colour matches the portal so it does not look pasted in.
 */
const OPTIONS = {
  width: 1024,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#1c1a17ff', light: '#ffffffff' },
};

export default function QrButton({ url, filename, label = '', className = '' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    setBusy(true);
    setError(false);
    try {
      const dataUrl = await QRCode.toDataURL(url, OPTIONS);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${filename || 'invitation'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('QR generation failed:', err);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`qr-button ${className}`.trim()}
      onClick={download}
      disabled={busy || !url}
      title={error ? 'Could not generate the QR code' : `Download a QR code for ${url}`}
      aria-label={label || `Download a QR code for ${url}`}
    >
      <Icon name={error ? 'warning' : busy ? 'spinner' : 'qrcode'} />
      {label ? ` ${label}` : ''}
    </button>
  );
}

/** The download filename for a link, e.g. "invite-chulani-minindu-dilan". */
export const qrFilename = (weddingSlug, inviteeSlug) =>
  ['invite', weddingSlug, inviteeSlug || 'open'].filter(Boolean).join('-');
