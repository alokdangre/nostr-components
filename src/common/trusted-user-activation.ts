// SPDX-License-Identifier: MIT

const eventTargetPrototype = globalThis.EventTarget?.prototype;
const nativeAddEventListener = eventTargetPrototype?.addEventListener
  ? Function.call.bind(eventTargetPrototype.addEventListener)
  : null;
const nativeRemoveEventListener = eventTargetPrototype?.removeEventListener
  ? Function.call.bind(eventTargetPrototype.removeEventListener)
  : null;
const trustedGetter = Object.getOwnPropertyDescriptor(
  globalThis.Event?.prototype || {},
  'isTrusted',
)?.get;
const readTrusted = trustedGetter
  ? Function.call.bind(trustedGetter)
  : null;

export function isTrustedUserEvent(event: Event): boolean {
  try {
    return readTrusted
      ? readTrusted(event) === true
      : event.isTrusted === true;
  } catch {
    return false;
  }
}

export function addNativeEventListener(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): void {
  if (nativeAddEventListener) {
    nativeAddEventListener(target, type, listener, options);
  } else {
    target.addEventListener(type, listener, options);
  }
}

export function removeNativeEventListener(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | EventListenerOptions,
): void {
  if (nativeRemoveEventListener) {
    nativeRemoveEventListener(target, type, listener, options);
  } else {
    target.removeEventListener(type, listener, options);
  }
}
