// SPDX-License-Identifier: MIT

import { bindTrustedActionContext } from '../../src/common/trusted-action-context';

export const COMPONENT_HYDRATION_EVENT_PREFIX = 'nostr-components-hydrate:';

const NPUB_PATTERN = /^npub1[023456789acdefghjklmnpqrstuvwxyz]{58}$/;

function normalizeContext(value) {
  if (
    !value ||
    (value.kind !== 'x' && value.kind !== 'youtube') ||
    typeof value.url !== 'string' ||
    !value.url.startsWith('https://')
  ) {
    return null;
  }
  const recipientNpub =
    typeof value.recipientNpub === 'string' &&
    NPUB_PATTERN.test(value.recipientNpub)
      ? value.recipientNpub
      : null;
  return {
    kind: value.kind,
    url: value.url,
    theme: value.theme === 'dark' ? 'dark' : 'light',
    recipientNpub: recipientNpub,
  };
}

function bindContext(component, context) {
  bindTrustedActionContext(component, {
    kind: context.kind,
    url: context.url,
    recipientNpub: context.recipientNpub,
  });
}

function setCommonAttributes(component, context) {
  component.setAttribute('url', context.url);
  component.setAttribute('compact', '');
  component.setAttribute('data-theme', context.theme);
  if (context.kind === 'youtube') {
    component.setAttribute('data-surface', 'youtube');
  }
}

function constructRegisteredElement(registry, tagName) {
  const ComponentConstructor = registry?.get(tagName);
  return typeof ComponentConstructor === 'function'
    ? new ComponentConstructor()
    : null;
}

/**
 * Hydrate one isolated-world action slot from the page's MAIN world.
 *
 * YouTube's custom-elements-es5-adapter breaks document.createElement() for
 * native class-based third-party elements. Constructing the registered class
 * with `new` bypasses that adapter path.
 */
export function hydrateActionSlot(
  slot,
  suppliedContext,
  registry = globalThis.customElements,
) {
  if (!slot) return false;
  const context = normalizeContext(suppliedContext);
  if (!context) return false;

  let like = slot.querySelector('nostr-like-button');
  if (!like) {
    like = constructRegisteredElement(registry, 'nostr-like-button');
    if (!like) return false;
    bindContext(like, context);
    setCommonAttributes(like, context);
    slot.appendChild(like);
  } else {
    bindContext(like, context);
    setCommonAttributes(like, context);
  }

  const recipientNpub = context.recipientNpub;
  let zap = slot.querySelector('nostr-zap-button');
  if (!recipientNpub) {
    zap?.remove();
    return true;
  }

  const shouldAppendZap = !zap;
  if (shouldAppendZap) {
    zap = constructRegisteredElement(registry, 'nostr-zap-button');
    if (!zap) return false;
  }
  bindContext(zap, context);
  setCommonAttributes(zap, context);
  zap.setAttribute('npub', recipientNpub);
  if (shouldAppendZap) slot.appendChild(zap);
  return true;
}

export function installComponentHydrator({
  channel,
  root = globalThis.document,
  registry = globalThis.customElements,
} = {}) {
  if (!/^[0-9a-f]{64}$/.test(String(channel || ''))) {
    throw new Error('Invalid component hydration channel');
  }

  const eventName = COMPONENT_HYDRATION_EVENT_PREFIX + channel;
  const handler = function (event) {
    hydrateActionSlot(event.target, event.detail, registry);
  };
  root.addEventListener(eventName, handler, true);

  return Object.freeze({
    eventName: eventName,
    dispose: function () {
      root.removeEventListener(eventName, handler, true);
    },
  });
}
