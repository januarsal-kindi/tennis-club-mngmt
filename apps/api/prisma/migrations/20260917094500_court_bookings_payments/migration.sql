-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentSubjectType" AS ENUM ('booking', 'enrollment');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'pending_verification', 'paid', 'waived');

-- CreateTable
CREATE TABLE "court_bookings" (
    "id" TEXT NOT NULL,
    "court_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "block_id" TEXT,
    "start" TIMESTAMPTZ(3) NOT NULL,
    "end" TIMESTAMPTZ(3) NOT NULL,
    "created_by_admin_id" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "court_bookings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "court_bookings_end_after_start" CHECK ("end" > "start")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "subject_type" "PaymentSubjectType" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "court_bookings_block_id_key" ON "court_bookings"("block_id");

-- CreateIndex
CREATE INDEX "court_bookings_court_id_idx" ON "court_bookings"("court_id");

-- CreateIndex
CREATE INDEX "court_bookings_user_id_idx" ON "court_bookings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_subject_type_subject_id_key" ON "payments"("subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "court_time_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
