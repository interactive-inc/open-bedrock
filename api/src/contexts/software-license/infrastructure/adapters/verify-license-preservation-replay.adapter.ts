import type { SystemD1Context } from "@system/configuration/system-context"

type Context = SystemD1Context

/** 再送を受理する直前に、現在の資格と判断対象の検査をまとめて実行する。 */
export class VerifyLicensePreservationReplayAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(assertions: ReadonlyArray<D1PreparedStatement>): Promise<true | Error> {
    if (assertions.length === 0) return new Error("preservation replay requires current assertions")
    try {
      const verified = await this.c.env.DB.batch([...assertions])
      if (verified.length !== assertions.length || verified.some((result) => !result.success))
        return new Error("preservation replay assertions failed")
      return true
    } catch (cause) {
      return new Error("preservation replay assertions failed", { cause })
    }
  }
}
