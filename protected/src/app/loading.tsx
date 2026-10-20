import { getTranslations } from "@/lib/language";

export default async function Loading() {
  const { t } = await getTranslations();
  return <main className="portal-route-loading" role="status">
    <span className="button-spinner" aria-hidden="true" />{t.portal.loading}
  </main>;
}
