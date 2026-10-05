interface DashboardRequestLock {
  token: string;
  expiresAt: number;
}

const LOCK_KEY = 'upx06-dashboard-request-lock-v1';
const LOCK_DURATION_MS = 2 * 60 * 1000;
const MANUAL_SEARCH_COOLDOWN_KEY = 'upx06-dashboard-manual-search-cooldown-v1';
const MANUAL_SEARCH_COOLDOWN_MS = 60 * 1000;

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

export function acquireDashboardRequestLock(): string | null {
  const now = Date.now();
  const existing = localStorage.getItem(LOCK_KEY);

  if (existing) {
    let lock: unknown;
    try {
      lock = JSON.parse(existing);
    } catch {
      throw new Error('Não foi possível verificar se outra aba está consultando o dashboard.');
    }

    if (
      typeof lock === 'object'
      && lock !== null
      && 'expiresAt' in lock
      && typeof lock.expiresAt === 'number'
      && lock.expiresAt > now
    ) {
      return null;
    }
  }

  const token = `${now}-${Math.random().toString(36).slice(2)}`;
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
    return token;
  }

  return null;
}

export function releaseDashboardRequestLock(token: string): void {
  const saved = localStorage.getItem(LOCK_KEY);
  if (!saved) return;

  let lock: unknown;
  try {
    lock = JSON.parse(saved);
  } catch {
    throw new Error('Não foi possível liberar o bloqueio da consulta ao dashboard.');
  }

  if (
    typeof lock === 'object'
    && lock !== null
    && 'token' in lock
    && lock.token === token
  ) {
    localStorage.removeItem(LOCK_KEY);
  }
}
