// SPDX-License-Identifier: MIT

import '../../src/nostr-like-button/nostr-like';
import '../../src/nostr-zap-button/nostr-zap';
import { installRelayTransport } from '../../src/common/relay-transport';
import { installComponentHydrator } from './component-hydrator';
import {
  createMainRelayTransport,
  createRelayChannels,
  RELAY_BOOTSTRAP_EVENT,
} from './main-relay-transport';

const { relayChannel, hydrationChannel } = createRelayChannels();

installRelayTransport(createMainRelayTransport(relayChannel));
installComponentHydrator({ channel: hydrationChannel });

// Both static content-script worlds run at document_start, before page scripts.
// Dispatch synchronously after the isolated listener is installed, then keep
// both channels only in their respective lexical scopes.
document.dispatchEvent(
  new CustomEvent(RELAY_BOOTSTRAP_EVENT, {
    detail: Object.freeze({ relayChannel, hydrationChannel }),
  }),
);
