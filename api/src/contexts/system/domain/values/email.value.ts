import { InvalidEmailError } from "@/contexts/system/domain/errors"
import { z } from "zod"

const normalizeEmail = (value: string): string => value.trim().toLowerCase()
const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? normalizeEmail(value) : value),
  z.email(),
)

export class EmailValue {
  static readonly schema = emailSchema
  readonly value: string

  private constructor(value: string) {
    this.value = value
    Object.freeze(this)
  }

  static create(value: string): EmailValue | InvalidEmailError {
    const parsed = emailSchema.safeParse(value)
    return parsed.success ? new EmailValue(parsed.data) : new InvalidEmailError()
  }

  toString(): string {
    return this.value
  }
}
