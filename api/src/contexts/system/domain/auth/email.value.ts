import { z } from "zod"

export class EmailValue {
  static readonly schema = z.preprocess(
    (value) => (typeof value === "string" ? EmailValue.normalize(value) : value),
    z.email(),
  )

  static normalize(value: string): string {
    return value.trim().toLowerCase()
  }
}
