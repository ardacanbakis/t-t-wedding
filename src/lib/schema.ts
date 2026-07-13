import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One row per invitation. An invitation can cover a whole household/couple.
// maxGuests === null means "unlimited" (special invitees pick any number).
export const invitations = sqliteTable("invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  name: text("name").notNull(),
  maxGuests: integer("max_guests"),
  status: text("status", { enum: ["pending", "accepted", "declined"] })
    .notNull()
    .default("pending"),
  partySize: integer("party_size"),
  note: text("note"),
  respondedAt: text("responded_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Invitation = typeof invitations.$inferSelect;
