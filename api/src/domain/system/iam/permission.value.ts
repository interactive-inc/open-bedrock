import { z } from "zod"

const zPermissionKey = z
  .string()
  .min(3)
  .max(100)
  .regex(/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/)

/**
 * System が所有する、名前空間付き権限キーの汎用値オブジェクト。
 *
 * 権限語彙そのものは利用側の bounded context が所有する。System は個別のキー一覧や
 * リソーススコープを知らず、構文と等価性だけを保証する。
 */
export class PermissionValue {
  private static readonly CACHE = new Map<string, PermissionValue>()

  readonly key: string

  constructor(key: string) {
    this.key = zPermissionKey.parse(key)
    Object.freeze(this)
  }

  equals(other: PermissionValue): boolean {
    return this.key === other.key
  }

  static hasAny(
    permissions: ReadonlySet<string>,
    ...requiredPermissions: ReadonlyArray<PermissionValue>
  ): boolean {
    if (requiredPermissions.length === 0) return false
    if (permissions.has("system:admin")) return true

    return requiredPermissions.some((permission) => permissions.has(permission.key))
  }

  static from(key: string): PermissionValue | null {
    const parsed = zPermissionKey.safeParse(key)
    if (!parsed.success) return null

    const cached = PermissionValue.CACHE.get(parsed.data)
    if (cached !== undefined) return cached

    const value = new PermissionValue(parsed.data)
    PermissionValue.CACHE.set(parsed.data, value)
    return value
  }

  static known(key: string): PermissionValue {
    const value = PermissionValue.from(key)

    if (value === null) {
      throw new Error(`Invalid permission key: ${key}`)
    }

    return value
  }
}
