import type { SystemD1Context } from "@system/configuration/system-context"
import { prepareSystemHumanOperationAuthorization } from "@system/interface/operations/prepare-system-human-operation-authorization"

type Context = SystemD1Context
type Input = Readonly<{
  accountId: string
  tokenVersion: number
  permissions: ReadonlyArray<string>
  now: Date
  requireExplicitPermissions?: boolean
}>

/** 稟議の操作者が人として現在の権限を持つかをSystemの公開operationで確認し、保存時の照合文を返す。 */
export class RingiHumanOperationAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(input: Input) {
    return prepareSystemHumanOperationAuthorization({ database: this.c.env.DB, ...input })
  }
}
