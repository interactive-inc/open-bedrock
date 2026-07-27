import { factory } from "@/factory"

export const help = `bedrock employee-grades — 従業員の等級割当

usage:
  bedrock employee-grades list [--employee-id <id>]               等級割当の履歴
  bedrock employee-grades create --employee-code <c> --grade-code <g> --effective-on <d>  等級を割当（管理者）`

export default factory.createHandlers((c) => c.text(help))
