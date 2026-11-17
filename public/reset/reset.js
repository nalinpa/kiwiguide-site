const EXPIRED = "This link has expired or was already used. Open Kiwi Guide and ask for a new one from the sign-in screen.";
const WEAK = "Choose a password with at least 6 characters.";
const GENERIC = "Something went wrong. Check your connection and try again.";

function readLink(search) {
  const p = new URLSearchParams(search);
  const mode = p.get("mode"), oobCode = p.get("oobCode"), apiKey = p.get("apiKey");
  return mode && oobCode && apiKey ? { mode, oobCode, apiKey } : null;
}

// Firebase may put text after the code ("WEAK_PASSWORD : Password should be..."), so match the start.
function messageFor(errorCode) {
  const code = String(errorCode || "").split(/[\s:]/)[0];
  if (code === "EXPIRED_OOB_CODE" || code === "INVALID_OOB_CODE") return EXPIRED;
  if (code === "WEAK_PASSWORD") return WEAK;
  return GENERIC;
}

if (typeof module !== "undefined") module.exports = { readLink, messageFor };

if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);
  const link = readLink(location.search);
  // The code is only needed in memory; take it out of the address bar and history.
  history.replaceState(null, "", location.pathname);

  const say = (text) => { $("msg").textContent = text; };
  const call = async (body) => {
    const res = await fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=" + encodeURIComponent(link.apiKey),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || "");
    return data;
  };
  const stop = (text) => { $("form").hidden = true; $("loading").hidden = true; say(text); };

  if (!link || link.mode !== "resetPassword") {
    stop(EXPIRED);
  } else {
    call({ oobCode: link.oobCode }).then((d) => {
      $("loading").hidden = true;
      $("email").textContent = "for " + d.email;
      $("form").hidden = false;
      $("password").focus();
    }).catch((e) => stop(messageFor(e instanceof TypeError ? "" : e.message)));

    $("form").addEventListener("submit", async (ev) => {
      ev.preventDefault(); // form-action is 'none': never really submit
      const button = $("go");
      button.disabled = true;
      say("");
      try {
        await call({ oobCode: link.oobCode, newPassword: $("password").value });
        stop("Password changed. Open Kiwi Guide and sign in with your new password.");
        $("open").hidden = false;
      } catch (e) {
        const text = messageFor(e instanceof TypeError ? "" : e.message);
        if (text === EXPIRED) stop(text); else { say(text); button.disabled = false; }
      }
    });
  }
}
