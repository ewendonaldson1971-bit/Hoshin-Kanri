import { Buffer } from "node:buffer";
import { customType, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const sopCounters = pgTable("sop_counters", {
  department: text("department").primaryKey(),
  prefix: text("prefix").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
});

export const sops = pgTable("sops", {
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

export const sopAssets = pgTable("sop_assets", {
  key: text("key").primaryKey(),
  sopId: text("sop_id").notNull().references(() => sops.id, { onDelete: "cascade" }),
  stepId: text("step_id").notNull(),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull(),
  originalName: text("original_name").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_sop_assets_sop_id").on(table.sopId),
]);

export const sopSteps = pgTable("sop_steps", {
  id: text("id").primaryKey(),
  sopId: text("sop_id").notNull().references(() => sops.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  instruction: text("instruction").notNull(),
  imageKey: text("image_key").references(() => sopAssets.key, { onDelete: "set null" }),
  imageName: text("image_name"),
  imageType: text("image_type"),
  imageCaption: text("image_caption"),
}, (table) => [
  uniqueIndex("idx_sop_steps_position").on(table.sopId, table.position),
  index("idx_sop_steps_sop_id").on(table.sopId),
]);
