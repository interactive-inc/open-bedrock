/** UUID の正規形（小文字・version 1〜8・variant 0b10）。 */
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/**
 * 動的セグメントの値を UUID として受け取る (Issue #1311)。
 *
 * 形が違えば「その資源は無い」と同じ扱いにしたいので、呼び出し側で notFound() へ
 * 落とせるよう null を返す。api 側の `validateUuidParam` と同じ集合を受け入れる。
 */
export function toUuidParam(rawId: string): string | null {
  return uuidPattern.test(rawId) ? rawId : null
}
