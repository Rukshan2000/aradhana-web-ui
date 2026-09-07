import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Weddings from './pages/Weddings.jsx';
import WeddingDetail from './pages/WeddingDetail.jsx';
import Guests from './pages/Guests.jsx';
import Plan from './pages/Plan.jsx';
import GuestDetail from './pages/GuestDetail.jsx';
import Events from './pages/Events.jsx';
import Images from './pages/Images.jsx';
import Profile from './pages/Profile.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import HealthBadge from './components/HealthBadge.jsx';
import { useAuth } from './lib/AuthContext.jsx';
import Icon from './components/Icon.jsx';
import { demoUrl } from './lib/site.js';

const links = [
  ['/dashboard', 'Dashboard', 'chart-simple'],
  ['/weddings', 'My Wedding', 'ring'],
  ['/guests', 'Invitees & Well-wishers', 'user-group'],
  ['/plan', 'Planner', 'clipboard-list'],
  ['/events', 'Events', 'chart-bar'],
  ['/images', 'Images', 'images'],
];

/** Sends a signed-out visitor to /login, remembering where they were headed. */
function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <p className="empty">Loading…</p>;
  if (user === null) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

function Shell() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/assets/logo-mark.png" alt="" width="28" height="28" />
          <span>Guest <em>Book</em></span>
        </div>
        <nav>
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={icon} fixedWidth />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          {/* A finished invitation to look at. Kept in the sidebar rather than
              on one page because it is just as useful while editing content as
              it is before the wedding exists. */}
          <a className="sidebar-demo" href={demoUrl()} target="_blank" rel="noreferrer">
            <Icon name="wand-magic-sparkles" fixedWidth />
            View sample site
          </a>
          {user && (
            <div className="account">
              <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')} title="Your profile">
                <Icon name="user" fixedWidth /> {user.name}
              </NavLink>
              <button onClick={logout} title="Sign out">
                <Icon name="sign-out-alt" /> Sign out
              </button>
            </div>
          )}
          <HealthBadge />
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/weddings" element={<Weddings />} />
          <Route path="/weddings/:weddingSlug" element={<WeddingDetail />} />
          <Route path="/guests" element={<Guests />} />
          <Route path="/guests/:slug" element={<GuestDetail />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/events" element={<Events />} />
          <Route path="/images" element={<Images />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<p className="empty">Page not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
