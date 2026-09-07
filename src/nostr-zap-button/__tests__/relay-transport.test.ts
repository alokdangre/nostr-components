// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent } from 'nostr-tools';
import * as zapReceiptModule from '../zap-receipt';
import {
  fetchInvoice,
  getBatchedProfileMetadata,
  getProfileMetadata,
  getZapProviderInfo,
  listenForZapReceipt,
} from '../zap-utils';
import {
  BOLT11_20U,
  BOLT11_20U_AMOUNT_MSATS,
} from './fixtures';

const RELAYS = ['wss://relay.damus.io'];

function makeProfileEvent(
  secretByte: number,
  content: Record<string, unknown>,
  createdAt = 10,
) {
  return finalizeEvent(
    {
      kind: 0,
      created_at: createdAt,
      tags: [],
      content: JSON.stringify(content),
    },
    new Uint8Array(32).fill(secretByte),
  );
}

afterEach(() => {
  delete (
    globalThis as typeof globalThis & {
      __nostrComponentsRelayTransport?: unknown;
    }
  ).__nostrComponentsRelayTransport;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Zap component relay transport', () => {
  it('routes profile lookup through the host transport', async () => {
    const profile = makeProfileEvent(6, {
      lud16: 'creator@example.com',
    });
    const pubkey = profile.pubkey;
    const query = vi.fn().mockResolvedValue([profile]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(getProfileMetadata(pubkey, RELAYS)).resolves.toMatchObject(profile);
    expect(query).toHaveBeenCalledWith(RELAYS, {
      authors: [pubkey],
      kinds: [0],
      limit: 1,
    });
  });

  it('rejects forged and wrong-author profile responses', async () => {
    const profile = makeProfileEvent(12, {
      lud16: 'creator@example.com',
    });
    const forgedProfile = {
      ...profile,
      content: JSON.stringify({ lud16: 'attacker@example.com' }),
    };
    const wrongAuthor = makeProfileEvent(13, {
      lud16: 'attacker@example.com',
    });
    const relays = ['wss://profile-validation.example'];
    const query = vi
      .fn()
      .mockResolvedValue([forgedProfile, wrongAuthor]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(getProfileMetadata(profile.pubkey, relays)).resolves.toBeNull();
  });

  it('scopes cached profiles by normalized relay set', async () => {
    const relayA = ['wss://profiles-a.example'];
    const relayB = ['wss://profiles-b.example'];
    const profileA = makeProfileEvent(9, { name: 'Relay A' }, 10);
    const profileB = makeProfileEvent(9, { name: 'Relay B' }, 11);
    const pubkey = profileA.pubkey;
    const query = vi.fn(async (relays: string[]) =>
      relays === relayA ? [profileA] : [profileB],
    );
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(getProfileMetadata(pubkey, relayA)).resolves.toMatchObject(profileA);
    await expect(getProfileMetadata(pubkey, relayB)).resolves.toMatchObject(profileB);
    await expect(
      getProfileMetadata(pubkey, ['wss://profiles-a.example/']),
    ).resolves.toMatchObject(profileA);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('batches zapper profiles into one bounded host query', async () => {
    const pubkeys = ['7'.repeat(64), '8'.repeat(64)];
    const query = vi.fn().mockResolvedValue([]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(getBatchedProfileMetadata(pubkeys, RELAYS)).resolves.toEqual([
      { id: pubkeys[0], profile: null },
      { id: pubkeys[1], profile: null },
    ]);
    expect(query).toHaveBeenCalledWith(RELAYS, {
      authors: pubkeys,
      kinds: [0],
      limit: 2,
    });
  });

  it('deduplicates mixed-case authors before the host profile query', async () => {
    const pubkey = 'ab'.repeat(32);
    const query = vi.fn().mockResolvedValue([]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    await expect(
      getBatchedProfileMetadata([pubkey, pubkey.toUpperCase(), pubkey], RELAYS),
    ).resolves.toEqual([
      { id: pubkey, profile: null },
      { id: pubkey.toUpperCase(), profile: null },
      { id: pubkey, profile: null },
    ]);
    expect(query).toHaveBeenCalledWith(RELAYS, {
      authors: [pubkey],
      kinds: [0],
      limit: 1,
    });
  });

  it('resolves LNURL metadata through host httpGet', async () => {
    const httpGet = vi.fn().mockResolvedValue({
      status: 200,
      json: {
        allowsNostr: true,
        nostrPubkey: 'aa'.repeat(32),
        callback: 'https://ln.example/callback',
      },
    });
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query: vi.fn(),
        publish: vi.fn(),
        httpGet,
      },
    });

    await expect(
      getZapProviderInfo(
        makeProfileEvent(22, { lud16: 'alice@ln.example' }),
      ),
    ).resolves.toMatchObject({
      lnurl: 'https://ln.example/.well-known/lnurlp/alice',
      callback: 'https://ln.example/callback',
    });
    expect(httpGet).toHaveBeenCalledWith(
      'https://ln.example/.well-known/lnurlp/alice',
    );
  });

  it('fetches invoices through host httpGet', async () => {
    const httpGet = vi.fn().mockResolvedValue({
      status: 200,
      json: { pr: BOLT11_20U },
    });
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query: vi.fn(),
        publish: vi.fn(),
        httpGet,
      },
    });

    await expect(
      fetchInvoice({
        zapEndpoint: 'https://ln.example/callback',
        amount: BOLT11_20U_AMOUNT_MSATS,
        authorId: '44'.repeat(32),
        normalizedRelays: RELAYS,
        anon: true,
      }),
    ).resolves.toBe(BOLT11_20U);
    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(String(httpGet.mock.calls[0][0])).toContain(
      `https://ln.example/callback?amount=${BOLT11_20U_AMOUNT_MSATS}&nostr=`,
    );
  });

  it('rejects an invoice for a different amount', async () => {
    const httpGet = vi.fn().mockResolvedValue({
      status: 200,
      json: { pr: BOLT11_20U },
    });
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query: vi.fn(),
        publish: vi.fn(),
        httpGet,
      },
    });

    await expect(
      fetchInvoice({
        zapEndpoint: 'https://ln.example/callback',
        amount: 21_000,
        authorId: '45'.repeat(32),
        normalizedRelays: RELAYS,
        anon: true,
      }),
    ).rejects.toThrow('LNURL invoice amount does not match requested amount');
  });

  it('rejects a malformed invoice from the LNURL endpoint', async () => {
    const httpGet = vi.fn().mockResolvedValue({
      status: 200,
      json: { pr: 'lnbc1not-an-invoice' },
    });
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: {
        query: vi.fn(),
        publish: vi.fn(),
        httpGet,
      },
    });

    await expect(
      fetchInvoice({
        zapEndpoint: 'https://ln.example/callback',
        amount: 21_000,
        authorId: '46'.repeat(32),
        normalizedRelays: RELAYS,
        anon: true,
      }),
    ).rejects.toThrow('LNURL endpoint returned an invalid invoice');
  });

  it('polls for a zap receipt through the host transport and stops on cleanup', async () => {
    vi.useFakeTimers();
    const pubkey = 'a'.repeat(64);
    const query = vi.fn().mockResolvedValue([]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    const cleanup = listenForZapReceipt({
      relays: RELAYS,
      receiversPubKey: pubkey,
      invoice: 'lnbc-test',
      provider: {
        lnurl: 'https://example.com/.well-known/lnurlp/creator',
        callback: 'https://example.com/callback',
        nostrPubkey: 'b'.repeat(64),
      },
      onSuccess: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(query).toHaveBeenCalledWith(RELAYS, {
      kinds: [9735],
      '#p': [pubkey],
      since: expect.any(Number),
      limit: 100,
    });

    cleanup();
    await vi.advanceTimersByTimeAsync(6000);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('ignores a pending transport result after cleanup', async () => {
    vi.useFakeTimers();
    let resolveQuery: ((events: any[]) => void) | undefined;
    const query = vi.fn(
      () => new Promise<any[]>((resolve) => {
        resolveQuery = resolve;
      }),
    );
    const validateReceipt = vi
      .spyOn(zapReceiptModule, 'validateZapReceipt')
      .mockReturnValue({
        ok: true,
        amountMsats: 1000,
        zapRequest: {} as any,
      });
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });
    const onSuccess = vi.fn();

    const cleanup = listenForZapReceipt({
      relays: RELAYS,
      receiversPubKey: 'e'.repeat(64),
      invoice: 'lnbc-cleanup',
      provider: {
        lnurl: 'https://example.com/.well-known/lnurlp/creator',
        callback: 'https://example.com/callback',
        nostrPubkey: 'f'.repeat(64),
      },
      onSuccess,
    });

    await vi.advanceTimersByTimeAsync(0);
    cleanup();
    resolveQuery?.([{ tags: [['bolt11', 'lnbc-cleanup']] }]);
    await Promise.resolve();

    expect(validateReceipt).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('stops transport receipt polling after the payment-attempt deadline', async () => {
    vi.useFakeTimers();
    const query = vi.fn().mockResolvedValue([]);
    Object.assign(globalThis, {
      __nostrComponentsRelayTransport: { query, publish: vi.fn() },
    });

    listenForZapReceipt({
      relays: RELAYS,
      receiversPubKey: 'c'.repeat(64),
      invoice: 'lnbc-expiring',
      provider: {
        lnurl: 'https://example.com/.well-known/lnurlp/creator',
        callback: 'https://example.com/callback',
        nostrPubkey: 'd'.repeat(64),
      },
      onSuccess: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 3000);
    const callsAtDeadline = query.mock.calls.length;
    expect(callsAtDeadline).toBeGreaterThan(1);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(query).toHaveBeenCalledTimes(callsAtDeadline);
  });
});
