import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/lib/language";
import { getPortalAccess, portalHome } from "@/lib/portal-access";
import { feedbackSettingsCopy } from "@/lib/feedback-settings-copy";
import { PortalHeader, PortalFooter } from "@/components/portal-shell";
import { PortalNavigation } from "../portal-navigation";
import { UserForm } from "../users/user-form";
import { saveCategory, savePhotoSettings } from "./actions";
import { CategoryOrderEditor } from "./category-order-editor";
import {
  parseFeedbackFormConfig,
  type FeedbackCategoryConfig,
} from "../../../../shared/feedback-form-config";
import { FeedbackCategoryIcon } from "@/components/feedback-category-icon";
export const dynamic = "force-dynamic";
export default async function FeedbackSettingsPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const access = await getPortalAccess(client);
  if (!user || !access.feedbackSettings) redirect(portalHome(access) ?? "/");
  const { language } = await getTranslations();
  const copy = feedbackSettingsCopy[language];
  const { data, error } = await client.rpc("get_feedback_form_config");
  let config;
  try {
    if (error) throw error;
    config = parseFeedbackFormConfig(data);
  } catch {
    return (
      <PortalNavigation loadingLabel={copy.saving}>
        <PortalHeader
          language={language}
          email={user.email ?? ""}
          access={access}
        />
        <main className="portal">
          <h1>{copy.title}</h1>
          <p role="alert">{copy.loadError}</p>
        </main>
        <PortalFooter language={language} access={access} />
      </PortalNavigation>
    );
  }
  const fields = (category?: FeedbackCategoryConfig) => (
    <>
      <label>
        {copy.slug}
        <input
          name="slug"
          pattern="[a-z][a-z0-9_]*"
          maxLength={64}
          required
          readOnly={!!category}
          defaultValue={category?.slug ?? ""}
        />
      </label>
      <div className="field-grid">
        <label>
          {copy.de}
          <input
            name="label_de"
            required
            maxLength={160}
            defaultValue={category?.label_de ?? ""}
          />
        </label>
        <label>
          {copy.it}
          <input
            name="label_it"
            required
            maxLength={160}
            defaultValue={category?.label_it ?? ""}
          />
        </label>
        <label>
          {copy.en}
          <input
            name="label_en"
            required
            maxLength={160}
            defaultValue={category?.label_en ?? ""}
          />
        </label>
      </div>
      <div className="checks">
        <label>
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={category?.is_active ?? true}
          />
          {copy.active}
        </label>
      </div>
      <label>
        {copy.icon}
        <input name="icon_file" type="file" accept=".svg,image/svg+xml" />
      </label>
      {category?.icon ? (
        <div className="checks">
          <label>
            <input name="remove_icon" type="checkbox" />
            {copy.remove}
          </label>
        </div>
      ) : null}
      <button type="submit">{copy.save}</button>
    </>
  );
  return (
    <PortalNavigation loadingLabel={copy.saving}>
      <PortalHeader
        language={language}
        email={user.email ?? ""}
        access={access}
      />
      <main className="portal feedback-settings-page">
        <header>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </header>
        <section className="editor-card feedback-photo-settings">
          <h2>{copy.photos}</h2>
          <UserForm action={savePhotoSettings} labels={copy}>
            <div className="checks">
              <label>
                <input
                  name="photos_enabled"
                  type="checkbox"
                  defaultChecked={config.photos_enabled}
                />
                {copy.enabled}
              </label>
            </div>
            <label>
              {copy.limit}
              <input
                name="max_photo_mb"
                type="number"
                min={1}
                max={10}
                step={1}
                required
                defaultValue={config.max_photo_bytes / 1024 / 1024}
              />
            </label>
            <button type="submit">{copy.savePhotos}</button>
          </UserForm>
        </section>
        <section
          className="feedback-category-guidelines"
          aria-labelledby="feedback-svg-guidelines"
        >
          <h2 id="feedback-svg-guidelines">{copy.svgTitle}</h2>
          <p>{copy.svgRules}</p>
          <p>{copy.svgLimits}</p>
          <p>{copy.rules}</p>
        </section>
        <section className="editor-card feedback-category-create">
          <h2>{copy.add}</h2>
          <UserForm
            action={saveCategory}
            labels={copy}
            clearUploads
            resetOnSuccess
            disabled={config.categories.length >= 50}
          >
            {fields()}
          </UserForm>
        </section>
        <div className="feedback-category-order-toolbar">
          <h2>{copy.categories}</h2>
          <CategoryOrderEditor
            categories={config.categories}
            language={language}
            copy={copy}
          />
        </div>
        <div className="feedback-category-editors">
          {config.categories.map((category) => (
            <section
              className="editor-card feedback-category-editor"
              key={category.slug}
            >
              <h2>
                <span className="category-icon-preview">
                  <FeedbackCategoryIcon
                    slug={category.slug}
                    icon={category.icon}
                  />
                </span>
                {category[`label_${language}`]}
              </h2>
              <UserForm action={saveCategory} labels={copy} clearUploads>
                {fields(category)}
              </UserForm>
            </section>
          ))}
        </div>
      </main>
      <PortalFooter language={language} access={access} />
    </PortalNavigation>
  );
}
