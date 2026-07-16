import type { ApplicationWorkflowStep } from "@/domain/application/application-workflow"
import type { Context } from "@/env"
import type {
  WorkflowInstance,
  WorkflowStepSnapshot,
} from "@/infrastructure/application/application-workflow-repository"
import {
  ApplicationWorkflowRepository,
  workflowStepSnapshotInsertStatements,
} from "@/infrastructure/application/application-workflow-repository"
import { resolveWorkflowStepSnapshot } from "@/lib/application/resolve-workflow-step-snapshot"

export type ResolvedWorkflowStepSnapshot = {
  snapshot: WorkflowStepSnapshot
  persisted: boolean
}

export async function loadOrResolveWorkflowStepSnapshot(props: {
  c: Context
  instance: WorkflowInstance
  applicantEmployeeId: number | null
  step: ApplicationWorkflowStep
  now: string
  excludedEmployeeIds?: ReadonlySet<number>
  targetDepartmentCode?: string | null
}): Promise<ResolvedWorkflowStepSnapshot | Error> {
  const repository = new ApplicationWorkflowRepository(props.c)
  const existing = await repository.findStepSnapshot(
    props.instance.applicationId,
    props.step.key,
    props.instance.currentRound,
  )

  if (existing instanceof Error) return existing
  if (existing !== null) return { snapshot: existing, persisted: true }

  const backfill = await resolveWorkflowStepSnapshot({
    c: props.c,
    applicantEmployeeId: props.applicantEmployeeId,
    step: props.step,
    activatedAt: props.instance.startedAt,
    resolvedAt: props.now,
    resolutionReason: "legacy_backfill",
    excludedEmployeeIds: props.excludedEmployeeIds,
    targetDepartmentCode: props.targetDepartmentCode,
  })

  if (backfill instanceof Error) return backfill

  return {
    persisted: false,
    snapshot: {
      applicationId: props.instance.applicationId,
      stepKey: props.step.key,
      round: props.instance.currentRound,
      ...backfill,
    },
  }
}

export async function persistResolvedWorkflowStepSnapshot(props: {
  c: Context
  snapshot: WorkflowStepSnapshot
}): Promise<WorkflowStepSnapshot | Error> {
  try {
    await props.c.env.DB.batch([
      ...workflowStepSnapshotInsertStatements({
        db: props.c.env.DB,
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
