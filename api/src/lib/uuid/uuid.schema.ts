import { z } from "zod"

/**
 * 主キーと ID 参照に使う UUID (Issue #1311)。
 *
 * 版は問わない。新規生成は v7 に統一するが、既に v4 で採番済みの行が正当なまま
 * 残るため、検査は「UUID であること」までとする。
 *
 * 正規形は小文字に固定する。DB の CHECK 制約が小文字の 16 進しか許さないので、
 * 大文字を入口で通すと保存時に初めて失敗し、エラーの質が落ちる。
 * nil UUID (全 0) は「未設定」を意味してしまうため識別子として認めない。
 */
export const uuidSchema = z
  .uuid()
  .refine((value) => value === value.toLowerCase(), "UUID は小文字で指定してください")
  .refine(
    (value) => value !== "00000000-0000-0000-0000-000000000000",
    "nil UUID は識別子として使えません",
  )

/**
 * `uuidSchema` と同じ集合を SQL 側で表す CHECK 制約の述語。
 *
 * Drizzle schema の `check()` と migration の両方がこの 1 か所を参照する。SQLite に
 * 正規表現が無いため GLOB で桁と文字種を検査する。小文字 16 進のみを許すので、
 * 大文字と nil UUID は Zod と同じく弾かれる。
 *
 * @param column 検査対象の列名（SQL 識別子としてそのまま埋め込む）
 */
export function uuidCheckPredicate(column: string): string {
  return (
    `length(${column}) = 36 ` +
    `AND ${column} GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-` +
    `[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-` +
    `[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-` +
    `[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' ` +
    `AND ${column} != '00000000-0000-0000-0000-000000000000'`
  )
}
