"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { updateRoleAction } from "@/app/(app)/admin/roles/actions"
import type { RoleUpdateFormState } from "@/app/(app)/admin/roles/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type PermissionOption = {
  key: string
  description: string
  category: string
}

type Props = {
  roleId: number
  name: string
  description: string | null
  grantedPermissionKeys: ReadonlyArray<string>
  permissions: ReadonlyArray<PermissionOption>
}

const initialState: RoleUpdateFormState = { ok: false, error: null }

// ロール編集フォーム。現在の名前・説明・権限を初期値に表示し、変更を PATCH する。
export function RoleEditForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: RoleUpdateFormState,
    formData: FormData,
  ): Promise<RoleUpdateFormState> {
    const result = await updateRoleAction(previousState, formData)

    if (result.ok) {
      toast.success("ロールを更新しました")

      router.push("/admin/roles")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, isPending] = useActionState(reduce, initialState)

  const granted = new Set(props.grantedPermissionKeys)

  const categories = [...new Set(props.permissions.map((permission) => permission.category))]

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="role_id" value={props.roleId} />

      <Field>
        <FieldLabel htmlFor="name">名前</FieldLabel>
        <Input id="name" name="name" required maxLength={200} defaultValue={props.name} />
      </Field>

      <Field>
        <FieldLabel htmlFor="description">説明（任意）</FieldLabel>
        <Input
          id="description"
          name="description"
          maxLength={1000}
          defaultValue={props.description ?? ""}
        />
      </Field>

      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">付与する権限</p>

        {categories.map((category) => (
          <div key={category} className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{category}</p>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {props.permissions
                .filter((permission) => permission.category === category)
                .map((permission) => (
                  <label key={permission.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="permission_keys"
                      value={permission.key}
                      defaultChecked={granted.has(permission.key)}
                    />

                    <span className="font-mono text-xs">{permission.key}</span>

                    <span className="text-muted-foreground">{permission.description}</span>
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "更新中…" : "変更を保存"}
      </Button>
    </form>
  )
}
