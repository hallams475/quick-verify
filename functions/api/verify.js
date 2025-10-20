// functions/api/verify.js
export async function onRequestPost({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const { imageUrl, email, phone } = body || {};

    const results = {
      imageCheck: await checkImage(imageUrl),
      emailCheck: await checkEmail(email),
      phoneCheck: await checkPhone(phone)
    };

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // allow your Pages frontend to call this API
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

// -------------------- Helpers --------------------

async function checkImage(imageUrl) {
  if (!imageUrl) return "No image provided";
  try {
    // DuckDuckGo image search page for the URL (lightweight approach)
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(imageUrl)}&iax=images&ia=images`;
    const resp = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } , cf: { cacheTtl: 300 }});
    const html = await resp.text();

    // heuristics:
    if (/shutterstock|istock|gettyimages|depositphotos|adobe/i.test(html)) {
      return "Similar image appears on stock/photo sites — likely reused or fake.";
    }
    if (html.length > 3000 && /img|src=|data-src/i.test(html)) {
      return "Similar images found online (reverse search detected matches).";
    }
    return "No obvious matches found in quick reverse check.";
  } catch (e) {
    return `Image search failed: ${e.message}`;
  }
}

async function checkEmail(email) {
  if (!email) return "No email provided";
  // basic syntax
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Invalid email format.";

  const domain = email.split('@')[1].toLowerCase();
  // small disposable domain list — expand later
  const disposable = ["mailinator.com", "10minutemail.com", "tempmail.com", "guerrillamail.com", "dispostable.com"];
  if (disposable.includes(domain)) return "Disposable email domain detected.";

  try {
    // Use public DNS-over-HTTPS to check MX records (Google DNS)
    const dnsUrl = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const r = await fetch(dnsUrl, { cf: { cacheTtl: 300 }});
    const j = await r.json();
    if (j && Array.isArray(j.Answer) && j.Answer.length > 0) {
      return "Domain has MX records — likely accepts email.";
    } else {
      return "No MX records found — domain may not accept email (suspicious).";
    }
  } catch (e) {
    return `Email DNS check failed: ${e.message}`;
  }
}

async function checkPhone(phone) {
  if (!phone) return "No phone provided";
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return "Too short to be a valid phone number.";
  if (digits.length > 15) return "Number looks too long to be valid.";

  // Very basic region hints:
  if (phone.trim().startsWith('+1')) return "North American format detected.";
  if (phone.trim().startsWith('+44')) return "UK format detected.";
  if (phone.trim().startsWith('+61')) return "Australia format detected.";
  // crude voip hint (common virtual provider prefixes can be added)
  if (/^(?:\+1(769|649)|\+44(74|75))/.test(digits)) {
    return "Number matches known virtual/VoIP prefixes — could be disposable/VoIP.";
  }

  return "Phone format looks plausible. Ownership cannot be confirmed without OTP.";
}
