import { useAsync } from '../lib/useAsync.js';
import { api } from '../lib/api.js';

export default function HealthBadge() {
  const { data, error, loading } = useAsync(() => api.health(), []);
  const state = loading ? 'pending' : error || !data?.ok ? 'down' : 'up';
  const label = { pending: 'checking API…', up: 'API online', down: 'API unreachable' }[state];
  return <div className={`health health-${state}`}><span className="dot" />{label}</div>;
}
