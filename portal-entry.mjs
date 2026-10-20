// The public route is useful without JavaScript. Load the workspace only when
// requested, including existing demo, deep-link and authentication return URLs.
export function needsWorkspace(url) {
  return url.searchParams.has('workspace') || url.searchParams.has('demo') ||
    url.searchParams.has('code') || url.searchParams.has('checkout') ||
    url.searchParams.has('invite') || Boolean(url.hash);
}
if (typeof document !== 'undefined') {
  const url = new URL(location.href);
  if (needsWorkspace(url)) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/portal.css';
    document.head.append(style);
    // Avoid marketing styles leaking into the existing application.
    for (const sheet of document.querySelectorAll('link[rel="stylesheet"]')) {
      if (['/style.css','/reading.css'].includes(new URL(sheet.href).pathname)) sheet.remove();
    }
    document.querySelector('#public-page').remove();
    const root = document.querySelector('#portal');
    root.hidden = false;
    root.innerHTML = '<div class="initial-load" role="status">Opening your race-day workspace…</div>';
    try { await import('/portal.js'); }
    catch {
      root.innerHTML = '<main id="content" class="initial-load"><h1>The workspace could not load.</h1><p>Please reload to try again, or <a href="'+url.pathname+'">return to the public page</a>.</p></main>';
    }
  }
}
