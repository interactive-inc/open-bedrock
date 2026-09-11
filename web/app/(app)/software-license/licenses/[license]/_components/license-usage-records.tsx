import type { getLicenseAssignments } from "@/lib/api/get-license-assignments"
import { ReleaseAssignmentDialog } from "@/app/(app)/software-license/licenses/[license]/_components/release-assignment-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  assignments: Exclude<Awaited<ReturnType<typeof getLicenseAssignments>>, Error>["data"]
  state: "assigned" | "released"
  canManage: boolean
  serviceName: string
}

/** 利用開始時のプランと解除理由を履歴として表示する。 */
export function LicenseUsageRecords(props: Props) {
  return (
    <>
      {props.assignments.length === 0 ? (
        <p>
          {props.state === "assigned" ? "利用中の職員は記録されていません" : "解除履歴はありません"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="サービスの利用者">
            <TableHeader>
              <TableRow>
                {[
                  "職員",
                  "利用開始時のプラン",
                  "外部アカウント",
                  "利用開始の記録",
                  "解除の記録",
                ].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    {assignment.employee_name ?? "氏名を参照できない職員"}
                    <p>{assignment.employee_id}</p>
                  </TableCell>
                  <TableCell>{assignment.plan_name ?? "未設定"}</TableCell>
                  <TableCell>{assignment.account_reference ?? "未設定"}</TableCell>
                  <TableCell>
                    <time>{new Date(assignment.assigned_at).toISOString()}</time>
                    <p>{assignment.assigned_reason}</p>
                  </TableCell>
                  <TableCell>
                    {assignment.released_at === null ? (
                      <>
                        <p>利用中</p>
                        {props.canManage ? (
                          <ReleaseAssignmentDialog
                            assignmentId={assignment.id}
                            employeeName={assignment.employee_name ?? assignment.employee_id}
                            serviceName={props.serviceName}
                          />
                        ) : null}
                      </>
                    ) : (
                      <>
                        <time>{new Date(assignment.released_at).toISOString()}</time>
                        <p>{assignment.release_reason}</p>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
