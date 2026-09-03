// SPDX-License-Identifier: MIT

export interface NostrRelayHttpGetResult {
  status: number;
  json: any;
}

export interface NostrRelayTransport {
  query(relays: string[], filter: Record<string, unknown>): Promise<any[]>;
  getCachedLikeState?(
    relays: string[],
    url: string,
  ): Promise<{
    found: boolean;
    isLiked: boolean;
  }>;
  getLikeState?(
    relays: string[],
    url: string,
  ): Promise<{
    totalCount: number;
    likedCount: number;
    dislikedCount: number;
    isLiked: boolean;
  }>;
  publish(relays: string[], event: any): Promise<void>;
  /** Host-proxied HTTPS GET for LNURL/invoice JSON when page CSP blocks fetch. */
  httpGet?(url: string): Promise<NostrRelayHttpGetResult>;
}

/** Optional host transport used when page CSP prevents direct relay sockets. */
export function getRelayTransport(): NostrRelayTransport | null {
  const transport = (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: Partial<NostrRelayTransport>;
    }
  ).__nostrComponentsRelayTransport;

  if (
    !transport ||
    typeof transport.query !== 'function' ||
    typeof transport.publish !== 'function'
  ) {
    return null;
  }
  return transport as NostrRelayTransport;
}

const ZAP_HTTP_TIMEOUT_MS = 10_000;

/** JSON GET that uses the host bridge when the page cannot reach Lightning HTTP. */
export async function httpGetJson(url: string): Promise<NostrRelayHttpGetResult> {
  const transport = getRelayTransport();
  if (typeof transport?.httpGet === 'function') {
    return transport.httpGet(url);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(ZAP_HTTP_TIMEOUT_MS),
  });
  let json: any = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}
