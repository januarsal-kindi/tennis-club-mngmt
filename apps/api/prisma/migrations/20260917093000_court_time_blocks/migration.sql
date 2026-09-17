-- CreateEnum
CREATE TYPE "TimeBlockKind" AS ENUM ('booking', 'session');

-- GiST exclusion needs btree_gist so court_id equality can combine with range overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "court_time_blocks" (
    "id" TEXT NOT NULL,
    "court_id" TEXT NOT NULL,
    "start" TIMESTAMPTZ(3) NOT NULL,
    "end" TIMESTAMPTZ(3) NOT NULL,
    "kind" "TimeBlockKind" NOT NULL,
    "ref_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "during" tstzrange GENERATED ALWAYS AS (tstzrange("start", "end", '[)')) STORED,

    CONSTRAINT "court_time_blocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "court_time_blocks_end_after_start" CHECK ("end" > "start")
);

-- CreateIndex
CREATE INDEX "court_time_blocks_court_id_idx" ON "court_time_blocks"("court_id");

-- Half-open [start, end): touching ranges do not overlap (A12).
ALTER TABLE "court_time_blocks" ADD CONSTRAINT "court_time_blocks_no_overlap"
  EXCLUDE USING gist ("court_id" WITH =, "during" WITH &&);

-- AddForeignKey
ALTER TABLE "court_time_blocks" ADD CONSTRAINT "court_time_blocks_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
