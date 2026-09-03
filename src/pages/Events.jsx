import { useEffect, useState, useCallback, useMemo } from 'react'
import { ShieldAlert } from 'lucide-react'
import EventCard from '../components/EventCard'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import { getEvents } from '../services/eventService'

const TYPE_TABS = ['All', 'Normal', 'Refuel', 'Leak', 'Theft']
const SEVERITY_OPTIONS = ['All severity', 'High', 'Medium', 'Low']

export default function Events() {
  const [state, setState] = useState({ status: 'loading', events: [], tableMissing: false, error: null })
  const [typeFilter, setTypeFilter] = useState('All')
  const [severityFilter, setSeverityFilter] = useState('All severity')

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: 'loading' }))
    const { data, error, tableMissing } = await getEvents(200)
    if (error) {
      setState({ status: 'error', events: [], tableMissing: false, error })
      return
    }
    setState({ status: 'success', events: data, tableMissing, error: null })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return state.events.filter((e) => {
      const typeOk = typeFilter === 'All' || e.event_type === typeFilter.toUpperCase()
      const severityOk =
        severityFilter === 'All severity' || e.severity === severityFilter.toUpperCase()
      return typeOk && severityOk
    })
  }, [state.events, typeFilter, severityFilter])

  if (state.status === 'loading') return <LoadingState label="Loading events…" />
  if (state.status === 'error') return <ErrorState title="Unable to load events." detail={state.error} onRetry={load} />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setTypeFilter(tab)}
              className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                typeFilter === tab
                  ? 'border-amber/40 bg-amber-soft text-amber'
                  : 'border-hairline text-text-dim hover:text-text'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded border border-hairline bg-panel px-2.5 py-2 text-xs text-text-dim focus:outline-none"
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={ShieldAlert}
            title="No detected events"
            detail={
              state.tableMissing
                ? 'The event detection pipeline is not connected yet. Once the backend starts classifying telemetry, events will appear here.'
                : 'No events match the current filters.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
