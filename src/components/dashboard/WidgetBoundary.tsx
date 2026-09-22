import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * WidgetBoundary — isolates each dashboard widget. If a widget throws (bad
 * API shape, missing data, etc.) it renders a small "couldn't load" card
 * instead of blanking the entire dashboard. One broken block must never
 * take down the whole page.
 */
interface Props {
  title: string
  children: ReactNode
}
interface State {
  hasError: boolean
}

export class WidgetBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep it quiet but discoverable in the console for debugging.
    // eslint-disable-next-line no-console
    console.error(`Dashboard widget "${this.props.title}" crashed:`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-sm font-semibold text-slate-700 mb-1">{this.props.title}</div>
          <p className="text-xs text-slate-400">Couldn&rsquo;t load this block right now.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs text-amber-700 hover:underline"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
