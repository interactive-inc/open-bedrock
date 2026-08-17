/** 共通Workforceのnamespaced IDを既存Lifecycleの保存IDへ戻す。 */
export function toLifecycleStorageId(value: string, prefix: string): string | Error {
  if (!value.startsWith(prefix)) {
    return new Error("workforce id has an unexpected namespace")
  }

  const storageId = value.slice(prefix.length)

  return storageId.length === 0 ? new Error("workforce id has no storage value") : storageId
}
