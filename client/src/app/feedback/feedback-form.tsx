"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { FeedbackPointMap } from "@/components/feedback-point-map";
import Link from "next/link";
import Image from "next/image";
import { LanguageSelector } from "@/components/language-selector";
import { useRouter } from "next/navigation";
import { TransportIcon, type TransportType } from "@/components/transport-icon";
import { useLanguage } from "@/components/language-provider";
import { feedbackFormCopy } from "@/lib/feedback-form-copy";
import type { FeedbackFormCopy } from "@/lib/feedback-form-copy";
import type { Language } from "@/lib/i18n";
import { getSupabaseConfig } from "@/lib/supabase/config";

import { FeedbackCategoryIcon } from "@/components/feedback-category-icon";
import { parseFeedbackFormConfig, feedbackCategoryLabel, validFeedbackPhoto, type FeedbackFormConfig } from "../../../../shared/feedback-form-config";
const photoExtensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function publicRequest(url: string, publishableKey: string, init: RequestInit, timeoutMs = 30_000) {
  return fetch(url, {
    ...init,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

const severityDefinitions = [
  { value: "low", color: "#37a85a" },
  { value: "medium", color: "#efa51b" },
  { value: "high", color: "#e64a46" },
] as const;

function SubmitButton({ disabled, pending, copy }: { disabled: boolean; pending: boolean; copy: FeedbackFormCopy }) {
  return (
    <button type="submit" disabled={disabled || pending} aria-disabled={disabled || pending}>
      {pending ? <span className="button-spinner" aria-hidden="true" /> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m21 3-7.5 18-3.8-7.7L2 9.5Z" /><path d="m9.7 13.3 5-4.5" /></svg>}
      {pending ? copy.sending : copy.send}
    </button>
  );
}

export function FeedbackForm({ placeId, pointId, stopName, stopLocation, transportType, language: requestedLanguage, configuration }: { configuration: FeedbackFormConfig; placeId: string; pointId: string; transportType: TransportType; stopName: string; stopLocation: string; language?: string }) {
  const router = useRouter();
  const [changingPoint, startPointChange] = useTransition();
  const { language: siteLanguage, setLanguage } = useLanguage();
  const language: Language = requestedLanguage === "de" || requestedLanguage === "it" || requestedLanguage === "en" ? requestedLanguage : siteLanguage;
  useEffect(() => {
    if (requestedLanguage === "de" || requestedLanguage === "it" || requestedLanguage === "en") setLanguage(requestedLanguage);
  }, [requestedLanguage, setLanguage]);
  const copy = feedbackFormCopy[language];
  const [config,setConfig] = useState(configuration);
  const categories = config.categories.filter(item=>item.is_active).map(item=>({...item,label:feedbackCategoryLabel(item,language)}));
  const photoLimit = (config.max_photo_bytes/1024/1024).toLocaleString(language);
  const photoTypes = copy.photoTypes.replace("10",photoLimit);
  const photoErrorMessage = copy.photoError.replace("10",photoLimit);
  const severity = severityDefinitions.map(item => ({ ...item, label: copy[item.value] }));
  const [step, setStep] = useState(1);
  const wizardRef = useRef<HTMLFormElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    if (!window.matchMedia("(max-width: 1279px)").matches) return;
    const panel = wizardRef.current?.querySelector<HTMLElement>(".wizard-panel.current");
    panel?.focus({ preventScroll: true });
    panel?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [step]);
  const [selected, setSelected] = useState<string[]>([]);
  const [level, setLevel] = useState("medium");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState(false);
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<"photoError" | null>(null);
  const [submitError, setSubmitError] = useState<"categoryError" | "emailError" | "photoError" | "sendError" | "configurationChanged" | null>(null);
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [showEmailError, setShowEmailError] = useState(false);
  const [pending, setPending] = useState(false);
  const submissionStarted = useRef(false);
  const preview = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const activeCategories = categories.filter((item) => selected.includes(item.slug));

  function toggleCategory(slug: string) {
    setSelected((current) => current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug]);
    setShowCategoryError(false);
  }

  const emailIsValid = !contact || /^\S+@\S+\.\S+$/.test(email.trim());

  function goToDetails() {
    if (!selected.length) {
      setShowCategoryError(true);
      return;
    }
    setStep(2);
  }

  function goToReview() {
    if (!emailIsValid) {
      setShowEmailError(true);
      return;
    }
    setStep(3);
  }

  function selectPhoto(file: File | null) {
    if (file && (!validFeedbackPhoto(file,config))) {
      setPhoto(null);
      if (photoInput.current) photoInput.current.value = "";
      setPhotoError("photoError");
      return;
    }
    setPhoto(file);
    setPhotoError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionStarted.current || pending || changingPoint) return;

    if (!pointId || selected.length === 0) {
      setShowCategoryError(true);
      setStep(1);
      setSubmitError("categoryError");
      return;
    }
    if (!emailIsValid) {
      setShowEmailError(true);
      setStep(2);
      setSubmitError("emailError");
      return;
    }
    if (photo && (!validFeedbackPhoto(photo,config))) {
      setSubmitError("photoError");
      return;
    }

    submissionStarted.current = true;
    setPending(true);
    setSubmitError(null);
    let submitted = false;

    try {
      const { url, publishableKey } = getSupabaseConfig();
      const configResponse = await publicRequest(`${url}/rest/v1/rpc/get_feedback_form_config`,publishableKey,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      if(!configResponse.ok) throw new Error("config");
      const fresh = parseFeedbackFormConfig(await configResponse.json());
      setConfig(fresh);
      const allowed=new Set(fresh.categories.filter(c=>c.is_active).map(c=>c.slug));
      if(selected.some(slug=>!allowed.has(slug)) || (photo&&!validFeedbackPhoto(photo,fresh))){
        setSelected(current=>current.filter(slug=>allowed.has(slug)));
        if(photo&&!validFeedbackPhoto(photo,fresh)) {
          setPhoto(null);
          if(photoInput.current)photoInput.current.value="";
        }
        setStep(selected.some(slug=>!allowed.has(slug))?1:2);
        setSubmitError("configurationChanged");
        return;
      }

      // The report ID is public; an independent capability authorizes its one photo.
      const uploadToken = photo ? crypto.randomUUID() : null;
      const extension = photo ? photoExtensions.get(photo.type) : null;
      const reportResponse = await publicRequest(`${url}/rest/v1/rpc/create_stop_point_feedback`, publishableKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_stop_point_id: pointId,
          p_categories: selected,
          p_severity: level,
          p_description: description.trim() || null,
          p_email: contact ? email.trim() : null,
          p_consent_to_contact: contact,
          p_language: language,
          p_upload_token: uploadToken,
          p_photo_extension: extension,
        }),
      });
      if (!reportResponse.ok) throw new Error("report");
      const feedbackId: unknown = await reportResponse.json();
      if (typeof feedbackId !== "string") throw new Error("report");

      let photoUploadFailed = false;
      if (photo) {
        try {
          const path = `${feedbackId}/${uploadToken}.${extension}`;
          const uploadResponse = await publicRequest(`${url}/storage/v1/object/feedback-photos/${path}`, publishableKey, {
            method: "POST",
            headers: { "Content-Type": photo.type, "x-upsert": "false" },
            body: photo,
          }, 60_000);
          if (!uploadResponse.ok) throw new Error("upload");

          const registrationResponse = await publicRequest(`${url}/rest/v1/rpc/register_feedback_photo`, publishableKey, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ p_feedback_id: feedbackId, p_storage_path: path }),
          });
          photoUploadFailed = !registrationResponse.ok;
        } catch {
          photoUploadFailed = true;
        }
      }

      const handoff = new URLSearchParams({ lang: language, point_id: pointId });
      if (stopName.trim()) handoff.set("stop", stopName.trim());
      if (selected.length) handoff.set("cats", selected.join(","));
      handoff.set("sev", level);
      if (description.trim()) handoff.set("msg", description.trim().slice(0, 500));
      if (photoUploadFailed) handoff.set("photo", "failed");
      submitted = true;
      router.push(`/feedback/thanks?${handoff.toString()}`);
    } catch {
      setSubmitError("sendError");
    } finally {
      if (!submitted) {
        submissionStarted.current = false;
        setPending(false);
      }
    }
  }

  return (
    <section className="feedback-dialog" aria-labelledby="feedback-title">
      <header className="feedback-heading">
        <div className="feedback-heading-main">
          <h1 id="feedback-title">{copy.title}</h1>
          <div className="feedback-point-context">
            <span className="stop-symbol"><TransportIcon type={transportType} language={language} size={56} priority /></span>
            <p>{stopName || copy.defaultStop}<span>{stopLocation || copy.defaultLocation}</span></p>
          </div>
        </div>
        <div className="feedback-heading-tools">
          <LanguageSelector className="feedback-language" variant="menu" value={language} onChange={next => {
            const url = new URL(window.location.href);
            url.searchParams.set("lang", next);
            router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
          }} />
          <Link className="feedback-close" href="/" aria-label={copy.close}><Image src="/icons/close.svg" width={12} height={12} alt="" aria-hidden="true" /></Link>
        </div>
        <FeedbackPointMap placeId={placeId} selectedId={pointId} language={language}
          disabled={pending || changingPoint} onSelect={id => {
            if (submissionStarted.current || pending || changingPoint || id === pointId) return;
            const url = new URL(window.location.href);
            url.searchParams.set("point", id);
            url.searchParams.set("lang", language);
            startPointChange(() => router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false }));
          }} />
        <p className="heading-required"><span>*</span> {copy.required}</p>
      </header>

      {submitError === "configurationChanged" ? <p className="form-error" role="alert">{copy.configurationChanged}</p> : null}
      <form ref={wizardRef} className="feedback-wizard" onSubmit={handleSubmit} noValidate>
        <input type="hidden" name="point_id" value={pointId} />
        <input type="hidden" name="stop_name" value={stopName} />
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="severity" value={level} />

        <fieldset tabIndex={-1} className={`wizard-panel ${step === 1 ? "current" : ""} ${showCategoryError ? "panel-invalid" : ""}`} aria-describedby={showCategoryError ? "category-error" : undefined}>
          <legend><span>1</span> {copy.categoryStep} <b className="required-mark" aria-label={copy.required}>*</b></legend>
          <p>{copy.categoryIntro}</p>
          <div className="category-list">
            {categories.map((item) => <label key={item.slug} className={selected.includes(item.slug) ? "checked" : ""}>
              <input type="checkbox" name="categories" value={item.slug} checked={selected.includes(item.slug)} onChange={() => toggleCategory(item.slug)} />
              <i><FeedbackCategoryIcon slug={item.slug} icon={item.icon} /></i><span>{item.label}</span>
            </label>)}
          </div>
          {showCategoryError && <p id="category-error" className="field-error" role="alert">{copy.categoryError}</p>}
          <small className="panel-hint"><span>i</span> {copy.categoryHint}</small>
          <button type="button" className="mobile-next" onClick={goToDetails}>{copy.next}</button>
        </fieldset>

        <fieldset tabIndex={-1} className={`wizard-panel ${step === 2 ? "current" : ""}`}>
          <legend><span>2</span> {copy.detailsStep}</legend>
          <label className="field-label">{copy.severityQuestion} <em>{copy.optional}</em></label>
          <div className="severity-options">
            {severity.map((item) => <label key={item.value} className={level === item.value ? "checked" : ""}>
              <input type="radio" name="severity_ui" value={item.value} checked={level === item.value} onChange={() => setLevel(item.value)} />
              <i style={{ background: item.color }} />{item.label}
            </label>)}
          </div>
          <label className="field-label" htmlFor="description">{copy.description}</label>
          <textarea id="description" name="description" maxLength={500} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
          <span className="character-count">{description.length} / 500</span>
          {config.photos_enabled ? <>
          <label className="field-label" htmlFor="photo">{copy.addPhoto} <em>{copy.optional}</em></label>
          <label className="photo-upload" htmlFor="photo">
            <input ref={photoInput} id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)} />
            {preview ? <Image src={preview} width={240} height={135} unoptimized alt={copy.photoPreview} /> : <><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 18H5a4 4 0 0 1-.4-8A7 7 0 0 1 18 8a5 5 0 0 1 1 9.9H17" /><path d="m9 13 3-3 3 3M12 10v10" /></svg><span><b>{copy.photoDrop}</b><small>{photoTypes}</small></span></>}
          </label>
          {photoError && <p className="form-error" role="alert">{photoErrorMessage}</p>}
          {photo ? <button type="button" onClick={()=>{setPhoto(null);if(photoInput.current)photoInput.current.value="";}}>{copy.removePhoto}</button> : null}
          </> : null}
          <label className="contact-toggle"><span>{copy.contactToggle} <em>{copy.optional}</em></span><input type="checkbox" name="consent_to_contact" checked={contact} onChange={(event) => { setContact(event.target.checked); setShowEmailError(false); }} /></label>
          {contact && <div className={`email-field ${showEmailError ? "field-invalid" : ""}`}><label className="field-label" htmlFor="email">{copy.email} <b className="required-mark" aria-label={copy.required}>*</b></label><input id="email" name="email" type="email" maxLength={320} required aria-invalid={showEmailError} aria-describedby={showEmailError ? "email-error" : undefined} value={email} onChange={(event) => { setEmail(event.target.value); setShowEmailError(false); }} />{showEmailError && <p id="email-error" className="field-error" role="alert">{copy.emailError}</p>}</div>}
          <p className="privacy-note"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3 4 6v5c0 5 3.3 8.5 8 10 4.7-1.5 8-5 8-10V6Z" /></svg><span>{copy.privacy} <a href="https://www.suedtirolmobil.info/de/service-und-kontakt/privacy">{copy.privacyLink}</a></span></p>
          <p className="required-note"><span>*</span> {copy.required}</p>
          <div className="mobile-actions"><button type="button" onClick={() => setStep(1)}>{copy.back}</button><button type="button" onClick={goToReview}>{copy.next}</button></div>
        </fieldset>

        <fieldset tabIndex={-1} className={`wizard-panel review-panel ${step === 3 ? "current" : ""}`}>
          <legend><span>3</span> {copy.reviewStep}</legend>
          <p>{copy.reviewIntro}</p>
          <div className="review-card">
            <h3>{copy.selectedCategories}</h3>
            {activeCategories.length ? activeCategories.map((item) => <div className="review-category" key={item.slug}><i><FeedbackCategoryIcon slug={item.slug} icon={item.icon} /></i>{item.label}</div>) : <p className="review-empty">{copy.noCategory}</p>}
            <h3>{copy.severity}</h3><p><b className={`severity-dot ${level}`} />{severity.find((item) => item.value === level)?.label}</p>
            <h3>{copy.yourDescription}</h3><p>{description || copy.noDescription}</p>
            {preview && config.photos_enabled && <><h3>{copy.photo}</h3><Image className="review-photo" src={preview} width={88} height={60} unoptimized alt={copy.selectedPhoto} /></>}
            <h3>{copy.contact}</h3><p>{contact ? <>{copy.contactYes}<br />{email}</> : copy.contactNo}</p>
          </div>
          <aside><span>i</span><p>{copy.thanksHint}</p></aside>
          {submitError && submitError !== "configurationChanged" && <p className="form-error" role="alert">{submitError === "photoError" ? photoErrorMessage : copy[submitError]}</p>}
          <div className="submit-actions"><button type="button" disabled={pending} onClick={() => setStep(2)}>{copy.back}</button><SubmitButton disabled={!pointId || changingPoint} pending={pending} copy={copy} /></div>
        </fieldset>
      </form>
      <footer className="feedback-dialog-footer">
        <span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3 4 6v5c0 5 3.3 8.5 8 10 4.7-1.5 8-5 8-10V6Z" /><path d="m9 12 2 2 4-4" /></svg> {copy.tagline}</span>
        <span>{copy.questions} <a href="https://www.suedtirolmobil.info/de/service-und-kontakt">{copy.customerService}</a></span>
      </footer>
    </section>
  );
}
