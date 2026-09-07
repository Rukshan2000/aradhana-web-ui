import { useCallback, useEffect, useState } from 'react';

// Runs an async loader and tracks {data, error, loading}. `reload` re-runs it.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    run()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
  }, [run, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
