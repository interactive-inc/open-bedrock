/**
 * UUID v7 を生成する (Issue #1311)。
 *
 * v7 は先頭 48bit が Unix 時刻(ms)なので、生成順にほぼ単調増加する。主キーに使うと
 * B-tree の挿入が末尾に集中し、v4 のような索引の断片化を避けられる。
 *
 * 同一ミリ秒内は rand_a 12bit を単調増加カウンタとして使い、その範囲でも順序を保つ
 * (RFC 9562 6.2 の "Method 1: Fixed Bit-Length Dedicated Counter")。カウンタが尽きた
 * 場合だけ次のミリ秒へ繰り上げる。
 */
let lastTimestamp = -1
let counter = 0

const COUNTER_LIMIT = 0x1000

export function createUuidV7(): string {
  let timestamp = Date.now()

  if (timestamp > lastTimestamp) {
    counter = 0
  } else {
    // 同一ミリ秒、または時刻の巻き戻り (NTP 補正など)。直前の値から進めて単調性を守る。
    timestamp = lastTimestamp
    counter += 1

    if (counter >= COUNTER_LIMIT) {
      // カウンタ 4096 件を使い切った。次のミリ秒へ繰り上げる。
      // ここを飛ばすとカウンタが 12bit を溢れて周回し、同じ値を二度返してしまう。
      timestamp = lastTimestamp + 1
      counter = 0
    }
  }

  lastTimestamp = timestamp

  const random = crypto.getRandomValues(new Uint8Array(8))

  const hex: string[] = []

  // 48bit: Unix 時刻 (ms)
  hex.push(timestamp.toString(16).padStart(12, "0"))

  // 4bit: version(7) + 12bit: 同一ミリ秒カウンタ
  hex.push((0x7000 | counter).toString(16).padStart(4, "0"))

  // 2bit: variant(0b10) + 62bit: 乱数
  const variantHigh = ((random[0] as number) & 0x3f) | 0x80
  hex.push(variantHigh.toString(16).padStart(2, "0"))
  for (let index = 1; index < 8; index += 1) {
    hex.push((random[index] as number).toString(16).padStart(2, "0"))
  }

  const value = hex.join("")

  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join("-")
}
