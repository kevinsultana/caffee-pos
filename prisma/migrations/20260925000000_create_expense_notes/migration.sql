-- CreateTable
CREATE TABLE "ExpenseNote" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "pcs" INTEGER NOT NULL DEFAULT 1,
    "total" DECIMAL(18,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseNote_date_idx" ON "ExpenseNote"("date");
