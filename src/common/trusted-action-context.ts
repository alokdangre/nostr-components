// SPDX-License-Identifier: MIT

export interface TrustedActionContext {
  actionId: string;
  kind: 'x' | 'youtube';
  url: string;
  recipientNpub: string | null;
}

const contexts = new WeakMap<HTMLElement, Readonly<TrustedActionContext>>();
const setContext = contexts.set.bind(contexts);
const getContext = contexts.get.bind(contexts);
const deleteContext = contexts.delete.bind(contexts);
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
      actionId: context.actionId,
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

export function revokeTrustedActionContext(component: HTMLElement): void {
  deleteContext(component);
}
