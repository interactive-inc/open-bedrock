import { InvalidIdValueError } from "@/lib/identity/errors"
import { z } from "zod"

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const zValue = z
  .string()
  .regex(uuidPattern)
  .transform((value) => value.toLowerCase())

/**
 * 全テーブルで共通の永続化済み内部 ID。
 *
 * 新規採番は create() に限定して prefix のない UUID を生成する。
 * 短い URL が必要な場合は別の CodeValue を使い、API で型を明示したい場合だけ
 * toApiString を使う。
 */
export class IdValue {
  private readonly value: string

  constructor(value: string) {
    this.value = zValue.parse(value)
    Object.freeze(this)
  }

  static create(): IdValue {
    return new IdValue(crypto.randomUUID())
  }

  static fromString(value: string): IdValue | InvalidIdValueError {
    const parsed = zValue.safeParse(value)
    if (!parsed.success) {
      return new InvalidIdValueError(value)
    }

    return new IdValue(parsed.data)
  }

  static fromApiString(prefix: string, value: string): IdValue | InvalidIdValueError {
    const apiPrefix = `${prefix}_`
    if (!value.startsWith(apiPrefix)) {
      return new InvalidIdValueError(value)
    }

    return IdValue.fromString(value.slice(apiPrefix.length))
  }

  equals(other: IdValue): boolean {
    return this.value === other.value
  }

  toApiString(prefix: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(prefix)) {
      throw new InvalidIdValueError(prefix)
    }

    return `${prefix}_${this.value}`
  }

  toString(): string {
    return this.value
  }
}
