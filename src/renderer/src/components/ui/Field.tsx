import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'

const BASE =
  'w-full border-3 border-ink bg-surface rounded px-3 text-[15px] nb-focus placeholder:text-muted/90 disabled:opacity-50'

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[12px] font-bold uppercase tracking-wide text-muted">{children}</span>
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </span>
  )
}

export function Fieldset({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      {label && <Label hint={hint}>{label}</Label>}
      {children}
    </label>
  )
}

export const Input = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: 'sm' | 'md' }
>(function Input({ className, size = 'md', ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        BASE,
        size === 'sm' ? 'h-9 text-[14px]' : 'h-10',
        className,
      )}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(BASE, 'py-2 leading-relaxed nb-scroll resize-y', className)}
      {...rest}
    />
  )
})

export { Select } from './Select'
export type { SelectOption } from './Select'
