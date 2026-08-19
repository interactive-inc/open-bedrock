"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createRoleAction } from "@/app/(app)/system/roles/actions"
import type { RoleCreateFormState } from "@/app/(app)/system/roles/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type PermissionOption = {
  key: string
  description: string
  category: string
}

type Props = {
  permissions: ReadonlyArray<PermissionOption>
}

const initialState: RoleCreateFormState = { ok: false, error: null }

/**
 * 動的ロール作成フォーム。キー・名前・説明と、付与する権限をチェックボックスで選ぶ。
 * 権限はカテゴリごとにまとめて表示する。成功・失敗は toast で通知する。成功時は一覧へ遷移する。
 */
export function RoleCreateForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: RoleCreateFormState,
    formData: FormData,
  ): Promise<RoleCreateFormState> {
    const result = await createRoleAction(previousState, formData)

    if (result.ok) {
      toast.success("ロールを作成しました")

      router.push("/system/roles")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, isPending] = useActionState(reduce, initialState)

  const categories = [...new Set(props.permissions.map((permission) => permission.category))]

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="key">キー（名前空間:名前、不変）</FieldLabel>
        <Input
          id="key"
          name="key"
          required
          minLength={3}
          maxLength={100}
          pattern="[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*"
          placeholder="company:auditor"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="name">名前</FieldLabel>
        <Input id="name" name="name" required maxLength={100} placeholder="監査担当" />
      </Field>

      <Field>
        <FieldLabel htmlFor="description">説明（任意）</FieldLabel>
        <Input id="description" name="description" maxLength={1000} />
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
                    <input type="checkbox" name="permission_keys" value={permission.key} />

                    <span className="font-mono text-xs">{permission.key}</span>

                    <span className="text-muted-foreground">{permission.description}</span>
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>

      {state.error !== null ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "作成中…" : "ロールを作成"}
      </Button>
    </form>
  )
}
