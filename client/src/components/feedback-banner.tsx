import Image from "next/image";
import Link from "next/link";
import texture from "@/components/texture.svg";
import photo from "@/components/08b34a5e47d6cb5fab59c83899705ea467bab7e9.jpg";

export function FeedbackBanner({ text, cta }: { text: string; cta: string }) {
  return <section className="feedback-banner">
    <div className="feedback-banner-content">
      <Image className="feedback-banner-texture" src={texture} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" aria-hidden="true" />
      <p>{text}</p>
      <Link href="/stops">{cta}<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></Link>
    </div>
    <div className="feedback-banner-photo">
      <Image src={photo} alt="" fill sizes="(min-width: 1600px) 632px, (min-width: 768px) 50vw, 100vw" placeholder="blur" />
    </div>
  </section>;
}
