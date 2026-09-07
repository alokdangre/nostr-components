// SPDX-License-Identifier: MIT

if (typeof importScripts === 'function') {
  importScripts('lib/zap-http.js');
}

const DIRECTORY_LOOKUP_ENDPOINT =
  'https://us-central1-gr-prod.cloudfunctions.net/lookupDirectoryHandle';
const LOOKUP_TIMEOUT_MS = 5000;
const ZAP_HTTP_TIMEOUT_MS = 10000;
const ZAP_HTTP_MAX_BYTES = 64 * 1024;
const RELAY_CHANNEL_PATTERN = /^[0-9a-f]{64}$/;

function getExecutionTarget(sender) {
  if (
    !sender ||
    !sender.tab ||
    !Number.isInteger(sender.tab.id) ||
    !chrome.scripting ||
    typeof chrome.scripting.executeScript !== 'function'
  ) {
    throw new Error('Nostr component injection is unavailable');
  }

  if (typeof sender.url !== 'string' || !Number.isInteger(sender.frameId)) {
    throw new Error('Nostr component injection requires a validated sender frame');
  }

  const senderUrl = new URL(sender.url);
  if (
    senderUrl.protocol !== 'https:' ||
    senderUrl.port !== '' ||
    ![
      'x.com',
      'twitter.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtube.com'
    ].includes(senderUrl.hostname)
  ) {
    throw new Error('Nostr component injection is restricted to supported sites');
  }

  return { tabId: sender.tab.id, frameIds: [sender.frameId] };
}

function installRelayTransport(channel, hydrationChannel) {
  const requestSource = 'nostr-components-relay-main';
  const responseSource = 'nostr-components-relay-extension';
  const transportKey = '__nostrComponentsRelayTransport';
  const authContext = 'nostr-components-relay-v1';
  const requestIdPattern = /^[0-9a-f]{32}$/;
  const messageMacPattern = /^[0-9a-f]{64}$/;
  const existingDescriptor = Object.getOwnPropertyDescriptor(globalThis, transportKey);
  if (existingDescriptor && !existingDescriptor.configurable) {
    throw new Error('Relay transport slot is already locked');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is required for the relay bridge');
  }

  const subtle = globalThis.crypto.subtle;
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  const encoder = new TextEncoder();
  const stringify = JSON.stringify.bind(JSON);
  const parse = JSON.parse.bind(JSON);
  const cloneValue =
    typeof globalThis.structuredClone === 'function'
      ? globalThis.structuredClone.bind(globalThis)
      : function (value) {
          return parse(stringify(value));
        };
  const PromiseConstructor = Promise;
  const pending = new Map();
  const pageOrigin = window.location.origin;
  const postMessage = window.postMessage.bind(window);
  const addEventListener = window.addEventListener.bind(window);

  function authPayload(type, message) {
    if (type === 'request') {
      return stringify([
        authContext,
        'request',
        message.requestId,
        message.operation,
        message.payload
      ]);
    }
    return stringify([
      authContext,
      'response',
      message.requestId,
      message.requestMac,
      message.ok === true,
      message.ok === true ? message.result : null,
      message.ok === true ? null : String(message.error || 'Relay request failed')
    ]);
  }

  function hexToBytes(value) {
    const bytes = new Uint8Array(value.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  function bytesToHex(value) {
    return Array.from(new Uint8Array(value), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  const keyPromise = subtle.importKey(
    'raw',
    hexToBytes(channel),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

  async function signRequest(message) {
    const key = await keyPromise;
    const mac = await subtle.sign(
      'HMAC',
      key,
      encoder.encode(authPayload('request', message))
    );
    return bytesToHex(mac);
  }

  async function verifyResponse(message) {
    if (!messageMacPattern.test(String(message?.mac || ''))) return false;
    const key = await keyPromise;
    return subtle.verify(
      'HMAC',
      key,
      hexToBytes(message.mac),
      encoder.encode(authPayload('response', message))
    );
  }

  function createRequestId() {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    return Array.from(bytes, function (value) {
      return value.toString(16).padStart(2, '0');
    }).join('');
  }

  async function onMessage(event) {
    const candidate = event.data;
    if (
      event.source !== window ||
      event.origin !== pageOrigin ||
      !candidate ||
      candidate.source !== responseSource ||
      !requestIdPattern.test(String(candidate.requestId || '')) ||
      !messageMacPattern.test(String(candidate.requestMac || '')) ||
      !messageMacPattern.test(String(candidate.mac || '')) ||
      !pending.has(candidate.requestId)
    ) {
      return;
    }

    let message;
    try {
      message = cloneValue(candidate);
    } catch (_error) {
      return;
    }
    if (
      !message ||
      message.source !== responseSource ||
      !requestIdPattern.test(String(message.requestId || '')) ||
      !messageMacPattern.test(String(message.requestMac || '')) ||
      !messageMacPattern.test(String(message.mac || '')) ||
      !pending.has(message.requestId)
    ) {
      return;
    }

    let authenticated = false;
    try {
      authenticated = await verifyResponse(message);
    } catch (_error) {
      return;
    }
    if (!authenticated || !pending.has(message.requestId)) return;

    const request = pending.get(message.requestId);
    if (request.requestMac !== message.requestMac) return;
    pending.delete(message.requestId);
    clearTimeout(request.timeoutId);
    if (message.ok === true) {
      request.resolve(message.result);
    } else {
      request.reject(new Error(message.error || 'Relay request failed'));
    }
  }

  async function request(operation, payload) {
    const requestId = createRequestId();
    const message = {
      source: requestSource,
      requestId: requestId,
      operation: operation,
      payload: cloneValue(payload)
    };
    message.mac = await signRequest(message);

    return new PromiseConstructor(function (resolve, reject) {
      const timeoutId = setTimeout(
        function () {
          pending.delete(requestId);
          reject(new Error('Relay request timed out'));
        },
        operation === 'publish' || operation === 'httpGet' ? 12000 : 4000
      );
      pending.set(requestId, {
        resolve: resolve,
        reject: reject,
        requestMac: message.mac,
        timeoutId: timeoutId
      });
      postMessage(message, pageOrigin);
    });
  }

  addEventListener('message', onMessage);
  const transport = Object.freeze({
    hydrationChannel: hydrationChannel,
    query: function (relays, filter) {
      return request('query', { relays: relays, filter: filter });
    },
    getCachedLikeState: function (relays, url) {
      return request('getCachedLikeState', { relays: relays, url: url });
    },
    getLikeState: function (relays, url) {
      return request('getLikeState', { relays: relays, url: url });
    },
    publish: function (relays, event) {
      return request('publish', { relays: relays, event: event });
    },
    httpGet: function (url) {
      return request('httpGet', { url: url });
    }
  });
  Object.defineProperty(globalThis, transportKey, {
    value: transport,
    writable: false,
    configurable: false,
    enumerable: false
  });
}

async function injectComponents(message, sender) {
  if (
    !RELAY_CHANNEL_PATTERN.test(String(message.channel || '')) ||
    !RELAY_CHANNEL_PATTERN.test(String(message.hydrationChannel || ''))
  ) {
    throw new Error('Invalid relay bridge channel');
  }

  const target = getExecutionTarget(sender);
  await chrome.scripting.executeScript({
    target: target,
    func: installRelayTransport,
    args: [message.channel, message.hydrationChannel],
    world: 'MAIN'
  });
  await chrome.scripting.executeScript({
    target: target,
    files: ['lib/nostr-extension-components.js'],
    world: 'MAIN'
  });
  return true;
}

function normalizeHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

async function lookupDirectoryHandle(message) {
  const handle = normalizeHandle(message.handle);
  if (!handle) {
    throw new Error('Invalid X handle');
  }

  const url = new URL(DIRECTORY_LOOKUP_ENDPOINT);
  url.searchParams.set('platform', 'twitter');
  url.searchParams.set('handle', handle);

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    const result = await response.json();
    if (response.status === 404 && result && result.found === false) {
      return result;
    }
    if (!response.ok) {
      throw new Error('Directory lookup failed with status ' + response.status);
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAllowedRequestSender(sender) {
  if (!sender || typeof sender.url !== 'string') return false;
  try {
    const senderUrl = new URL(sender.url);
    return (
      senderUrl.protocol === 'https:' &&
      senderUrl.port === '' &&
      [
        'x.com',
        'twitter.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtube.com'
      ].includes(senderUrl.hostname)
    );
  } catch (_error) {
    return false;
  }
}

async function fetchHttpsJson(message, sender) {
  if (!isAllowedRequestSender(sender)) {
    throw new Error('HTTPS fetch is restricted to supported sites');
  }

  const normalized = globalThis.NostrLikeExtension?.zapHttp?.normalizeZapHttpUrl(message.url);
  if (!normalized) {
    throw new Error('HTTPS request contains an unsupported URL');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, ZAP_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(normalized, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal
    });
    const text = await response.text();
    if (text.length > ZAP_HTTP_MAX_BYTES) {
      throw new Error('HTTPS response is too large');
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_error) {
      throw new Error('Invalid JSON from HTTPS endpoint');
    }
    return { status: response.status, json: json };
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message) {
    return false;
  }

  let operation;
  if (message.type === 'LOOKUP_DIRECTORY_HANDLE') {
    operation = lookupDirectoryHandle(message);
  } else if (message.type === 'INJECT_NOSTR_COMPONENTS') {
    operation = injectComponents(message, sender);
  } else if (message.type === 'FETCH_HTTPS_JSON') {
    operation = fetchHttpsJson(message, sender);
  } else {
    return false;
  }

  operation.then(
    function (result) {
      sendResponse({ ok: true, result: result });
    },
    function (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Extension request failed'
      });
    }
  );

  return true;
});
