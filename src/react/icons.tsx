import React from 'react'

// Ícones próprios da barra de ferramentas: traço na cor do texto (currentColor),
// 16 × 16 px, sem dependência de bibliotecas de ícones.
const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    className="ve-icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

export const IconSave = () => (
  <Svg>
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M8 3v5h7V3" />
    <rect x="8" y="13" width="8" height="6" />
  </Svg>
)
export const IconOpen = () => (
  <Svg>
    <path d="M3 7V5h6l2 2h8v3" />
    <path d="M3 7v12h15l3-9H6l-3 9" />
  </Svg>
)
export const IconUndo = () => (
  <Svg>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
)
export const IconRedo = () => (
  <Svg>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </Svg>
)
export const IconBold = () => (
  <Svg>
    <path d="M7 4h7a4 4 0 0 1 0 8H7z" />
    <path d="M7 12h8a4 4 0 0 1 0 8H7z" />
  </Svg>
)
export const IconItalic = () => (
  <Svg>
    <path d="M10 4h8M6 20h8M15 4 9 20" />
  </Svg>
)
export const IconUnderline = () => (
  <Svg>
    <path d="M7 4v7a5 5 0 0 0 10 0V4" />
    <path d="M5 21h14" />
  </Svg>
)
export const IconTextColor = () => (
  <Svg>
    <path d="m6 16 6-12 6 12M8.5 11h7" />
    <path d="M4 21h16" strokeWidth="3" />
  </Svg>
)
export const IconPaper = () => (
  <Svg>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Svg>
)
export const IconAlignLeft = () => (
  <Svg>
    <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
  </Svg>
)
export const IconAlignCenter = () => (
  <Svg>
    <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />
  </Svg>
)
export const IconAlignRight = () => (
  <Svg>
    <path d="M4 6h16M10 10h10M4 14h16M10 18h10" />
  </Svg>
)
export const IconBulletList = () => (
  <Svg>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </Svg>
)
export const IconIndent = () => (
  <Svg>
    <path d="M4 5h16M11 10h9M11 14h9M4 19h16" />
    <path d="m4 9 3 3-3 3" />
  </Svg>
)
export const IconOutdent = () => (
  <Svg>
    <path d="M4 5h16M11 10h9M11 14h9M4 19h16" />
    <path d="M7 9 4 12l3 3" />
  </Svg>
)
export const IconLink = () => (
  <Svg>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Svg>
)
export const IconUnlink = () => (
  <Svg>
    <path d="M15 7.5 16.5 6a3.5 3.5 0 0 1 5 5L20 12.5M9 16.5 7.5 18a3.5 3.5 0 0 1-5-5L4 11.5" />
    <path d="m3 3 18 18" />
  </Svg>
)
export const IconHr = () => (
  <Svg>
    <path d="M3 12h18" />
    <path d="M8 6h8M8 18h8" strokeOpacity="0.4" />
  </Svg>
)
export const IconImage = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </Svg>
)
export const IconTextbox = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="1" strokeDasharray="3 2" />
    <path d="M8 9h8M12 9v7" />
  </Svg>
)
export const IconBorderColor = () => (
  <Svg>
    <path d="m14 4 6 6-9 9H5v-6z" />
  </Svg>
)
export const IconTrash = () => (
  <Svg>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
)
export const IconClearFormat = () => (
  <Svg>
    <path d="M6 4h12M12 4l-4 16" />
    <path d="m15 14 6 6M21 14l-6 6" />
  </Svg>
)
export const IconMic = () => (
  <Svg>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
  </Svg>
)
