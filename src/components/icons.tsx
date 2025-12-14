// src/components/icons.tsx
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function cls(base: string, className?: string) {
  return [base, className].filter(Boolean).join(' ');
}

export function IconHome({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cls('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconWallet({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cls('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M20 10h-4.5A2.5 2.5 0 0 0 13 12.5v0A2.5 2.5 0 0 0 15.5 15H20"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16.5 12.5h0.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconStudio({ size = 18, className, ...props }: IconProps) {
  // "building" minimal
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cls('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M6 21V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 21h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9 8h2M9 11h2M9 14h2M13 8h2M13 11h2M13 14h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconFocus({ size = 18, className, ...props }: IconProps) {
  // cible minimal
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cls('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 21a9 9 0 1 0-9-9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 18a6 6 0 1 0-6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 15a3 3 0 1 0-3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 12h0.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSun({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cls('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMoon({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cls('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUser({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cls('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M20 21a8 8 0 0 0-16 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 13a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function IconSettings({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cls('shrink-0', className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a7.8 7.8 0 0 0 .1-6l-1.8.6a6.1 6.1 0 0 1 0 4.2l1.7 1.2ZM4.6 9a7.8 7.8 0 0 0-.1 6l1.8-.6a6.1 6.1 0 0 1 0-4.2L4.6 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9 4.6a7.8 7.8 0 0 1 6 0l-.6 1.8a6.1 6.1 0 0 0-4.8 0L9 4.6ZM15 19.4a7.8 7.8 0 0 1-6 0l.6-1.8a6.1 6.1 0 0 0 4.8 0l.6 1.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
