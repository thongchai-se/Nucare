import {
  AlertPriority,
  AlertType,
  Prisma,
  Role,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import {
  EPHEMERAL_CHAT_MAX_BODY_LENGTH,
  EPHEMERAL_CHAT_MESSAGE_PAGE_SIZE,
  EPHEMERAL_CHAT_PEER_PAGE_SIZE,
  EPHEMERAL_CHAT_PEER_PAGE_SIZE_MAX,
  EPHEMERAL_CHAT_STAFF_ROLE_LABELS,
  type EphemeralChatStaffRole,
} from "../lib/ephemeral-chat/constants";
import {
  hasOpenStudentDevelopmentCase,
  resolveStaffChatableStudentScope,
} from "../lib/care-chat-access";
import {
  canStudentChatWithStaff,
  getSessionPeerUserId,
  isEligibleChatStaff,
  isEligibleChatStudent,
  isSessionParticipant,
  listEphemeralChatStaffRoles,
} from "../lib/ephemeral-chat/eligibility";
import {
  assertStaffMayOpenChatWithStudent,
  assertStudentMayOpenChatWithStaff,
  buildStudentChatPeerListWhere,
  endEphemeralChatSession,
  findOrCreateEphemeralChatSession,
  loadEligibleAdvisorIdsForStudent,
  loadOwnedCounselingClinicianIdsForStudent,
  markEphemeralChatSessionRead,
  purgeEphemeralChatUnderStoragePressure,
  resolvePeerListPaging,
  type EphemeralChatSessionRecord,
} from "../lib/ephemeral-chat/sessions";
import { countUnreadSessions, isSessionUnreadForViewer } from "../lib/ephemeral-chat/unread";
import { notifyUser } from "../lib/notify-user";
import { prisma } from "../lib/prisma";
import { buildUserHasRoleWhere, hasAssignedRole } from "../lib/roles";
import {
  formatStudentIdForResponse,
  getUserInitials,
  inferStudyYear,
} from "../lib/user-format";

const openSessionSchema = z
  .object({
    peerUserId: z.string().trim().min(1).max(64),
  })
  .strict();

const sessionParamSchema = z.object({
  sessionId: z.string().trim().min(1).max(64),
});

const messagesQuerySchema = z.object({
  after: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(EPHEMERAL_CHAT_MESSAGE_PAGE_SIZE).optional(),
});

const peersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  studyYear: z.coerce.number().int().min(1).max(8).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(EPHEMERAL_CHAT_PEER_PAGE_SIZE_MAX)
    .optional(),
});

const postMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(EPHEMERAL_CHAT_MAX_BODY_LENGTH),
  })
  .strict();

type PeerDto = {
  id: string;
  name: string;
  initials: string;
  studentId: string | null;
  employeeId: string | null;
  image: string | null;
  studyYear: string | null;
  roleLabels: string[];
  kind: "student" | "staff";
};

const mapPeer = (
  user: {
    id: string;
    name: string;
    studentId: string | null;
    employeeId: string | null;
    image: string | null;
    studyYear?: number | null;
    role: Role;
    additionalRoles: Role[];
  },
  kind: "student" | "staff"
): PeerDto => {
  const roleLabels =
    kind === "staff"
      ? listEphemeralChatStaffRoles(user).map(
          (role) => EPHEMERAL_CHAT_STAFF_ROLE_LABELS[role as EphemeralChatStaffRole]
        )
      : ["นิสิต"];

  return {
    id: user.id,
    name: user.name,
    initials: getUserInitials(user.name, kind === "student" ? "นศ" : "บค"),
    studentId: formatStudentIdForResponse(user.studentId),
    employeeId: user.employeeId,
    image: user.image,
    studyYear:
      kind === "student"
        ? (() => {
            const year = inferStudyYear(user.studentId, user.studyYear ?? null);
            return year === "-" ? null : year;
          })()
        : null,
    roleLabels,
    kind,
  };
};

const mapSession = (session: EphemeralChatSessionRecord, viewerUserId: string) => {
  const peer =
    viewerUserId === session.studentId
      ? mapPeer(session.staff, "staff")
      : mapPeer(session.student, "student");

  return {
    id: session.id,
    consultationRequestId: session.consultationRequestId,
    lastMessageAt: session.lastMessageAt,
    createdAt: session.createdAt,
    peer,
  };
};

const mapMessage = (message: {
  id: string;
  sessionId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}) => ({
  id: message.id,
  sessionId: message.sessionId,
  senderId: message.senderId,
  body: message.body,
  createdAt: message.createdAt,
});

const resolveActorKind = (
  user: { role: Role; roles?: Role[] } | undefined
): "student" | "staff" | null => {
  if (!user) {
    return null;
  }
  if (hasAssignedRole(user, Role.STUDENT) && isEligibleChatStudent(user)) {
    return "student";
  }
  if (isEligibleChatStaff(user)) {
    return "staff";
  }
  return null;
};

/** รายชื่อคู่สนทนาที่เปิดแชทได้ — โชว์รายการทันที ตัดหน้าได้ และ ?q= กรองได้ */
export const listEphemeralChatPeers = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const actorKind = resolveActorKind(req.user);
  if (!userId || !actorKind) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const peersQuery = peersQuerySchema.safeParse(req.query);
  if (!peersQuery.success) {
    res.status(400).json({ message: "Invalid query", errors: peersQuery.error.flatten() });
    return;
  }

  try {
    if (actorKind === "student") {
      const [advisorIds, ownedClinicianIds] = await Promise.all([
        loadEligibleAdvisorIdsForStudent(prisma, userId),
        loadOwnedCounselingClinicianIdsForStudent(prisma, userId),
      ]);
      const peerSelect = {
        id: true,
        name: true,
        studentId: true,
        employeeId: true,
        image: true,
        studyYear: true,
        role: true,
        additionalRoles: true,
      } as const;
      const [advisors, mentalHealth, studentDev, hasOpenSdCase] = await Promise.all([
        prisma.user.findMany({
          where: {
            id: { in: advisorIds.size > 0 ? [...advisorIds] : ["__none__"] },
            isActive: true,
            ...buildUserHasRoleWhere(Role.ADVISOR),
          },
          select: peerSelect,
          orderBy: { name: "asc" },
          take: 80,
        }),
        prisma.user.findMany({
          where: {
            id: { in: ownedClinicianIds.size > 0 ? [...ownedClinicianIds] : ["__none__"] },
            isActive: true,
            ...buildUserHasRoleWhere(Role.MENTAL_HEALTH),
          },
          select: peerSelect,
          orderBy: { name: "asc" },
          take: 40,
        }),
        prisma.user.findMany({
          where: {
            isActive: true,
            ...buildUserHasRoleWhere(Role.STUDENT_DEVELOPMENT),
          },
          select: peerSelect,
          orderBy: { name: "asc" },
          take: 40,
        }),
        hasOpenStudentDevelopmentCase(prisma, userId),
      ]);

      const studentBearer = {
        id: userId,
        role: Role.STUDENT as Role,
        roles: req.user?.roles,
        isActive: true,
      };
      const seen = new Set<string>();
      const peers: PeerDto[] = [];
      for (const user of [...advisors, ...mentalHealth, ...studentDev]) {
        if (seen.has(user.id) || !isEligibleChatStaff(user)) {
          continue;
        }
        if (
          !canStudentChatWithStaff({
            student: studentBearer,
            staff: user,
            assignedAdvisorIds: advisorIds,
            ownedClinicianIds,
            hasOpenStudentDevelopmentCase: hasOpenSdCase,
          })
        ) {
          continue;
        }
        seen.add(user.id);
        peers.push(mapPeer(user, "staff"));
      }

      res.json({ peers });
      return;
    }

    const peerSelect = {
      id: true,
      name: true,
      studentId: true,
      employeeId: true,
      image: true,
      studyYear: true,
      role: true,
      additionalRoles: true,
    } as const;

    const staffBearer = {
      id: userId,
      role: req.user!.role,
      roles: req.user?.roles,
      additionalRoles: undefined,
      isActive: true,
    };
    const chatScope = await resolveStaffChatableStudentScope(prisma, staffBearer);
    const paging = resolvePeerListPaging({
      page: peersQuery.data.page,
      pageSize: peersQuery.data.pageSize,
      defaultPageSize: EPHEMERAL_CHAT_PEER_PAGE_SIZE,
      maxPageSize: EPHEMERAL_CHAT_PEER_PAGE_SIZE_MAX,
    });
    const listWhere = buildStudentChatPeerListWhere(
      peersQuery.data.q || "",
      chatScope,
      peersQuery.data.studyYear ?? null
    );

    if (!listWhere) {
      res.json({
        peers: [],
        total: 0,
        page: paging.page,
        pageSize: paging.pageSize,
      });
      return;
    }

    const [total, students] = await Promise.all([
      prisma.user.count({ where: listWhere }),
      prisma.user.findMany({
        where: listWhere,
        select: peerSelect,
        orderBy: { name: "asc" },
        skip: paging.skip,
        take: paging.pageSize,
      }),
    ]);

    res.json({
      peers: students.map((student) => mapPeer(student, "student")),
      total,
      page: paging.page,
      pageSize: paging.pageSize,
    });
  } catch (error) {
    console.error("List ephemeral chat peers error:", error);
    res.status(500).json({ message: "Failed to list chat peers" });
  }
};

/** รายการห้องแชทที่ยัง ACTIVE ของผู้ใช้ */
export const listEphemeralChatSessions = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const actorKind = resolveActorKind(req.user);
  if (!userId || !actorKind) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const sessions = await prisma.ephemeralChatSession.findMany({
      where: actorKind === "student" ? { studentId: userId } : { staffId: userId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            employeeId: true,
            image: true,
            studyYear: true,
            role: true,
            additionalRoles: true,
          },
        },
        staff: {
          select: {
            id: true,
            name: true,
            studentId: true,
            employeeId: true,
            image: true,
            studyYear: true,
            role: true,
            additionalRoles: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, body: true, createdAt: true, senderId: true },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 50,
    });

    const mapped = sessions.map((session) => {
      const last = session.messages[0] ?? null;
      const unread = isSessionUnreadForViewer(userId, {
        studentId: session.studentId,
        staffId: session.staffId,
        lastMessageAt: session.lastMessageAt,
        studentLastReadAt: session.studentLastReadAt,
        staffLastReadAt: session.staffLastReadAt,
        lastSenderId: last?.senderId ?? null,
      });
      return {
        ...mapSession(session, userId),
        unread,
        preview: last
          ? {
              id: last.id,
              body: last.body.slice(0, 140),
              createdAt: last.createdAt,
              senderId: last.senderId,
            }
          : null,
      };
    });

    res.json({
      sessions: mapped,
      unreadCount: mapped.filter((session) => session.unread).length,
    });
  } catch (error) {
    console.error("List ephemeral chat sessions error:", error);
    res.status(500).json({ message: "Failed to list chat sessions" });
  }
};

/** จำนวนห้องที่มีข้อความยังไม่อ่าน — สำหรับ badge เมนู */
export const getEphemeralChatUnreadCount = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const actorKind = resolveActorKind(req.user);
  if (!userId || !actorKind) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const sessions = await prisma.ephemeralChatSession.findMany({
      where: actorKind === "student" ? { studentId: userId } : { staffId: userId },
      select: {
        studentId: true,
        staffId: true,
        lastMessageAt: true,
        studentLastReadAt: true,
        staffLastReadAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { senderId: true },
        },
      },
      take: 100,
    });

    const unreadCount = countUnreadSessions(
      userId,
      sessions.map((session) => ({
        studentId: session.studentId,
        staffId: session.staffId,
        lastMessageAt: session.lastMessageAt,
        studentLastReadAt: session.studentLastReadAt,
        staffLastReadAt: session.staffLastReadAt,
        lastSenderId: session.messages[0]?.senderId ?? null,
      }))
    );

    res.json({ unreadCount });
  } catch (error) {
    console.error("Get ephemeral chat unread count error:", error);
    res.status(500).json({ message: "Failed to get unread count" });
  }
};

/** เปิดหรือคืนห้องแชทกับ peer */
export const openEphemeralChatSession = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const actorKind = resolveActorKind(req.user);
  if (!userId || !req.user || !actorKind) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = openSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  if (parsed.data.peerUserId === userId) {
    res.status(400).json({ message: "ไม่สามารถเปิดแชทกับตัวเองได้" });
    return;
  }

  try {
    let studentId: string;
    let staffId: string;

    if (actorKind === "student") {
      await assertStudentMayOpenChatWithStaff(
        prisma,
        {
          id: userId,
          role: req.user.role,
          additionalRoles: undefined,
          isActive: true,
        },
        parsed.data.peerUserId
      );
      studentId = userId;
      staffId = parsed.data.peerUserId;
    } else {
      await assertStaffMayOpenChatWithStudent(
        prisma,
        {
          id: userId,
          role: req.user.role,
          roles: req.user.roles,
          isActive: true,
        },
        parsed.data.peerUserId
      );
      studentId = parsed.data.peerUserId;
      staffId = userId;
    }

    const session = await findOrCreateEphemeralChatSession(prisma, {
      studentId,
      staffId,
    });

    await markEphemeralChatSessionRead(prisma, {
      sessionId: session.id,
      viewerUserId: userId,
    });

    const recentMessages = await prisma.ephemeralChatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: EPHEMERAL_CHAT_MESSAGE_PAGE_SIZE,
    });

    res.status(201).json({
      session: mapSession(session, userId),
      messages: recentMessages.reverse().map(mapMessage),
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 403 || status === 404) {
      res.status(status).json({
        message: (error as Error).message,
        code: (error as { code?: string }).code,
      });
      return;
    }
    console.error("Open ephemeral chat session error:", error);
    res.status(500).json({ message: "Failed to open chat session" });
  }
};

/** ดึงข้อความในห้อง (รองรับ cursor after=messageId) */
export const listEphemeralChatMessages = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !resolveActorKind(req.user)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const params = sessionParamSchema.safeParse(req.params);
  const query = messagesQuerySchema.safeParse(req.query);
  if (!params.success || !query.success) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }

  try {
    const session = await prisma.ephemeralChatSession.findUnique({
      where: { id: params.data.sessionId },
      select: { id: true, studentId: true, staffId: true },
    });

    if (!session) {
      res.status(404).json({ message: "ไม่พบห้องแชท" });
      return;
    }

    if (!isSessionParticipant(userId, session)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // เปิดเธรด = อ่านแล้ว → เคลียร์ badge
    if (!query.data.after) {
      await markEphemeralChatSessionRead(prisma, {
        sessionId: session.id,
        viewerUserId: userId,
      });
    }

    const limit = query.data.limit ?? EPHEMERAL_CHAT_MESSAGE_PAGE_SIZE;
    let afterFilter: Prisma.EphemeralChatMessageWhereInput | undefined;

    if (query.data.after) {
      const cursor = await prisma.ephemeralChatMessage.findFirst({
        where: { id: query.data.after, sessionId: session.id },
        select: { id: true, createdAt: true },
      });
      if (!cursor) {
        res.status(400).json({ message: "cursor ไม่ถูกต้อง" });
        return;
      }
      afterFilter = {
        OR: [
          { createdAt: { gt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { gt: cursor.id } },
        ],
      };
    }

    const messages = await prisma.ephemeralChatMessage.findMany({
      where: {
        sessionId: session.id,
        ...afterFilter,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
    });

    res.json({ messages: messages.map(mapMessage) });
  } catch (error) {
    console.error("List ephemeral chat messages error:", error);
    res.status(500).json({ message: "Failed to list chat messages" });
  }
};

/** ส่งข้อความในห้องแชทชั่วคราว */
export const postEphemeralChatMessage = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !resolveActorKind(req.user)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const params = sessionParamSchema.safeParse(req.params);
  const body = postMessageSchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: body.success ? undefined : body.error.flatten(),
    });
    return;
  }

  try {
    const session = await prisma.ephemeralChatSession.findUnique({
      where: { id: params.data.sessionId },
      select: {
        id: true,
        studentId: true,
        staffId: true,
        student: { select: { id: true, name: true, email: true } },
        staff: { select: { id: true, name: true, email: true } },
      },
    });

    if (!session) {
      res.status(404).json({ message: "ไม่พบห้องแชท หรือการสนทนาถูกปิดแล้ว" });
      return;
    }

    if (!isSessionParticipant(userId, session)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const peerUserId = getSessionPeerUserId(userId, session);
    if (!peerUserId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.ephemeralChatMessage.create({
        data: {
          sessionId: session.id,
          senderId: userId,
          body: body.data.body,
        },
        select: {
          id: true,
          sessionId: true,
          senderId: true,
          body: true,
          createdAt: true,
        },
      });

      const readPatch =
        userId === session.studentId
          ? { studentLastReadAt: created.createdAt }
          : { staffLastReadAt: created.createdAt };

      await tx.ephemeralChatSession.update({
        where: { id: session.id },
        data: {
          lastMessageAt: created.createdAt,
          ...readPatch,
        },
      });

      return created;
    });

    const peer = peerUserId === session.studentId ? session.student : session.staff;
    const senderName =
      userId === session.studentId ? session.student.name : session.staff.name;

    await notifyUser({
      recipientUserId: peer.id,
      recipientEmail: peer.email,
      channels: { inApp: true, email: false },
      alert: {
        actorUserId: userId,
        studentId: session.studentId,
        type: AlertType.CHAT_MESSAGE,
        priority: AlertPriority.LOW,
        title: "ข้อความใหม่ในแชท",
        message: `${senderName} ส่งข้อความถึงคุณ — เปิดเมนูข้อความเพื่อตอบกลับ`,
        sourceType: "EphemeralChatSession",
        sourceId: session.id,
      },
    });

    // ลดภาระทันทีเมื่อข้อความสะสมเกินเพดาน — ไม่ต้องรอเที่ยงคืน
    void purgeEphemeralChatUnderStoragePressure(prisma).catch((purgeError) => {
      console.error("Ephemeral chat pressure purge failed:", purgeError);
    });

    res.status(201).json({ message: mapMessage(message) });
  } catch (error) {
    console.error("Post ephemeral chat message error:", error);
    res.status(500).json({ message: "Failed to send chat message" });
  }
};

/** จบการสนทนาและลบข้อความทั้งหมด */
export const endEphemeralChatSessionHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !resolveActorKind(req.user)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const params = sessionParamSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ message: "Invalid request" });
    return;
  }

  try {
    const result = await endEphemeralChatSession(prisma, {
      sessionId: params.data.sessionId,
      actorUserId: userId,
    });

    if (!result.deleted) {
      res.status(404).json({ message: "ไม่พบห้องแชท หรือถูกปิดไปแล้ว" });
      return;
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "chat.ephemeral.end",
      entityType: "EphemeralChatSession",
      entityId: params.data.sessionId,
      description: "จบแชทชั่วคราวและลบข้อความ",
      ipAddress: getRequestIpAddress(req),
    });

    res.json({ message: "จบการสนทนาแล้ว ข้อความถูกลบแล้ว", deleted: true });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 403) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    console.error("End ephemeral chat session error:", error);
    res.status(500).json({ message: "Failed to end chat session" });
  }
};
