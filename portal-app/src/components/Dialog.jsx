import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/**
 * Confirm and alert boxes drawn as part of the portal rather than by the
 * browser.
 *
 * `window.confirm` blocks the whole tab, cannot say which of two buttons is
 * the dangerous one, and looks like a phishing prompt on some browsers — a
 * poor last word before something is deleted. These read as the portal's own
 * UI, keep the same promise-shaped call site (`await confirm(…)`), and are
 * built on the native <dialog>, so Escape, focus trapping and the backdrop
 * come from the platform rather than from hand-written key handlers.
 */
const DialogContext = createContext(null);

export function useDialogs() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }) {
  // One request at a time: a dialog is a question, and a second question
  // before the first is answered would be a bug in the caller.
  const [request, setRequest] = useState(null);
  const ref = useRef(null);
  const confirmButton = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (request && !el.open) {
      el.showModal();
      // The safe button takes focus, so Enter never destroys anything.
      confirmButton.current?.focus();
    }
    if (!request && el.open) el.close();
  }, [request]);

  const settle = useCallback((value) => {
    setRequest((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const ask = useCallback((kind, options) => new Promise((resolve) => {
    const opts = typeof options === 'string' ? { body: options } : (options || {});
    setRequest({
      kind,
      title: kind === 'confirm' ? 'Are you sure?' : 'Just so you know',
      confirmLabel: kind === 'confirm' ? 'Confirm' : 'OK',
      cancelLabel: 'Cancel',
      danger: false,
      ...opts,
      resolve,
    });
  }), []);

  const api = {
    /** Resolves true if the reader confirms, false on cancel or Escape. */
    confirm: useCallback((options) => ask('confirm', options), [ask]),
    /** Resolves once the reader has acknowledged it. */
    alert: useCallback((options) => ask('alert', options), [ask]),
  };

  const r = request;
  return (
    <DialogContext.Provider value={api}>
      {children}
      <dialog
        ref={ref}
        className={`dialog${r?.danger ? ' dialog--danger' : ''}`}
        // Escape fires `cancel`, and the backdrop click lands on the dialog
        // itself rather than on any of its children.
        onCancel={(e) => { e.preventDefault(); settle(false); }}
        onClick={(e) => { if (e.target === ref.current) settle(false); }}
      >
        {r && (
          <div className="dialog__panel">
            <h2 className="dialog__title">
              {r.danger && <Icon name="warning" />} {r.title}
            </h2>
            {r.body && <p className="dialog__body">{r.body}</p>}
            <div className="dialog__actions">
              {r.kind === 'confirm' && (
                <button type="button" ref={confirmButton} onClick={() => settle(false)}>
                  {r.cancelLabel}
                </button>
              )}
              <button
                type="button"
                ref={r.kind === 'confirm' ? undefined : confirmButton}
                className={r.danger ? 'danger-solid' : 'primary'}
                onClick={() => settle(true)}
              >
                {r.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </DialogContext.Provider>
  );
}
