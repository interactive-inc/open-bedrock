"use client"

import { useRouter } from "next/navigation"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { createLifeEventAction } from "@/app/(app)/my/life-events/actions"
import type { LifeEventActionState } from "@/app/(app)/my/life-events/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: LifeEventActionState = { ok: false, error: null }

type Props = {
  phone: string | null
}

/**
 * ライフイベント届出フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 * 転居のときだけ変更理由・郵便番号・新住所・電話番号を追加入力させ、詳細欄はサーバー側で合成する。
 * 電話番号は個人設定に登録済みの値を初期値にする。
 */
export function LifeEventCreateForm(props: Props) {
  const router = useRouter()

  const [eventType, setEventType] = useState("marriage")

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

  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: LifeEventActionState,
    formData: FormData,
  ): Promise<LifeEventActionState> {
    const result = await createLifeEventAction(previousState, formData)

    if (result.ok) {
      toast.success("ライフイベントを届け出ました")

      router.push("/my/life-events")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-4">
      <h2 className="text-lg font-medium">ライフイベントを届け出る</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="event-type">種別</FieldLabel>

          <NativeSelect
            id="event-type"
            name="event_type"
            defaultValue="marriage"
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
          <FieldLabel htmlFor="event-date">
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

          <Input id="event-date" name="event_date" type="date" required />

          {isRelocation ? (
            <FieldDescription>
              転居した日（新住所から通勤を開始した日）を入れてください
            </FieldDescription>
          ) : null}

          {isDependentAdded ? (
            <FieldDescription>
              対象者との婚姻の場合は婚姻日、対象者の離職の場合は退職日の翌日（資格喪失年月日）、対象者の収入減少の場合は雇用契約（変更）年月日等を入れてください
            </FieldDescription>
          ) : null}

          {isDependentRemoved ? (
            <FieldDescription>
              対象者の就職の場合は就職日、対象者との離婚の場合は離婚日、対象者の死亡の場合は死亡日の翌日を入れてください
            </FieldDescription>
          ) : null}
        </Field>

        {isDivorce ? (
          <>
            <Field>
              <FieldLabel htmlFor="divorce-name-kanji">変更後 戸籍氏名（漢字）</FieldLabel>

              <Input id="divorce-name-kanji" name="divorce_new_name_kanji" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="divorce-name-kana">変更後 戸籍氏名（フリガナ）</FieldLabel>

              <Input id="divorce-name-kana" name="divorce_new_name_kana" required />
            </Field>
          </>
        ) : null}

        {isMarriage ? (
          <>
            <Field>
              <FieldLabel htmlFor="marriage-name-kanji">
                変更後 戸籍氏名（漢字）（姓が変わる場合のみ）
              </FieldLabel>

              <Input id="marriage-name-kanji" name="marriage_new_name_kanji" placeholder="任意" />
            </Field>

            <Field>
              <FieldLabel htmlFor="marriage-name-kana">
                変更後 戸籍氏名（フリガナ）（姓が変わる場合のみ）
              </FieldLabel>

              <Input id="marriage-name-kana" name="marriage_new_name_kana" placeholder="任意" />
            </Field>

            <FieldDescription>
              入籍した配偶者を扶養に入れる場合は、別途【扶養対象家族に追加/変更】の申請もお願いします（配偶者の年収が130万円未満の場合、扶養に入れることができます）
            </FieldDescription>

            <FieldDescription>
              入籍に関する証明書（婚姻受理証明書、戸籍抄本・謄本など）の提出は不要です。以下を確認・対応してください：
              https://www.notion.so/3e8648ed1c174e769676d7a02798d2a5
            </FieldDescription>
          </>
        ) : null}

        {isRelocation ? (
          <>
            <Field>
              <FieldLabel htmlFor="relocation-reason">変更理由</FieldLabel>

              <NativeSelect
                id="relocation-reason"
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
                <FieldLabel htmlFor="relocation-reason-other">その他の理由</FieldLabel>

                <Input id="relocation-reason-other" name="relocation_reason_other" required />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="relocation-postal-code">郵便番号（居住地）</FieldLabel>

              <Input id="relocation-postal-code" name="postal_code" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="relocation-new-address">新住所（居住地）</FieldLabel>

              <Input id="relocation-new-address" name="new_address" required />

              <FieldDescription>
                建物名・部屋番号がある場合は忘れずに記載してください
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="relocation-phone-number">電話番号</FieldLabel>

              <Input
                id="relocation-phone-number"
                name="phone_number"
                defaultValue={props.phone ?? ""}
                required
              />

              <FieldDescription>
                ご自身の携帯電話または固定電話の番号を記載してください
              </FieldDescription>
            </Field>
          </>
        ) : isChildbirth ? (
          <>
            <Field>
              <FieldLabel htmlFor="child-name-kanji">子の氏名（漢字）</FieldLabel>

              <Input id="child-name-kanji" name="child_name_kanji" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="child-name-kana">子の氏名（フリガナ）</FieldLabel>

              <Input id="child-name-kana" name="child_name_kana" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="child-relationship">続柄</FieldLabel>

              <NativeSelect
                id="child-relationship"
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
                <FieldLabel htmlFor="child-relationship-other">続柄（その他）</FieldLabel>

                <Input id="child-relationship-other" name="child_relationship_other" required />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="child-dependent">子の扶養義務</FieldLabel>

              <NativeSelect
                id="child-dependent"
                name="child_dependent"
                defaultValue="yes"
                className="w-full"
                onChange={(event) => setChildDependent(event.target.value)}
              >
                <NativeSelectOption value="yes">あり</NativeSelectOption>

                <NativeSelectOption value="no">なし</NativeSelectOption>
              </NativeSelect>

              <FieldDescription>
                子の父または母いずれか収入が高い方に扶養義務（健康保険証の発行、所得税上の扶養家族としての申告）があります
              </FieldDescription>
            </Field>

            {childDependent === "yes" ? (
              <Field>
                <FieldLabel htmlFor="child-benefit-method">出産育児一時金の受給方法</FieldLabel>

                <NativeSelect
                  id="child-benefit-method"
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

                <FieldDescription>
                  健康保険から出産育児一時金として1児につき42万円（産科医療補償制度未加入の医療機関等で出産した場合は40.8万円）が支給されます。詳細は協会けんぽのサイトをご確認ください：
                  https://www.kyoukaikenpo.or.jp/g3/sb3280/r145/
                </FieldDescription>

                <FieldDescription>
                  直接支払制度を利用し出産費用が42万円未満だった場合や、制度を利用しなかった場合は、差額請求・受給の申請書と添付書類2点（直接支払制度合意文書のコピー、出産費用の領収・明細書のコピー、産科医療補償制度のスタンプがある書類のコピー）を人事本部担当者へ提出してください
                </FieldDescription>
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="child-special-leave">
                出生に伴う特別休暇を取得しますか
              </FieldLabel>

              <NativeSelect
                id="child-special-leave"
                name="childbirth_special_leave"
                defaultValue="yes"
                className="w-full"
              >
                <NativeSelectOption value="yes">取得する</NativeSelectOption>

                <NativeSelectOption value="no">取得しない</NativeSelectOption>
              </NativeSelect>

              <FieldDescription>
                「取得する」を選んだ場合は、別途「休暇申請」より特別休暇を申請してください
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="child-childcare-leave">
                育児休業の取得希望はありますか
              </FieldLabel>

              <NativeSelect
                id="child-childcare-leave"
                name="childcare_leave_intent"
                defaultValue="yes"
                className="w-full"
              >
                <NativeSelectOption value="yes">ある</NativeSelectOption>

                <NativeSelectOption value="no">ない</NativeSelectOption>
              </NativeSelect>
            </Field>
          </>
        ) : isDependentAdded || isDependentRemoved ? (
          <>
            <Field>
              <FieldLabel htmlFor="dependent-reason">扶養異動理由</FieldLabel>

              <NativeSelect
                id="dependent-reason"
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

              {isDependentRemoved ? (
                <FieldDescription>対象者の健康保険証を返却してください</FieldDescription>
              ) : null}
            </Field>

            {dependentReason === "other" ? (
              <Field>
                <FieldLabel htmlFor="dependent-reason-other">扶養異動理由（その他）</FieldLabel>

                <Input id="dependent-reason-other" name="dependent_reason_other" required />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="dependent-family-name-kanji">対象家族の氏名（漢字）</FieldLabel>

              <Input id="dependent-family-name-kanji" name="dependent_family_name_kanji" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="dependent-family-name-kana">
                対象家族の氏名（フリガナ）
              </FieldLabel>

              <Input id="dependent-family-name-kana" name="dependent_family_name_kana" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="dependent-relationship">続柄</FieldLabel>

              <NativeSelect
                id="dependent-relationship"
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
                <FieldLabel htmlFor="dependent-relationship-other">続柄（その他）</FieldLabel>

                <Input
                  id="dependent-relationship-other"
                  name="dependent_relationship_other"
                  required
                />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="dependent-birth-date">対象家族の生年月日</FieldLabel>

              <Input id="dependent-birth-date" name="dependent_birth_date" type="date" required />
            </Field>

            {isDependentAdded ? (
              <>
                <Field>
                  <FieldLabel htmlFor="dependent-certificate-needed">
                    健康保険 資格確認書の発行は必要ですか？
                  </FieldLabel>

                  <NativeSelect
                    id="dependent-certificate-needed"
                    name="dependent_certificate_needed"
                    defaultValue="not_needed"
                    className="w-full"
                  >
                    <NativeSelectOption value="not_needed">不要</NativeSelectOption>

                    <NativeSelectOption value="needed">必要</NativeSelectOption>
                  </NativeSelect>

                  <FieldDescription>
                    資格確認書とは、マイナ保険証（健康保険証の利用登録をしたマイナンバーカード）の利用ができない方に対し交付するもので、資格確認書を医療機関等の窓口に提示することで被保険者等の資格を確認します
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="dependent-occupation">扶養対象となる方の職業</FieldLabel>

                  <NativeSelect
                    id="dependent-occupation"
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
                    <FieldLabel htmlFor="dependent-occupation-other">
                      扶養対象となる方の職業（その他）
                    </FieldLabel>

                    <Input id="dependent-occupation-other" name="dependent_occupation_other" />
                  </Field>
                ) : null}

                <Field>
                  <FieldLabel htmlFor="dependent-annual-income">扶養対象となる方の年収</FieldLabel>

                  <Input
                    id="dependent-annual-income"
                    name="dependent_annual_income"
                    placeholder="例: 0円、90万円"
                  />

                  <FieldDescription>
                    扶養追加する時点の、年収換算の金額を記載してください
                  </FieldDescription>
                </Field>
              </>
            ) : null}
          </>
        ) : isMarriage || isDivorce ? null : (
          <Field>
            <FieldLabel htmlFor="event-detail">詳細</FieldLabel>

            <Input
              id="event-detail"
              name="detail"
              maxLength={FORM_CONSTRAINTS.lifeEvent.detailMax}
              placeholder="任意"
            />
          </Field>
        )}
      </FieldGroup>

      <FieldDescription>
        {isRelocation ||
        isChildbirth ||
        isMarriage ||
        isDivorce ||
        isDependentAdded ||
        isDependentRemoved
          ? "法的判定や給付金の計算は行わず記録のみです"
          : "詳細は任意です。法的判定や給付金の計算は行わず記録のみです"}
      </FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "届出中..." : "届け出る"}
        </Button>
      </div>
    </form>
  )
}
