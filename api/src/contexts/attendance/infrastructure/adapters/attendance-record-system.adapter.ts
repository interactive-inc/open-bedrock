import type { SystemD1Context } from "@system/configuration/system-context"
import { openSystemRecordCoveragePages } from "@system/interface/operations/open-system-record-coverage-pages"
import { openSystemRecordRetirementVerificationPlans } from "@system/interface/operations/open-system-record-retirement-verification-plans"
import { openSystemRecordRetirementVerificationReceipts } from "@system/interface/operations/open-system-record-retirement-verification-receipts"
import { openSystemRecordSourceFreezes } from "@system/interface/operations/open-system-record-source-freezes"
import { prepareSystemRecordKindCoverage } from "@system/interface/operations/prepare-system-record-kind-coverage"
import { prepareSystemRecordRetirementPageKeys } from "@system/interface/operations/prepare-system-record-retirement-page-keys"
import { prepareSystemRecordSourceFreezeAuthorization } from "@system/interface/operations/prepare-system-record-source-freeze-authorization"

type Context = SystemD1Context &
  Readonly<{
    env: Readonly<{ ATTACHMENT_KEKS?: string }>
    assertions?: ReadonlyArray<D1PreparedStatement>
  }>

/** attendanceのApplicationが使うSystem記録操作を、現在の照合文へ束縛して提供する。 */
export class AttendanceRecordSystemAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepareSourceFreezeAuthorization(
    input: Parameters<typeof prepareSystemRecordSourceFreezeAuthorization>[1],
  ) {
    return prepareSystemRecordSourceFreezeAuthorization(this.c, input)
  }

  sourceFreezes() {
    return openSystemRecordSourceFreezes(this.guarded())
  }

  coveragePages() {
    return openSystemRecordCoveragePages(this.guarded())
  }

  retirementPlans() {
    return openSystemRecordRetirementVerificationPlans(this.guarded())
  }

  retirementReceipts() {
    return openSystemRecordRetirementVerificationReceipts(this.guarded())
  }

  prepareKindCoverage(input: unknown) {
    return prepareSystemRecordKindCoverage(this.guarded(), input)
  }

  prepareRetirementPageKeys(pageId: string) {
    return prepareSystemRecordRetirementPageKeys(this.guarded(), pageId)
  }

  private guarded() {
    return { env: this.c.env, assertions: this.c.assertions ?? [] }
  }
}
