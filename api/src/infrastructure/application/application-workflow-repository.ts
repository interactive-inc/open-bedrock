import type { ApplicationWorkflow } from "@/domain/application/application-workflow"
import { parseApplicationWorkflow } from "@/domain/application/application-workflow"
import type { Context } from "@/env"
import {
  applicationWorkflowApprovals,
  applicationWorkflowInstances,
  applicationWorkflows,
} from "@/schema"
import { eq } from "drizzle-orm"

export type WorkflowInstance = {
  applicationId: number
  definition: ApplicationWorkflow
  currentStepKey: string
  currentRound: number
  startedAt: string
  dueAt: string | null
}

export class ApplicationWorkflowRepository {
  constructor(private readonly c: Context) {}

  async findDefinition(templateId: number): Promise<ApplicationWorkflow | null | Error> {
    try {
      const row = await this.c.var.database
        .select({ definitionJson: applicationWorkflows.definitionJson })
        .from(applicationWorkflows)
        .where(eq(applicationWorkflows.templateId, templateId))
        .limit(1)
        .then((rows) => rows.at(0))

      if (row === undefined) return null

      return decode(row.definitionJson)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load application workflow")
    }
  }

  async upsertDefinition(props: {
    templateId: number
    definition: ApplicationWorkflow
    updatedAt: string
  }): Promise<null | Error> {
    try {
      await this.c.var.database
        .insert(applicationWorkflows)
        .values({
          templateId: props.templateId,
          definitionJson: JSON.stringify(props.definition),
          updatedAt: props.updatedAt,
        })
        .onConflictDoUpdate({
          target: applicationWorkflows.templateId,
          set: {
            definitionJson: JSON.stringify(props.definition),
            updatedAt: props.updatedAt,
          },
        })

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save application workflow")
    }
  }

  async createInstance(props: {
    applicationId: number
    definition: ApplicationWorkflow
    currentStepKey: string
    startedAt: string
    dueAt: string | null
  }): Promise<null | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `INSERT INTO application_workflow_instances
             (application_id, definition_json, current_step_key, started_at, due_at)
             VALUES (?1, ?2, ?3, ?4, ?5)`,
        ).bind(
          props.applicationId,
          JSON.stringify(props.definition),
          props.currentStepKey,
          props.startedAt,
          props.dueAt,
        ),
        this.c.env.DB.prepare(
          "UPDATE applications SET current_step = ?2 WHERE id = ?1 AND status = 'pending'",
        ).bind(props.applicationId, props.currentStepKey),
      ])

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create workflow instance")
    }
  }

  async findInstance(applicationId: number): Promise<WorkflowInstance | null | Error> {
    try {
      const row = await this.c.var.database
        .select()
        .from(applicationWorkflowInstances)
        .where(eq(applicationWorkflowInstances.applicationId, applicationId))
        .limit(1)
        .then((rows) => rows.at(0))

      if (row === undefined) return null

      const definition = decode(row.definitionJson)

      return definition instanceof Error
        ? definition
        : {
            applicationId: row.applicationId,
            definition,
            currentStepKey: row.currentStepKey,
            currentRound: row.currentRound,
            startedAt: row.startedAt,
            dueAt: row.dueAt,
          }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load workflow instance")
    }
  }

  async listApprovals(applicationId: number, stepKey?: string, round?: number) {
    try {
      return await this.c.var.database
        .select()
        .from(applicationWorkflowApprovals)
        .where(eq(applicationWorkflowApprovals.applicationId, applicationId))
        .then((rows) =>
          rows.filter(
            (row) =>
              (stepKey === undefined || row.stepKey === stepKey) &&
              (round === undefined || row.round === round),
          ),
        )
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load workflow approvals")
    }
  }
}

function decode(json: string): ApplicationWorkflow | Error {
  try {
    return parseApplicationWorkflow(JSON.parse(json))
  } catch {
    return new Error("workflow definition is not valid JSON")
  }
}
