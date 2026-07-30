import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.groupType.createMany({
    data: [
      { name: "Ясли", minAgeMonths: 12, maxAgeMonths: 24 },
      { name: "Младшая", minAgeMonths: 24, maxAgeMonths: 36 },
      { name: "Средняя", minAgeMonths: 36, maxAgeMonths: 48 },
      { name: "Старшая", minAgeMonths: 48, maxAgeMonths: 60 },
      { name: "Подготовительная", minAgeMonths: 60, maxAgeMonths: 84 },
      { name: "Дежурная", minAgeMonths: 12, maxAgeMonths: 84 },
    ],
    skipDuplicates: true,
  });

  await prisma.dischargeReason.createMany({
    data: [
      { name: "Выпуск" },
      { name: "Переезд семьи" },
      { name: "Смена детского сада" },
      { name: "Финансовые причины" },
      { name: "Иное" },
    ],
    skipDuplicates: true,
  });

  await prisma.documentType.createMany({
    data: [
      { name: "Свидетельство о рождении", hasExpiry: false },
      { name: "Медицинская справка", hasExpiry: true },
      { name: "Справка о прививках", hasExpiry: true },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
