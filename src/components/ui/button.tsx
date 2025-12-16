import { cn } from '@/lib/cn';
import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ReactElement,
} from 'react';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  /**
   * Si true, le bouton applique ses styles à un enfant unique (ex: <Link />)
   * au lieu de rendre un <button>. Utile pour les liens stylés comme des boutons.
   */
  asChild?: boolean;
};

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition-colors shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-white border-[var(--accent-strong)] hover:bg-[var(--accent-strong)] hover:border-[var(--accent-strong)]',
  outline:
    'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]',
  ghost: 'border-transparent bg-transparent text-[var(--text)] hover:bg-[var(--surface-hover)]',
  danger:
    'bg-[var(--danger)] border-[var(--danger)] text-white hover:brightness-95 focus-visible:outline-[var(--danger)]',
  success:
    'bg-[var(--success)] border-[var(--success)] text-white hover:brightness-95 focus-visible:outline-[var(--success)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  asChild = false,
  ...props
}: ButtonProps) {
  const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    const childProps = child.props ?? {};
    return cloneElement(child, {
      ...childProps,
      ...props,
      className: cn(classes, childProps.className as string | undefined),
    });
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
