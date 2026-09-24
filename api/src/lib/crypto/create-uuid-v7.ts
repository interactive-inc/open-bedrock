const COUNTER_LIMIT = 0x1000

let lastTimestamp = -1

let counter = 0

/**
 * UUID v7 を生成する。
 *
 * 先頭48bitが Unix 時刻(ms)なので、生成順にほぼ単調増加し、主キーの B-tree への挿入が
 * 末尾に集まる。同一ミリ秒内は rand_a の12bitを単調増加カウンタとして使う
 * (RFC 9562 6.2 Method 1)。時刻が巻き戻ったときは直前の時刻から進め、カウンタが
 * 尽きたときだけ次のミリ秒へ繰り上げる。
 */
export function createUuidV7(): string {
  let timestamp = Date.now()

  if (timestamp > lastTimestamp) {
    counter = 0
  } else {
    timestamp = lastTimestamp
    counter += 1

    if (counter >= COUNTER_LIMIT) {
      // 12bitを溢れて周回させると同じ値を二度返すため、次のミリ秒へ進める。
      timestamp = lastTimestamp + 1
      counter = 0
    }
  }

  lastTimestamp = timestamp

  const random = crypto.getRandomValues(new Uint8Array(8))
  const variantHigh = ((random[0] ?? 0) & 0x3f) | 0x80
  const tail = [variantHigh, ...random.slice(1)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  const hex = `${timestamp.toString(16).padStart(12, "0")}${(0x7000 | counter).toString(16)}${tail}`

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-")
}
