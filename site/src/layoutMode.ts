const MOBILE_LAYOUT_BREAKPOINT = 668;
const MIN_SIDE_IMAGE_WIDTH = 180;
const MAX_SIDE_IMAGE_WIDTH = 320;
// Keep the desktop layout until the reading lane is genuinely tight.
const MIN_DESKTOP_CONTENT_WIDTH = 400;

const clamp = (min: number, value: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getSideImageWidth = (viewportWidth: number) =>
  clamp(MIN_SIDE_IMAGE_WIDTH, viewportWidth * 0.24, MAX_SIDE_IMAGE_WIDTH);

export const shouldUseCompactLayout = (viewportWidth: number) => {
  if (viewportWidth <= MOBILE_LAYOUT_BREAKPOINT) {
    return true;
  }

  const sideImageWidth = getSideImageWidth(viewportWidth);
  const contentLaneWidth = viewportWidth - (2 * sideImageWidth);

  return contentLaneWidth < MIN_DESKTOP_CONTENT_WIDTH;
};
