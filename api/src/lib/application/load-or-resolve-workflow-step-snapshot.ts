import type { ApplicationWorkflowStep } from "@/contexts/company/domain/application/application-workflow"
import type { Context } from "@/env"
import type {
  WorkflowInstance,
  WorkflowStepSnapshot,
} from "@/contexts/company/infrastructure/application/application-workflow-repository"
import { ApplicationWorkflowRepository } from "@/contexts/company/infrastructure/application/application-workflow-repository"
import { resolveWorkflowStepSnapshot } from "@/lib/application/resolve-workflow-step-snapshot"

export type ResolvedWorkflowStepSnapshot = {
  snapshot: WorkflowStepSnapshot
  persisted: boolean
}

/**
 * 既存スナップショットがあれば読み出し、無ければ legacy_backfill として解決する。
 * 解決した場合は persisted=false のまま返し、永続化は呼び出し側に委ねる
 */
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
