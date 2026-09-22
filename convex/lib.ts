export const DEFAULT_FEE = 60500;

export const CAMPUSES: Record<string, { id: string; name: string; code: string }> = {
  nyeri: { id: "nyeri", name: "Nyeri Campus", code: "NYR" },
  thika: { id: "thika", name: "Thika Campus", code: "THK" },
  nakuru: { id: "nakuru", name: "Nakuru Campus", code: "NKR" },
  ainabkoi: { id: "ainabkoi", name: "Ainabkoi Campus", code: "AIN" },
  ugenya: { id: "ugenya", name: "Ugenya Campus", code: "UGN" },
  seme: { id: "seme", name: "Seme Campus", code: "SME" },
};

export const PROGRAMMES: Record<string, { code: string; name: string; fee: number }> = {
  HP: { code: "HP", name: "Horticultural Production (CBET)", fee: 60500 },
  DGA: { code: "DGA", name: "Diploma in General Agriculture", fee: 60500 },
  DSA: { code: "DSA", name: "Diploma in Sustainable Agriculture", fee: 60500 },
  DEA: { code: "DEA", name: "Diploma in Entrepreneurial Agriculture", fee: 60500 },
  CGA: { code: "CGA", name: "Certificate in General Agriculture", fee: 60500 },
  CSA: { code: "CSA", name: "Certificate in Sustainable Agriculture", fee: 60500 },
  CEA: { code: "CEA", name: "Certificate in Entrepreneurial Agriculture", fee: 60500 },
};

export function hashPassword(password: string): string {
  const s = `ksa-reporting-desk-v1:${password}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function sessionToken() {
  const a = Math.random().toString(36).slice(2);
  const b = Math.random().toString(36).slice(2);
  return `${a}${b}${Date.now().toString(36)}`;
}

/** Extract trailing sequence before /YEAR from ADM like NKR/HP/C1/003/2026 */
export function seqFromAdm(admNo: string): string {
  const parts = admNo.trim().toUpperCase().split("/").filter(Boolean);
  if (parts.length >= 2) {
    const maybeYear = parts[parts.length - 1];
    const maybeSeq = parts[parts.length - 2];
    if (/^\d{4}$/.test(maybeYear) && /^\d+$/.test(maybeSeq)) {
      return String(parseInt(maybeSeq, 10));
    }
  }
  const m = admNo.match(/\/(\d+)\/(\d{4})\s*$/);
  if (m) return String(parseInt(m[1], 10));
  return "";
}

export function padSeq(raw: string): string {
  const n = raw.replace(/\D/g, "");
  if (!n) return "";
  return n.padStart(3, "0");
}

export const ADM_YEAR = "2026";
export const ADM_COHORT = "C1";

/** Build campus ground ADM: NKR/HP/C1/015/2026 */
export function buildGroundAdm(
  campusId: string,
  programme: string,
  seq: number
): string {
  const code = CAMPUSES[campusId]?.code || campusId.toUpperCase().slice(0, 3);
  const prog = programme.trim().toUpperCase() || "HP";
  const n = Math.max(1, Math.floor(seq));
  return `${code}/${prog}/${ADM_COHORT}/${String(n).padStart(3, "0")}/${ADM_YEAR}`;
}

/** Highest numeric sequence used in a list of ground ADMs for same campus+programme pattern */
export function maxSeqFromGroundList(groundList: string[]): number {
  let max = 0;
  for (const g of groundList) {
    const s = seqFromAdm(g);
    if (s) {
      const n = parseInt(s, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max;
}
