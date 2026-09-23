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
 * Login. campusId is the desk page campus (sent as pageCampusId to Convex).
 * Client does NOT block on role — Convex already checks password + campus.
 */
export async function login(email, password, campusId) {
  const client = getClient();
  const session = await client.mutation("auth:login", {
    email: email.trim().toLowerCase(),
    password,
    pageCampusId: campusId || undefined,
  });

  let full = session || {};
  if (full.token) {
    try {
      const me = await client.query("auth:me", { token: full.token });
      if (me) full = { ...full, ...me };
    } catch (_) {
      /* keep session */
    }
  }

  const role =
    full.role ||
    full.staff?.role ||
    full.user?.role ||
    full.staffRole ||
    null;
  if (role) full.role = role;

  // Prefer API campus, else form campus
  full.campusId =
    full.campusId ||
    full.staff?.campusId ||
    campusId ||
    "";

  saveSession(full);
  return full;
}

export async function resumeSession() {
  const s = loadSession();
  if (!s?.token) return null;
  try {
    const client = getClient();
    const session = await client.query("auth:me", { token: s.token });
    if (!session) {
      clearSession();
      return null;
    }
    const merged = { ...s, ...session };
    if (merged.staff?.role && !merged.role) merged.role = merged.staff.role;
    merged.campusId =
      merged.campusId || merged.staff?.campusId || s.campusId || "";
    saveSession(merged);
    return merged;
  } catch {
    return s;
  }
}

export function requireRole(session, roles) {
  const role = session?.role || session?.staff?.role;
  if (!role) return false;
  if (role === "admin") return true;
  return roles.includes(role);
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
  const tick = () => {
    const n = new Date();
    const t = document.getElementById(timeId);
    const d = document.getElementById(dateId);
    if (t)
      t.textContent = n.toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    if (d)
      d.textContent = n.toLocaleDateString("en-KE", {
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

export const CAMPUSES = [
  { id: "nakuru", code: "NKR", name: "Nakuru" },
  { id: "nyeri", code: "NYR", name: "Nyeri" },
  { id: "thika", code: "THK", name: "Thika" },
  { id: "ainabkoi", code: "AIN", name: "Ainabkoi" },
  { id: "ugenya", code: "UGN", name: "Ugenya" },
  { id: "seme", code: "SME", name: "Seme" },
];

export const TOTAL_FEE = 60500;
