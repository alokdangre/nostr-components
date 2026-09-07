// SPDX-License-Identifier: MIT

(function () {
  const extension = globalThis.NostrLikeExtension = globalThis.NostrLikeExtension || {};
  const HYDRATION_EVENT_PREFIX = 'nostr-components-hydrate:';
  const RELAY_BOOTSTRAP_EVENT = 'nostr-components-relay-bootstrap:v2';
  const CHANNEL_PATTERN = /^[0-9a-f]{64}$/;
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

  function hydrate(slot) {
    if (!hydrationEventName) {
      throw new Error('MAIN-world component bridge is not ready');
    }
    slot.dispatchEvent(new Event(hydrationEventName, { bubbles: true }));
    if (!slot.querySelector('nostr-like-button')) {
      throw new Error('MAIN-world component hydrator did not create Nostr Like');
    }
    return true;
  }

  extension.componentLoader = {
    ready: ready,
    hydrate: hydrate
  };
})();
