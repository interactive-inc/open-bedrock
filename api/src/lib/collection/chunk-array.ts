/**
 * 配列を固定長のチャンクに分割する。
 * D1 は 1 ステートメントあたり 100 個までの bind パラメータしか許さないため、
 * 一括 insert / upsert を行カラム数で割ったチャンクに分けて db.batch でまとめる用途に使う。
 */
export function chunkArray<T>(items: ReadonlyArray<T>, size: number): T[][] {
  if (size < 1) {
    return [items.slice()]
  }

  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}
