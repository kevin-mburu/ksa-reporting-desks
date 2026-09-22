import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_FEE, nowIso, PROGRAMMES, buildGroundAdm, maxSeqFromGroundList } from "./lib";

async function requireSession(ctx: any, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) return null;
  return session;
}

function assertCampus(session: any, campusId: string) {
  if (session.role === "admin") return true;
  return session.campusId === campusId;
}

export const getByAdmNo = query({
  args: { admNo: v.string() },
  handler: async (ctx, args) => {
    const admNo = args.admNo.trim().toUpperCase();
    return await ctx.db
      .query("students")
      .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
      .unique();
  },
});

export const listByCampus = query({
  args: {
    token: v.string(),
    campusId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    if (!session) return [];
    let campusId = args.campusId;
    if (session.role !== "admin") campusId = session.campusId;
    if (!campusId) {
      return await ctx.db.query("students").order("desc").take(800);
    }
    return await ctx.db
      .query("students")
      .withIndex("by_campus", (q) => q.eq("campusId", campusId!))
      .order("desc")
      .take(800);
  },
});


export const nextGroundSeq = query({
  args: {
    campusId: v.string(),
    programme: v.string(),
  },
  handler: async (ctx, args) => {
    const programme = args.programme.trim().toUpperCase();
    const rows = await ctx.db
      .query("students")
      .withIndex("by_campus", (q) => q.eq("campusId", args.campusId))
      .collect();
    const grounds = rows
      .filter((r) => (r.programme || "").toUpperCase() === programme)
      .map((r) => r.groundAdmNo || "")
      .filter(Boolean);
    const max = maxSeqFromGroundList(grounds);
    const next = max + 1;
    return {
      nextSeq: next,
      preview: buildGroundAdm(args.campusId, programme, next),
      lastSeq: max,
    };
  },
});

export const saveFinance = mutation({
  args: {
    token: v.string(),
    admNo: v.string(),
    campusId: v.string(),
    programme: v.string(),
    studentName: v.string(),
    payMethod: v.string(),
    kcbRef: v.optional(v.string()),
    mpesaRef: v.optional(v.string()),
    cashRef: v.optional(v.string()),
    chequeRef: v.optional(v.string()),
    amountPaid: v.number(),
    fee: v.optional(v.number()),
    letterAdmNo: v.optional(v.string()),
    groundAdmNo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    if (!session) return { ok: false, error: "Please sign in again." };
    if (session.role !== "admin" && session.role !== "finance") {
      return { ok: false, error: "Finance role required." };
    }
    if (!assertCampus(session, args.campusId)) {
      return { ok: false, error: "Wrong campus for this account." };
    }

    const admNo = args.admNo.trim().toUpperCase();
    const fee =
      args.fee ??
      PROGRAMMES[args.programme.trim().toUpperCase()]?.fee ??
      DEFAULT_FEE;
    const amountPaid = Math.max(0, args.amountPaid);
    const balance = Math.max(0, fee - amountPaid);
    const now = nowIso();

    const existing = await ctx.db
      .query("students")
      .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
      .unique();

    const letter = (args.letterAdmNo || admNo).trim().toUpperCase();
    const programme = args.programme.trim().toUpperCase();

    // Sequential ground ADM for NEW assigns; keep existing ground on update unless explicitly sent
    let ground: string;
    if (existing?.groundAdmNo && !args.groundAdmNo) {
      ground = existing.groundAdmNo;
    } else if (args.groundAdmNo && existing) {
      // Edit path may pass groundAdmNo
      ground = args.groundAdmNo.trim().toUpperCase();
    } else if (existing?.groundAdmNo) {
      ground = existing.groundAdmNo;
    } else {
      // New student: next sequential for this campus + programme
      const peers = await ctx.db
        .query("students")
        .withIndex("by_campus", (q) => q.eq("campusId", args.campusId))
        .collect();
      const grounds = peers
        .filter((r) => (r.programme || "").toUpperCase() === programme)
        .map((r) => r.groundAdmNo || "")
        .filter(Boolean);
      const next = maxSeqFromGroundList(grounds) + 1;
      ground = buildGroundAdm(args.campusId, programme, next);
    }

    const patch: Record<string, unknown> = {
      admNo,
      letterAdmNo: letter,
      groundAdmNo: ground,
      campusId: args.campusId,
      programme: args.programme.trim().toUpperCase(),
      studentName: args.studentName.trim().toUpperCase(),
      payMethod: args.payMethod,
      kcbRef: args.kcbRef || "",
      mpesaRef: args.mpesaRef || "",
      cashRef: args.cashRef || "",
      chequeRef: args.chequeRef || "",
      amountPaid,
      fee,
      balance,
      updatedAt: now,
    };
    if (!existing?.financeAt) patch.financeAt = now;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { ok: true, id: existing._id, balance, fee, financeAt: existing.financeAt || now, groundAdmNo: ground, letterAdmNo: letter };
    }
    const id = await ctx.db.insert("students", {
      ...(patch as any),
      financeAt: now,
      createdAt: now,
    });
    return { ok: true, id, balance, fee, financeAt: now, groundAdmNo: ground, letterAdmNo: letter };
  },
});

export const saveBio = mutation({
  args: {
    token: v.string(),
    admNo: v.string(),
    campusId: v.string(),
    studentName: v.string(),
    programme: v.optional(v.string()),
    phone: v.optional(v.string()),
    idNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    age: v.optional(v.string()),
    guardian: v.optional(v.string()),
    guardianPhone: v.optional(v.string()),
    gender: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    if (!session) return { ok: false, error: "Please sign in again." };
    if (session.role !== "admin" && session.role !== "it") {
      return { ok: false, error: "IT desk role required." };
    }
    if (!assertCampus(session, args.campusId)) {
      return { ok: false, error: "Wrong campus for this account." };
    }

    const admNo = args.admNo.trim().toUpperCase();
    const existing = await ctx.db
      .query("students")
      .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
      .unique();

    if (!existing) {
      return {
        ok: false,
        error: "No Finance record for this ADM yet. Finance must save first.",
      };
    }
    if (existing.campusId !== args.campusId && session.role !== "admin") {
      return { ok: false, error: "Student belongs to another campus." };
    }

    const now = nowIso();
    const patch: Record<string, unknown> = {
      studentName: args.studentName.trim().toUpperCase(),
      programme: args.programme
        ? args.programme.trim().toUpperCase()
        : existing.programme,
      phone: args.phone || "",
      idNumber: args.idNumber || "",
      email: args.email || "",
      age: args.age || "",
      guardian: args.guardian || "",
      guardianPhone: args.guardianPhone || "",
      gender: args.gender || "",
      bioCaptured: true,
      updatedAt: now,
    };
    if (!existing.bioAt) patch.bioAt = now;

    await ctx.db.patch(existing._id, patch);
    return { ok: true, bioAt: existing.bioAt || now };
  },
});

export const savePhoto = mutation({
  args: {
    token: v.string(),
    admNo: v.string(),
    campusId: v.string(),
    photoSerial: v.string(),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    if (!session) return { ok: false, error: "Please sign in again." };
    if (session.role !== "admin" && session.role !== "photo") {
      return { ok: false, error: "Photo desk role required." };
    }
    if (!assertCampus(session, args.campusId)) {
      return { ok: false, error: "Wrong campus for this account." };
    }

    const admNo = args.admNo.trim().toUpperCase();
    const existing = await ctx.db
      .query("students")
      .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
      .unique();

    if (!existing) {
      return {
        ok: false,
        error: "No Finance record for this ADM yet. Finance must save first.",
      };
    }
    if (existing.campusId !== args.campusId && session.role !== "admin") {
      return { ok: false, error: "Student belongs to another campus." };
    }

    const serial = args.photoSerial.trim().toUpperCase();
    const all = await ctx.db.query("students").collect();
    const clash = all.find(
      (s) =>
        s.photoSerial &&
        s.photoSerial.toUpperCase() === serial &&
        s.admNo !== admNo
    );
    if (clash) {
      return { ok: false, error: `Photo serial already used by ${clash.admNo}.` };
    }

    const now = nowIso();
    const patch: Record<string, unknown> = {
      photoSerial: serial,
      remarks: args.remarks || "",
      updatedAt: now,
    };
    if (!existing.photoAt) patch.photoAt = now;

    await ctx.db.patch(existing._id, patch);
    return { ok: true, photoAt: existing.photoAt || now };
  },
});

export const campusTotals = query({
  args: {
    token: v.string(),
    campusId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    if (!session) return null;
    let campusId = args.campusId;
    if (session.role !== "admin") campusId = session.campusId;

    const rows = campusId
      ? await ctx.db
          .query("students")
          .withIndex("by_campus", (q) => q.eq("campusId", campusId!))
          .collect()
      : await ctx.db.query("students").collect();

    return {
      count: rows.length,
      collected: rows.reduce((a, s) => a + (s.amountPaid || 0), 0),
      outstanding: rows.reduce((a, s) => a + (s.balance || 0), 0),
      bio: rows.filter((s) => s.bioCaptured).length,
      photo: rows.filter((s) => s.photoSerial).length,
      campusId: campusId || "all",
    };
  },
});

/** Delete a campus register row so the number can be reassigned */
export const removeStudent = mutation({
  args: {
    token: v.string(),
    admNo: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    if (!session) return { ok: false, error: "Please sign in again." };
    if (session.role !== "admin" && session.role !== "finance") {
      return { ok: false, error: "Only Finance or Admin can delete register rows." };
    }
    const admNo = args.admNo.trim().toUpperCase();
    const existing = await ctx.db
      .query("students")
      .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
      .unique();
    if (!existing) return { ok: false, error: "Record not found." };
    if (session.role !== "admin" && existing.campusId !== session.campusId) {
      return { ok: false, error: "Wrong campus." };
    }
    await ctx.db.delete(existing._id);
    return { ok: true };
  },
});
