import { DomainError } from "@system/domain/errors"

export type SkillErrorCode =
  | "forbidden"
  | "skill_conflict"
  | "skill_unavailable"

/** skill原記録の保全操作が成立しない理由。 */
export class SkillError extends DomainError {
  constructor(
    readonly code: SkillErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "SkillError"
  }
}
