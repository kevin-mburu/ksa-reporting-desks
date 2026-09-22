import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { padSeq, seqFromAdm } from "./lib";

export const lookup = query({
  args: {
    admNo: v.string(),
    campusId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admNo = args.admNo.trim().toUpperCase();
    if (!admNo) return null;
    const row = await ctx.db
      .query("issuedLetters")
      .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
      .unique();
    if (!row) return { found: false as const };
    if (args.campusId && row.campusId !== args.campusId) {
      return {
        found: true as const,
        validForThisCampus: false as const,
        studentName: row.studentName,
        campusId: row.campusId,
        programme: row.programme,
        programmeName: row.programmeName,
        admNo: row.admNo,
        message: `This ADM belongs to ${row.campusId} campus, not ${args.campusId}.`,
      };
    }
    return {
      found: true as const,
      validForThisCampus: true as const,
      studentName: row.studentName,
      campusId: row.campusId,
      programme: row.programme,
      programmeName: row.programmeName,
      admNo: row.admNo,
      message: "Valid",
    };
  },
});

/**
 * Staff type only the sequence number (e.g. 3 or 003).
 * Returns matching issued letters for this campus (optionally filtered by programme).
 */
export const lookupBySeq = query({
  args: {
    campusId: v.string(),
    seq: v.string(),
    programme: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const want = String(parseInt(args.seq.replace(/\D/g, "") || "0", 10));
    if (!want || want === "0") return { matches: [] as any[] };

    const rows = await ctx.db
      .query("issuedLetters")
      .withIndex("by_campus", (q) => q.eq("campusId", args.campusId))
      .collect();

    let matches = rows.filter((r) => seqFromAdm(r.admNo) === want);
    if (args.programme) {
      const p = args.programme.trim().toUpperCase();
      matches = matches.filter(
        (r) =>
          r.programme.toUpperCase() === p ||
          r.admNo.toUpperCase().includes("/" + p + "/")
      );
    }

    return {
      matches: matches.map((r) => ({
        admNo: r.admNo,
        studentName: r.studentName,
        campusId: r.campusId,
        programme: r.programme,
        programmeName: r.programmeName,
      })),
    };
  },
});

export const upsert = mutation({
  args: {
    admNo: v.string(),
    studentName: v.string(),
    campusId: v.string(),
    programme: v.string(),
    programmeName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admNo = args.admNo.trim().toUpperCase();
    const existing = await ctx.db
      .query("issuedLetters")
      .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
      .unique();
    const payload = {
      studentName: args.studentName.trim().toUpperCase(),
      campusId: args.campusId,
      programme: args.programme.trim().toUpperCase(),
      programmeName: args.programmeName,
      source: "manual",
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { ok: true, updated: true };
    }
    await ctx.db.insert("issuedLetters", { admNo, ...payload });
    return { ok: true, updated: false };
  },
});

export const bulkImport = mutation({
  args: {
    rows: v.array(
      v.object({
        admNo: v.string(),
        studentName: v.string(),
        campusId: v.string(),
        programme: v.string(),
        programmeName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const r of args.rows) {
      const admNo = r.admNo.trim().toUpperCase();
      const existing = await ctx.db
        .query("issuedLetters")
        .withIndex("by_admNo", (q) => q.eq("admNo", admNo))
        .unique();
      const payload = {
        studentName: r.studentName.trim().toUpperCase(),
        campusId: r.campusId,
        programme: r.programme.trim().toUpperCase(),
        programmeName: r.programmeName,
        source: "import",
      };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        updated++;
      } else {
        await ctx.db.insert("issuedLetters", { admNo, ...payload });
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

// silence unused in case tree-shake
void padSeq;
