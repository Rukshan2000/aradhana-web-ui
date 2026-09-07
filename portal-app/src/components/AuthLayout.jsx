/* Shared frame for /login and /register: a decorative brand panel plus
   whatever form the page provides. Kept separate from the pages themselves
   so Login/Register stay focused on their own field logic. */
export function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-hidden="true">
        <img className="auth-brand__mark" src="/assets/logo-mark.png" alt="" width="52" height="52" />
        <div className="auth-brand__text">
          <p className="auth-brand__eyebrow">Guest Book</p>
          <h1>Every invitation,{' '}<em>beautifully kept.</em></h1>
          <p className="auth-brand__lede">
            Manage weddings, guests and RSVPs from one calm, organised place.
          </p>
        </div>
        <div className="auth-brand__petals">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>
      </aside>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="auth-card__eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}

/** A text/email/password field with a floating label and optional trailing action. */
export function Field({ label, type = 'text', value, onChange, required, autoFocus, minLength, autoComplete, trailing, hint, ...rest }) {
  return (
    <label className="field-float">
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        autoFocus={autoFocus}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder=" "
        {...rest}
      />
      <span>{label}</span>
      {trailing}
      {hint && <small>{hint}</small>}
    </label>
  );
}
