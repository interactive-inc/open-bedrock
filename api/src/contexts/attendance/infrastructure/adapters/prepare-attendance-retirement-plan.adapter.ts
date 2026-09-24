import { ForbiddenError } from "@/lib/errors"
import type { AttendanceRecordSourceContext } from "@/contexts/attendance/configuration/attendance-record-source-context"
import { attendanceRetirementPlanCommandSchema } from "@/contexts/attendance/domain/schemas/attendance-retirement-plan-command.schema"
import { AttendanceRecordSourceAuthorizationAdapter } from "@/contexts/attendance/infrastructure/adapters/attendance-record-source-authorization.adapter"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"
import { prepareSystemRecordKindCoverage } from "@system/interface/operations/prepare-system-record-kind-coverage"

type Context = AttendanceRecordSourceContext

/** 打刻の照合終端と現在の収集資格を検査し、撤去前の検証対象を固定する。 */
export class PrepareAttendanceRetirementPlanAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, stepUpToken: string) {
    const parsed = attendanceRetirementPlanCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const request = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new ForbiddenError("retirement authentication required", "forbidden")
    const authority = await prepareSystemRecordSourceFreezeAuthorization(this.c, {
      authentication,
      now: this.c.var.now(),
      stepUpToken,
    })
    if (authority instanceof Error) return authority
    if (authority === "forbidden")
      return new ForbiddenError("retirement authorization denied", "forbidden")
    const reader = await new AttendanceRecordSourceAuthorizationAdapter(this.c).prepare()
    if (reader instanceof Error) return reader
    const chain = await prepareSystemRecordKindCoverage(
      {
        env: this.c.env,
        assertions: [...authority.assertions, ...reader.assertions],
      },
      {
        freezeId: request.freezeId,
        sourceNamespace: request.sourceNamespace,
        purpose: request.purpose,
        ownerContext: "attendance",
        recordKind: "attendance-record",
      },
    )
    if (chain instanceof Error) return chain
    const currentReader = await new AttendanceRecordSourceAuthorizationAdapter(this.c).prepare()
    if (currentReader instanceof Error) return currentReader
    const assertions = [...chain.assertions, ...currentReader.assertions]
    try {
      const checked = await this.c.env.DB.batch(assertions)
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement coverage changed")
      const summary = chain.summary
      const plan = await RecordRetirementVerificationPlanEntity.create({
        ...request,
        ownerContext: "attendance",
        capability: { revision: 1, recordKinds: ["attendance-record"] },
        coverage: [
          {
            recordKind: summary.recordKind,
            terminalPageId: summary.terminalPageId,
            terminalDigest: summary.terminalDigest,
            pageCount: summary.pageCount,
            recordCount: summary.recordCount,
          },
        ],
        actorAccountId: authentication.accountId,
        createdAt: this.c.var.now().toISOString(),
        auditEventId: crypto.randomUUID(),
      })
      if (plan instanceof Error) return plan
      return Object.freeze({ plan, assertions: Object.freeze(assertions) })
    } catch (cause) {
      return new Error("retirement coverage unavailable", { cause })
    }
  }
}
