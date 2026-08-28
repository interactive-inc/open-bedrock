import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vite-plus/test"

import { Input } from "@/components/ui/input"

/** jsdom は showPicker を実装していないので、呼ばれたかどうかだけ見る。 */
function stubShowPicker() {
  const showPicker = vi.fn()

  Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
    configurable: true,
    value: showPicker,
    writable: true,
  })

  return showPicker
}

describe("Input", () => {
  test("日付の枠を押すとピッカーを開く", () => {
    const showPicker = stubShowPicker()

    render(<Input type="date" aria-label="日付" />)

    fireEvent.click(screen.getByLabelText("日付"))

    expect(showPicker).toHaveBeenCalledTimes(1)
  })

  test("時刻など他のピッカー型でも開く", () => {
    const showPicker = stubShowPicker()

    render(<Input type="time" aria-label="時刻" />)

    fireEvent.click(screen.getByLabelText("時刻"))

    expect(showPicker).toHaveBeenCalledTimes(1)
  })

  test("通常の文字入力では開かない", () => {
    const showPicker = stubShowPicker()

    render(<Input type="text" aria-label="氏名" />)

    fireEvent.click(screen.getByLabelText("氏名"))

    expect(showPicker).not.toHaveBeenCalled()
  })

  test("readOnly のときは開かない", () => {
    const showPicker = stubShowPicker()

    render(<Input type="date" readOnly aria-label="確定日" />)

    fireEvent.click(screen.getByLabelText("確定日"))

    expect(showPicker).not.toHaveBeenCalled()
  })

  test("呼び出し側の onClick を潰さない", () => {
    stubShowPicker()

    const onClick = vi.fn()

    render(<Input type="date" onClick={onClick} aria-label="開始日" />)

    fireEvent.click(screen.getByLabelText("開始日"))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test("呼び出し側が preventDefault したらピッカーを開かない", () => {
    const showPicker = stubShowPicker()

    render(<Input type="date" onClick={(event) => event.preventDefault()} aria-label="終了日" />)

    fireEvent.click(screen.getByLabelText("終了日"))

    expect(showPicker).not.toHaveBeenCalled()
  })

  test("showPicker が投げても落ちない", () => {
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      value: () => {
        throw new Error("NotAllowedError")
      },
      writable: true,
    })

    render(<Input type="date" aria-label="対象日" />)

    expect(() => fireEvent.click(screen.getByLabelText("対象日"))).not.toThrow()
  })
})
