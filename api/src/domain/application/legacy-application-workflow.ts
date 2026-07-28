import {
  zApplicationWorkflow,
  type ApplicationWorkflow,
} from "@/domain/application/application-workflow"

/**
 * 承認ロールのみ持つ旧定義を、単一の承認ステップからなる現行ワークフローへ変換する
 */
export function legacyApplicationWorkflow(
  approverRoles: ReadonlyArray<string>,
): ApplicationWorkflow {
  return zApplicationWorkflow.parse({
    version: 1,
    steps: [
      {
        key: "manager_approval",
        name: "承認",
        approvers:
          approverRoles.length > 0
            ? approverRoles.map((roleKey) => ({ type: "role" as const, role_key: roleKey }))
            : [{ type: "direct_manager" as const }],
      },
    ],
  })
}
