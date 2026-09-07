// SPDX-License-Identifier: MIT

export interface TrustedActionContext {
  kind: 'x' | 'youtube';
  url: string;
  recipientNpub: string | null;
}

const contexts = new WeakMap<HTMLElement, Readonly<TrustedActionContext>>();
const setContext = contexts.set.bind(contexts);
const getContext = contexts.get.bind(contexts);
const freeze = Object.freeze.bind(Object);

/**
 * Bind authority supplied by the extension's isolated world to one component.
 * The WeakMap is private to the statically loaded MAIN-world bundle.
 */
export function bindTrustedActionContext(
  component: HTMLElement,
  context: TrustedActionContext,
): void {
  setContext(
    component,
    freeze({
      kind: context.kind,
      url: context.url,
      recipientNpub: context.recipientNpub,
    }),
  );
}

export function getTrustedActionContext(
  component: HTMLElement,
): Readonly<TrustedActionContext> | null {
  return getContext(component) || null;
}
