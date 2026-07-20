const SYSTEM_ROLE_STRENGTH: ReadonlyArray<string> = ["admin", "hr", "manager", "member"]

/**
 * レスポンス互換: 複数ロールを持つアカウントから、/me が返す単一 role の代表値を導出する。
 * 旧ロール判定は admin>hr>manager>member の強弱で判定していたため、保持する system role のうち
 * 最も強いものを代表とする。system role を持たない（動的ロールのみ）場合は member 扱い。
 * 認可判定には使わない（認可は hasPermission が正）
 */
export function toPrimaryRole(roleKeys: ReadonlyArray<string>): string {
  for (const candidate of SYSTEM_ROLE_STRENGTH) {
    if (roleKeys.includes(candidate)) {
      return candidate
    }
  }

  return "member"
}
