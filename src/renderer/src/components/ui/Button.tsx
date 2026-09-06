import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'accent' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
}

const HARD =
  'border-3 border-ink shadow-hard hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-sm disabled:shadow-hard disabled:translate-x-0 disabled:translate-y-0'

const VARIANTS: Record<Variant, string> = {
  primary: `bg-ink text-ground hover:bg-black ${HARD}`,
  accent: `bg-accent-yellow text-ink hover:brightness-105 ${HARD}`,
  danger: `bg-accent-coral text-ink hover:brightness-105 ${HARD}`,
  outline: `bg-surface text-ink hover:bg-ground ${HARD}`,
  ghost: 'bg-transparent text-ink border-3 border-transparent hover:bg-black/5',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', block, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'nb-focus inline-flex items-center justify-center whitespace-nowrap rounded font-semibold select-none',
        'transition-transform duration-100 ease-out',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
