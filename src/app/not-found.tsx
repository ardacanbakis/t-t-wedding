// Exported as 404.html — GitHub Pages serves it for every unknown path.
// The inline script turns pretty invitation links (/i/<token>) into the
// static page's query form (/i/?t=<token>) before anything renders.
const redirectScript = `
(function () {
  var m = location.pathname.match(/^(.*)\\/i\\/([A-Za-z0-9_-]{8,})\\/?$/);
  if (m) location.replace(m[1] + "/i/?t=" + m[2] + location.hash);
})();
`;

export default function NotFound() {
  return (
    <div
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div className="kicker" style={{ fontSize: 26 }}>
          Tansu &amp; Arda
        </div>
        <h1 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 32, color: "var(--brown)", margin: "10px 0" }}>
          Sayfa bulunamadı · Page not found
        </h1>
      </div>
    </div>
  );
}
