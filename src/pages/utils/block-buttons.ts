// Keep compatibility and visibility semantics in sync with dom-web/src/lib/blockButtons.ts.
/** A present array (even empty) overrides the legacy single button. */
export function getHeroItemButtons<T>(item: {
  buttons?: T[];
  button?: T;
}): T[] {
  return item.buttons ?? (item.button ? [item.button] : []);
}

/** Keep the authored array/legacy shape while replacing resolved buttons. */
export function withHeroItemButtons<T extends { buttons?: B[]; button?: B }, B>(
  item: T,
  buttons: B[],
) {
  return item.buttons !== undefined
    ? { ...item, button: undefined, buttons }
    : { ...item, button: buttons[0] };
}

/** Omitted visibility preserves existing authored content. */
export function isButtonVisible(button: { isVisible?: boolean }): boolean {
  return button?.isVisible !== false;
}
