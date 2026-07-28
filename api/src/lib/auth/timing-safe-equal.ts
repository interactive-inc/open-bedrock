/**
 * 2 つの文字列を長さの漏えいと早期リターンを避けて比較する。
 * 双方を SHA-256 した固定長ダイジェスト同士を定数時間で突き合わせるため、
 * 入力長の差からタイミングで秘密を推測されない。
 */
export async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder()

  const leftDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(left)))

  const rightDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(right)))

  let mismatch = 0

  for (let index = 0; index < leftDigest.length; index++) {
    mismatch = mismatch | (leftDigest[index]! ^ rightDigest[index]!)
  }

  return mismatch === 0
}
