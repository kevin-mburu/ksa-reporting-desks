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

export async function login(email, password, campusId, expectedRoles) {
  const client = getClient();
  const session = await client.mutation("auth:login", {
    email: email.trim().toLowerCase(),
    password,
    campusId: campusId || undefined,
  });
  if (expectedRoles && expectedRoles.length) {
    const role = session.role || session.staff?.role;
    if (role !== "admin" && !expectedRoles.includes(role)) {
      throw new Error("This account cannot open this desk. Use the correct role or Admin.");
    }
  }
  saveSession(session);
  return session;
}

export async function resumeSession(expectedRoles) {
  const s = loadSession();
  if (!s?.token) return null;
  try {
    const client = getClient();
    const session = await client.query("auth:me", { token: s.token });
    if (!session) {
      clearSession();
      return null;
    }
    const role = session.role || session.staff?.role;
    if (expectedRoles?.length && role !== "admin" && !expectedRoles.includes(role)) {
      return null;
    }
    const merged = { ...s, ...session };
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
  return session?.campusId || session?.staff?.campusId || "";
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
