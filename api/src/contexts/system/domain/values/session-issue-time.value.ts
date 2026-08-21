export type SessionIssueTimeProps = Readonly<{
  issuedAtSeconds: number | null
  issuedAtMs?: number | null
}>

/** Session tokenの発行時刻と、発行時刻に基づく失効・更新判定を所有するValue Object。 */
export class SessionIssueTimeValue {
  readonly issuedAtSeconds: number | null
  readonly issuedAtMs: number | null

  private constructor(props: SessionIssueTimeProps) {
    this.issuedAtSeconds = props.issuedAtSeconds
    this.issuedAtMs = props.issuedAtMs ?? null
    Object.freeze(this)
  }

  static restore(props: SessionIssueTimeProps): SessionIssueTimeValue {
    return new SessionIssueTimeValue(props)
  }

  isRevokedByPasswordChange(passwordChangedAt: Date | null): boolean {
    if (passwordChangedAt === null) return false
    if (this.issuedAtSeconds === null) return true
    if (this.issuedAtMs !== null) return this.issuedAtMs < passwordChangedAt.getTime()

    return this.issuedAtSeconds <= Math.floor(passwordChangedAt.getTime() / 1_000)
  }

  shouldRefresh(nowMs: number, refreshAfterSeconds: number): boolean {
    if (this.issuedAtMs !== null) {
      return nowMs - this.issuedAtMs >= refreshAfterSeconds * 1_000
    }
    if (this.issuedAtSeconds !== null) {
      return nowMs - this.issuedAtSeconds * 1_000 >= refreshAfterSeconds * 1_000
    }
    return true
  }
}
