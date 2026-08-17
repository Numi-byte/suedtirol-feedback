import { createBusStop, signOut } from "./actions";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/brand-logo";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RouteLines = () => (
  <svg className="route-lines" viewBox="0 0 420 300" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 230h110l80-80h130l60-60" />
      <path d="M70 30v90l80 80v100" opacity=".6" />
    </g>
    <g fill="currentColor">
      <circle cx="130" cy="230" r="16" />
      <circle cx="340" cy="150" r="16" />
    </g>
  </svg>
);

export default async function PortalHomePage() {
  if (!hasSupabaseConfig()) {
    return (
      <main className="portal-message">
        <p>Protected portal</p>
        <h1>Supabase configuration required</h1>
        <span>
          Copy <code>.env.local.example</code> to <code>.env.local</code> in the protected app,
          then set the project URL and publishable key before restarting the development server.
        </span>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: stops } = user ? await supabase.from("bus_stops").select("id,name_de,name_it,name_en,municipality,latitude,longitude,is_published").order("created_at", { ascending: false }) : { data: [] };
  const { data: feedback } = user ? await supabase.from("stop_feedback").select("id,overall_rating,cleanliness_rating,safety_rating,accessibility_rating,information_rating,shelter_rating,has_shelter,has_seating,has_lighting,comment,email,consent_to_contact,language,created_at,bus_stops(name_de,name_it,name_en)").order("created_at", { ascending: false }) : { data: [] };

  if (!user) return (
    <main className="login-page">
      <section className="login-intro">
        <BrandLogo tone="dark" sub="portal" />
        <p>South Tyrol · Public transport</p>
        <h1>Shape better stops<br />for every journey.</h1>
        <span className="login-lead">Review passenger feedback and keep the region&apos;s bus stop information accurate, accessible and up to date.</span>
        <RouteLines />
      </section>
      <section className="login-panel"><div className="login-card">
        <p>Protected portal</p><h2>Welcome back</h2><span>Sign in with your authorized Supabase account.</span>
        <LoginForm />
        <small>Access is restricted to approved transport administrators.</small>
      </div></section>
    </main>
  );

  return (
    <>
    <div className="portal-bar">
      <div className="portal-bar-inner">
        <BrandLogo sub="portal" />
        <div className="user-actions"><span className="user-pill">{user.email}</span><form action={signOut}><button type="submit" className="sign-out">Sign out</button></form></div>
      </div>
    </div>
    <main className="portal">
      <header><div><p>Transport data portal</p><h1>Bus stop management</h1></div></header>
      <div className="portal-grid">
        <section className="editor-card">
          <div className="card-heading"><span>New location</span><h2>Add a bus stop</h2><p>Enter all three public names and the exact WGS84 coordinates.</p></div>
          <form action={createBusStop}>
            <div className="field-grid three"><label>German name<input name="name_de" required /></label><label>Italian name<input name="name_it" required /></label><label>English name<input name="name_en" required /></label></div>
            <div className="field-grid"><label>Municipality<input name="municipality" required /></label><label>Stop code<input name="stop_code" placeholder="Optional" /></label></div>
            <div className="field-grid"><label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any" placeholder="46.4983" required /></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any" placeholder="11.3548" required /></label></div>
            <div className="checks"><label><input name="is_accessible" type="checkbox" /> Accessible</label><label><input name="is_published" type="checkbox" defaultChecked /> Publish on client map</label></div>
            <button type="submit">Save bus stop</button>
          </form>
        </section>
        <section className="stops-card"><div className="card-heading"><span>Database</span><h2>{stops?.length ?? 0} bus stops</h2></div><div className="stop-list">
          {stops?.map((stop) => <article key={stop.id}><div className="status-dot" data-published={stop.is_published} /><div><strong>{stop.name_de}</strong><small>{stop.name_it} · {stop.name_en}</small><small>{stop.municipality} · {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}</small></div></article>)}
          {!stops?.length && <p className="empty">No stops yet. Add the first location.</p>}
        </div></section>
      </div>
      <section className="feedback-card">
        <div className="card-heading"><span>Submitted responses</span><h2>Stop feedback</h2><p>Visible only to authenticated portal users.</p></div>
        <div className="feedback-table-wrap"><table><thead><tr><th>Stop</th><th>Overall</th><th>Category ratings</th><th>Facilities</th><th>Comment</th><th>Submitted</th></tr></thead><tbody>
          {feedback?.map((entry) => {
            const stop = Array.isArray(entry.bus_stops) ? entry.bus_stops[0] : entry.bus_stops;
            return <tr key={entry.id}><td><strong>{stop?.name_de ?? "Deleted stop"}</strong><small>{stop?.name_it} · {stop?.name_en}</small><small>Language: {entry.language.toUpperCase()}</small></td><td><span className="score">{entry.overall_rating}/5</span></td><td><small>Clean {entry.cleanliness_rating}/5 · Safety {entry.safety_rating}/5</small><small>Access {entry.accessibility_rating}/5 · Info {entry.information_rating}/5 · Shelter {entry.shelter_rating}/5</small></td><td><small>Shelter {entry.has_shelter ? "✓" : "–"} · Seating {entry.has_seating ? "✓" : "–"} · Light {entry.has_lighting ? "✓" : "–"}</small></td><td><span className="comment">{entry.comment || "No comment"}</span>{entry.consent_to_contact && entry.email && <small>Contact: {entry.email}</small>}</td><td><small>{new Date(entry.created_at).toLocaleDateString("de-IT")}</small></td></tr>;
          })}
          {!feedback?.length && <tr><td colSpan={6} className="empty">No feedback submitted yet.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
    </>
  );
}
