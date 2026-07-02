"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { setLocaleAction } from "@/app/(app)/settings/actions"
import type { SetLocaleState } from "@/app/(app)/settings/actions"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Locale } from "@/lib/i18n/locale"

const initialState: SetLocaleState = { ok: true, error: null }

const localeOptions: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
]

type Props = {
  locale: Locale
}

export function LocaleField(props: Props) {
  const router = useRouter()

  // action 完了後に画面の Server Component を再取得して `<html lang>` や辞書に反映する。
  // レンダー中には副作用を起こさない（useEffect は使わない）。
  const action = useActionState(async (previousState: SetLocaleState, formData: FormData) => {
    const next = await setLocaleAction(previousState, formData)

    router.refresh()

    return next
  }, initialState)

  const dispatch = action[1]

  const isPending = action[2]

  function handleValueChange(value: string | null) {
    if (value === null) return

    const formData = new FormData()

    formData.set("locale", value)

    dispatch(formData)
  }

  return (
    <FieldGroup>
      <Field orientation="responsive">
        <FieldContent>
          <FieldTitle id="locale-label">表示言語</FieldTitle>
          <FieldDescription>設定した言語で画面のテキストを表示します。</FieldDescription>
        </FieldContent>

        <Select value={props.locale} onValueChange={handleValueChange} disabled={isPending}>
          <SelectTrigger aria-labelledby="locale-label" className="w-full sm:w-fit">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {localeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  )
}
