-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "rankingMetric" SET DEFAULT 'MEAN',
ALTER COLUMN "studentCodePattern" SET DEFAULT '^[0-9]{5,15}$';
