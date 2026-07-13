import { withBase } from "@/lib/supabase";

export default function Home() {
  return (
    <div
      className="fade-in"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ textAlign: "center", maxWidth: 560 }}>
        <div className="kicker" style={{ fontSize: "clamp(20px, 3vw, 28px)" }}>
          bir aşk hikâyesi
        </div>
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 600,
            fontSize: "clamp(44px, 9vw, 80px)",
            color: "var(--brown)",
            margin: "10px 0 4px",
            lineHeight: 1.08,
          }}
        >
          Tansu <span style={{ fontFamily: "var(--script)", color: "var(--gold)", fontWeight: 500 }}>&amp;</span> Arda
        </h1>
        <div className="divider">
          <div className="line-l" />
          <span className="heart">♥</span>
          <div className="line-r" />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <a className="pill-btn" href={withBase("/story/")}>
            Hikâyemiz · Our Story
          </a>
        </div>
        <p style={{ fontFamily: "var(--sans)", fontWeight: 300, fontSize: 12, color: "var(--brown-soft)", marginTop: 28 }}>
          Davetiyeniz size özel bir bağlantıyla gönderildi. · Your invitation was sent to you as a personal link.
        </p>
      </div>
    </div>
  );
}
