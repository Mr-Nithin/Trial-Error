import Link from "next/link";
import { ArcMark } from "@/components/ArcLogo";

export default function NotFound() {
  return (
    <main className="screen white" style={{ alignItems: "center", justifyContent: "center", padding: 32, gap: 16, textAlign: "center" }}>
      <ArcMark width={64} />
      <h1 className="title">This step isn’t recorded.</h1>
      <p className="muted" style={{ margin: 0, maxWidth: 300, lineHeight: 1.5 }}>
        The page you’re looking for doesn’t exist, or it was moved to another version.
      </p>
      <Link href="/projects" className="btn primary" style={{ marginTop: 8 }}>
        Back to your projects
      </Link>
    </main>
  );
}
