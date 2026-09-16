-- CreateTable
CREATE TABLE "courts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_weekly_hours" (
    "id" TEXT NOT NULL,
    "court_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_local" TEXT NOT NULL,
    "end_local" TEXT NOT NULL,

    CONSTRAINT "court_weekly_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_blackouts" (
    "id" TEXT NOT NULL,
    "court_id" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "court_blackouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "court_weekly_hours_court_id_weekday_key" ON "court_weekly_hours"("court_id", "weekday");

-- CreateIndex
CREATE INDEX "court_blackouts_court_id_idx" ON "court_blackouts"("court_id");

-- AddForeignKey
ALTER TABLE "court_weekly_hours" ADD CONSTRAINT "court_weekly_hours_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_blackouts" ADD CONSTRAINT "court_blackouts_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
