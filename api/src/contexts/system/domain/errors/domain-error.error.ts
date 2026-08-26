/** Domain層で予想可能な業務エラーの共通基底。 */
export class DomainError extends Error {
  readonly layer = "domain"

  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options)
    this.name = new.target.name
  }
}
