// Núcleo do VersaEdit — TypeScript puro, sem React. Vira @versaedit/core na v0.2.
export {
  VersaEditCore,
  type ContentLimit,
  type CoreCallbacks,
  type CoreOptions,
  type ObjectState,
  type Point,
  type SelectionStyle,
  type SelectionType,
  type TbBorderStyle,
  type TextboxBorder,
} from './editor'
export * from './defaults'
export {
  createFrameResizer,
  DEFAULT_FRAME_HANDLES,
  type FrameHandle,
  type FrameLimits,
  type FrameResizePhase,
  type FrameResizer,
  type FrameResizerOptions,
  type FrameSize,
} from './frame-resize'
export { format, resolveLabels, type VersaEditLabels, type VersaEditLocale } from './i18n'
export { injectStyles } from './styles'
export * from './speech'
export { escapeHtml, isSafeUrl, purifyHtml, sanitizeHtml } from './sanitize'
