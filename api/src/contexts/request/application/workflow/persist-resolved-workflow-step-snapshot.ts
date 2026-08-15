import type { Context } from "@/env"
import {
  ApplicationWorkflowRepository,
  type WorkflowStepSnapshot,
} from "@/contexts/request/infrastructure/application-workflow-repository"
import { WorkflowSql } from "@/contexts/request/infrastructure/workflow-sql"

/**
 * legacy_backfill で解決したスナップショットを INSERT OR IGNORE で永続化し、
 * 保存後の行を読み直して返す
 */
export async function persistResolvedWorkflowStepSnapshot(props: {
  c: Context
  snapshot: WorkflowStepSnapshot
}): Promise<WorkflowStepSnapshot | Error> {
  try {
    await props.c.env.DB.batch([
      ...new WorkflowSql(props.c.env.DB).insert({
        applicationId: props.snapshot.applicationId,
        stepKey: props.snapshot.stepKey,
        round: props.snapshot.round,
        snapshot: {
          requiredApprovals: props.snapshot.requiredApprovals,
          activatedAt: props.snapshot.activatedAt,
          dueAt: props.snapshot.dueAt,
          escalatedAt: props.snapshot.escalatedAt,
          resolutionReason:
            props.snapshot.resolutionReason === "activation"
              ? "activation"
              : props.snapshot.resolutionReason === "manual_repair"
                ? "manual_repair"
                : "legacy_backfill",
          resolutionId: props.snapshot.resolutionId,
          candidates: props.snapshot.candidates.map((candidate) => ({
            ...candidate,
            source: candidate.source === "escalation" ? "escalation" : "primary",
          })),
        },
        ignoreConflicts: true,
      }),
    ])
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to backfill workflow step snapshot")
  }

  const persisted = await new ApplicationWorkflowRepository(props.c).findStepSnapshot(
    props.snapshot.applicationId,
    props.snapshot.stepKey,
    props.snapshot.round,
  )

  return persisted ?? new Error("workflow step snapshot was not persisted")
}
