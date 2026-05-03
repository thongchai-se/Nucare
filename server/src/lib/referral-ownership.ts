import { prisma } from "./prisma";

export type ReferralOwnerSnapshot = {
  actorName: string | null;
  createdAt: Date;
};

export const getAcceptedReferralOwners = async (
  referralIds: string[]
): Promise<Map<string, ReferralOwnerSnapshot>> => {
  if (referralIds.length === 0) {
    return new Map();
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "CaseReferral",
      entityId: {
        in: referralIds,
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

  const ownerByReferralId = new Map<string, ReferralOwnerSnapshot>();

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
