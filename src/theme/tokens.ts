// TS re-export of colors.js for RN APIs that can't consume a NativeWind className
// (native Alert, status bar style, SVG fill, etc.) — keep in sync with colors.js by hand
// until a NativeWind v5 migration brings runtime CSS-variable theming.
import colors from './colors.js';

export { colors };

export type ColorScale = typeof colors.primary;
