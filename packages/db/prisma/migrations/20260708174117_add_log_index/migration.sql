-- DropIndex
DROP INDEX "ApiLog_timestamp_idx";

-- CreateIndex
CREATE INDEX "ApiLog_timestamp_resStatus_idx" ON "ApiLog"("timestamp", "resStatus");
