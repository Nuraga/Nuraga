-- CreateEnum
CREATE TYPE "TariffType" AS ENUM ('MONTHLY_FULL', 'MONTHLY_HALF_DAY', 'HOURLY', 'PAY_AS_YOU_GO', 'DUTY_GROUP');

-- CreateEnum
CREATE TYPE "RecurrencePeriod" AS ENUM ('MONTHLY', 'ONE_TIME', 'PER_VISIT');

-- CreateEnum
CREATE TYPE "RecalcRule" AS ENUM ('NONE', 'MEALS_ONLY', 'FULL_DAY_WITH_THRESHOLD');

-- CreateEnum
CREATE TYPE "DiscountBasis" AS ENUM ('SECOND_CHILD', 'PREPAYMENT', 'CORPORATE', 'STAFF', 'SOCIAL', 'DIRECTOR_DECISION');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('PERCENT', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'TERMINATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('TARIFF', 'SERVICE', 'FINE', 'RECALC', 'DISCOUNT', 'MANUAL_ADJUSTMENT', 'PREVIOUS_BALANCE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD_ONSITE', 'BANK_TRANSFER', 'ONLINE_GATEWAY');

-- CreateTable
CREATE TABLE "tariff" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "type" "TariffType" NOT NULL,
    "baseAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "recurrence" "RecurrencePeriod" NOT NULL,
    "recalcRule" "RecalcRule" NOT NULL DEFAULT 'NONE',
    "recalcThresholdDays" INTEGER,
    "includesDescription" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "scheduleInfo" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_enrollment" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "childId" TEXT,
    "basis" "DiscountBasis" NOT NULL,
    "kind" "DiscountKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "reason" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "approvedById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "fileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "childId" TEXT,
    "serviceId" TEXT,
    "type" "InvoiceLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "ruleRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "externalRef" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tariff_branchId_idx" ON "tariff"("branchId");

-- CreateIndex
CREATE INDEX "service_branchId_idx" ON "service"("branchId");

-- CreateIndex
CREATE INDEX "service_enrollment_childId_idx" ON "service_enrollment"("childId");

-- CreateIndex
CREATE INDEX "service_enrollment_serviceId_idx" ON "service_enrollment"("serviceId");

-- CreateIndex
CREATE INDEX "discount_familyId_idx" ON "discount"("familyId");

-- CreateIndex
CREATE INDEX "discount_childId_idx" ON "discount"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_number_key" ON "contract"("number");

-- CreateIndex
CREATE INDEX "contract_familyId_idx" ON "contract"("familyId");

-- CreateIndex
CREATE INDEX "contract_childId_idx" ON "contract"("childId");

-- CreateIndex
CREATE INDEX "invoice_branchId_year_month_idx" ON "invoice"("branchId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_familyId_year_month_key" ON "invoice"("familyId", "year", "month");

-- CreateIndex
CREATE INDEX "invoice_line_invoiceId_idx" ON "invoice_line"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_familyId_idx" ON "payment"("familyId");

-- CreateIndex
CREATE INDEX "payment_allocation_paymentId_idx" ON "payment_allocation"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocation_invoiceId_idx" ON "payment_allocation"("invoiceId");

-- AddForeignKey
ALTER TABLE "tariff" ADD CONSTRAINT "tariff_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_enrollment" ADD CONSTRAINT "service_enrollment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_enrollment" ADD CONSTRAINT "service_enrollment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount" ADD CONSTRAINT "discount_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount" ADD CONSTRAINT "discount_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
