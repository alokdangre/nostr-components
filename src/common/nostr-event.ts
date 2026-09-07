// SPDX-License-Identifier: MIT

import type { Event } from 'nostr-tools';
import { verifyEvent } from 'nostr-tools';

/**
 * Verify a symbol-free copy so nostr-tools cannot reuse cached verification
 * state from an object that was mutated after an earlier check.
 */
export function cloneVerifiedEvent(value: unknown): Event | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Partial<Event>;
  if (
    typeof event.id !== 'string' ||
    typeof event.pubkey !== 'string' ||
    typeof event.created_at !== 'number' ||
    !Number.isInteger(event.created_at) ||
    typeof event.kind !== 'number' ||
    !Number.isInteger(event.kind) ||
    typeof event.content !== 'string' ||
    typeof event.sig !== 'string' ||
    !Array.isArray(event.tags) ||
    event.tags.some(
      tag =>
        !Array.isArray(tag) ||
        tag.some(value => typeof value !== 'string'),
    )
  ) {
    return null;
  }

  const candidate: Event = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map(tag => [...tag]),
    content: event.content,
    sig: event.sig,
  };
  try {
    return verifyEvent(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
