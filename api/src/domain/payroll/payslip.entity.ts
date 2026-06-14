import type { PayslipRow } from "@/schema"
import { z } from "zod"

const zProps = z.object({
  id: z.number().nullable(),
  employeeId: z.number(),
  period: z.string(),
  baseSalary: z.number(),
  allowances: z.number(),
  deductions: z.number(),
  netPay: z.number(),
  issuedAt: z.string().nullable(),
  status: z.enum(["draft", "issued"]),
})

type Props = z.infer<typeof zProps>

// 給与明細（社員ごと・期間ごとの支給額と差引支給額・発行状態）。集約ルート。
export class Payslip implements Props {
  // 永続化前は null、DB 採番後に確定する。
  readonly id!: Props["id"]

  readonly employeeId!: Props["employeeId"]

  readonly period!: Props["period"]

  readonly baseSalary!: Props["baseSalary"]

  readonly allowances!: Props["allowances"]

  readonly deductions!: Props["deductions"]

  readonly netPay!: Props["netPay"]

  readonly issuedAt!: Props["issuedAt"]

  readonly status!: Props["status"]

  constructor(private readonly props: Props) {
    zProps.parse(props)

    Object.assign(this, props)

    Object.freeze(this)
  }

  // 発行済みの給与明細を組み立てる。id は未採番、状態は issued。
  static create(props: {
    employeeId: number
    period: string
    baseSalary: number
    allowances: number
    deductions: number
    netPay: number
    issuedAt: string
  }): Payslip {
    return new Payslip({
      id: null,
      employeeId: props.employeeId,
      period: props.period,
      baseSalary: props.baseSalary,
      allowances: props.allowances,
      deductions: props.deductions,
      netPay: props.netPay,
      issuedAt: props.issuedAt,
      status: "issued",
    })
  }

  static fromRow(row: PayslipRow): Payslip {
    return new Payslip({
      id: row.id,
      employeeId: row.employeeId,
      period: row.period,
      baseSalary: row.baseSalary,
      allowances: row.allowances,
      deductions: row.deductions,
      netPay: row.netPay,
      issuedAt: row.issuedAt,
      status: row.status === "draft" ? "draft" : "issued",
    })
  }

  // 基本給に手当を足し控除を引いた差引支給額を求める。
  static toNetPay(props: { baseSalary: number; allowances: number; deductions: number }): number {
    return props.baseSalary + props.allowances - props.deductions
  }

  // 期間と金額を訂正した新しい給与明細を返す。金額は渡された値をそのまま記録する。
  withCorrected(props: {
    period: string
    baseSalary: number
    allowances: number
    deductions: number
    netPay: number
  }): Payslip {
    return new Payslip({
      ...this.props,
      period: props.period,
      baseSalary: props.baseSalary,
      allowances: props.allowances,
      deductions: props.deductions,
      netPay: props.netPay,
    })
  }
}
