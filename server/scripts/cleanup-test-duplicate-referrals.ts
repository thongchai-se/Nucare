/**
 * ลบ/ปิดข้อมูลส่งต่อที่หลุดจากเทส เพื่อไม่ให้โผล่ในเส้นทางติดตาม
 * รัน: npx tsx scripts/cleanup-test-duplicate-referrals.ts
 */
import "dotenv/config";
import { PrismaClient, ReferralStatus } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_REASON_MARKERS = [
  "ควรโดนบล็อก",
  "ครั้งนี้ต้องโดนบล็อก",
  "เคสทดสอบกันส่งซ้ำ",
  "ทดสอบกันส่งซ้ำ",
  "ทดสอบหมุดติดตามการส่งต่อ",
  "เทสส่งต่อเพื่อสร้างนัด",
  "flow-test",
  "[TEST]",
  "integration-test",
];

async function main() {
  const testWhere = {
    OR: TEST_REASON_MARKERS.map((marker) => ({ reason: { contains: marker } })),
  };

  const deletedTest = await prisma.caseReferral.deleteMany({ where: testWhere });
  console.log(`deleted test-marker referrals: ${deletedTest.count}`);

  // เหลือเคสเปิดได้คนละ 1 ใบ — ใบเก่ากว่าปิดทิ้ง
  const open = await prisma.caseReferral.findMany({
    where: { status: { in: [ReferralStatus.PENDING, ReferralStatus.ACCEPTED] } },
    orderBy: [{ studentId: "asc" }, { createdAt: "desc" }],
    select: { id: true, studentId: true },
  });

  const keep = new Set<string>();
  const closeIds: string[] = [];
  for (const row of open) {
    if (keep.has(row.studentId)) {
      closeIds.push(row.id);
    } else {
      keep.add(row.studentId);
    }
  }

  if (closeIds.length > 0) {
    const closedDupes = await prisma.caseReferral.updateMany({
      where: { id: { in: closeIds } },
      data: { status: ReferralStatus.CLOSED },
    });
    console.log(`closed duplicate open referrals (kept newest): ${closedDupes.count}`);
  } else {
    console.log("no duplicate open referrals");
  }

  // ลบ CLOSED ที่เหลือเป็นซ้ำปลายทางเดียวกันของนิสิตคนเดียว (เก็บใบล่าสุดต่อ target)
  const closed = await prisma.caseReferral.findMany({
    where: { status: ReferralStatus.CLOSED },
    orderBy: [{ studentId: "asc" }, { target: "asc" }, { createdAt: "desc" }],
    select: { id: true, studentId: true, target: true },
  });

  const keepClosed = new Set<string>();
  const deleteClosedIds: string[] = [];
  for (const row of closed) {
    const key = `${row.studentId}:${row.target}`;
    if (keepClosed.has(key)) {
      deleteClosedIds.push(row.id);
    } else {
      keepClosed.add(key);
    }
  }

  if (deleteClosedIds.length > 0) {
    const removed = await prisma.caseReferral.deleteMany({
      where: { id: { in: deleteClosedIds } },
    });
    console.log(`deleted surplus CLOSED referrals (kept newest per target): ${removed.count}`);
  } else {
    console.log("no surplus CLOSED referrals");
  }

  const remaining = await prisma.caseReferral.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log(
    "remaining referrals by status:",
    remaining.map((row) => `${row.status}=${row._count._all}`).join(", ") || "(none)"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
