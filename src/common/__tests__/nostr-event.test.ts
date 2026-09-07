// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import {
  finalizeEvent,
  verifiedSymbol,
} from 'nostr-tools';
import { cloneVerifiedEvent } from '../nostr-event';

describe('cloneVerifiedEvent', () => {
  it('ignores an inherited nostr-tools verification cache value', () => {
    const signed = finalizeEvent(
      {
        kind: 0,
        created_at: 1,
        tags: [],
        content: '{"name":"alice"}',
      },
      new Uint8Array(32).fill(7),
    );
    const forged = {
      id: signed.id,
      pubkey: signed.pubkey,
      created_at: signed.created_at,
      kind: signed.kind,
      tags: signed.tags.map(tag => [...tag]),
      content: '{"name":"mallory"}',
      sig: signed.sig,
    };

    Object.defineProperty(Object.prototype, verifiedSymbol, {
      configurable: true,
      value: true,
    });
    try {
      expect(cloneVerifiedEvent(forged)).toBeNull();
      const verified = cloneVerifiedEvent(signed);
      expect(verified).not.toBeNull();
      expect(
        Object.prototype.hasOwnProperty.call(verified!, verifiedSymbol),
      ).toBe(true);
    } finally {
      delete (Object.prototype as Record<PropertyKey, unknown>)[
        verifiedSymbol
      ];
    }
  });
});
