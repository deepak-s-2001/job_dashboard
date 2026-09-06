import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-3 border-ink bg-surface rounded shadow-hard', className)}
      {...rest}
    />
  )
}

export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-3 border-ink bg-surface rounded', className)}
      {...rest}
    />
  )
}
