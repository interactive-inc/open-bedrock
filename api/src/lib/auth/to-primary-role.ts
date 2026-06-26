// 移行互換: 複数ロールを持つアカウントから、既存 can-*(単一 role) が期待する代表 role を導出する。
// 既存 can-* は admin>hr>manager>member の強弱で判定していたため、保持する system role のうち
// 最も強いものを代表とする。system role を持たない(動的ロールのみ)場合は member 扱い。
// Phase 7 で can-* が permission ベースへ移行したら、この互換関数は不要になる。

const SYSTEM_ROLE_STRENGTH: ReadonlyArray<string> = ["admin", "hr", "manager", "member"]

/**
 * roleKeys から後方互換の代表 role 文字列を返す。
 */
export function toPrimaryRole(roleKeys: ReadonlyArray<string>): string {
  for (const candidate of SYSTEM_ROLE_STRENGTH) {
    if (roleKeys.includes(candidate)) {
      return candidate
    }
  }

  return "member"
}
