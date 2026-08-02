-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'AFTERNOON_SNACK');

-- CreateTable
CREATE TABLE "allergen" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_allergen" (
    "childId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "child_allergen_pkey" PRIMARY KEY ("childId","allergenId")
);

-- CreateTable
CREATE TABLE "dish" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_allergen" (
    "dishId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "dish_allergen_pkey" PRIMARY KEY ("dishId","allergenId")
);

-- CreateTable
CREATE TABLE "menu_item" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "dishId" TEXT NOT NULL,

    CONSTRAINT "menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allergen_name_key" ON "allergen"("name");

-- CreateIndex
CREATE INDEX "menu_item_branchId_date_idx" ON "menu_item"("branchId", "date");

-- AddForeignKey
ALTER TABLE "child_allergen" ADD CONSTRAINT "child_allergen_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_allergen" ADD CONSTRAINT "child_allergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_allergen" ADD CONSTRAINT "dish_allergen_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_allergen" ADD CONSTRAINT "dish_allergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
