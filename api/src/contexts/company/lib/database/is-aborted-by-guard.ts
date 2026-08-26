const BATCH_ABORT_SENTINEL = "malformed JSON"

/** CompanyのD1 batch guardによる意図的なrollbackかを判定する。 */
export function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes(BATCH_ABORT_SENTINEL)
}
