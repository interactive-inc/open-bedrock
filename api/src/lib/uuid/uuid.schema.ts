import { z } from "zod"

/**
 * 主キーと ID 参照に使う UUID (Issue #1311)。
 *
 * 版は問わない。新規生成は v7 に統一するが、既に v4 で採番済みの行が正当なまま
 * 残るため、検査は「UUID であること」までとする。
 *
 * 正規形は小文字に固定する。DB の CHECK 制約が小文字の 16 進しか許さないので、
 * 大文字を入口で通すと保存時に初めて失敗し、エラーの質が落ちる。
 *
 * version と variant は `z.uuid()` が検査する。ただし nil UUID (全 0) と max UUID
 * (全 f) だけは RFC 9562 が特別に定義しているため `z.uuid()` を素通りする。どちらも
 * 「未設定」「番兵」であって識別子ではないので、明示的に拒否する。
 */
export const uuidSchema = z
  .uuid()
  .refine((value) => value === value.toLowerCase(), "UUID は小文字で指定してください")
  .refine(
    (value) =>
      value !== "00000000-0000-0000-0000-000000000000" &&
      value !== "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "nil UUID と max UUID は識別子として使えません",
  )

/**
 * `uuidSchema` と同じ集合を SQL 側で表す CHECK 制約の述語。
 *
 * Drizzle schema の `check()` と migration の両方がこの 1 か所を参照する。SQLite に
 * 正規表現が無いため GLOB で桁と文字種を検査する。
 *
 * 桁と文字種だけでなく version (13 文字目) と variant (17 文字目) まで見る。ここを
 * `[0-9a-f]` のままにすると `11111111-1111-1111-1111-111111111111` のような RFC 非準拠の
 * 「形だけ UUID」が DB には入るのに API の入口では弾かれる。CHECK が通っている分だけ
 * 正当な行に見えてしまい、発覚が遅れる。
 *
 * version は RFC 9562 が定義する v1〜v8、variant は 0b10 に固定する。nil UUID (version 0)
 * と max UUID (version f) はこの範囲から外れるので、Zod 側の明示的な拒否と結果が揃う。
 *
 * @param column 検査対象の列名（SQL 識別子としてそのまま埋め込む）
 */
export function uuidCheckPredicate(column: string): string {
  const hex = "[0-9a-f]"

  return (
    `length(${column}) = 36 ` +
    `AND ${column} GLOB '${hex.repeat(8)}-${hex.repeat(4)}-` +
    `[1-8]${hex.repeat(3)}-[89ab]${hex.repeat(3)}-${hex.repeat(12)}'`
  )
}
