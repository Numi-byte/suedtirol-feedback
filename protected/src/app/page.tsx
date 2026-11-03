import PortalPage from "./portal-page";
export const dynamic = "force-dynamic";
export default function Page(props: { searchParams: Promise<{ replies?: string; feedbackPage?: string }> }) { return <PortalPage {...props} view="feedback" />; }
