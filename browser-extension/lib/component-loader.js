// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const HYDRATION_EVENT_PREFIX = 'nostr-components-hydrate:';
  const RELAY_BOOTSTRAP_EVENT = 'nostr-components-relay-bootstrap:v2';
  const CHANNEL_PATTERN = /^[0-9a-f]{64}$/;
  const actionContexts = new WeakMap();
  let hydrationEventName = null;
  let resolveReady;
  let rejectReady;
  const ready = new Promise(function (resolve, reject) {
    resolveReady = resolve;
    rejectReady = reject;
  });

  function receiveBootstrap(event) {
    const relayChannel = String(event.detail?.relayChannel || '');
    const hydrationChannel = String(event.detail?.hydrationChannel || '');
    if (
      event.target !== document ||
      !CHANNEL_PATTERN.test(relayChannel) ||
      !CHANNEL_PATTERN.test(hydrationChannel)
    ) {
      return;
    }

    document.removeEventListener(RELAY_BOOTSTRAP_EVENT, receiveBootstrap, true);
    try {
      extension.relayClient.configure(relayChannel);
      hydrationEventName = HYDRATION_EVENT_PREFIX + hydrationChannel;
      resolveReady(true);
    } catch (error) {
      rejectReady(error);
    }
  }

  document.addEventListener(RELAY_BOOTSTRAP_EVENT, receiveBootstrap, true);

  function registerAction(slot, context) {
    if (
      !slot ||
      !context ||
      (context.kind !== 'x' && context.kind !== 'youtube') ||
      !extension.relayClient.isAllowedContentUrl(context.url)
    ) {
      throw new Error('Invalid isolated action context');
    }
    actionContexts.set(slot, {
      kind: context.kind,
      url: context.url,
      theme: context.theme === 'dark' ? 'dark' : 'light',
      recipientNpub: extension.url.isValidNpub(context.recipientNpub)
        ? context.recipientNpub
        : null
    });
  }

  function updateAction(slot, patch) {
    const current = actionContexts.get(slot);
    if (!current) {
      throw new Error('Unknown isolated action slot');
    }
    registerAction(slot, {
      ...current,
      ...patch
    });
  }

  function hydrate(slot) {
    if (!hydrationEventName) {
      throw new Error('MAIN-world component bridge is not ready');
    }
    const context = actionContexts.get(slot);
    if (!context) {
      throw new Error('Unknown isolated action slot');
    }
    slot.dispatchEvent(new CustomEvent(hydrationEventName, {
      bubbles: true,
      detail: Object.freeze({ ...context })
    }));
    if (!slot.querySelector('nostr-like-button')) {
      throw new Error('MAIN-world component hydrator did not create Nostr Like');
    }
    return true;
  }

  extension.componentLoader = {
    ready: ready,
    registerAction: registerAction,
    updateAction: updateAction,
    hydrate: hydrate
  };
})();
