import { redirect } from "next/navigation";
import PortalPage from "../portal-page";
import { databaseSelectionHref } from "@/lib/database-navigation";
export const dynamic = "force-dynamic";
type Search = { stop?: string; page?: string; q?: string; archivePage?: string };
export default async function Page(props: { searchParams: Promise<Search> }) {
  const params = await props.searchParams;
  // Keep old bookmarked editor URLs working after moving editing to Database.
  if (params.stop) {
    const search = new URLSearchParams();
    for (const key of ["q", "page", "archivePage"] as const) {
      if (params[key]) search.set(key, params[key]);
    }
    redirect(`${databaseSelectionHref(search.toString(), params.stop)}#stop-editor`);
  }
  return <PortalPage {...props} view="stops" />;
}
