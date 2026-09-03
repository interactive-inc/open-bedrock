"use client"

import { useActionState } from "react"
import {
  addRegulationVersionAction,
  archiveRegulationAction,
} from "@/app/(app)/regulation/regulations/actions"
import type { RegulationActionState } from "@/app/(app)/regulation/regulations/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: RegulationActionState = { ok: false, error: null }

type Props = {
  code: string
  status: string
}

/**
 * 規程の新版追加フォームとアーカイブ操作。管理者にのみ表示される。
 */
export function RegulationManageActions(props: Props) {
  const addVersion = useActionState(addRegulationVersionAction, initialState)

  const archive = useActionState(archiveRegulationAction, initialState)

  const addState = addVersion[0]

  const addAction = addVersion[1]

  const addPending = addVersion[2]

  const archiveState = archive[0]

  const archiveAction = archive[1]

  const archivePending = archive[2]

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-card border p-4">
      <form action={addAction} className="flex flex-col gap-4">
        <input type="hidden" name="code" value={props.code} />

        <h2 className="text-sm font-medium">新版を追加</h2>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="regulation_version_effective_on">施行日</FieldLabel>

            <Input id="regulation_version_effective_on" name="effective_on" type="date" />
          </Field>

          <Field>
            <FieldLabel htmlFor="regulation_version_body">本文（Markdown）</FieldLabel>

            <Textarea id="regulation_version_body" name="body_md" rows={6} />
          </Field>

          <Field>
            <FieldLabel htmlFor="regulation_version_note">備考（任意）</FieldLabel>

            <Input id="regulation_version_note" name="note" />
          </Field>
        </FieldGroup>

        {addState.error === null ? null : <FieldError>{addState.error}</FieldError>}

        {addState.ok ? <p className="text-sm text-muted-foreground">新版を追加しました</p> : null}

        <Button type="submit" disabled={addPending} className="w-fit">
          {addPending ? "追加中..." : "新版を追加"}
        </Button>
      </form>

      {props.status === "archived" ? null : (
        <form action={archiveAction}>
          <input type="hidden" name="code" value={props.code} />

          <Button type="submit" variant="outline" disabled={archivePending}>
            {archivePending ? "アーカイブ中..." : "規程をアーカイブ"}
          </Button>
        </form>
      )}

      {archiveState.error === null ? null : <FieldError>{archiveState.error}</FieldError>}
    </div>
  )
}
