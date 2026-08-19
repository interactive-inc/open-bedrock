export class WriteOperationEntity<TOperation extends string, TProps extends object> {
  readonly operation: TOperation
  readonly props: Readonly<TProps>

  private constructor(operation: TOperation, props: TProps) {
    this.operation = operation
    this.props = Object.freeze({ ...props })
    Object.freeze(this)
  }

  static create<TOperation extends string, TProps extends object>(
    operation: TOperation,
    props: TProps,
  ): WriteOperationEntity<TOperation, TProps> {
    return new WriteOperationEntity(operation, props)
  }
}

export type DeletionEntity<TEntity extends object> = WriteOperationEntity<
  "delete",
  { entity: TEntity }
>
