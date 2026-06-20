import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { buildExecutiveDashboardStats } from "../lib/executive-analytics";
import { hasAssignedRole } from "../lib/roles";

export const getExecutiveDashboard = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId || !hasAssignedRole(req.user, Role.EXECUTIVE)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = await buildExecutiveDashboardStats();
    res.status(200).json(payload);
  } catch (error) {
    console.error("Get executive dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch executive dashboard" });
  }
};
