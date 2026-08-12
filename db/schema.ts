import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sopCounters = sqliteTable("sop_counters", {
  department: text("department").primaryKey(),
  prefix: text("prefix").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
});

export const sops = sqliteTable("sops", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  author: text("author").notNull(),
  createdDate: text("created_date").notNull(),
  version: text("version").notNull(),
  reviewDate: text("review_date"),
  status: text("status").notNull().default("Published"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_sops_reference").on(table.reference),
  index("idx_sops_department_created").on(table.department, table.createdAt),
]);

export const sopSteps = sqliteTable("sop_steps", {
  id: text("id").primaryKey(),
  sopId: text("sop_id").notNull().references(() => sops.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  instruction: text("instruction").notNull(),
  imageKey: text("image_key"),
  imageName: text("image_name"),
  imageType: text("image_type"),
  imageCaption: text("image_caption"),
}, (table) => [
  uniqueIndex("idx_sop_steps_position").on(table.sopId, table.position),
  index("idx_sop_steps_sop_id").on(table.sopId),
]);
