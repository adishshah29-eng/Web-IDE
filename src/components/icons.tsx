interface IconProps {
  className?: string;
}

const base = "shrink-0";

export function IconChevron({ className = "", open }: IconProps & { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`${base} ${className} transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      fill="none"
    >
      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFolder({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path
        d="M2 4.5C2 3.67157 2.67157 3 3.5 3H6.5L8 4.5H12.5C13.3284 4.5 14 5.17157 14 6V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconFile({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path
        d="M4 2.5H9L12 5.5V13C12 13.2761 11.7761 13.5 11.5 13.5H4.5C4.22386 13.5 4 13.2761 4 13V2.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9 2.5V5.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClose({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={`${base} ${className}`} fill="none">
      <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconDot({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={`${base} ${className}`} fill="currentColor">
      <circle cx="6" cy="6" r="3" />
    </svg>
  );
}

export function IconPlus({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" className={`${base} ${className}`} fill="none">
      <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconFolderPlus({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path
        d="M2 4.5C2 3.67157 2.67157 3 3.5 3H6.5L8 4.5H12.5C13.3284 4.5 14 5.17157 14 6V11.5C14 12.3284 13.3284 13 12.5 13H3.5C2.67157 13 2 12.3284 2 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M8 7.5V10.5M6.5 9H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlay({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="currentColor">
      <path d="M4.5 3.2C4.5 2.77 4.97 2.51 5.33 2.74L12.5 7.54C12.83 7.76 12.83 8.24 12.5 8.46L5.33 13.26C4.97 13.49 4.5 13.23 4.5 12.8V3.2Z" />
    </svg>
  );
}

export function IconTrash({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path
        d="M3.5 4.5H12.5M6.5 4.5V3.2C6.5 2.87 6.77 2.6 7.1 2.6H8.9C9.23 2.6 9.5 2.87 9.5 3.2V4.5M6.5 7.3V11M9.5 7.3V11M4.3 4.5L4.8 12.4C4.83 12.88 5.23 13.25 5.71 13.25H10.29C10.77 13.25 11.17 12.88 11.2 12.4L11.7 4.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTemplate({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <rect x="2" y="2" width="12" height="12" rx="1.3" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 6.2H14" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6 6.2V14" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function IconExternalLink({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path
        d="M6.5 3H4.3C3.58 3 3 3.58 3 4.3v7.4C3 12.42 3.58 13 4.3 13h7.4c.72 0 1.3-.58 1.3-1.3V9.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 3H13v3.5M13 3L7.5 8.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMaximize({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path
        d="M6 3H3v3M10 3h3v3M6 13H3v-3M10 13h3v-3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconMinimize({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path
        d="M3 6h3V3M13 6h-3V3M3 10h3v3M13 10h-3v3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconExplorer({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none">
      <path
        d="M4 6a1 1 0 011-1h4.5l1.8 2H19a1 1 0 011 1v9a1 1 0 01-1 1H5a1 1 0 01-1-1V6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconConsoleActivity({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none">
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 9H17.5M6.5 12.5H14M6.5 16H11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconPreviewActivity({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconAgentActivity({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none">
      <path
        d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9l-4 3.5v-3.5H6.5A2.5 2.5 0 014 13.5v-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="8.75" cy="10" r="1" fill="currentColor" />
      <circle cx="12" cy="10" r="1" fill="currentColor" />
      <circle cx="15.25" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconTerminalActivity({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={`${base} ${className}`} fill="none">
      <rect x="3" y="4" width="18" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9.5L10.5 12.5L7 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 15.5H17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconBack({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path d="M9.5 3L5 8L9.5 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRefresh({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <path
        d="M13 8A5 5 0 1 1 11.5 4.3M13 8V4.5M13 8H9.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPhone({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <rect x="5" y="1.5" width="6" height="13" rx="1.3" stroke="currentColor" strokeWidth="1.1" />
      <path d="M7 12.2H9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function IconTablet({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <rect x="3" y="1.5" width="10" height="13" rx="1.3" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6.8 12.2H9.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function IconLaptop({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" className={`${base} ${className}`} fill="none">
      <rect x="2.5" y="2.5" width="11" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1 12.5H15" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
