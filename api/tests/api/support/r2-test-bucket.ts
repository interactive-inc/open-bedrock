/**
 * テスト用の R2 バケット。メモリ上に暗号文を持ち、put / get / head / delete だけを実装する。
 * 保存されているバイト列をそのまま覗けるので、平文が漏れていないことを検証できる。
 */
export class R2TestBucket {
  private readonly objects = new Map<string, Uint8Array>()

  async put(key: string, value: unknown): Promise<{ key: string }> {
    this.objects.set(key, toBytes(value))

    return { key }
  }

  async get(key: string): Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null> {
    const stored = this.objects.get(key)

    if (stored === undefined) return null

    return {
      arrayBuffer: async () => {
        const copy = new Uint8Array(stored.byteLength)

        copy.set(stored)

        return copy.buffer
      },
    }
  }

  async head(key: string): Promise<{ key: string } | null> {
    return this.objects.has(key) ? { key } : null
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key)
  }

  /** テスト専用。保存されている生バイト列を読む。 */
  storedBytes(key: string): Uint8Array | null {
    return this.objects.get(key) ?? null
  }

  keys(): ReadonlyArray<string> {
    return [...this.objects.keys()]
  }

  size(): number {
    return this.objects.size
  }
}

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    const copy = new Uint8Array(value.byteLength)

    copy.set(value)

    return copy
  }

  if (value instanceof ArrayBuffer) return new Uint8Array(value)

  throw new Error("R2TestBucket は Uint8Array か ArrayBuffer だけを受け付けます")
}

/** 32 バイトの KEK を base64 で返す。テストの決め打ち鍵。 */
export function testKekEnv(version = 1): string {
  const key = new Uint8Array(32)

  for (let index = 0; index < key.length; index += 1) {
    key[index] = (index * 7 + version) % 256
  }

  let binary = ""

  for (const byte of key) {
    binary += String.fromCharCode(byte)
  }

  return JSON.stringify({ [String(version)]: btoa(binary) })
}
