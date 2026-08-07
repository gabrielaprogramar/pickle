// Client-side settings-change notification.
// Mirrors the auth-change pattern in hooks/use-auth.ts: the SettingsProvider
// subscribes, and use-settings fires after any successful mutation so the
// provider re-fetches the bundle and applies appearance to <html> immediately.
type SettingsChangeListener = () => void | Promise<void>;
const listeners = new Set<SettingsChangeListener>();

export function subscribeSettingsChanged(
  listener: SettingsChangeListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function notifySettingsChanged(): Promise<void> {
  const snapshot = [...listeners];
  await Promise.allSettled(snapshot.map((listener) => Promise.resolve(listener())));
}
