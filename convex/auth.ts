import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword, sessionToken } from "./lib";

const SESSION_MS = 12 * 60 * 60 * 1000;

export const seedStaff = mutation({
  args: {
    adminEmail: v.string(),
    adminPassword: v.string(),
    adminName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.adminEmail.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) return { ok: false, message: "Admin email already exists" };

    await ctx.db.insert("staff", {
      email,
      passwordHash: hashPassword(args.adminPassword),
      name: args.adminName || "System Admin",
      role: "admin",
      isActive: true,
    });

    const campuses = ["nyeri", "thika", "nakuru", "ainabkoi", "ugenya", "seme"];
    for (const campus of campuses) {
      for (const role of ["finance", "it", "photo", "principal"] as const) {
        const e = `${role}.${campus}@ksa.local`;
        const found = await ctx.db
          .query("staff")
          .withIndex("by_email", (q) => q.eq("email", e))
          .unique();
        if (!found) {
          await ctx.db.insert("staff", {
            email: e,
            passwordHash: hashPassword("campus2026"),
            name: `${role} ${campus}`,
            role,
            campusId: campus,
            isActive: true,
          });
        }
      }
    }
    return {
      ok: true,
      message: "Admin + sample desk users created. Sample password: campus2026",
    };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    pageCampusId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!staff || !staff.isActive) {
      return { ok: false as const, error: "Invalid email or password." };
    }
    if (staff.passwordHash !== hashPassword(args.password)) {
      return { ok: false as const, error: "Invalid email or password." };
    }

    if (staff.role !== "admin" && args.pageCampusId) {
      if (!staff.campusId || staff.campusId !== args.pageCampusId) {
        return {
          ok: false as const,
          error: `This account is not authorised for ${args.pageCampusId} campus.`,
        };
      }
    }

    const token = sessionToken();
    const expiresAt = Date.now() + SESSION_MS;
    await ctx.db.insert("sessions", {
      token,
      staffId: staff._id,
      email: staff.email,
      role: staff.role,
      campusId: staff.campusId,
      name: staff.name,
      expiresAt,
    });

    return {
      ok: true as const,
      token,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      campusId: staff.campusId ?? null,
      expiresAt,
    };
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now()) return null;
    return {
      email: session.email,
      name: session.name,
      role: session.role,
      campusId: session.campusId ?? null,
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return { ok: true };
  },
});

export const createStaff = mutation({
  args: {
    token: v.string(),
    email: v.string(),
    password: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("finance"),
      v.literal("it"),
      v.literal("photo"),
      v.literal("principal"),
      v.literal("admin")
    ),
    campusId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.expiresAt < Date.now() || session.role !== "admin") {
      return { ok: false, error: "Admin only." };
    }
    const email = args.email.trim().toLowerCase();
    const exists = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (exists) return { ok: false, error: "Email already exists." };
    if (args.role !== "admin" && !args.campusId) {
      return { ok: false, error: "Campus required for non-admin staff." };
    }

    await ctx.db.insert("staff", {
      email,
      passwordHash: hashPassword(args.password),
      name: args.name,
      role: args.role,
      campusId: args.role === "admin" ? undefined : args.campusId,
      isActive: true,
    });
    return { ok: true };
  },
});

export const listStaff = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!session || session.role !== "admin") return [];
    const rows = await ctx.db.query("staff").collect();
    return rows.map((s) => ({
      email: s.email,
      name: s.name,
      role: s.role,
      campusId: s.campusId ?? null,
      isActive: s.isActive,
    }));
  },
});
