export { default as VersaEdit, default } from './react/VersaEdit'
export type { VersaEditHandle, VersaEditProps } from './react/VersaEdit'
export type { VersaEditLabels, VersaEditLocale } from './core/i18n'
export type { FontFamilyOption, FrameOptions } from './core/defaults'
export {
  DEFAULT_COLOR_PALETTE,
  DEFAULT_FONT_FAMILIES,
  DEFAULT_FONT_SIZES,
  DEFAULT_HIGHLIGHT_COLORS,
} from './core/defaults'
// Núcleo sem React, para quem quiser montar a própria interface
export { VersaEditCore } from './core/editor'
export type {
  CoreCallbacks,
  CoreOptions,
  ObjectState,
  SelectionStyle,
  TextboxBorder,
} from './core/editor'
