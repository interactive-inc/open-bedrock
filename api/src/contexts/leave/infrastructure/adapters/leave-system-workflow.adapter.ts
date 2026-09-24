import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"

type Context = Parameters<typeof openSystemProcedures>[0] &
  Parameters<typeof openSystemProposals>[0]

/** 休暇のApplicationが使うSystem手続と提案の正本を、Systemの公開operationで開く。 */
export class LeaveSystemWorkflowAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  proposals() {
    return openSystemProposals(this.c)
  }

  procedures() {
    return openSystemProcedures(this.c)
  }
}
