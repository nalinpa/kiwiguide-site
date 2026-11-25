// /plan/apple: Sign in with Apple posts its answer here (response_mode form_post, which Apple needs to share the email).
// The answer goes on to /plan/ in the fragment, in the same shape as Google's (#id_token=..&state=..), so the page signs
// in the same way. The token is never logged or stored here.
const STATE = /^[A-Za-z0-9_-]{1,64}$/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export async function appleReturn(request) {
  const origin = new URL(request.url).origin;
  const go = (frag) => new Response(null, { status: 303, headers: { Location: `${origin}/plan/${frag}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  if (request.method !== "POST") return go("");
  const form = await request.formData().catch(() => null);
  const state = form && form.get("state");
  if (typeof state !== "string" || !STATE.test(state)) return go("");
  const token = form.get("id_token"), error = form.get("error");
  if (typeof token === "string" && token.length < 8192 && JWT.test(token)) return go(`#id_token=${token}&state=${state}`);
  // Apple's cancel is user_cancelled_authorize; the page knows Google's name for it
  return go(`#error=${error === "user_cancelled_authorize" ? "access_denied" : "server_error"}&state=${state}`);
}
