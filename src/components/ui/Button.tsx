// ============================================
// Button Component (Catalyst-style)
// ============================================

import * as Headless from '@headlessui/react'
import { clsx } from 'clsx'
import { type ReactNode, forwardRef } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

function TouchTarget({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        className="absolute left-1/2 top-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 [@media(pointer:fine)]:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  )
}

const baseStyles = clsx(
  'relative isolate inline-flex items-center justify-center gap-x-2 rounded-lg border text-base/6 font-semibold',
  'focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-primary-500',
  'data-[disabled]:opacity-50 cursor-pointer data-[disabled]:cursor-not-allowed',
  '[&>[data-slot=icon]]:-mx-0.5 [&>[data-slot=icon]]:my-0.5 [&>[data-slot=icon]]:size-5 [&>[data-slot=icon]]:shrink-0 [&>[data-slot=icon]]:text-[--btn-icon] [&>[data-slot=icon]]:sm:my-1 [&>[data-slot=icon]]:sm:size-4'
)

const sizeStyles = {
  xs: 'px-2 py-1 text-xs/5 sm:text-xs/5',
  sm: 'px-2.5 py-1.5 text-sm/5 sm:text-sm/5',
  md: 'px-3 py-2 text-sm/6 sm:text-sm/6',
  lg: 'px-4 py-2.5 text-base/6 sm:text-base/6',
  icon: 'size-9 [&>[data-slot=icon]]:m-0 [&>[data-slot=icon]]:!size-5',
}

const solidStyles = {
  primary: clsx(
    'border-transparent bg-primary-600 text-white',
    'data-[hover]:bg-primary-500 data-[active]:bg-primary-700',
    'dark:bg-primary-500 dark:data-[hover]:bg-primary-400 dark:data-[active]:bg-primary-600',
    '[--btn-icon:theme(colors.white/80%)] data-[hover]:[--btn-icon:theme(colors.white)]'
  ),
  secondary: clsx(
    'border-zinc-950/10 bg-white text-zinc-950',
    'data-[hover]:bg-zinc-950/[2.5%] data-[active]:bg-zinc-950/5',
    'dark:border-white/15 dark:bg-white/5 dark:text-white',
    'dark:data-[hover]:bg-white/10 dark:data-[active]:bg-white/15',
    '[--btn-icon:theme(colors.zinc.500)] data-[hover]:[--btn-icon:theme(colors.zinc.700)]'
  ),
  danger: clsx(
    'border-transparent bg-danger-600 text-white',
    'data-[hover]:bg-danger-500 data-[active]:bg-danger-700',
    '[--btn-icon:theme(colors.white/80%)] data-[hover]:[--btn-icon:theme(colors.white)]'
  ),
  success: clsx(
    'border-transparent bg-success-600 text-white',
    'data-[hover]:bg-success-500 data-[active]:bg-success-700',
    '[--btn-icon:theme(colors.white/80%)] data-[hover]:[--btn-icon:theme(colors.white)]'
  ),
  warning: clsx(
    'border-transparent bg-warning-500 text-white',
    'data-[hover]:bg-warning-400 data-[active]:bg-warning-600',
    '[--btn-icon:theme(colors.white/80%)] data-[hover]:[--btn-icon:theme(colors.white)]'
  ),
}

const outlineStyles = {
  primary: clsx(
    'border-primary-500/50 text-primary-600',
    'data-[hover]:border-primary-500 data-[hover]:bg-primary-50',
    'data-[active]:bg-primary-100',
    'dark:text-primary-400 dark:border-primary-500/30',
    'dark:data-[hover]:border-primary-400 dark:data-[hover]:bg-primary-950/50',
    '[--btn-icon:theme(colors.primary.500)]'
  ),
  secondary: clsx(
    'border-zinc-300 text-zinc-700',
    'data-[hover]:border-zinc-400 data-[hover]:bg-zinc-50',
    'data-[active]:bg-zinc-100',
    'dark:text-zinc-300 dark:border-zinc-700',
    'dark:data-[hover]:border-zinc-600 dark:data-[hover]:bg-zinc-800/50',
    '[--btn-icon:theme(colors.zinc.500)]'
  ),
  danger: clsx(
    'border-danger-500/50 text-danger-600',
    'data-[hover]:border-danger-500 data-[hover]:bg-danger-50',
    '[--btn-icon:theme(colors.danger.500)]'
  ),
  success: clsx(
    'border-success-500/50 text-success-600',
    'data-[hover]:border-success-500 data-[hover]:bg-success-50',
    '[--btn-icon:theme(colors.success.500)]'
  ),
  warning: clsx(
    'border-warning-500/50 text-warning-600',
    'data-[hover]:border-warning-500 data-[hover]:bg-warning-50',
    '[--btn-icon:theme(colors.warning.500)]'
  ),
}

const plainStyles = {
  primary: clsx(
    'border-transparent text-primary-600',
    'data-[hover]:bg-primary-50',
    'data-[active]:bg-primary-100',
    'dark:text-primary-400',
    'dark:data-[hover]:bg-primary-950/50',
    '[--btn-icon:theme(colors.primary.500)]'
  ),
  secondary: clsx(
    'border-transparent text-zinc-700',
    'data-[hover]:bg-zinc-100',
    'data-[active]:bg-zinc-200',
    'dark:text-zinc-300',
    'dark:data-[hover]:bg-zinc-800',
    '[--btn-icon:theme(colors.zinc.500)]'
  ),
  danger: clsx(
    'border-transparent text-danger-600',
    'data-[hover]:bg-danger-50',
    'dark:text-danger-400',
    '[--btn-icon:theme(colors.danger.500)]'
  ),
  success: clsx(
    'border-transparent text-success-600',
    'data-[hover]:bg-success-50',
    'dark:text-success-400',
    '[--btn-icon:theme(colors.success.500)]'
  ),
  warning: clsx(
    'border-transparent text-warning-600',
    'data-[hover]:bg-warning-50',
    'dark:text-warning-400',
    '[--btn-icon:theme(colors.warning.500)]'
  ),
}

type ButtonColor = 'primary' | 'secondary' | 'danger' | 'success' | 'warning'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon'

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin size-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      data-slot="icon"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

type BaseButtonProps = {
  color?: ButtonColor
  size?: ButtonSize
  outline?: boolean
  plain?: boolean
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  className?: string
  children?: ReactNode
}

type ButtonProps = BaseButtonProps &
  (
    | (Omit<Headless.ButtonProps, 'as' | 'className'> & { to?: never })
    | (Omit<LinkProps, 'className'> & { disabled?: boolean })
  )

function getButtonStyles(color: ButtonColor = 'primary', outline?: boolean, plain?: boolean): string {
  if (plain) return plainStyles[color] || plainStyles.secondary
  if (outline) return outlineStyles[color] || outlineStyles.secondary
  return solidStyles[color] || solidStyles.primary
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    { color, size = 'md', outline, plain, isLoading = false, leftIcon, rightIcon, className, children, ...props },
    ref
  ) {
    const classes = clsx(baseStyles, sizeStyles[size], getButtonStyles(color, outline, plain), className)

    const content = isLoading ? (
      <>
        <LoadingSpinner />
        <span className="sr-only">로딩 중...</span>
      </>
    ) : (
      <TouchTarget>
        {leftIcon && <span data-slot="icon">{leftIcon}</span>}
        {children}
        {rightIcon && <span data-slot="icon">{rightIcon}</span>}
      </TouchTarget>
    )

    if ('to' in props && props.to) {
      const { to, ...linkProps } = props as LinkProps & { disabled?: boolean }
      return (
        <Link to={to} {...linkProps} className={classes} ref={ref as React.Ref<HTMLAnchorElement>}>
          {content}
        </Link>
      )
    }

    const buttonProps = props as Omit<Headless.ButtonProps, 'as' | 'className'>

    return (
      <Headless.Button
        {...buttonProps}
        className={classes}
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={isLoading || buttonProps.disabled}
        aria-busy={isLoading || undefined}
      >
        {content}
      </Headless.Button>
    )
  }
)

type IconButtonProps = BaseButtonProps & Omit<Headless.ButtonProps, 'as' | 'className'>

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, children, ...props },
  ref
) {
  return (
    <Button ref={ref as React.Ref<HTMLButtonElement | HTMLAnchorElement>} size="icon" className={className} {...props}>
      <span data-slot="icon" className="flex-shrink-0">
        {children}
      </span>
    </Button>
  )
})
