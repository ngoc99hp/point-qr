-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RankingMetric" AS ENUM ('MEAN', 'TRIMMED_MEAN', 'MEDIAN');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RatingFlag" AS ENUM ('UNKNOWN_STUDENT', 'NAME_MISMATCH', 'DEVICE_MULTI_STUDENT');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "minScore" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "maxScore" DECIMAL(3,1) NOT NULL DEFAULT 10,
    "scoreStep" DECIMAL(2,1) NOT NULL DEFAULT 0.5,
    "trimRatio" DECIMAL(3,2) NOT NULL DEFAULT 0.1,
    "rankingMetric" "RankingMetric" NOT NULL DEFAULT 'TRIMMED_MEAN',
    "studentCodePattern" TEXT NOT NULL DEFAULT '^[A-Z0-9]{5,15}$',
    "strictRoster" BOOLEAN NOT NULL DEFAULT true,
    "rotatingQr" BOOLEAN NOT NULL DEFAULT true,
    "hideRaterNamesOnProjector" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "groupId" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentId" TEXT,
    "score" DECIMAL(3,1) NOT NULL,
    "flags" "RatingFlag"[] DEFAULT ARRAY[]::"RatingFlag"[],
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedBy" TEXT,
    "deviceId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_code_key" ON "Event"("code");

-- CreateIndex
CREATE INDEX "Event_ownerId_idx" ON "Event"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_eventId_name_key" ON "Group"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_eventId_order_key" ON "Group"("eventId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Student_eventId_code_key" ON "Student"("eventId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Round_groupId_key" ON "Round"("groupId");

-- CreateIndex
CREATE INDEX "Round_eventId_status_idx" ON "Round"("eventId", "status");

-- CreateIndex
CREATE INDEX "Rating_roundId_excluded_idx" ON "Rating"("roundId", "excluded");

-- CreateIndex
CREATE INDEX "Rating_roundId_deviceId_idx" ON "Rating"("roundId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_roundId_studentCode_key" ON "Rating"("roundId", "studentCode");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Custom SQL (SPEC §4): Prisma schema cannot express these.
-- BR-01: at most one OPEN round per event.
CREATE UNIQUE INDEX "Round_one_open_per_event"
  ON "Round" ("eventId") WHERE status = 'OPEN';

ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_score_range" CHECK (score >= 0 AND score <= 10);
