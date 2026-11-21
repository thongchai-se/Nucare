import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import {
  canStaffStartChatWithStudent,
  canStudentChatWithStaff,
  getSessionPeerUserId,
  isEligibleChatStaff,
  isEligibleChatStudent,
  isEphemeralChatStaffRole,
  isSessionParticipant,
  listEphemeralChatStaffRoles,
} from "./eligibility";

describe("ephemeral-chat eligibility", () => {
  it("ระบุบทบาทบุคลากรที่แชทได้", () => {
    assert.equal(isEphemeralChatStaffRole(Role.ADVISOR), true);
    assert.equal(isEphemeralChatStaffRole(Role.INSTRUCTOR), true);
    assert.equal(isEphemeralChatStaffRole(Role.MENTAL_HEALTH), true);
    assert.equal(isEphemeralChatStaffRole(Role.STUDENT_DEVELOPMENT), true);
    assert.equal(isEphemeralChatStaffRole(Role.EXECUTIVE), false);
    assert.equal(isEphemeralChatStaffRole(Role.ADMIN), false);
    assert.equal(isEphemeralChatStaffRole(Role.STUDENT), false);
  });

  it("นิสิตและบุคลากรต้อง active และมีบทบาทถูกต้อง", () => {
    assert.equal(isEligibleChatStudent({ role: Role.STUDENT }), true);
    assert.equal(isEligibleChatStudent({ role: Role.STUDENT, isActive: false }), false);
    assert.equal(isEligibleChatStaff({ role: Role.ADVISOR }), true);
    assert.equal(isEligibleChatStaff({ role: Role.EXECUTIVE }), false);
    assert.equal(
      isEligibleChatStaff({
        role: Role.ADMIN,
        additionalRoles: [Role.MENTAL_HEALTH],
      }),
      true
    );
  });

  it("listEphemeralChatStaffRoles คืนเฉพาะบทบาทที่อนุญาต", () => {
    assert.deepEqual(
      listEphemeralChatStaffRoles({
        role: Role.ADVISOR,
        additionalRoles: [Role.MENTAL_HEALTH, Role.EXECUTIVE],
      }),
      [Role.ADVISOR, Role.MENTAL_HEALTH]
    );
  });

  it("นิสิตคุยกับ SD ได้เมื่อมีเคสเปิด และ advisor/MH ตามความสัมพันธ์", () => {
    const student = { role: Role.STUDENT };
    assert.equal(
      canStudentChatWithStaff({
        student,
        staff: { id: "sd-1", role: Role.STUDENT_DEVELOPMENT },
        hasOpenStudentDevelopmentCase: false,
      }),
      false
    );
    assert.equal(
      canStudentChatWithStaff({
        student,
        staff: { id: "sd-1", role: Role.STUDENT_DEVELOPMENT },
        hasOpenStudentDevelopmentCase: true,
      }),
      true
    );
    assert.equal(
      canStudentChatWithStaff({
        student,
        staff: { id: "ex-1", role: Role.EXECUTIVE },
      }),
      false
    );
    assert.equal(
      canStudentChatWithStaff({
        student,
        staff: { id: "mh-1", role: Role.MENTAL_HEALTH },
        ownedClinicianIds: ["mh-1"],
      }),
      true
    );
    assert.equal(
      canStudentChatWithStaff({
        student,
        staff: { id: "mh-2", role: Role.MENTAL_HEALTH },
        ownedClinicianIds: ["mh-1"],
      }),
      false
    );
    assert.equal(
      canStudentChatWithStaff({
        student,
        staff: { id: "adv-1", role: Role.ADVISOR },
        assignedAdvisorIds: ["adv-1", "adv-2"],
      }),
      true
    );
    assert.equal(
      canStudentChatWithStaff({
        student,
        staff: { id: "adv-9", role: Role.ADVISOR },
        assignedAdvisorIds: ["adv-1"],
      }),
      false
    );
  });

  it("บุคลากรทักนิสิตได้ตามความสัมพันธ์ ไม่ใช่ทุกคนเสมอ", () => {
    assert.equal(
      canStaffStartChatWithStudent({
        staff: { role: Role.STUDENT_DEVELOPMENT },
        student: { role: Role.STUDENT },
        hasOpenStudentDevelopmentCase: false,
      }),
      false
    );
    assert.equal(
      canStaffStartChatWithStudent({
        staff: { role: Role.STUDENT_DEVELOPMENT },
        student: { role: Role.STUDENT },
        hasOpenStudentDevelopmentCase: true,
      }),
      true
    );
    assert.equal(
      canStaffStartChatWithStudent({
        staff: { role: Role.EXECUTIVE },
        student: { role: Role.STUDENT },
      }),
      false
    );
    assert.equal(
      canStaffStartChatWithStudent({
        staff: { role: Role.MENTAL_HEALTH },
        student: { role: Role.STUDENT },
        isOwnedCounselingCase: true,
      }),
      true
    );
    assert.equal(
      canStaffStartChatWithStudent({
        staff: { role: Role.MENTAL_HEALTH },
        student: { role: Role.STUDENT },
        isOwnedCounselingCase: false,
      }),
      false
    );
    assert.equal(
      canStaffStartChatWithStudent({
        staff: { role: Role.ADVISOR },
        student: { role: Role.STUDENT },
        isAdvisee: true,
      }),
      true
    );
    assert.equal(
      canStaffStartChatWithStudent({
        staff: { role: Role.ADVISOR },
        student: { role: Role.STUDENT },
        isAdvisee: false,
      }),
      false
    );
    assert.equal(
      canStaffStartChatWithStudent({
        staff: { role: Role.ADVISOR },
        student: { role: Role.STUDENT, isActive: false },
        isAdvisee: true,
      }),
      false
    );
  });

  it("ตรวจ participant และ peer ของห้อง", () => {
    const session = { studentId: "s1", staffId: "t1" };
    assert.equal(isSessionParticipant("s1", session), true);
    assert.equal(isSessionParticipant("t1", session), true);
    assert.equal(isSessionParticipant("x", session), false);
    assert.equal(getSessionPeerUserId("s1", session), "t1");
    assert.equal(getSessionPeerUserId("t1", session), "s1");
    assert.equal(getSessionPeerUserId("x", session), null);
  });
});
