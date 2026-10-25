import { useLayoutEffect, useRef } from 'react';

/**
 * New content starts at the top: when `key` changes (a tab, class or enemy picked), scroll the
 * pop-up body this element sits in, or the element itself, back to the top. Attach the returned
 * ref to the modal body or to any element inside it.
 */
export function useScrollToTop<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    (el?.closest('.modal-body') ?? el)?.scrollTo({ top: 0 });
  }, [key]);
  return ref;
}
