import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { useLocalState } from '../lib/useLocalState.js';
import { Page, Stat, State } from '../components/Page.jsx';
import Icon from '../components/Icon.jsx';
import { BUDGET_LINES, PHASES, VENDOR_ROLES } from '../data/planTemplate.js';
import { useDialogs } from '../components/Dialog.jsx';

const money = (n) => `Rs ${Number(n || 0).toLocaleString('en-LK')}`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const uid = () => Math.random().toString(36).slice(2, 9);

/** Whole days from now until the wedding; negative once it has happened. */
function daysUntil(date) {
  if (!date) return null;
  const day = 24 * 60 * 60 * 1000;
  return Math.ceil((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / day);
}

/** The template, flattened into editable rows on first use. */
const seedTasks = () =>
  PHASES.flatMap((p) => p.tasks.map((text) => ({ id: uid(), phase: p.id, text, done: false })));
const seedBudget = () =>
  BUDGET_LINES.map((l) => ({ id: uid(), label: l.label, planned: 0, actual: 0, paid: false }));

function Bar({ value, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Plan() {
  const weddings = useAsync(() => api.weddings.list(), []);
  const myWedding = weddings.data?.[0] || null;

  if (weddings.loading) return <Page title="Planner"><p className="empty">Loading…</p></Page>;
  if (!myWedding) {
    return (
      <Page title="Planner">
        <p className="empty"><Link to="/weddings">Create your wedding</Link> to start planning.</p>
      </Page>
    );
  }
  // Keyed on the slug so each wedding reads its own saved plan rather than
  // inheriting whichever one rendered first.
  return <Planner key={myWedding.slug} wedding={myWedding} />;
}

function Planner({ wedding }) {
  const prefix = `kwings.plan.v1.${wedding.slug}`;
  const [tasks, setTasks] = useLocalState(`${prefix}.tasks`, seedTasks);
  const [budget, setBudget] = useLocalState(`${prefix}.budget`, seedBudget);
  const [total, setTotal] = useLocalState(`${prefix}.total`, 0);
  const [vendors, setVendors] = useLocalState(`${prefix}.vendors`, []);
  const [notes, setNotes] = useLocalState(`${prefix}.notes`, '');
  const [openPhase, setOpenPhase] = useState(PHASES[0].id);
  const importInput = useRef(null);
  const { confirm, alert } = useDialogs();

  // The one part of the page that is not the couple's own typing: how many
  // people have actually replied, straight from the invitations.
  const stats = useAsync(() => api.guests.stats(), []);
  const totals = stats.data?.totals || {};

  const days = daysUntil(wedding.event_date);
  const doneCount = tasks.filter((t) => t.done).length;
  const planned = useMemo(() => budget.reduce((s, l) => s + num(l.planned), 0), [budget]);
  const spent = useMemo(() => budget.reduce((s, l) => s + num(l.actual), 0), [budget]);
  const ceiling = num(total) || planned;

  const patchTask = (id, fields) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  const patchLine = (id, fields) => setBudget((b) => b.map((l) => (l.id === id ? { ...l, ...fields } : l)));
  const patchVendor = (id, fields) => setVendors((v) => v.map((x) => (x.id === id ? { ...x, ...fields } : x)));

  function exportPlan() {
    const blob = new Blob(
      [JSON.stringify({ wedding: wedding.slug, exported_at: new Date().toISOString(), tasks, budget, total, vendors, notes }, null, 2)],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wedding-plan-${wedding.slug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function importPlan(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.tasks) || !Array.isArray(data.budget)) throw new Error('not a plan file');
      const yes = await confirm({
        title: 'Replace this plan?',
        body: 'The checklist, budget, suppliers and notes in this browser are replaced by the ones in the file.',
        confirmLabel: 'Replace',
        danger: true,
      });
      if (!yes) return;
      setTasks(data.tasks);
      setBudget(data.budget);
      setTotal(data.total || 0);
      setVendors(data.vendors || []);
      setNotes(data.notes || '');
    } catch (err) {
      await alert({ title: 'Could not read that file', body: err.message, danger: true });
    }
  }

  async function reset() {
    const yes = await confirm({
      title: 'Start the plan over?',
      body: 'Every tick, figure, supplier and note in this browser is cleared and the template comes back. Export first if you want a copy.',
      confirmLabel: 'Reset plan',
      danger: true,
    });
    if (!yes) return;
    setTasks(seedTasks());
    setBudget(seedBudget());
    setTotal(0);
    setVendors([]);
    setNotes('');
  }

  return (
    <Page
      title="Planner"
      actions={
        <>
          <button onClick={() => window.print()} title="Print this plan"><Icon name="print" /> Print</button>
          <button onClick={exportPlan} title="Save the plan as a file"><Icon name="download" /> Export</button>
          <button onClick={() => importInput.current?.click()} title="Load a plan from a file">
            <Icon name="upload" /> Import
          </button>
          <input ref={importInput} type="file" accept="application/json" hidden onChange={importPlan} />
          <button className="danger" onClick={reset} title="Clear the plan"><Icon name="undo" /> Reset</button>
        </>
      }
    >
      <p className="muted plan-note">
        <Icon name="info-circle" /> This plan is kept in this browser only — it is never uploaded, and it will
        not follow you to another device. Use <strong>Export</strong> to keep a copy or move it.
      </p>

      <div className="stats">
        <Stat
          label={days === null ? 'No date set yet' : days > 0 ? 'Days to go' : days === 0 ? 'Today' : 'Days since'}
          value={days === null ? '—' : Math.abs(days)}
        />
        <Stat label={`Tasks done of ${tasks.length}`} value={doneCount} />
        <Stat label={`Spent of ${money(ceiling)}`} value={money(spent)} />
        <Stat label="Replies in" value={stats.loading ? '…' : `${totals.total_attending || 0} heads`} />
      </div>

      {/* ── Checklist ─────────────────────────────────────────────────── */}
      <h2>Checklist</h2>
      <div className="plan-phases">
        {PHASES.map((phase) => {
          const rows = tasks.filter((t) => t.phase === phase.id);
          const done = rows.filter((t) => t.done).length;
          const open = openPhase === phase.id;
          return (
            <section key={phase.id} className={`card plan-phase${open ? ' open' : ''}`}>
              <button
                type="button"
                className="plan-phase__head"
                onClick={() => setOpenPhase(open ? null : phase.id)}
                aria-expanded={open}
              >
                <Icon name={open ? 'chevron-down' : 'chevron-right'} />
                <span className="plan-phase__label">
                  <strong>{phase.label}</strong>
                  <span className="muted">{phase.note}</span>
                </span>
                <span className="plan-phase__count">
                  {done}/{rows.length}
                  <Bar value={done} total={rows.length} />
                </span>
              </button>

              {/* Rendered even while collapsed: printing has to include every
                  phase, and a closed <ul> that is not in the DOM cannot be
                  brought back by print CSS. */}
              <ul className="plan-tasks" hidden={!open}>
                  {rows.map((t) => (
                    <li key={t.id} className={t.done ? 'done' : ''}>
                      <label>
                        <input type="checkbox" checked={t.done} onChange={(e) => patchTask(t.id, { done: e.target.checked })} />
                        <input
                          className="plan-task__text"
                          value={t.text}
                          onChange={(e) => patchTask(t.id, { text: e.target.value })}
                        />
                      </label>
                      <button
                        type="button"
                        className="qr-button danger"
                        title="Delete this task"
                        aria-label="Delete this task"
                        onClick={() => setTasks((ts) => ts.filter((x) => x.id !== t.id))}
                      >
                        <Icon name="trash-can" />
                      </button>
                    </li>
                  ))}
                <li className="plan-tasks__add">
                  <button
                    type="button"
                    onClick={() => setTasks((ts) => [...ts, { id: uid(), phase: phase.id, text: '', done: false }])}
                  >
                    <Icon name="plus" /> Add a task
                  </button>
                </li>
              </ul>
            </section>
          );
        })}
      </div>

      {/* ── Budget ────────────────────────────────────────────────────── */}
      <h2>Budget</h2>
      <div className="card">
        <div className="plan-budget__head">
          <label>
            Total budget
            <input type="number" min="0" step="1000" value={total} onChange={(e) => setTotal(e.target.value)} />
          </label>
          <div className="plan-budget__summary">
            <div>
              <span className="muted">Planned</span> <strong>{money(planned)}</strong>
            </div>
            <div>
              <span className="muted">Spent</span> <strong>{money(spent)}</strong>
            </div>
            <div className={spent > ceiling && ceiling > 0 ? 'over' : ''}>
              <span className="muted">{spent > ceiling && ceiling > 0 ? 'Over by' : 'Left'}</span>{' '}
              <strong>{money(Math.abs(ceiling - spent))}</strong>
            </div>
            <Bar value={spent} total={ceiling} />
          </div>
        </div>

        <table className="plan-table">
          <thead>
            <tr><th>Item</th><th>Planned</th><th>Actual</th><th>Paid</th><th /></tr>
          </thead>
          <tbody>
            {budget.map((l) => (
              <tr key={l.id} className={l.paid ? 'paid' : ''}>
                <td><input value={l.label} onChange={(e) => patchLine(l.id, { label: e.target.value })} /></td>
                <td><input type="number" min="0" value={l.planned} onChange={(e) => patchLine(l.id, { planned: e.target.value })} /></td>
                <td><input type="number" min="0" value={l.actual} onChange={(e) => patchLine(l.id, { actual: e.target.value })} /></td>
                <td className="center">
                  <input type="checkbox" checked={l.paid} onChange={(e) => patchLine(l.id, { paid: e.target.checked })} />
                </td>
                <td>
                  <button
                    type="button"
                    className="qr-button danger"
                    title="Delete this line"
                    aria-label="Delete this line"
                    onClick={() => setBudget((b) => b.filter((x) => x.id !== l.id))}
                  >
                    <Icon name="trash-can" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5}>
                <button
                  type="button"
                  onClick={() => setBudget((b) => [...b, { id: uid(), label: '', planned: 0, actual: 0, paid: false }])}
                >
                  <Icon name="plus" /> Add a line
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Who is coming ─────────────────────────────────────────────── */}
      <h2>Who is coming</h2>
      <State loading={stats.loading} error={stats.error}>
        <div className="card">
          <div className="stats">
            <Stat label="Invitations" value={totals.total_guests} />
            <Stat label="Attending heads" value={totals.total_attending} />
            <Stat label="Opened" value={totals.total_opens} />
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Straight from the invitations — the number to give the caterer.
            Manage it in <Link to="/guests">Invitees &amp; Well-wishers</Link>.
          </p>
        </div>
      </State>

      {/* ── Suppliers ─────────────────────────────────────────────────── */}
      <h2>Suppliers</h2>
      <div className="card">
        <table className="plan-table">
          <thead>
            <tr><th>Role</th><th>Name</th><th>Phone</th><th>Cost</th><th>Booked</th><th /></tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className={v.booked ? 'paid' : ''}>
                <td>
                  <input list="vendor-roles" value={v.role} onChange={(e) => patchVendor(v.id, { role: e.target.value })} />
                </td>
                <td><input value={v.name} onChange={(e) => patchVendor(v.id, { name: e.target.value })} /></td>
                <td><input type="tel" value={v.phone} onChange={(e) => patchVendor(v.id, { phone: e.target.value })} /></td>
                <td><input type="number" min="0" value={v.cost} onChange={(e) => patchVendor(v.id, { cost: e.target.value })} /></td>
                <td className="center">
                  <input type="checkbox" checked={v.booked} onChange={(e) => patchVendor(v.id, { booked: e.target.checked })} />
                </td>
                <td>
                  <button
                    type="button"
                    className="qr-button danger"
                    title="Delete this supplier"
                    aria-label="Delete this supplier"
                    onClick={() => setVendors((vs) => vs.filter((x) => x.id !== v.id))}
                  >
                    <Icon name="trash-can" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={6}>
                <button
                  type="button"
                  onClick={() => setVendors((vs) => [...vs, { id: uid(), role: '', name: '', phone: '', cost: 0, booked: false }])}
                >
                  <Icon name="plus" /> Add a supplier
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <datalist id="vendor-roles">
          {VENDOR_ROLES.map((r) => <option key={r} value={r} />)}
        </datalist>
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────── */}
      <h2>Notes</h2>
      <div className="card">
        <textarea
          className="plan-notes"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nekath times, who is bringing what, the things you keep forgetting…"
        />
      </div>
    </Page>
  );
}
