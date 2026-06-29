/**
 * D1 batch-abort ガード。
 *
 * Cloudflare D1 の batch() は BEGIN TRANSACTION を使わず、ステートメントを順次実行する。
 * 前のステートメントが 0 行変更（= 条件不一致）の場合に json_extract('', '$') で
 * 意図的にエラーを発生させてバッチ全体を rollback する。
 */

/** json_extract('', '$') が発生させるエラーメッセージの部分一致文字列。 */
export const BATCH_ABORT_SENTINEL = "malformed JSON"

/**
 * 直前のステートメントが 0 行変更だったとき、json_extract('', '$') で
 * D1 batch をアボートさせるガード文を返す。
 */
export function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}

/**
 * ガード文（abortWhenPreviousStatementChangedNoRows）の json_extract('', '$') による
 * 意図的な abort かを判定する。これ以外の batch 失敗は本物の DB エラーとして伝播させる。
 */
export function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes(BATCH_ABORT_SENTINEL)
}
