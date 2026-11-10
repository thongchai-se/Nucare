import { prisma } from "./prisma";

export type ReferralOwnerSnapshot = {
  actorName: string | null;
  createdAt: Date;
};

/**
 * หาเจ้าของเคสที่รับแล้วจาก acceptedBy เป็นหลัก
 * ถ้ายังไม่มี (ข้อมูลเก่า) ค่อย fallback จาก audit log
 */
export const getAcceptedReferralOwners = async (
  referralIds: string[]
): Promise<Map<string, ReferralOwnerSnapshot>> => {
  if (referralIds.length === 0) {
    return new Map();
  }

  const ownerByReferralId = new Map<string, ReferralOwnerSnapshot>();

  const referrals = await prisma.caseReferral.findMany({
    where: {
      id: { in: referralIds },
      acceptedByUserId: { not: null },
    },
    select: {
      id: true,
      updatedAt: true,
      acceptedBy: {
        select: { name: true },
      },
    },
  });

  for (const referral of referrals) {
    ownerByReferralId.set(referral.id, {
      actorName: referral.acceptedBy?.name ?? null,
      createdAt: referral.updatedAt,
    });
  }

  const missingIds = referralIds.filter((id) => !ownerByReferralId.has(id));
  if (missingIds.length === 0) {
    return ownerByReferralId;
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "CaseReferral",
      entityId: {
        in: missingIds,
      },
      action: "mental-health.referral.update-status",
      description: {
        contains: "ACCEPTED",
      },
    },
    include: {
      actor: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  for (const log of auditLogs) {
    if (!log.entityId || ownerByReferralId.has(log.entityId)) {
      continue;
    }

    ownerByReferralId.set(log.entityId, {
      actorName: log.actor?.name ?? null,
      createdAt: log.createdAt,
    });
  }

  return ownerByReferralId;
};
