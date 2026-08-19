export class InvalidIdValueError extends Error {
  readonly value: string

  constructor(value: string) {
    super("invalid_id")
    this.name = "InvalidIdValueError"
    this.value = value
    Object.freeze(this)
  }
}
