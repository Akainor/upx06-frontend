interface DashboardRequestLock {
  token: string;
  expiresAt: number;
}

const LOCK_KEY = 'upx06-dashboard-request-lock-v1';
const LOCK_DURATION_MS = 2 * 60 * 1000;
const LOCK_RENEW_INTERVAL_MS = 30 * 1000;
const MANUAL_SEARCH_COOLDOWN_KEY = 'upx06-dashboard-manual-search-cooldown-v1';
const MANUAL_SEARCH_COOLDOWN_MS = 60 * 1000;
const LAST_DASHBOARD_REQUEST_KEY = 'upx06-dashboard-last-successful-request-v1';
const heldBrowserLocks = new Map<string, () => void>();
const fallbackLockRenewals = new Map<string, number>();

function createLockToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseDashboardLock(saved: string): DashboardRequestLock {
  let lock: unknown;
  try {
    lock = JSON.parse(saved);
  } catch {
    throw new Error('Não foi possível verificar se outra aba está consultando o dashboard.');
  }

  if (
    typeof lock !== 'object'
    || lock === null
    || !('token' in lock)
    || typeof lock.token !== 'string'
    || !('expiresAt' in lock)
    || typeof lock.expiresAt !== 'number'
  ) {
    throw new Error('O bloqueio da consulta ao dashboard está inválido.');
  }

  return { token: lock.token, expiresAt: lock.expiresAt };
}

function renewFallbackLock(token: string): void {
  const saved = localStorage.getItem(LOCK_KEY);
  if (!saved) return;

  const lock = parseDashboardLock(saved);
  if (lock.token !== token) return;

  localStorage.setItem(LOCK_KEY, JSON.stringify({
    token,
    expiresAt: Date.now() + LOCK_DURATION_MS,
  } satisfies DashboardRequestLock));
}

export function getManualSearchCooldownRemaining(): number {
  const saved = localStorage.getItem(MANUAL_SEARCH_COOLDOWN_KEY);
  if (!saved) return 0;

  const expiresAt = Number(saved);
  if (!Number.isFinite(expiresAt)) {
    throw new Error('O tempo de espera da busca manual salvo está inválido.');
  }

  const remaining = Math.max(0, expiresAt - Date.now());
  if (remaining === 0) {
    localStorage.removeItem(MANUAL_SEARCH_COOLDOWN_KEY);
  }

  return remaining;
}

export function startManualSearchCooldown(): number {
  const expiresAt = Date.now() + MANUAL_SEARCH_COOLDOWN_MS;
  localStorage.setItem(MANUAL_SEARCH_COOLDOWN_KEY, expiresAt.toString());
  return expiresAt;
}

export function isManualSearchCooldownStorageKey(key: string | null): boolean {
  return key === MANUAL_SEARCH_COOLDOWN_KEY;
}

export function getLastDashboardRequestAt(): number {
  const saved = localStorage.getItem(LAST_DASHBOARD_REQUEST_KEY);
  if (!saved) return 0;

  const timestamp = Number(saved);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error('O horário da última consulta ao dashboard está inválido.');
  }

  return timestamp;
}

export function recordDashboardRequestSuccess(timestamp: number): void {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error('O horário da consulta ao dashboard está inválido.');
  }

  localStorage.setItem(LAST_DASHBOARD_REQUEST_KEY, timestamp.toString());
}

export async function acquireDashboardRequestLock(): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return new Promise<string | null>((resolve, reject) => {
      let resolverReleased: (() => void) | undefined;
      void navigator.locks.request(
        LOCK_KEY,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            resolve(null);
            return;
          }

          const token = createLockToken();
          const holdLock = new Promise<void>((release) => {
            resolverReleased = release;
          });
          heldBrowserLocks.set(token, () => resolverReleased?.());
          resolve(token);
          await holdLock;
        },
      ).catch(reject);
    });
  }

  const now = Date.now();
  const existing = localStorage.getItem(LOCK_KEY);

  if (existing) {
    const lock = parseDashboardLock(existing);
    if (lock.expiresAt > now) return null;
  }

  const token = createLockToken();
  localStorage.setItem(LOCK_KEY, JSON.stringify({
    token,
    expiresAt: now + LOCK_DURATION_MS,
  } satisfies DashboardRequestLock));

  const saved: unknown = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null');
  if (
    typeof saved === 'object'
    && saved !== null
    && 'token' in saved
    && saved.token === token
  ) {
    const renewal = window.setInterval(
      () => renewFallbackLock(token),
      LOCK_RENEW_INTERVAL_MS,
    );
    fallbackLockRenewals.set(token, renewal);
    return token;
  }

  return null;
}

export function releaseDashboardRequestLock(token: string): void {
  const releaseBrowserLock = heldBrowserLocks.get(token);
  if (releaseBrowserLock) {
    heldBrowserLocks.delete(token);
    releaseBrowserLock();
    return;
  }

  const renewal = fallbackLockRenewals.get(token);
  if (renewal !== undefined) {
    window.clearInterval(renewal);
    fallbackLockRenewals.delete(token);
  }

  const saved = localStorage.getItem(LOCK_KEY);
  if (!saved) return;

  const lock = parseDashboardLock(saved);
  if (lock.token === token) localStorage.removeItem(LOCK_KEY);
}
