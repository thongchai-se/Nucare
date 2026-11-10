import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildExecutiveDashboardStats } from "../src/lib/executive-analytics";

const prisma = new PrismaClient();

async function main() {
  const seeded = await prisma.studentAssessment.count({ where: { totalScore: { gte: 9000 } } });
  const stats = await buildExecutiveDashboardStats();
  const overall = stats.overall.trends.map((t) => ({
    month: t.month,
    label: t.label,
    screened: t.screened,
    highRisk: t.highRisk,
    referrals: t.referrals,
    sos: t.sos,
  }));
  console.log(JSON.stringify({ seededAssessments: seeded, overallTrends: overall }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
