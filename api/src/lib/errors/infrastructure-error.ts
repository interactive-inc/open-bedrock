export type InfrastructureErrorContext = Readonly<{
  entity: string
  operation: string
  entityId?: string
}>

export abstract class InfrastructureError extends Error {
  readonly entity: string
  readonly operation: string
  readonly entityId: string | null

  protected constructor(
    name: string,
    message: string,
    context: InfrastructureErrorContext,
    options: ErrorOptions = {},
  ) {
    super(message, options)
    this.name = name
    this.entity = context.entity
    this.operation = context.operation
    this.entityId = context.entityId ?? null
  }
}
