// All operations intentionally live in this module so the write-state key remains inaccessible.
// Exposing the Symbol to split the functions would allow callers to forge persistence metadata.
const entityWriteStateKey: unique symbol = Symbol("entityWriteState")

export type EntityWithWriteState<TEntity extends object, TState extends object> = TEntity &
  Readonly<{ [entityWriteStateKey]: Readonly<TState> }>

/**
 * Entity のドメイン状態を変えず、次の永続化で必要になる更新前の比較値などを保持させる。
 */
export function withEntityWriteState<TEntity extends object, TState extends object>(
  entity: TEntity,
  state: TState,
): EntityWithWriteState<TEntity, TState> {
  const entityWithWriteState = Object.create(Object.getPrototypeOf(entity)) as EntityWithWriteState<
    TEntity,
    TState
  >

  Object.defineProperties(entityWithWriteState, Object.getOwnPropertyDescriptors(entity))
  Object.defineProperty(entityWithWriteState, entityWriteStateKey, {
    configurable: false,
    enumerable: false,
    value: Object.freeze({ ...state }),
    writable: false,
  })

  return Object.freeze(entityWithWriteState)
}

export function entityWriteState<TEntity extends object, TState extends object>(
  entity: EntityWithWriteState<TEntity, TState>,
): Readonly<TState> {
  return entity[entityWriteStateKey]
}

export function optionalEntityWriteState<TEntity extends object, TState extends object>(
  entity: TEntity,
): Readonly<TState> | undefined {
  return (entity as EntityWithWriteState<TEntity, TState>)[entityWriteStateKey]
}
