export type IconName =
  | 'trash'
  | 'close'
  | 'plus'
  | 'fork'
  | 'drop'
  | 'run'
  | 'dumbbell'
  | 'scale'
  | 'heart'
  | 'sun'
  | 'list'
  | 'chart'
  | 'person'
  | 'check'
  | 'chevron'
  | 'sparkle'
  | 'send'
  | 'undo'
  | 'chat'
  | 'pencil'

const PATHS: Record<IconName, JSX.Element> = {
  trash: <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6.5 7l.9 12.1A2 2 0 0 0 9.4 21h5.2a2 2 0 0 0 2-1.9L17.5 7M10 11v6M14 11v6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  fork: <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4" />,
  drop: <path d="M12 2.5S5.5 9.4 5.5 14.2a6.5 6.5 0 0 0 13 0C18.5 9.4 12 2.5 12 2.5Z" />,
  run: (
    <>
      <circle cx="14" cy="4.5" r="1.8" />
      <path d="M8 21l3-6 3 2v4M6 12l3-3.5 4 1 2.5 3.5H19M11 15l2-5.5" />
    </>
  ),
  dumbbell: <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />,
  scale: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="4" />
      <path d="M9 8.5a3 3 0 0 1 6 0M12 8.5l1.8-1.8" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4.5 4.5 0 0 1 7-3.7A4.5 4.5 0 0 1 19 10c0 5.6-7 10-7 10ZM5.5 12H9l1.5-2.5 2.5 5L14.5 12h4" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  list: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="3" />
      <path d="M8 2.5v3M16 2.5v3M4 9h16M8 13h3M8 17h6" />
    </>
  ),
  chart: <path d="M4 19V10M10 19V5M16 19v-6M22 19V8M2 19h20" />,
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  sparkle: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </>
  ),
  send: <path d="M12 19V5M6 11l6-6 6 6" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  chat: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z" />,
  pencil: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />,
}

export function Icon({ name, size = 22, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  )
}
