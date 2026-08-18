"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { submitFeedback } from "./actions";

const categories = [
  { slug: "weather_protection", icon: "shelter", label: "Witterungsschutz fehlt" },
  { slug: "seating", icon: "seat", label: "Sitzplatz fehlt" },
  { slug: "safe_sidewalk", icon: "walk", label: "Sicherer Gehweg zur Haltestelle fehlt" },
  { slug: "safe_crossing", icon: "crossing", label: "Keine sichere Querung der Straße zur Haltestelle" },
  { slug: "passenger_information", icon: "information", label: "Fahrgastinformation fehlt oder ist mangelhaft" },
  { slug: "lighting", icon: "light", label: "Beleuchtung fehlt" },
  { slug: "accessibility", icon: "accessible", label: "Barrierefreiheit nicht gegeben" },
  { slug: "shading", icon: "sun", label: "Beschattung fehlt" },
  { slug: "bicycle_parking", icon: "bike", label: "Fahrradabstellplatz fehlt" },
  { slug: "waste_bin", icon: "bin", label: "Mülleimer fehlt" },
] as const;

const severity = [
  { value: "low", label: "gering", color: "#37a85a" },
  { value: "medium", label: "mittel", color: "#efa51b" },
  { value: "high", label: "hoch", color: "#e64a46" },
] as const;

type IconName = typeof categories[number]["icon"];

function CategoryIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    shelter: <><path d="M4 19V8l8-4 8 4v11" /><path d="M7 19v-8h10v8M9 14h6" /></>,
    seat: <><path d="M6 5v8h11V8M6 10h11M8 13v6M17 13v6" /></>,
    walk: <><circle cx="12" cy="4.5" r="2" /><path d="m10 9 3-2 2.5 3M12.5 8.2l-1 5.3-4 5M11.5 13.5l4.5 5" /></>,
    crossing: <><path d="M4 18h16M6 14h3M11 14h3M16 14h2M5 10h3M10 10h3M15 10h4M4 6h16" /></>,
    information: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
    light: <><path d="M9 18h6M10 21h4M8.5 14.5A6 6 0 1 1 15.5 14.5L14 17h-4Z" /></>,
    accessible: <><circle cx="11" cy="4" r="2" /><path d="M10 7.5 9 13h6l3 6M10 10h5l2 3M9.5 12.5a5 5 0 1 0 5.5 6" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    bike: <><circle cx="6" cy="17" r="4" /><circle cx="18" cy="17" r="4" /><path d="m6 17 4-8 4 8M8 13h8l-3-6h3M9 7h3" /></>,
    bin: <><path d="M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function BusStopIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="4" width="14" height="14" rx="3" /><path d="M8 8h8v5H8zM8 18v2M16 18v2" /><circle cx="8.5" cy="15.5" r=".7" fill="currentColor" /><circle cx="15.5" cy="15.5" r=".7" fill="currentColor" /></svg>;
}

export function FeedbackForm({ stopId, stopName, stopLocation, language }: { stopId: string; stopName: string; stopLocation: string; language: string }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [level, setLevel] = useState("medium");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState(false);
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const activeCategories = categories.filter((item) => selected.includes(item.slug));

  function toggleCategory(slug: string) {
    setSelected((current) => current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug]);
  }

  return (
    <section className="feedback-dialog" aria-labelledby="feedback-title">
      <header className="feedback-heading">
        <span className="stop-symbol"><BusStopIcon /></span>
        <div><h1 id="feedback-title">Feedback zur Haltestelle</h1><p>●&nbsp; {stopName} · {stopLocation}</p></div>
        <Link href="/" aria-label="Feedback schließen">×</Link>
      </header>

      <ol className="feedback-progress" aria-label="Fortschritt">
        {["Kategorie auswählen", "Details angeben", "Prüfen & senden"].map((label, index) => (
          <li key={label} className={step >= index + 1 ? "active" : ""} aria-current={step === index + 1 ? "step" : undefined}>
            <span>{index + 1}</span><b>{label}</b>
          </li>
        ))}
      </ol>

      <form action={submitFeedback} className="feedback-wizard">
        <input type="hidden" name="stop_id" value={stopId} />
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="severity" value={level} />

        <fieldset className={`wizard-panel ${step === 1 ? "current" : ""}`}>
          <legend><span>1</span> Kategorie auswählen</legend>
          <p>Wählen Sie eine oder mehrere Kategorien aus, die zu den fehlenden Elementen an dieser Haltestelle passen.</p>
          <div className="category-list">
            {categories.map((item) => <label key={item.slug} className={selected.includes(item.slug) ? "checked" : ""}>
              <input type="checkbox" name="categories" value={item.slug} checked={selected.includes(item.slug)} onChange={() => toggleCategory(item.slug)} />
              <i><CategoryIcon name={item.icon} /></i><span>{item.label}</span>
            </label>)}
          </div>
          <small className="panel-hint"><span>i</span> Sie können mehrere Kategorien auswählen.</small>
          <button type="button" className="mobile-next" disabled={!selected.length} onClick={() => setStep(2)}>Weiter</button>
        </fieldset>

        <fieldset className={`wizard-panel ${step === 2 ? "current" : ""}`}>
          <legend><span>2</span> Details angeben</legend>
          <label className="field-label">Wie stark beeinträchtigt das Problem? <em>(optional)</em></label>
          <div className="severity-options">
            {severity.map((item) => <label key={item.value} className={level === item.value ? "checked" : ""}>
              <input type="radio" name="severity_ui" value={item.value} checked={level === item.value} onChange={() => setLevel(item.value)} />
              <i style={{ background: item.color }} />{item.label}
            </label>)}
          </div>
          <label className="field-label" htmlFor="description">Beschreiben Sie kurz, was fehlt oder verbessert werden sollte.</label>
          <textarea id="description" name="description" maxLength={500} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
          <span className="character-count">{description.length} / 500</span>
          <label className="field-label" htmlFor="photo">Foto hinzufügen <em>(optional)</em></label>
          <label className="photo-upload" htmlFor="photo">
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
            {preview ? <Image src={preview} width={240} height={135} unoptimized alt="Vorschau des ausgewählten Fotos" /> : <><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 18H5a4 4 0 0 1-.4-8A7 7 0 0 1 18 8a5 5 0 0 1 1 9.9H17" /><path d="m9 13 3-3 3 3M12 10v10" /></svg><span><b>Foto hierher ziehen oder klicken, um Dateien auszuwählen</b><small>JPG, PNG oder WebP, max. 10 MB</small></span></>}
          </label>
          <label className="contact-toggle"><span>Ich möchte bei Rückfragen kontaktiert werden <em>(optional)</em></span><input type="checkbox" name="consent_to_contact" checked={contact} onChange={(event) => setContact(event.target.checked)} /></label>
          {contact && <><label className="field-label" htmlFor="email">E-Mail-Adresse</label><input id="email" name="email" type="email" maxLength={320} required value={email} onChange={(event) => setEmail(event.target.value)} /></>}
          <p className="privacy-note"><span>▣</span> Ihre Daten werden ausschließlich zur Bearbeitung dieses Feedbacks verwendet und nicht veröffentlicht. <Link href="/about">Datenschutz</Link></p>
          <div className="mobile-actions"><button type="button" onClick={() => setStep(1)}>Zurück</button><button type="button" disabled={!selected.length} onClick={() => setStep(3)}>Weiter</button></div>
        </fieldset>

        <fieldset className={`wizard-panel review-panel ${step === 3 ? "current" : ""}`}>
          <legend><span>3</span> Prüfen & senden</legend>
          <p>Bitte prüfen Sie Ihre Angaben, bevor Sie das Feedback senden.</p>
          <div className="review-card">
            <h3>Gewählte Kategorien</h3>
            {activeCategories.length ? activeCategories.map((item) => <div className="review-category" key={item.slug}><i><CategoryIcon name={item.icon} /></i>{item.label}</div>) : <p className="review-empty">Noch keine Kategorie gewählt.</p>}
            <h3>Problemstärke</h3><p><b className={`severity-dot ${level}`} />{severity.find((item) => item.value === level)?.label}</p>
            <h3>Ihre Beschreibung</h3><p>{description || "Keine Beschreibung angegeben."}</p>
            {preview && <><h3>Foto</h3><Image className="review-photo" src={preview} width={88} height={60} unoptimized alt="Ausgewähltes Foto" /></>}
            <h3>Kontakt</h3><p>{contact ? <>Ich möchte kontaktiert werden<br />{email}</> : "Keine Kontaktaufnahme gewünscht"}</p>
          </div>
          <aside><span>i</span><p>Ihr Feedback hilft uns, Haltestellen sicherer und komfortabler zu machen. Vielen Dank!</p></aside>
          <div className="submit-actions"><button type="button" onClick={() => setStep(2)}>Zurück</button><button type="submit" disabled={!stopId || !selected.length}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m21 3-7.5 18-3.8-7.7L2 9.5Z" /><path d="m9.7 13.3 5-4.5" /></svg> Feedback senden</button></div>
        </fieldset>
      </form>
      <footer className="feedback-dialog-footer">
        <span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 4 6v5c0 5 3.3 8.5 8 10 4.7-1.5 8-5 8-10V6Z" /><path d="m9 12 2 2 4-4" /></svg> Gemeinsam für bessere Mobilität.</span>
        <span>Haben Sie Fragen? <Link href="/about">Kundenservice kontaktieren ↗</Link></span>
      </footer>
    </section>
  );
}
