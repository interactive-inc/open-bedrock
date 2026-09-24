import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

export type PostingDepartmentOption = {
  id: string
  name: string
}

type Props = {
  id: string
  options: ReadonlyArray<PostingDepartmentOption>
  defaultValue: string | null
  // 現在の組織に無い（廃止済みなどの）設定済み部署。選択肢に残して値を失わないようにする。
  currentUnit: PostingDepartmentOption | null
  // 組織単位を参照していない旧記録の部署名。参考表示だけに使う。
  legacyDeptName: string | null
}

/**
 * 公募の募集部署を Company の組織単位から選ぶ。未選択は部署未設定として送る。
 */
export function PostingDepartmentSelect(props: Props) {
  const hasCurrentUnit =
    props.currentUnit !== null &&
    props.options.some((option) => option.id === props.currentUnit?.id) === false

  return (
    <Field>
      <FieldLabel htmlFor={props.id}>募集部署</FieldLabel>

      <NativeSelect
        id={props.id}
        name="organization_unit_id"
        defaultValue={props.defaultValue ?? ""}
      >
        <NativeSelectOption value="">部署未設定</NativeSelectOption>

        {hasCurrentUnit && props.currentUnit !== null ? (
          <NativeSelectOption value={props.currentUnit.id}>
            {props.currentUnit.name}（現在の設定）
          </NativeSelectOption>
        ) : null}

        {props.options.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {option.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {props.legacyDeptName !== null && props.defaultValue === null ? (
        <FieldDescription>以前の部署名: {props.legacyDeptName}</FieldDescription>
      ) : null}
    </Field>
  )
}
