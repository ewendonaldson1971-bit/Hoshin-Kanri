CREATE TABLE "check_ins" (
	"id" serial PRIMARY KEY,
	"cycle_id" integer NOT NULL,
	"author" text NOT NULL,
	"note" text NOT NULL,
	"sentiment" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "initiatives" (
	"id" serial PRIMARY KEY,
	"objective_id" integer NOT NULL,
	"title" text NOT NULL,
	"owner" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text NOT NULL,
	"progress" integer NOT NULL,
	"priority" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" serial PRIMARY KEY,
	"cycle_id" integer NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"owner" text NOT NULL,
	"metric" text NOT NULL,
	"baseline" integer NOT NULL,
	"target" integer NOT NULL,
	"current" integer NOT NULL,
	"unit" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_cycles" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"theme" text NOT NULL,
	"vision" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer NOT NULL,
	"review_date" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_cycle_id_strategy_cycles_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "strategy_cycles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_objective_id_objectives_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_cycle_id_strategy_cycles_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "strategy_cycles"("id") ON DELETE CASCADE;