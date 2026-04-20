function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Opens a print-friendly summary of referral cards in a new window.
 */
export function printReferralsSummary({
  referrals = [],
  topicLabel = "",
  zipCode = "",
  t,
}) {
  if (typeof window === "undefined") return;

  const generatedAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const blocks = referrals.map((ref) => {
    const name = escHtml(ref.name);
    const desc = escHtml(ref.description || "");
    const phone = escHtml(ref.phone || "");
    const url = escHtml(ref.url || "");
    const intake = escHtml(ref.intake_form || "");
    const instructions = escHtml(ref.intake_instructions || "");
    return `<section class="print-ref">
      <h2>${name}</h2>
      ${desc ? `<p>${desc}</p>` : ""}
      ${phone ? `<p><strong>Phone</strong> ${phone}</p>` : ""}
      ${url ? `<p><strong>Website</strong> ${url}</p>` : ""}
      ${intake ? `<p><strong>Intake</strong> ${intake}</p>` : ""}
      ${instructions ? `<p><strong>Notes</strong> ${instructions}</p>` : ""}
    </section>`;
  });

  const title = escHtml(t("chat.printTitle"));
  const intro = escHtml(
    t("chat.printIntro", {
      topic: topicLabel || "—",
      zip: zipCode || "—",
    })
  );
  const footer = escHtml(t("chat.printFooter"));
  const gen = escHtml(generatedAt);

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  body{font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.5;color:#0f172a;padding:28px;max-width:720px;margin:0 auto;}
  h1{font-size:1.2rem;margin:0 0 6px;font-weight:700;}
  .meta{color:#475569;font-size:0.9rem;margin:0 0 20px;}
  .gen{color:#64748b;font-size:0.85rem;margin:0 0 28px;}
  .print-ref{border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:14px;}
  h2{margin:0 0 8px;font-size:1.05rem;}
  p{margin:6px 0;font-size:0.95rem;}
  .foot{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:0.82rem;color:#64748b;}
</style></head><body>
<h1>${title}</h1>
<p class="meta">${intro}</p>
<p class="gen">${gen}</p>
${blocks.length ? blocks.join("") : '<section class="print-ref"><p>No resources available to print yet.</p></section>'}
<p class="foot">${footer}</p>
<script>
window.onload = function () {
  setTimeout(function () {
    window.print();
  }, 120);
};
</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}
