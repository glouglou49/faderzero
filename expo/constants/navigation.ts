export const FLOATING_TAB_BAR_BASE_HEIGHT = 76;
export const FLOATING_TAB_BAR_FALLBACK_BOTTOM_INSET = 12;
export const FLOATING_TAB_BAR_CONTENT_GAP = 20;
export const MODAL_MIN_BOTTOM_SPACING = 16;
export const MODAL_FOOTER_EXTRA_SPACING = 8;

export function getFloatingTabBarHeight(bottomInset: number) {
  return FLOATING_TAB_BAR_BASE_HEIGHT + bottomInset;
}

export function getFloatingTabBarContentPadding(bottomInset: number) {
  const safeBottomInset =
    bottomInset > 0 ? bottomInset : FLOATING_TAB_BAR_FALLBACK_BOTTOM_INSET;

  return (
    FLOATING_TAB_BAR_BASE_HEIGHT +
    safeBottomInset +
    FLOATING_TAB_BAR_CONTENT_GAP
  );
}

export function getModalBottomOffset(bottomInset: number) {
  return Math.max(bottomInset, MODAL_MIN_BOTTOM_SPACING);
}

export function getModalFooterBottomPadding(bottomInset: number) {
  return getModalBottomOffset(bottomInset) + MODAL_FOOTER_EXTRA_SPACING;
}
