import { avatarColour, initials, shortName } from '@/board/BoardWidgets'
import type { BoardData } from '@/board/boardApi'

/**
 * The morning huddle.
 *
 * A whole-screen scene rather than a card, because for twenty minutes
 * every morning this is the only thing on the wall worth looking at, and
 * a room stood in front of a television does not want to hunt for the
 * panel that matters.
 *
 * Three things, in the order somebody standing there would ask: who is
 * out and when they start, what the sky is doing, and one thing worth
 * remembering before anybody gets in a van.
 */
export function BoardHuddle({ data }: { data: BoardData }) {
  const h = data.huddle
  if (!h) return null

  const working = h.crew.filter((c) => c.jobs > 0)
  const off = h.crew.filter((c) => c.jobs === 0)

  const at = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: data.timezone })
      : null

  return (
    <div className="tv-huddle">
      <div className="tv-huddle-head">
        <span className="tv-huddle-title">Morning huddle</span>
        <span className="tv-huddle-date">
          {new Date().toLocaleDateString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone: data.timezone,
          })}
        </span>
      </div>

      <div className="tv-huddle-body">
        {/* who is out */}
        <section className="tv-huddle-crew">
          {working.length === 0 ? (
            <p className="tv-quiet">Nobody is booked out yet today.</p>
          ) : (
            <ul className="tv-list">
              {working.map((c) => (
                <li key={c.id} className="tv-huddle-row">
                  <span className="tv-avatar" style={{ background: avatarColour(c.id || c.name || '') }}>
                    {initials(c.name ?? '?')}
                  </span>
                  <span className="tv-huddle-who">
                    <span className="tv-crew-name">{shortName(c.name ?? 'Unnamed')}</span>
                    <span className="tv-crew-job">
                      {c.first_customer ?? 'First job'}
                      {' · '}
                      {c.jobs} {c.jobs === 1 ? 'job' : 'jobs'}
                    </span>
                  </span>
                  <span className="tv-huddle-time">{at(c.first_at) ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}

          {off.length > 0 && (
            <span className="tv-crew-off">
              {off.slice(0, 4).map((c) => (
                <span key={c.id} className="tv-crew-off-one">
                  <span
                    className="tv-avatar tv-avatar-sm"
                    style={{ background: avatarColour(c.id || c.name || '') }}
                  >
                    {initials(c.name ?? '?')}
                  </span>
                  {shortName(c.name ?? 'Unnamed')}
                </span>
              ))}
              <span className="tv-crew-off-label">off today</span>
            </span>
          )}
        </section>

        {/* the sky */}
        <section className="tv-huddle-side">
          {h.weather.hours.length > 0 && (
            <div className="tv-huddle-weather">
              {h.weather.hours.map((w, i) => (
                <span key={i} className="tv-hour">
                  <span className="tv-hour-at">
                    {w.at
                      ? new Date(w.at).toLocaleTimeString([], { hour: 'numeric', timeZone: data.timezone })
                      : ''}
                  </span>
                  <span className="tv-hour-temp">
                    {w.temp}&deg;
                  </span>
                  {w.rain != null && w.rain >= 20 && <span className="tv-hour-rain">{w.rain}%</span>}
                </span>
              ))}
            </div>
          )}

          {h.weather.warning && <p className="tv-huddle-warning">{h.weather.warning}</p>}

          <p className="tv-huddle-tip">
            <span className="tv-huddle-tip-label">Worth remembering</span>
            {h.tip.text}
          </p>
        </section>
      </div>
    </div>
  )
}
