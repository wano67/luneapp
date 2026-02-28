export const WALLET_REFRESH_EVENT = 'wallet:refresh';

export function emitWalletRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WALLET_REFRESH_EVENT));
}

export function onWalletRefresh(handler: () => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(WALLET_REFRESH_EVENT, listener);
  return () => window.removeEventListener(WALLET_REFRESH_EVENT, listener);
}
