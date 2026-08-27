import type { Context } from "@/env"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import type { ProcedureKey } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SystemD1ProcedureRepository } from "@system/infrastructure/workflow/system-d1-procedure.repository"
import { SystemD1WorkflowWriter } from "@system/infrastructure/workflow/system-d1-workflow-writer.repository"

/** Companyの人事申請をSystem workflowへ接続する技術境界。 */
export class PersonnelActionRequestWorkflowAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findCurrent(procedureKey: ProcedureKey) {
    return new SystemD1ProcedureRepository({ env: { DB: this.c.env.DB } }).findCurrent(procedureKey)
  }

  async start(input: Parameters<StartSystemProcedure["run"]>[0]) {
    return new StartSystemProcedure(this.writer()).run(input)
  }

  async cancel(input: Parameters<CancelSystemProcedure["run"]>[0]) {
    return new CancelSystemProcedure(this.writer()).run(input)
  }

  async organizationRevision(): Promise<number | Error> {
    try {
      return (
        (await this.c.env.DB.prepare(
          "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
        ).first<number>("revision")) ?? 0
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to load organization revision")
    }
  }

  private writer(): SystemD1WorkflowWriter {
    return new SystemD1WorkflowWriter({ env: { DB: this.c.env.DB } })
  }
}
