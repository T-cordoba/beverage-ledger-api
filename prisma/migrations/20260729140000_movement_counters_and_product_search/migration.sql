-- Not declared in schema.prisma: `CREATE EXTENSION` needs the postgresqlExtensions
-- preview feature, and pinning a schema (Supabase keeps extensions in
-- "extensions") would break the local docker Postgres, which has no such schema.
-- Unqualified it lands on the search_path in both.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "movement_counters" (
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "next_sequence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "movement_counters_pkey" PRIMARY KEY ("organization_id","year")
);

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products" USING GIN ("name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "movement_counters" ADD CONSTRAINT "movement_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
