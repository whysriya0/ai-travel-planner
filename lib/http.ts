export class TravelError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export async function fetchJson<T>(url: string | URL, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new TravelError(`Data provider returned HTTP ${response.status}. Check its configuration and try again.`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof TravelError) throw error;
    throw new TravelError('A data provider is unreachable or timed out. Please try again.');
  }
}
