import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const DEV_SUPERADMIN_PASSWORD = "ChangeMe123!";

async function main() {
  const branch = await prisma.branch.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Филиал 1 (демо)",
      locale: "ru",
    },
  });

  const passwordHash = await argon2.hash(DEV_SUPERADMIN_PASSWORD, { type: argon2.argon2id });
  const superadmin = await prisma.user.upsert({
    where: { email: "superadmin@detsad.local" },
    update: {},
    create: {
      email: "superadmin@detsad.local",
      passwordHash,
      fullName: "Суперадминистратор",
    },
  });

  await prisma.userBranchRole.upsert({
    where: {
      userId_branchId_role: { userId: superadmin.id, branchId: branch.id, role: "SUPERADMIN" },
    },
    update: {},
    create: { userId: superadmin.id, branchId: branch.id, role: "SUPERADMIN" },
  });

  console.log(
    `Seeded superadmin: superadmin@detsad.local / ${DEV_SUPERADMIN_PASSWORD} (dev only — 2FA setup required on first login)`,
  );

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
