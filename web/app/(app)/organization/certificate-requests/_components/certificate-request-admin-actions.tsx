"use client"

import { useActionState } from "react"
import {
  issueCertificateRequestAction,
  rejectCertificateRequestAction,
} from "@/app/(app)/my/certificate-requests/actions"
import type { CertificateRequestActionState } from "@/app/(app)/my/certificate-requests/actions"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"

type Props = {
  certificateRequestId: string
}

const initialState: CertificateRequestActionState = { ok: false, error: null }

// admin 一覧の行アクション。requested の依頼を人事が発行/却下する。
// 発行と却下でそれぞれ独立の Server Action を持ち、id を hidden で渡す。
export function CertificateRequestAdminActions(props: Props) {
  const issue = useActionState(issueCertificateRequestAction, initialState)

  const reject = useActionState(rejectCertificateRequestAction, initialState)

  const issueState = issue[0]

  const issueAction = issue[1]

  const isIssuePending = issue[2]

  const rejectState = reject[0]

  const rejectAction = reject[1]

  const isRejectPending = reject[2]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <form action={issueAction}>
          <input type="hidden" name="certificate_request_id" value={props.certificateRequestId} />

          <Button type="submit" size="sm" disabled={isIssuePending}>
            発行
          </Button>
        </form>

        <form action={rejectAction}>
          <input type="hidden" name="certificate_request_id" value={props.certificateRequestId} />

          <Button type="submit" size="sm" variant="destructive" disabled={isRejectPending}>
            却下
          </Button>
        </form>
      </div>

      {issueState.error !== null ? <FieldError>{issueState.error}</FieldError> : null}

      {rejectState.error !== null ? <FieldError>{rejectState.error}</FieldError> : null}
    </div>
  )
}
