import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  staff: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("finance"),
      v.literal("it"),
      v.literal("photo"),
      v.literal("principal"),
      v.literal("admin")
    ),
    campusId: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_email", ["email"]),

  issuedLetters: defineTable({
    admNo: v.string(),
    studentName: v.string(),
    campusId: v.string(),
    programme: v.string(),
    programmeName: v.optional(v.string()),
    source: v.optional(v.string()),
  })
    .index("by_admNo", ["admNo"])
    .index("by_campus", ["campusId"]),

  students: defineTable({
    /** Primary key at desks — usually same as online letter ADM */
    admNo: v.string(),
    /** Online letter ADM after portal admission */
    letterAdmNo: v.optional(v.string()),
    /** Number confirmed / used on campus reporting day (may match letter or differ) */
    groundAdmNo: v.optional(v.string()),
    campusId: v.string(),
    programme: v.string(),
    studentName: v.string(),
    payMethod: v.optional(v.string()),
    kcbRef: v.optional(v.string()),
    mpesaRef: v.optional(v.string()),
    cashRef: v.optional(v.string()),
    chequeRef: v.optional(v.string()),
    amountPaid: v.optional(v.number()),
    fee: v.optional(v.number()),
    balance: v.optional(v.number()),
    phone: v.optional(v.string()),
    idNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    age: v.optional(v.string()),
    guardian: v.optional(v.string()),
    guardianPhone: v.optional(v.string()),
    gender: v.optional(v.string()),
    bioCaptured: v.optional(v.boolean()),
    photoSerial: v.optional(v.string()),
    remarks: v.optional(v.string()),
    financeAt: v.optional(v.string()),
    bioAt: v.optional(v.string()),
    photoAt: v.optional(v.string()),
    updatedAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_admNo", ["admNo"])
    .index("by_campus", ["campusId"])
    .index("by_campus_programme", ["campusId", "programme"]),

  sessions: defineTable({
    token: v.string(),
    staffId: v.id("staff"),
    email: v.string(),
    role: v.string(),
    campusId: v.optional(v.string()),
    name: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),
});
