import type { Session } from "@/contexts/company/domain/iam/session"
import { canDecideLegacyApplication } from "@/lib/application/can-decide-legacy-application"
import { NotifyApprovalResult } from "@/contexts/company/application/notification/notify-approval-result"
import { ApplicationApproval } from "@/contexts/company/domain/application/application-approval.entity"
import type { Context } from "@/env"
import { ApplicationRepository } from "@/contexts/company/infrastructure/application/application-repository"
import { ApplicationTemplateRepository } from "@/contexts/company/infrastructure/application/application-template-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { ApplicationWorkflowRepository } from "@/contexts/company/infrastructure/application/application-workflow-repository"
import { decideWorkflowApplication } from "@/contexts/company/application/application/decide-workflow-application"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"

export type Command = {
  session: Session
  applicationId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

export type ApplicationDecision = {
  status: "pending" | "approved" | "rejected"
}

/**
 * 申請のステータスを pending からの条件付き UPDATE で確定し、承認記録を同時に INSERT する。
 * D1 batch で status UPDATE と approval INSERT をアトミックに行うため、
 * status だけ確定し承認記録が欠損する不整合は起きない。
 * 並行リクエストは条件付き UPDATE でどちらか 1 件しか確定できず、承認記録も重複しない。
 */
export class DecideApplication {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ApplicationDecision | ApplicationError> {
    if (command.session.employeeId !== command.approverId) {
      return new ForbiddenError("cannot decide as another employee", "forbidden")
    }

    const applicationRepository = new ApplicationRepository(this.c)

    const existing = await applicationRepository.findById(command.applicationId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find application", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("application not found", "application_not_found")
    }

    const applicationTemplateRepository = new ApplicationTemplateRepository(this.c)

    const template = await applicationTemplateRepository.findById(existing.templateId)

    if (template instanceof Error) {
      return new UnexpectedError("failed to find application template", { cause: template })
    }

    if (template === null) {
      return new UnexpectedError("template not found")
    }

    const workflowInstance = await new ApplicationWorkflowRepository(this.c).findInstance(
      command.applicationId,
    )

    if (workflowInstance instanceof Error) {
      return new UnexpectedError("failed to load workflow instance", { cause: workflowInstance })
    }

    if (workflowInstance !== null) {
      if (
        existing.status !== "pending" ||
        existing.currentStep !== workflowInstance.currentStepKey
      ) {
        return new ConflictError("workflow is not awaiting a decision", "already_decided")
      }

      const applicant = await new EmployeeRepository(this.c).findById(existing.applicantId)
      if (applicant instanceof Error) {
        return new UnexpectedError("failed to find workflow applicant", { cause: applicant })
      }
      if (applicant === null) {
        return new UnexpectedError("workflow applicant not found")
      }

      const decision = await decideWorkflowApplication({
        c: this.c,
        instance: workflowInstance,
        templateCode: template.code,
        applicantEmployeeId: existing.applicantId,
        applicant: {
          id: applicant.id,
          code: applicant.code,
          dept_id: applicant.deptId,
          dept_name: applicant.deptName,
          position: applicant.position,
          status: applicant.status,
        },
        payload: existing.payload,
        actorEmployeeId: command.approverId,
        actorAccountId: command.session.accountId,
        session: command.session,
        action: command.action,
        comment: command.comment,
        createdAt: command.createdAt,
      })

      if (decision instanceof Error) return decision

      if (decision.status !== "pending" || command.action === "reject") {
        await new NotifyApprovalResult(this.c).run({
          recipientEmployeeId: existing.applicantId,
          action: command.action,
          subjectLabel: `申請「${template.name}」`,
          sourceDomain: "application",
          sourceId: command.applicationId,
          createdAt: command.createdAt,
        })
      }

      return decision
    }

    const canDecideLegacy = await canDecideLegacyApplication({
      c: this.c,
      session: command.session,
      applicantEmployeeId: existing.applicantId,
      approverRoles: template.approverRoles,
    })
    if (canDecideLegacy instanceof Error) {
      return new UnexpectedError("failed to resolve organization authority", {
        cause: canDecideLegacy,
      })
    }
    if (canDecideLegacy === false) {
      return new ForbiddenError("cannot decide application outside organization scope", "forbidden")
    }

    if (existing.applicantId === command.approverId) {
      return new ForbiddenError("cannot decide own application", "forbidden")
    }

    if (existing.status !== "pending") {
      return new ConflictError("application is already decided", "already_decided")
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const approval = ApplicationApproval.create({
      applicationId: command.applicationId,
      approverId: command.approverId,
      action: command.action,
      comment: command.comment,
      createdAt: command.createdAt,
    })

    const decided = await applicationRepository.decideFromPendingWithApproval({
      applicationId: command.applicationId,
      status: nextStatus,
      approval,
    })

    if (decided instanceof Error) {
      return new UnexpectedError("failed to decide application", { cause: decided })
    }

    if (decided === null) {
      // 条件付き UPDATE が 0 行更新だった。並行リクエストに先を越されたケースを再読込で分類する。
      const current = await applicationRepository.findById(command.applicationId)

      if (current instanceof Error) {
        return new UnexpectedError("failed to find application", { cause: current })
      }

      if (current === null) {
        return new NotFoundError("application not found", "application_not_found")
      }

      return new ConflictError("application is already decided", "already_decided")
    }

    // 決定は確定済みのため、申請者への結果通知が失敗しても決定は返す。
    await new NotifyApprovalResult(this.c).run({
      recipientEmployeeId: existing.applicantId,
      action: command.action,
      subjectLabel: `申請「${template.name}」`,
      sourceDomain: "application",
      sourceId: command.applicationId,
      createdAt: command.createdAt,
    })

    return { status: decided.status }
  }
}
