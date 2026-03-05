import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';
let previousPosition = '';
let previousTop = '';
let previousWidth = '';
let previousPaddingRight = '';
let previousHtmlOverflow = '';
let scrollY = 0;

function applyLock() {
  if (typeof document === 'undefined') return;
  const { body } = document;
  const root = document.documentElement;
  if (lockCount === 0) {
    previousOverflow = body.style.overflow;
    previousPosition = body.style.position;
    previousTop = body.style.top;
    previousWidth = body.style.width;
    previousPaddingRight = body.style.paddingRight;
    previousHtmlOverflow = root.style.overflow;
    scrollY = window.scrollY;

    const scrollbarWidth = window.innerWidth - root.clientWidth;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    root.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function releaseLock() {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    const { body } = document;
    body.style.overflow = previousOverflow;
    body.style.position = previousPosition;
    body.style.top = previousTop;
    body.style.width = previousWidth;
    body.style.paddingRight = previousPaddingRight;
    document.documentElement.style.overflow = previousHtmlOverflow;
    window.scrollTo(0, scrollY);
  }
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    applyLock();
    return () => releaseLock();
  }, [active]);
}

export function lockBodyScroll() {
  applyLock();
}

export function unlockBodyScroll() {
  releaseLock();
}
