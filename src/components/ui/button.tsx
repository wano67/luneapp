import { cn } from '@/lib/cn';
import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ReactElement,
} from 'react';

type ButtonVariant = 'primary' | 'outline' | 'ghost';
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
  'inline-flex items-center justify-center rounded-lg font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60 disabled:cursor-not-allowed';

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-500 text-slate-50 hover:bg-blue-400 border border-blue-500/70',
  outline:
    'border border-slate-800 text-slate-50 bg-slate-900/50 hover:border-blue-500/60 hover:text-white',
  ghost:
    'text-slate-200 hover:text-white border border-transparent hover:border-slate-700 bg-transparent',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2 text-base',
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
    const child = children as ReactElement<any>;
    return cloneElement(child, {
      ...child.props,
      className: cn(classes, child.props.className),
      ...props,
    });
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
