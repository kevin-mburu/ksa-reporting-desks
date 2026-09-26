import { ConvexHttpClient } from "https://esm.sh/convex@1.17.0/browser";

export const CONVEX_URL = "https://resolute-rat-113.convex.cloud";

const SESSION_KEY = "ksa_desk_session";

export function getClient() {
  return new ConvexHttpClient(CONVEX_URL);
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Find session token from any common shape returned by auth:login / auth:me
 */
export function tokenOf(session) {
  if (!session || typeof session !== "object") return "";
  const candidates = [
    session.token,
    session.sessionToken,
    session.authToken,
    session.accessToken,
    session.jwt,
    session.sessionId,
    session.sid,
    session.staff?.token,
    session.staff?.sessionToken,
    session.user?.token,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  for (const [k, v] of Object.entries(session)) {
    if (typeof v === "string" && v.length > 8) {
      const lk = k.toLowerCase();
      if (lk.includes("token") || lk === "sid" || lk === "sessionid") return v;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) {
        if (typeof v2 === "string" && v2.length > 8) {
          const lk2 = k2.toLowerCase();
          if (lk2.includes("token") || lk2 === "sid" || lk2 === "sessionid")
            return v2;
        }
      }
    }
  }
  return "";
}

export async function login(email, password, campusId) {
  const client = getClient();
  const raw = await client.mutation("auth:login", {
    email: email.trim().toLowerCase(),
    password,
    pageCampusId: campusId || undefined,
  });

  console.log("[KSA auth:login response]", raw);
  console.log(
    "[KSA auth:login keys]",
    raw && typeof raw === "object" ? Object.keys(raw) : typeof raw
  );

  // Reject failed logins (Convex may return { ok: false, error } instead of throwing)
  if (!raw || raw.ok === false || raw.error) {
    throw new Error(
      (raw && raw.error) || "Invalid email or password."
    );
  }

  let full = { ...(raw && typeof raw === "object" ? raw : {}) };

  let tok = tokenOf(full);
  if (!tok && typeof raw === "string") tok = raw;
  if (tok) full.token = tok;

  if (full.token) {
    try {
      const me = await client.query("auth:me", { token: full.token });
      console.log("[KSA auth:me response]", me);
      if (me && typeof me === "object") {
        if (me.ok === false || me.error) {
          console.warn("[KSA auth:me error]", me.error);
        } else {
          full = { ...full, ...me };
          if (!tokenOf(full)) full.token = tok;
          else full.token = tokenOf(full);
        }
      }
    } catch (e) {
      console.warn("[KSA auth:me failed]", e);
    }
  }

  const role =
    full.role || full.staff?.role || full.user?.role || full.staffRole || null;
  if (role) full.role = role;

  full.campusId = full.campusId || full.staff?.campusId || campusId || "";

  if (!full.token && tok) full.token = tok;

  if (!tokenOf(full)) {
    const keys = Object.keys(full).join(", ") || "(empty)";
    throw new Error(
      "Login OK but no token in response. Keys: " +
        keys +
        ". Open Console (F12) and check [KSA auth:login response]."
    );
  }

  full.token = tokenOf(full);
  saveSession(full);
  return full;
}

export async function resumeSession() {
  const s = loadSession();
  if (!tokenOf(s)) return null;
  try {
    const client = getClient();
    const token = tokenOf(s);
    const session = await client.query("auth:me", { token });
    if (!session || session.ok === false || session.error) {
      clearSession();
      return null;
    }
    const merged = { ...s, ...session };
    merged.token = tokenOf(merged) || token;
    if (merged.staff?.role && !merged.role) merged.role = merged.staff.role;
    merged.campusId =
      merged.campusId || merged.staff?.campusId || s.campusId || "";
    saveSession(merged);
    return merged;
  } catch {
    return s;
  }
}

export function roleOf(session) {
  return String(
    session?.role || session?.staff?.role || session?.user?.role || ""
  )
    .trim()
    .toLowerCase();
}

export function requireRole(session, roles) {
  const role = roleOf(session);
  if (!role) return false;
  if (role === "admin") return true;
  const allowed = (roles || []).map((r) => String(r).toLowerCase());
  return allowed.includes(role);
}

/**
 * Enforce desk access. Admin always allowed.
 * On failure: clear session and throw so login form shows the error.
 */
export function assertDeskAccess(session, allowedRoles, deskName) {
  if (requireRole(session, allowedRoles)) return true;
  const role = roleOf(session) || "(none)";
  clearSession();
  throw new Error(
    `Access denied: "${role}" cannot open ${deskName}. Use a ${allowedRoles.join(" / ")} account (or admin).`
  );
}

/**
 * Delete student by ADM. Tries letter / ground / admNo (+ optional campusId).
 * Verifies the student is gone from listByCampus before returning ok.
 */
export async function removeStudentRecord(session, studentOrAdm) {
  const token = tokenOf(session);
  const campusId = campusOf(session);
  if (!token) throw new Error("No session token — sign in again.");
  const candidates = [];
  let docId = "";
  if (typeof studentOrAdm === "string") {
    candidates.push(studentOrAdm.trim());
  } else if (studentOrAdm && typeof studentOrAdm === "object") {
    docId = String(studentOrAdm._id || studentOrAdm.id || "");
    for (const k of ["admNo", "letterAdmNo", "groundAdmNo"]) {
      const v = String(studentOrAdm[k] || "").trim();
      if (v && !candidates.includes(v)) candidates.push(v);
    }
  }
  if (!candidates.length) throw new Error("Missing admission number for delete.");

  const client = getClient();

  async function stillPresent(admTried) {
    if (!campusId) return null;
    try {
      const all =
        (await client.query("students:listByCampus", { token, campusId })) || [];
      return all.find(
        (s) =>
          (docId && String(s._id) === docId) ||
          candidates.some(
            (a) =>
              s.admNo === a || s.letterAdmNo === a || s.groundAdmNo === a
          ) ||
          s.admNo === admTried ||
          s.letterAdmNo === admTried ||
          s.groundAdmNo === admTried
      );
    } catch {
      return null;
    }
  }

  // Validator is only { token, admNo } — never send campusId
  let lastErr = null;
  let lastResult = null;
  for (const admNo of candidates) {
    try {
      lastResult = await client.mutation("students:removeStudent", {
        token,
        admNo,
      });
      const left = await stillPresent(admNo);
      if (!left) {
        return {
          ok: true,
          usedAdm: admNo,
          server: lastResult,
        };
      }
      lastErr = new Error(
        "removeStudent returned without error but student still exists (tried " +
          admNo +
          "). Server reply: " +
          JSON.stringify(lastResult ?? null)
      );
    } catch (e) {
      lastErr = e;
      const m = String(e?.message || e || "");
      if (
        m.includes("extra field") ||
        m.includes("ArgumentValidation") ||
        m.includes("not found") ||
        m.includes("Not found") ||
        m.includes("no student")
      ) {
        continue;
      }
      throw e;
    }
  }
  throw (
    lastErr ||
    new Error(
      "Delete failed for ADM variants: " +
        candidates.join(", ") +
        ". Backend may not implement removeStudent correctly."
    )
  );
}

export function campusOf(session) {
  return (
    session?.campusId ||
    session?.staff?.campusId ||
    session?.pageCampusId ||
    ""
  );
}

export function toast(msg, isError = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "show" + (isError ? " error" : "");
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.className = "";
  }, 4000);
}

export function startClock(timeId = "live-time", dateId = "live-date") {
  // Force East Africa Time (UTC+3) — not the browser's local zone
  const TZ = "Africa/Nairobi";
  const tick = () => {
    const n = new Date();
    const t = document.getElementById(timeId);
    const d = document.getElementById(dateId);
    if (t)
      t.textContent = n.toLocaleTimeString("en-KE", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    if (d)
      d.textContent = n.toLocaleDateString("en-KE", {
        timeZone: TZ,
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  };
  tick();
  setInterval(tick, 1000);
}

export function fmt(n) {
  return Number(n || 0).toLocaleString("en-KE");
}

/** Uppercase text fields (names, IDs, refs). Email stays lower. */
export function toUpper(s) {
  return String(s ?? "").trim().toUpperCase();
}
export function toLowerEmail(s) {
  return String(s ?? "").trim().toLowerCase();
}

/** True if error looks like expired/invalid session */
export function isSessionError(err) {
  const m = String(err?.message || err || "").toLowerCase();
  return (
    m.includes("token") ||
    m.includes("session") ||
    m.includes("unauthorized") ||
    m.includes("unauthenticated") ||
    m.includes("not authenticated") ||
    m.includes("invalid auth")
  );
}

/**
 * Disable button while async work runs. Restores label after.
 */
export async function withBusy(btn, work, busyLabel = "Working…") {
  if (!btn) return work();
  if (btn.disabled) return;
  const prev = btn.textContent;
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  btn.textContent = busyLabel;
  try {
    return await work();
  } finally {
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
    btn.textContent = prev;
  }
}

/**
 * Try several mutation names until one exists (Convex deploy name drift).
 * Returns { ok, name, result } or throws last error if all missing.
 */
export async function tryMutations(names, args) {
  const client = getClient();
  let lastErr = null;
  for (const name of names) {
    try {
      const result = await client.mutation(name, args);
      return { ok: true, name, result };
    } catch (e) {
      const msg = String(e?.message || e || "");
      lastErr = e;
      if (
        msg.includes("Could not find public function") ||
        msg.includes("not found") ||
        msg.includes("Unknown function")
      ) {
        console.warn("[KSA] mutation missing:", name, msg);
        continue;
      }
      // Real validation/auth error — stop trying
      throw e;
    }
  }
  throw lastErr || new Error("No matching Convex mutation found: " + names.join(", "));
}

export const CAMPUSES = [
  { id: "nakuru", code: "NKR", name: "Nakuru" },
  { id: "nyeri", code: "NYR", name: "Nyeri" },
  { id: "thika", code: "THK", name: "Thika" },
  { id: "ainabkoi", code: "AIN", name: "Ainabkoi" },
  { id: "ugenya", code: "UGN", name: "Ugenya" },
  { id: "seme", code: "SME", name: "Seme" },
];

export const TOTAL_FEE = 60500;
