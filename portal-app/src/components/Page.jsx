export function Page({ title, actions, children }) {
  return (
    <>
      <header className="page-head">
        <h1>{title}</h1>
        <div className="actions">{actions}</div>
      </header>
      {children}
    </>
  );
}

export function State({ loading, error, empty, children }) {
  if (loading) return <p className="empty">Loading…</p>;
  if (error) return <p className="error">{String(error.message || error)}</p>;
  if (empty) return <p className="empty">Nothing here yet.</p>;
  return children;
}

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value ?? 0}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Badge({ status }) {
  return <span className={`badge badge-${status || 'pending'}`}>{status || 'pending'}</span>;
}

export const fmtDate = (v) => (v ? new Date(v).toLocaleString() : '—');
