// An open tab or a home screen app in the background keeps running the old
// code until it is reloaded. A deploy changes the hashed bundle names in
// index.html, so comparing them with the running page shows a new version.

const pattern = /\/_expo\/static\/js\/[^"'\s]+\.js/g;
export const bundlesIn = (html: string) => [...new Set(html.match(pattern) || [])].sort().join(" ");

function running() {
  if (typeof document === "undefined") return "";
  return bundlesIn([...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")).join(" "));
}

export async function newVersionAvailable() {
  // Native builds have no document, development builds no hashed bundles:
  // nothing to compare.
  const now = running();
  if (!now) return false;
  const html = await fetch("/", { cache: "no-store" })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  const live = bundlesIn(html);
  return !!live && live !== now;
}
