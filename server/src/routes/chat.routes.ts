import { Role } from "@prisma/client";
import { Router } from "express";
import {
  endEphemeralChatSessionHandler,
  getEphemeralChatUnreadCount,
  listEphemeralChatMessages,
  listEphemeralChatPeers,
  listEphemeralChatSessions,
  openEphemeralChatSession,
  postEphemeralChatMessage,
} from "../controllers/ephemeral-chat.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { ephemeralChatRateLimit } from "../middleware/rate-limit.middleware";

const router = Router();

router.use(
  authenticateToken,
  authorizeRoles(
    Role.STUDENT,
    Role.ADVISOR,
    Role.INSTRUCTOR,
    Role.MENTAL_HEALTH,
    Role.STUDENT_DEVELOPMENT,
    Role.EXECUTIVE
  )
);

router.get("/peers", listEphemeralChatPeers);
router.get("/sessions", listEphemeralChatSessions);
router.get("/unread-count", getEphemeralChatUnreadCount);
router.post("/sessions", ephemeralChatRateLimit, openEphemeralChatSession);
router.get("/sessions/:sessionId/messages", listEphemeralChatMessages);
router.post(
  "/sessions/:sessionId/messages",
  ephemeralChatRateLimit,
  postEphemeralChatMessage
);
router.post("/sessions/:sessionId/end", ephemeralChatRateLimit, endEphemeralChatSessionHandler);

export default router;
