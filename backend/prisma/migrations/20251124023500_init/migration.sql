-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "unit" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Kpi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "periodicity" TEXT NOT NULL,
    "targetWeekly" INTEGER,
    "targetMonthly" INTEGER,
    "ownerId" INTEGER NOT NULL,
    CONSTRAINT "Kpi_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kpiId" INTEGER NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL,
    "value" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    CONSTRAINT "Progress_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_kpiId_periodType_periodKey_key" ON "Progress"("kpiId", "periodType", "periodKey");
