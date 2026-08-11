import { useEffect, useState } from 'react';

import { Banner } from '../../../components/Banner';
import { useSessionStore } from '../../../stores/session-store';

const WARNING_WINDOW_MS = 5 * 60 * 1000;
const TICK_MS = 30 * 1000;

export function SessionExpiryBanner() {
  const tokenExpiresAt = useSessionStore((s) => s.tokenExpiresAt);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Reset the dismissed flag when the token changes (e.g. re-login) — adjusting
  // state during render per React's own pattern for this, rather than an effect.
  const [trackedExpiresAt, setTrackedExpiresAt] = useState(tokenExpiresAt);
  if (tokenExpiresAt !== trackedExpiresAt) {
    setTrackedExpiresAt(tokenExpiresAt);
    setDismissed(false);
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  if (!tokenExpiresAt || dismissed) return null;

  const msRemaining = tokenExpiresAt - now;
  if (msRemaining <= 0 || msRemaining > WARNING_WINDOW_MS) return null;

  const minutesRemaining = Math.max(1, Math.ceil(msRemaining / 60000));

  return (
    <Banner
      message={`Session ending in ${minutesRemaining} min — you'll need to log in again soon.`}
      variant="warning"
      onDismiss={() => setDismissed(true)}
    />
  );
}
