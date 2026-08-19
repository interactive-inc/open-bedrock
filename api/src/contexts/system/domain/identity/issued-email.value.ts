/**
 * メールアドレスを持たない Account 向けの機械発番アドレスを組み立てる (#1306)。
 * このアドレスには実際のメールは届かない (can_receive_email=false)。招待メールの代わりに
 * 管理画面で初期パスワードを発行して手渡しする運用のログイン ID として使う。
 */
export class IssuedEmailValue {
  /**
   * ローカル部と製品configurationのdomainから発番アドレスを組み立てる。
   * localPart・domainの選択は利用側が担い、Systemは不透明な識別子として扱う。
   */
  static buildIssuedEmail(localPart: string, domain: string): string {
    return `${localPart}@${domain}`
  }

  /**
   * 発番アドレスかどうかをドメインで判定する。ドメイン推測はドメインモデルの正ではないが、
   * 表示用のバッジ判定など UI 側の補助にだけ使う (認可・分岐の判定は can_receive_email を正とする)。
   */
  static isIssuedEmail(email: string, domain: string): boolean {
    return email.endsWith(`@${domain}`)
  }
}
