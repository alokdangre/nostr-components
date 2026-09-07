// SPDX-License-Identifier: MIT

import { describe, expect, it, vi } from 'vitest';
import {
  addNativeEventListener,
  isTrustedUserEvent,
  removeNativeEventListener,
} from '../trusted-user-activation';

describe('trusted user activation helpers', () => {
  it('rejects programmatically dispatched events', () => {
    expect(isTrustedUserEvent(new Event('click'))).toBe(false);
  });

  it('uses captured listener intrinsics after page-level monkeypatching', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    Object.defineProperty(EventTarget.prototype, 'addEventListener', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('page intercepted addEventListener');
      }),
    });
    Object.defineProperty(EventTarget.prototype, 'removeEventListener', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('page intercepted removeEventListener');
      }),
    });

    try {
      addNativeEventListener(target, 'test', listener);
      target.dispatchEvent(new Event('test'));
      removeNativeEventListener(target, 'test', listener);
      target.dispatchEvent(new Event('test'));
    } finally {
      Object.defineProperty(EventTarget.prototype, 'addEventListener', {
        configurable: true,
        value: originalAdd,
      });
      Object.defineProperty(EventTarget.prototype, 'removeEventListener', {
        configurable: true,
        value: originalRemove,
      });
    }

    expect(listener).toHaveBeenCalledOnce();
  });
});
