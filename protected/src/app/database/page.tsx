import PortalPage from "../portal-page";
export const dynamic = "force-dynamic";
export default function Page(props: { searchParams: Promise<{ stop?: string; page?: string; q?: string; archivePage?: string; missing?: string }> }) { return <PortalPage {...props} view="database" />; }
