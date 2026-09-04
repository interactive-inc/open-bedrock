"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  acknowledgeGovernanceAction,
  publishGovernanceAction,
  reviewGovernanceAction,
  submitGovernanceReviewAction,
  type GovernanceActionState,
} from "@/app/(app)/governance/governance-documents/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

const initialState: GovernanceActionState = { ok: false, error: null }

async function reduceReview(
  state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const result = await reviewGovernanceAction(state, formData)
  if (result.ok) toast.success("レビュー判断を記録しました")
  else if (result.error !== null) toast.error(result.error)
  return result
}

type Approval = {
  org_role_code: string
  status: "pending" | "approved" | "rejected"
  can_decide: boolean
}

type Props = {
  code: string
  version: string
  versionState: "draft" | "in_review" | "published" | "superseded" | "rejected"
  publicationMode: "direct" | "approval"
  acknowledgementRequired: boolean
  acknowledged: boolean
  permissions: ReadonlyArray<string>
  approvals: ReadonlyArray<Approval>
}

export function DocumentWorkflowActions(props: Props) {
  const canManage = props.permissions.includes("governance:manage")
  const canPublish = props.permissions.includes("governance:publish")
  const canReview = props.permissions.includes("governance:review")
  const canAcknowledge = props.permissions.includes("governance:acknowledge")
  const pendingApprovals = props.approvals.filter((approval) => approval.status === "pending")
  const actionableApprovals = pendingApprovals.filter((approval) => approval.can_decide)
  const publishable =
    canPublish &&
    ((props.publicationMode === "direct" && props.versionState === "draft") ||
      (props.publicationMode === "approval" &&
        props.versionState === "in_review" &&
        props.approvals.length > 0 &&
        pendingApprovals.length === 0 &&
        props.approvals.every((approval) => approval.status === "approved")))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {canManage && props.publicationMode === "approval" && props.versionState === "draft" ? (
          <SimpleActionForm
            action={submitGovernanceReviewAction}
            successMessage="レビューへ提出しました"
            fields={{ code: props.code, version: props.version }}
            label="レビューへ提出"
          />
        ) : null}

        {publishable ? (
          <SimpleActionForm
            action={publishGovernanceAction}
            successMessage="公開しました"
            fields={{ code: props.code, version: props.version }}
            label="この版を公開"
          />
        ) : null}

        {canAcknowledge && props.acknowledgementRequired && props.versionState === "published" ? (
          props.acknowledged ? (
            <Button variant="secondary" disabled>
              確認済み
            </Button>
          ) : (
            <SimpleActionForm
              action={acknowledgeGovernanceAction}
              successMessage="確認を記録しました"
              fields={{ code: props.code }}
              label="内容を確認した"
            />
          )
        ) : null}
      </div>

      {canReview && props.versionState === "in_review" && actionableApprovals.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {actionableApprovals.map((approval) => (
            <ReviewForm
              key={approval.org_role_code}
              code={props.code}
              version={props.version}
              orgRoleCode={approval.org_role_code}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

type Action = (state: GovernanceActionState, formData: FormData) => Promise<GovernanceActionState>

function SimpleActionForm(props: {
  action: Action
  fields: Readonly<Record<string, string>>
  label: string
  successMessage: string
}) {
  async function reduce(state: GovernanceActionState, formData: FormData) {
    const result = await props.action(state, formData)
    if (result.ok) toast.success(props.successMessage)
    else if (result.error !== null) toast.error(result.error)
    return result
  }
  const [, action, pending] = useActionState(reduce, initialState)
  return (
    <form action={action}>
      {Object.entries(props.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" disabled={pending}>
        {props.label}
      </Button>
    </form>
  )
}

function ReviewForm(props: { code: string; version: string; orgRoleCode: string }) {
  const [, action, pending] = useActionState(reduceReview, initialState)
  return (
    <form action={action} className="rounded-xl border bg-muted/20 p-4">
      <input type="hidden" name="code" value={props.code} />
      <input type="hidden" name="version" value={props.version} />
      <input type="hidden" name="org_role_code" value={props.orgRoleCode} />
      <p className="mb-4 text-sm font-medium">{props.orgRoleCode} として判断</p>
      <Field className="mb-4">
        <FieldLabel htmlFor={`review-comment-${props.orgRoleCode}`}>コメント（任意）</FieldLabel>
        <Textarea id={`review-comment-${props.orgRoleCode}`} name="comment" maxLength={2000} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="approved" disabled={pending}>
          承認
        </Button>
        <Button
          type="submit"
          name="decision"
          value="rejected"
          variant="destructive"
          disabled={pending}
        >
          差し戻し
        </Button>
      </div>
    </form>
  )
}
