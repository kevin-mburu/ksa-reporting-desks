import { ConvexHttpClient } from "https://esm.sh/convex@1.17.0/browser";

/** No trailing slash */
export const CONVEX_URL = "https://tame-wolf-369.convex.cloud";

export const client = new ConvexHttpClient(CONVEX_URL);
export const DEFAULT_FEE = 60500;

const TOKEN_KEY = "ksa_desk_token";
const USER_KEY = "ksa_desk_user";

export function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      name: data.name,
      email: data.email,
      role: data.role,
      campusId: data.campusId,
      expiresAt: data.expiresAt,
    })
  );
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export async function login(email, password, pageCampusId) {
  const res = await client.mutation("auth:login", {
    email,
    password,
    pageCampusId: pageCampusId || undefined,
  });
  if (res.ok) saveSession(res);
  return res;
}

export async function logout() {
  const token = getToken();
  if (token) {
    try {
      await client.mutation("auth:logout", { token });
    } catch (_) {}
  }
  clearSession();
}

export function fmtKes(n) {
  return "KES " + Number(n || 0).toLocaleString("en-KE");
}

export function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const CAMPUS_OPTIONS = [
  ["nyeri", "Nyeri"],
  ["thika", "Thika"],
  ["nakuru", "Nakuru"],
  ["ainabkoi", "Ainabkoi"],
  ["ugenya", "Ugenya"],
  ["seme", "Seme"],
];

export function fillCampusSelect(sel) {
  sel.innerHTML =
    '<option value="">Select campus…</option>' +
    CAMPUS_OPTIONS.map(([id, name]) => `<option value="${id}">${name}</option>`).join("");
}

export function toast(msg, err) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = "show" + (err ? " err" : "");
  setTimeout(() => (t.className = ""), 3500);
}

/** Live clock into #live-time and #live-date */
export function startClock() {
  const tick = () => {
    const n = new Date();
    const t = document.getElementById("live-time");
    const d = document.getElementById("live-date");
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


/**
 * If session exists and role is allowed, return user; else null.
 * Admin is allowed on every desk.
 */
export function sessionAllows(roles) {
  const u = getUser();
  const token = getToken();
  if (!u || !token) return null;
  if (u.expiresAt && Date.now() > u.expiresAt) {
    clearSession();
    return null;
  }
  if (u.role === "admin") return u;
  if (roles.includes(u.role)) return u;
  return null;
}
