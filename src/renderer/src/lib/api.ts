import type { ApiResult } from '@shared/types'

export const api = window.api

/** Unwrap an ApiResult, throwing a plain Error on failure. */
export async function call<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const res = await p
  if (!res.ok) throw new Error(res.error ?? 'Something went wrong.')
  return res.data as T
}
