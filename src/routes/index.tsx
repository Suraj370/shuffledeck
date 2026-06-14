import { useReducer, useRef } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  runJSRandom,
  runWELL512a,
  runXorshift,
  type AlgorithmResult,
} from "@/lib/algorithms"

export const Route = createFileRoute("/")({ component: App })

const ALGORITHMS: { name: string; runner: (n: number) => AlgorithmResult }[] =
  [
    { name: "JS Random", runner: runJSRandom },
    { name: "Xorshift", runner: runXorshift },
    { name: "WELL512a", runner: runWELL512a },
  ]

const TOTAL = ALGORITHMS.length

// ── state machine ────────────────────────────────────────────────────────────

type State = {
  rounds: string
  results: AlgorithmResult[]
  error: string
  isRunning: boolean
  dialogOpen: boolean
}

type Action =
  | { type: "set_rounds"; value: string; clearResults: boolean }
  | { type: "set_error"; message: string }
  | { type: "run_start" }
  | { type: "run_done"; result: AlgorithmResult }
  | { type: "dialog_open" }
  | { type: "dialog_cancel"; revertTo: string }
  | { type: "dialog_ok" }

const initialState: State = {
  rounds: "",
  results: [],
  error: "",
  isRunning: false,
  dialogOpen: false,
}

function appReducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_rounds":
      return {
        ...state,
        rounds: action.value,
        error: "",
        results: action.clearResults ? [] : state.results,
      }
    case "set_error":
      return { ...state, error: action.message }
    case "run_start":
      return { ...state, isRunning: true }
    case "run_done": {
      const without = state.results.filter((r) => r.name !== action.result.name)
      const next = [...without, action.result].sort(
        (a, b) =>
          ALGORITHMS.findIndex((al) => al.name === a.name) -
          ALGORITHMS.findIndex((al) => al.name === b.name)
      )
      return { ...state, isRunning: false, results: next }
    }
    case "dialog_open":
      return { ...state, dialogOpen: true }
    case "dialog_cancel":
      return { ...state, dialogOpen: false, rounds: action.revertTo }
    case "dialog_ok":
      return { ...state, dialogOpen: false, results: [] }
  }
}

// ── component ────────────────────────────────────────────────────────────────

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const { rounds, results, error, isRunning, dialogOpen } = state
  const savedRounds = useRef("")
  const warnedOnce = useRef(false)

  function handleRoundsChange(value: string) {
    const hasPartial = results.length > 0 && results.length < TOTAL
    if (hasPartial && !warnedOnce.current) {
      savedRounds.current = rounds
      warnedOnce.current = true
      dispatch({ type: "dialog_open" })
    }
    dispatch({ type: "set_rounds", value, clearResults: results.length >= TOTAL })
  }

  function handleCancel() {
    warnedOnce.current = false
    dispatch({ type: "dialog_cancel", revertTo: savedRounds.current })
  }

  function handleOK() {
    warnedOnce.current = false
    dispatch({ type: "dialog_ok" })
  }

  function validate(): string | null {
    const trimmed = rounds.trim()
    if (!trimmed) return "Please enter the number of rounds."
    const n = Number(trimmed)
    if (!Number.isInteger(n) || isNaN(n))
      return "Number of rounds must be a valid integer."
    if (n < 1 || n > 10000)
      return "Number of rounds must be between 1 and 10,000."
    return null
  }

  async function runAlgorithm(runner: (n: number) => AlgorithmResult) {
    const msg = validate()
    if (msg) {
      dispatch({ type: "set_error", message: msg })
      return
    }
    dispatch({ type: "run_start" })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const result = runner(Number(rounds.trim()))
    dispatch({ type: "run_done", result })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Shuffle Deck — Performance Evaluator
      </h1>

      {/* Input panel */}
      <div className="rounded-lg border bg-card p-6 space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="rounds" className="text-sm font-medium">
            Number of Rounds{" "}
            <span className="text-muted-foreground">(1 – 10,000)</span>
          </label>
          <input
            id="rounds"
            type="number"
            value={rounds}
            onChange={(e) => handleRoundsChange(e.target.value)}
            placeholder="Enter number of rounds…"
            min={1}
            max={10000}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex flex-wrap gap-3">
          {ALGORITHMS.map(({ name, runner }) => (
            <Button
              key={name}
              onClick={() => runAlgorithm(runner)}
              disabled={isRunning}
              variant={results.some((r) => r.name === name) ? "secondary" : "default"}
            >
              {name}
            </Button>
          ))}
        </div>

        {isRunning && (
          <p className="animate-pulse text-sm text-muted-foreground">
            Running…
          </p>
        )}
      </div>

      {/* Results table */}
      {results.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Algorithm</th>
                <th className="px-4 py-3 text-left font-medium">Started</th>
                <th className="px-4 py-3 text-left font-medium">Ended</th>
                <th className="px-4 py-3 text-left font-medium">Total Time</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.name} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.startTime}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.endTime}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">
                    {r.totalTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Warning dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold">Unsaved Test Results</h2>
            <p className="text-sm text-muted-foreground">
              Not all algorithms have been tested with the current number of
              rounds. Changing rounds will clear existing results. Do you want
              to continue?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleOK}>OK</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
