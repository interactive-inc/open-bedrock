"use client"

import { useState } from "react"
import { cancelLifeEventAction, updateLifeEventAction } from "@/app/(app)/my/life-events/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { EmptyState } from "@/components/empty-state"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LifeEventResponse } from "@/lib/api/types/life-event-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { lifeEventTypeLabel } from "@/lib/life-event-type-label"
import { statusLabel } from "@/lib/status-label"

type Props = {
  lifeEvents: ReadonlyArray<LifeEventResponse>
  phone: string | null
}

/** 自分のライフイベント届出一覧。各行に変更（Dialog フォーム）と取消ボタンを置く表示コンポーネント。 */
export function MyLifeEventsList(props: Props) {
  if (props.lifeEvents.length === 0) {
    return <EmptyState title="ライフイベント届出はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>種別</TableHead>
            <TableHead>発生日</TableHead>
            <TableHead>詳細</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.lifeEvents.map((lifeEvent) => (
            <TableRow key={lifeEvent.id}>
              <TableCell>{lifeEventTypeLabel(lifeEvent.event_type)}</TableCell>

              <TableCell>{lifeEvent.event_date}</TableCell>

              <TableCell>{lifeEvent.detail ?? "-"}</TableCell>

              <TableCell>{statusLabel(lifeEvent.status)}</TableCell>

              <TableCell>
                <TableRowActions>
                  <UpdateLifeEventDialog lifeEvent={lifeEvent} phone={props.phone} />

                  <CancelLifeEventButton lifeEventId={lifeEvent.id} />
                </TableRowActions>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** ライフイベント届出変更フォームを Dialog で開く。種別・発生日・詳細を編集して送信する。 */
function UpdateLifeEventDialog(props: { lifeEvent: LifeEventResponse; phone: string | null }) {
  const [open, setOpen] = useState(false)

  const [eventType, setEventType] = useState<string>(props.lifeEvent.event_type)

  const [relocationReason, setRelocationReason] = useState("relocation")

  const [childRelationship, setChildRelationship] = useState("eldest_son")

  const [childDependent, setChildDependent] = useState("yes")

  const [dependentReason, setDependentReason] = useState("marriage")

  const [dependentRelationship, setDependentRelationship] = useState("husband")

  const [dependentOccupation, setDependentOccupation] = useState("unemployed")

  const isRelocation = eventType === "relocation"

  const isChildbirth = eventType === "childbirth"

  const isMarriage = eventType === "marriage"

  const isDivorce = eventType === "divorce"

  const isDependentAdded = eventType === "dependent_added"

  const isDependentRemoved = eventType === "dependent_removed"

  const [state, formAction, pending] = useFormAction(
    updateLifeEventAction,
    { ok: false, error: null },
    "ライフイベント届出を変更しました",
    { onSuccess: () => setOpen(false) },
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>ライフイベント届出を変更</DialogTitle>

          <DialogDescription>種別・発生日・詳細を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="life_event_id" value={props.lifeEvent.id} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_event_type">種別</FieldLabel>

              <NativeSelect
                id="update_event_type"
                name="event_type"
                defaultValue={props.lifeEvent.event_type}
                className="w-full"
                onChange={(event) => setEventType(event.target.value)}
              >
                <NativeSelectOption value="marriage">結婚</NativeSelectOption>

                <NativeSelectOption value="divorce">離婚</NativeSelectOption>

                <NativeSelectOption value="childbirth">出産</NativeSelectOption>

                <NativeSelectOption value="relocation">転居</NativeSelectOption>

                <NativeSelectOption value="dependent_added">扶養追加</NativeSelectOption>

                <NativeSelectOption value="dependent_removed">扶養取消</NativeSelectOption>
              </NativeSelect>
            </Field>

            <Field>
              <FieldLabel htmlFor="update_event_date">
                {isRelocation
                  ? "変更日"
                  : isChildbirth
                    ? "子の出生日"
                    : isMarriage
                      ? "入籍日"
                      : isDivorce
                        ? "氏名変更日（戸籍上の変更日）"
                        : isDependentAdded || isDependentRemoved
                          ? "異動日"
                          : "発生日"}
              </FieldLabel>

              <Input
                id="update_event_date"
                name="event_date"
                type="date"
                defaultValue={props.lifeEvent.event_date}
              />
            </Field>

            {isRelocation ? (
              <>
                <Field>
                  <FieldLabel htmlFor="update_relocation_reason">変更理由</FieldLabel>

                  <NativeSelect
                    id="update_relocation_reason"
                    name="relocation_reason"
                    defaultValue="relocation"
                    className="w-full"
                    onChange={(event) => setRelocationReason(event.target.value)}
                  >
                    <NativeSelectOption value="relocation">転居</NativeSelectOption>

                    <NativeSelectOption value="resident_registration_change">
                      住民票の異動
                    </NativeSelectOption>

                    <NativeSelectOption value="other">その他</NativeSelectOption>
                  </NativeSelect>
                </Field>

                {relocationReason === "other" ? (
                  <Field>
                    <FieldLabel htmlFor="update_relocation_reason_other">その他の理由</FieldLabel>

                    <Input
                      id="update_relocation_reason_other"
                      name="relocation_reason_other"
                      required
                    />
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="update_postal_code">郵便番号（居住地）</FieldLabel>

                  <Input id="update_postal_code" name="postal_code" required />
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_new_address">新住所（居住地）</FieldLabel>

                  <Input id="update_new_address" name="new_address" required />
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_phone_number">電話番号</FieldLabel>

                  <Input
                    id="update_phone_number"
                    name="phone_number"
                    defaultValue={props.phone ?? ""}
                    required
                  />
                </Field>
              </>
            ) : isChildbirth ? (
              <>
                <Field>
                  <FieldLabel htmlFor="update_child_name_kanji">子の氏名（漢字）</FieldLabel>

                  <Input id="update_child_name_kanji" name="child_name_kanji" required />
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_child_name_kana">子の氏名（フリガナ）</FieldLabel>

                  <Input id="update_child_name_kana" name="child_name_kana" required />
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_child_relationship">続柄</FieldLabel>

                  <NativeSelect
                    id="update_child_relationship"
                    name="child_relationship"
                    defaultValue="eldest_son"
                    className="w-full"
                    onChange={(event) => setChildRelationship(event.target.value)}
                  >
                    <NativeSelectOption value="eldest_son">長男</NativeSelectOption>

                    <NativeSelectOption value="eldest_daughter">長女</NativeSelectOption>

                    <NativeSelectOption value="second_son">次男</NativeSelectOption>

                    <NativeSelectOption value="second_daughter">次女</NativeSelectOption>

                    <NativeSelectOption value="third_son">三男</NativeSelectOption>

                    <NativeSelectOption value="third_daughter">三女</NativeSelectOption>

                    <NativeSelectOption value="other">その他</NativeSelectOption>
                  </NativeSelect>
                </Field>

                {childRelationship === "other" ? (
                  <Field>
                    <FieldLabel htmlFor="update_child_relationship_other">
                      続柄（その他）
                    </FieldLabel>

                    <Input
                      id="update_child_relationship_other"
                      name="child_relationship_other"
                      required
                    />
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="update_child_dependent">子の扶養義務</FieldLabel>

                  <NativeSelect
                    id="update_child_dependent"
                    name="child_dependent"
                    defaultValue="yes"
                    className="w-full"
                    onChange={(event) => setChildDependent(event.target.value)}
                  >
                    <NativeSelectOption value="yes">あり</NativeSelectOption>

                    <NativeSelectOption value="no">なし</NativeSelectOption>
                  </NativeSelect>
                </Field>

                {childDependent === "yes" ? (
                  <Field>
                    <FieldLabel htmlFor="update_child_benefit_method">
                      出産育児一時金の受給方法
                    </FieldLabel>

                    <NativeSelect
                      id="update_child_benefit_method"
                      name="childbirth_benefit_method"
                      defaultValue="direct_payment_used"
                      className="w-full"
                    >
                      <NativeSelectOption value="direct_payment_used">
                        直接支払制度を利用した
                      </NativeSelectOption>

                      <NativeSelectOption value="direct_payment_not_used">
                        直接支払制度を利用しなかった
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="update_child_special_leave">
                    出生に伴う特別休暇を取得しますか
                  </FieldLabel>

                  <NativeSelect
                    id="update_child_special_leave"
                    name="childbirth_special_leave"
                    defaultValue="yes"
                    className="w-full"
                  >
                    <NativeSelectOption value="yes">取得する</NativeSelectOption>

                    <NativeSelectOption value="no">取得しない</NativeSelectOption>
                  </NativeSelect>
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_child_childcare_leave">
                    育児休業の取得希望はありますか
                  </FieldLabel>

                  <NativeSelect
                    id="update_child_childcare_leave"
                    name="childcare_leave_intent"
                    defaultValue="yes"
                    className="w-full"
                  >
                    <NativeSelectOption value="yes">ある</NativeSelectOption>

                    <NativeSelectOption value="no">ない</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </>
            ) : isMarriage ? (
              <>
                <Field>
                  <FieldLabel htmlFor="update_marriage_name_kanji">
                    変更後 戸籍氏名（漢字）（姓が変わる場合のみ）
                  </FieldLabel>

                  <Input
                    id="update_marriage_name_kanji"
                    name="marriage_new_name_kanji"
                    placeholder="任意"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_marriage_name_kana">
                    変更後 戸籍氏名（フリガナ）（姓が変わる場合のみ）
                  </FieldLabel>

                  <Input
                    id="update_marriage_name_kana"
                    name="marriage_new_name_kana"
                    placeholder="任意"
                  />
                </Field>
              </>
            ) : isDivorce ? (
              <>
                <Field>
                  <FieldLabel htmlFor="update_divorce_name_kanji">
                    変更後 戸籍氏名（漢字）
                  </FieldLabel>

                  <Input id="update_divorce_name_kanji" name="divorce_new_name_kanji" required />
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_divorce_name_kana">
                    変更後 戸籍氏名（フリガナ）
                  </FieldLabel>

                  <Input id="update_divorce_name_kana" name="divorce_new_name_kana" required />
                </Field>
              </>
            ) : isDependentAdded || isDependentRemoved ? (
              <>
                <Field>
                  <FieldLabel htmlFor="update_dependent_reason">扶養異動理由</FieldLabel>

                  <NativeSelect
                    id="update_dependent_reason"
                    name="dependent_reason"
                    defaultValue={isDependentAdded ? "marriage" : "employment"}
                    className="w-full"
                    onChange={(event) => setDependentReason(event.target.value)}
                  >
                    {isDependentAdded ? (
                      <>
                        <NativeSelectOption value="marriage">対象者との結婚</NativeSelectOption>

                        <NativeSelectOption value="resignation">対象者の退職</NativeSelectOption>

                        <NativeSelectOption value="income_decrease">
                          対象者の収入減少
                        </NativeSelectOption>
                      </>
                    ) : (
                      <>
                        <NativeSelectOption value="employment">対象者の就職</NativeSelectOption>

                        <NativeSelectOption value="divorce">対象者との離婚</NativeSelectOption>

                        <NativeSelectOption value="death">対象者の死亡</NativeSelectOption>
                      </>
                    )}

                    <NativeSelectOption value="other">その他</NativeSelectOption>
                  </NativeSelect>
                </Field>

                {dependentReason === "other" ? (
                  <Field>
                    <FieldLabel htmlFor="update_dependent_reason_other">
                      扶養異動理由（その他）
                    </FieldLabel>

                    <Input
                      id="update_dependent_reason_other"
                      name="dependent_reason_other"
                      required
                    />
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="update_dependent_family_name_kanji">
                    対象家族の氏名（漢字）
                  </FieldLabel>

                  <Input
                    id="update_dependent_family_name_kanji"
                    name="dependent_family_name_kanji"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_dependent_family_name_kana">
                    対象家族の氏名（フリガナ）
                  </FieldLabel>

                  <Input
                    id="update_dependent_family_name_kana"
                    name="dependent_family_name_kana"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="update_dependent_relationship">続柄</FieldLabel>

                  <NativeSelect
                    id="update_dependent_relationship"
                    name="dependent_relationship"
                    defaultValue="husband"
                    className="w-full"
                    onChange={(event) => setDependentRelationship(event.target.value)}
                  >
                    <NativeSelectOption value="husband">夫</NativeSelectOption>

                    <NativeSelectOption value="wife">妻</NativeSelectOption>

                    <NativeSelectOption value="eldest_son">長男</NativeSelectOption>

                    <NativeSelectOption value="eldest_daughter">長女</NativeSelectOption>

                    <NativeSelectOption value="second_son">次男</NativeSelectOption>

                    <NativeSelectOption value="second_daughter">次女</NativeSelectOption>

                    <NativeSelectOption value="father">実父</NativeSelectOption>

                    <NativeSelectOption value="mother">実母</NativeSelectOption>

                    <NativeSelectOption value="father_in_law">義父</NativeSelectOption>

                    <NativeSelectOption value="mother_in_law">義母</NativeSelectOption>

                    <NativeSelectOption value="other">その他</NativeSelectOption>
                  </NativeSelect>
                </Field>

                {dependentRelationship === "other" ? (
                  <Field>
                    <FieldLabel htmlFor="update_dependent_relationship_other">
                      続柄（その他）
                    </FieldLabel>

                    <Input
                      id="update_dependent_relationship_other"
                      name="dependent_relationship_other"
                      required
                    />
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="update_dependent_birth_date">対象家族の生年月日</FieldLabel>

                  <Input
                    id="update_dependent_birth_date"
                    name="dependent_birth_date"
                    type="date"
                    required
                  />
                </Field>

                {isDependentAdded ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="update_dependent_certificate_needed">
                        健康保険 資格確認書の発行は必要ですか？
                      </FieldLabel>

                      <NativeSelect
                        id="update_dependent_certificate_needed"
                        name="dependent_certificate_needed"
                        defaultValue="not_needed"
                        className="w-full"
                      >
                        <NativeSelectOption value="not_needed">不要</NativeSelectOption>

                        <NativeSelectOption value="needed">必要</NativeSelectOption>
                      </NativeSelect>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="update_dependent_occupation">
                        扶養対象となる方の職業
                      </FieldLabel>

                      <NativeSelect
                        id="update_dependent_occupation"
                        name="dependent_occupation"
                        defaultValue="unemployed"
                        className="w-full"
                        onChange={(event) => setDependentOccupation(event.target.value)}
                      >
                        <NativeSelectOption value="unemployed">無職</NativeSelectOption>

                        <NativeSelectOption value="company_employee">会社員</NativeSelectOption>

                        <NativeSelectOption value="self_employed">自営業</NativeSelectOption>

                        <NativeSelectOption value="other">その他</NativeSelectOption>
                      </NativeSelect>
                    </Field>

                    {dependentOccupation === "other" ? (
                      <Field>
                        <FieldLabel htmlFor="update_dependent_occupation_other">
                          扶養対象となる方の職業（その他）
                        </FieldLabel>

                        <Input
                          id="update_dependent_occupation_other"
                          name="dependent_occupation_other"
                        />
                      </Field>
                    ) : null}

                    <Field>
                      <FieldLabel htmlFor="update_dependent_annual_income">
                        扶養対象となる方の年収
                      </FieldLabel>

                      <Input
                        id="update_dependent_annual_income"
                        name="dependent_annual_income"
                        placeholder="例: 0円、90万円"
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="update_detail">詳細</FieldLabel>

                <Input
                  id="update_detail"
                  name="detail"
                  defaultValue={props.lifeEvent.detail ?? ""}
                  maxLength={FORM_CONSTRAINTS.lifeEvent.detailMax}
                />
              </Field>
            )}
          </FieldGroup>

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** ライフイベント届出取消ボタン。Server Action を呼び、成功時はリストが revalidate される。 */
function CancelLifeEventButton(props: { lifeEventId: string }) {
  const [_state, formAction, pending] = useFormAction(
    cancelLifeEventAction,
    {
      ok: false,
      error: null,
    },
    "ライフイベント届出を取り消しました",
  )

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="取消"
      title="このライフイベント届出を取り消しますか？"
      description="取り消した届出は元に戻せません。"
      confirmLabel="届出を取り消す"
      pending={pending}
    >
      <input type="hidden" name="life_event_id" value={props.lifeEventId} />
    </ConfirmActionDialog>
  )
}
