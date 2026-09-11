"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { WorkflowApproverSelector } from "@/lib/api/types/application-workflow-types"
/** 従業員や上長による承認者指定を編集する。 */
export function ApproverRow(props: {
  selector: WorkflowApproverSelector
  typeInputId: string
  typeInputLabel: string
  onChange: (selector: WorkflowApproverSelector) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const value =
    props.selector.type === "role"
      ? props.selector.role_key
      : props.selector.type === "employee"
        ? props.selector.employee_code
        : ""
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <NativeSelect
        id={props.typeInputId}
        aria-label={props.typeInputLabel}
        value={props.selector.type}
        onChange={(event) => {
          const type = event.target.value as WorkflowApproverSelector["type"]
          props.onChange(
            type === "role"
              ? { type, role_key: "" }
              : type === "employee"
                ? { type, employee_code: "" }
                : type === "responsibility"
                  ? { type, responsibility_type: "", organization_unit_code: null }
                  : { type },
          )
        }}
      >
        <NativeSelectOption value="direct_manager">直属上司</NativeSelectOption>
        <NativeSelectOption value="department_manager">部門責任者</NativeSelectOption>
        <NativeSelectOption value="target_department_manager">異動先部門責任者</NativeSelectOption>
        <NativeSelectOption value="management_chain">上位管理職全員</NativeSelectOption>
        <NativeSelectOption value="responsibility">組織責務</NativeSelectOption>
        <NativeSelectOption value="role">IAMロール</NativeSelectOption>
        <NativeSelectOption value="employee">従業員指定</NativeSelectOption>
      </NativeSelect>
      {props.selector.type === "responsibility" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="責務タイプ"
            placeholder="PEOPLE_OPERATIONS"
            pattern="[A-Z][A-Z0-9_]*"
            maxLength={64}
            value={props.selector.responsibility_type}
            onChange={(event) =>
              props.onChange({
                type: "responsibility",
                responsibility_type: event.target.value,
                organization_unit_code:
                  props.selector.type === "responsibility"
                    ? props.selector.organization_unit_code
                    : null,
              })
            }
          />
          <Input
            aria-label="組織コード（任意）"
            placeholder="未指定なら全組織"
            value={props.selector.organization_unit_code ?? ""}
            onChange={(event) =>
              props.onChange({
                type: "responsibility",
                responsibility_type:
                  props.selector.type === "responsibility"
                    ? props.selector.responsibility_type
                    : "",
                organization_unit_code: event.target.value === "" ? null : event.target.value,
              })
            }
          />
        </div>
      ) : props.selector.type === "role" || props.selector.type === "employee" ? (
        <Input
          aria-label={props.selector.type === "role" ? "ロールキー" : "従業員コード"}
          placeholder={props.selector.type === "role" ? "role_key" : "E001"}
          value={value}
          onChange={(event) =>
            props.onChange(
              props.selector.type === "role"
                ? { type: "role", role_key: event.target.value }
                : { type: "employee", employee_code: event.target.value },
            )
          }
        />
      ) : (
        <div />
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!props.canDelete}
        onClick={props.onDelete}
      >
        削除
      </Button>
    </div>
  )
}
