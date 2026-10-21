import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.9-.9L3 21l1.9-4.6A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4Z" />
    </Icon>
  );
}

export function GraphIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M7.9 7.4 16.1 8.6M7.2 8.1l3.6 7.6M16.6 9.2l-3.3 6.6" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function ScissorsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="6" cy="18" r="2.6" />
      <path d="M20 4 8.4 16.2M20 20 8.4 7.8" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 3 10.5 13.5M21 3l-6.6 18-3.9-7.5L3 9.6 21 3Z" />
    </Icon>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Icon>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2.4" />
      <path d="M15 5.4A2.4 2.4 0 0 0 12.6 3H6.4A2.4 2.4 0 0 0 4 5.4v6.2A2.4 2.4 0 0 0 6.4 14" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 12.5 5 5L20 6.5" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5" />
    </Icon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L11 4.9" />
      <path d="M14 11a5 5 0 0 0-7.1 0L4.5 13.4a5 5 0 0 0 7.1 7.1L13 19.1" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.6V12l3 1.8" />
    </Icon>
  );
}

export function PulseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12h4l2.2-5.5L13 18l2.6-6h5.9" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.6 21 20H3l9-16.4Z" />
      <path d="M12 9.4v4.4M12 17.1v.1" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L20.5 7.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 6.5l3 3" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5M12 7.9v.1" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11.4A8.2 8.2 0 1 0 18 17" />
      <path d="M20 4.6v6h-6" />
    </Icon>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 4.2A3 3 0 0 0 7 7.1a3 3 0 0 0-1.6 5.4A3.2 3.2 0 0 0 8 17.9a3 3 0 0 0 4 1.9V4.9a2.6 2.6 0 0 0-2.5-.7Z" />
      <path d="M14.5 4.2A3 3 0 0 1 17 7.1a3 3 0 0 1 1.6 5.4 3.2 3.2 0 0 1-2.6 5.4 3 3 0 0 1-4 1.9" />
    </Icon>
  );
}

export function SuggestionIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.4 13.7 9l5.6 1.7-5.6 1.7L12 18l-1.7-5.6L4.7 10.7 10.3 9 12 3.4Z" />
    </Icon>
  );
}
