/** Minimal page shown in the browser once GitHub has redirected back. */
export function callbackPage(ok: boolean, detail?: string): string {
  const title = ok ? "You're signed in" : "Sign-in failed";
  const body = ok
    ? "You can close this tab and go back to Marasca."
    : `Something went wrong${detail ? `: ${escapeHtml(detail)}` : ""}. Go back to Marasca and try again.`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Marasca — ${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 -apple-system,system-ui,sans-serif;background:#fdfcfa;color:#1e1d1b}
main{max-width:26rem;text-align:center;padding:2rem}h1{font-weight:500;font-size:1.5rem;margin:0 0 .5rem}p{color:#7a766f;margin:0}
.mark{width:44px;height:44px;margin:0 auto 1rem;border-radius:14px;background:#f7f5f0;display:grid;place-items:center;color:${ok ? "#b4232f" : "#a9a49b"}}</style></head>
<body><main><div class="mark"><svg width="28" height="28" viewBox="0 0 32 32"><circle cx="11" cy="21" r="5.5" fill="currentColor"/><circle cx="21" cy="21" r="5.5" fill="currentColor"/><path d="M13.5 16.5C12 11 14 6.5 21 5M18.5 16.5C18.5 11 20 8 21 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg></div>
<h1>${title}</h1><p>${body}</p></main></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
