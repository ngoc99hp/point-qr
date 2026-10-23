-- CreateTable
CREATE TABLE "SubmitAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmitAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmitAttempt_eventId_deviceId_kind_createdAt_idx" ON "SubmitAttempt"("eventId", "deviceId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "SubmitAttempt_eventId_createdAt_idx" ON "SubmitAttempt"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "SubmitAttempt" ADD CONSTRAINT "SubmitAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
