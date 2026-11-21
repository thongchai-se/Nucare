import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import {
  canStaffChatWithStudentResolved,
  canStudentChatWithStaffResolved,
  canViewCareHistory,
  resolveCareHistoryContentLevel,
  resolveStaffChatableStudentScope,
  type CareChatDb,
} from "./care-chat-access";
import type { StudentAccessStore } from "./access-control";

const createStore = (overrides: Partial<StudentAccessStore> = {}): StudentAccessStore => ({
  findActiveAdvisorAssignment: async () => false,
  findActiveInstructorAssignment: async () => false,
  listAdvisorStudentIds: async () => [],
  listInstructorStudentIds: async () => [],
  ...overrides,
});

const createDb = (owned = false): CareChatDb =>
  ({
    caseReferral: {
      findFirst: async () => (owned ? { id: "ref-1" } : null),
      findMany: async () => [],
    },
    studentAdvisorAssignment: {},
    studentInstructorAssignment: {},
  }) as unknown as CareChatDb;

describe("resolveCareHistoryContentLevel", () => {
  it("CCA-01 SD ไม่ได้เนื้อหา, MH ได้ clinical, อื่น operational", () => {
    assert.equal(resolveCareHistoryContentLevel(Role.STUDENT_DEVELOPMENT), "none");
    assert.equal(resolveCareHistoryContentLevel(Role.MENTAL_HEALTH), "clinical");
    assert.equal(resolveCareHistoryContentLevel(Role.ADVISOR), "operational");
    assert.equal(resolveCareHistoryContentLevel(Role.EXECUTIVE), "operational");
  });
});

describe("canViewCareHistory", () => {
  it("CCA-02 EXEC เห็นได้, SD อย่างเดียวไม่เห็น", async () => {
    assert.equal(
      await canViewCareHistory(Role.EXECUTIVE, "e1", "s1", createDb(), createStore()),
      true
    );
    assert.equal(
      await canViewCareHistory(Role.STUDENT_DEVELOPMENT, "sd1", "s1", createDb(), createStore()),
      false
    );
  });

  it("CCA-03 ADVISOR เห็นเฉพาะนิสิตในสังกัด", async () => {
    assert.equal(
      await canViewCareHistory(
        Role.ADVISOR,
        "a1",
        "s1",
        createDb(),
        createStore({ findActiveAdvisorAssignment: async () => true })
      ),
      true
    );
    assert.equal(
      await canViewCareHistory(
        Role.ADVISOR,
        "a1",
        "s2",
        createDb(),
        createStore({ findActiveAdvisorAssignment: async () => false })
      ),
      false
    );
  });

  it("CCA-04 MH เห็นเฉพาะเคสที่รับแล้ว", async () => {
    assert.equal(
      await canViewCareHistory(Role.MENTAL_HEALTH, "mh1", "s1", createDb(true), createStore()),
      true
    );
    assert.equal(
      await canViewCareHistory(Role.MENTAL_HEALTH, "mh1", "s1", createDb(false), createStore()),
      false
    );
  });
});

describe("canStaffChatWithStudentResolved / canStudentChatWithStaffResolved", () => {
  it("CCA-05 staff: EXEC ห้าม, SD ต้องมีเคสเปิด, advisor/MH ตามความสัมพันธ์", () => {
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.EXECUTIVE],
        isAdvisee: false,
        isOwnedCounselingCase: false,
      }),
      false
    );
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.STUDENT_DEVELOPMENT],
        isAdvisee: false,
        isOwnedCounselingCase: false,
        hasOpenStudentDevelopmentCase: false,
      }),
      false
    );
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.STUDENT_DEVELOPMENT],
        isAdvisee: false,
        isOwnedCounselingCase: false,
        hasOpenStudentDevelopmentCase: true,
      }),
      true
    );
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.ADVISOR],
        isAdvisee: true,
        isOwnedCounselingCase: false,
      }),
      true
    );
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.ADVISOR],
        isAdvisee: false,
        isOwnedCounselingCase: false,
      }),
      false
    );
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.MENTAL_HEALTH],
        isAdvisee: false,
        isOwnedCounselingCase: true,
      }),
      true
    );
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.MENTAL_HEALTH],
        isAdvisee: false,
        isOwnedCounselingCase: false,
      }),
      false
    );
  });

  it("CCA-06 นิสิตคุย MH ได้เฉพาะ clinician ที่รับเคส — SD ต้องมีเคสเปิด", () => {
    assert.equal(
      canStudentChatWithStaffResolved({
        staffRoles: [Role.MENTAL_HEALTH],
        staffId: "mh-1",
        assignedAdvisorIds: [],
        ownedClinicianIds: ["mh-1"],
      }),
      true
    );
    assert.equal(
      canStudentChatWithStaffResolved({
        staffRoles: [Role.MENTAL_HEALTH],
        staffId: "mh-2",
        assignedAdvisorIds: [],
        ownedClinicianIds: ["mh-1"],
      }),
      false
    );
    assert.equal(
      canStudentChatWithStaffResolved({
        staffRoles: [Role.ADVISOR, Role.MENTAL_HEALTH],
        staffId: "multi-1",
        assignedAdvisorIds: [],
        ownedClinicianIds: [],
      }),
      false
    );
    assert.equal(
      canStudentChatWithStaffResolved({
        staffRoles: [Role.STUDENT_DEVELOPMENT],
        staffId: "sd-1",
        assignedAdvisorIds: [],
        ownedClinicianIds: [],
        hasOpenStudentDevelopmentCase: false,
      }),
      false
    );
    assert.equal(
      canStudentChatWithStaffResolved({
        staffRoles: [Role.STUDENT_DEVELOPMENT],
        staffId: "sd-1",
        assignedAdvisorIds: [],
        ownedClinicianIds: [],
        hasOpenStudentDevelopmentCase: true,
      }),
      true
    );
  });

  it("CCA-07 ที่ปรึกษาอย่างเดียวไม่คุยได้จากสังกัดผู้สอน", () => {
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.ADVISOR],
        isAdvisee: false,
        isOwnedCounselingCase: false,
        isInstructorStudent: true,
      }),
      false
    );
    assert.equal(
      canStaffChatWithStudentResolved({
        staffRoles: [Role.INSTRUCTOR],
        isAdvisee: false,
        isOwnedCounselingCase: false,
        isInstructorStudent: true,
      }),
      false
    );
  });
});

describe("resolveStaffChatableStudentScope", () => {
  it("CCA-08 ผู้บริหารไม่ได้รายการ และกองพัฒได้เฉพาะเคสสวัสดิการเปิด", async () => {
    const db = createDb();
    assert.deepEqual(
      await resolveStaffChatableStudentScope(db, { id: "e1", role: Role.EXECUTIVE }, createStore()),
      { mode: "ids", studentIds: [] }
    );

    const sdDb = {
      caseReferral: {
        findFirst: async () => null,
        findMany: async () => [{ studentId: "welfare-1" }],
      },
      studentAdvisorAssignment: {},
      studentInstructorAssignment: {},
    } as unknown as CareChatDb;

    const sdScope = await resolveStaffChatableStudentScope(
      sdDb,
      { id: "sd1", role: Role.STUDENT_DEVELOPMENT },
      createStore()
    );
    assert.equal(sdScope.mode, "ids");
    if (sdScope.mode === "ids") {
      assert.deepEqual(sdScope.studentIds, ["welfare-1"]);
    }
  });

  it("CCA-09 ที่ปรึกษาได้เฉพาะนิสิตในสังกัด", async () => {
    const scope = await resolveStaffChatableStudentScope(
      createDb(),
      { id: "a1", role: Role.ADVISOR },
      createStore({ listAdvisorStudentIds: async () => ["s1", "s2"] })
    );
    assert.equal(scope.mode, "ids");
    if (scope.mode === "ids") {
      assert.deepEqual([...scope.studentIds].sort(), ["s1", "s2"]);
    }
  });

  it("CCA-10 ผู้เชี่ยวชาญได้เฉพาะเคสที่รับแล้ว", async () => {
    const db = {
      caseReferral: {
        findFirst: async () => null,
        findMany: async () => [{ studentId: "owned-1" }, { studentId: "owned-2" }],
      },
      studentAdvisorAssignment: {},
      studentInstructorAssignment: {},
    } as unknown as CareChatDb;

    const scope = await resolveStaffChatableStudentScope(
      db,
      { id: "mh1", role: Role.MENTAL_HEALTH },
      createStore({ listAdvisorStudentIds: async () => ["advisee-should-not-appear"] })
    );
    assert.equal(scope.mode, "ids");
    if (scope.mode === "ids") {
      assert.deepEqual([...scope.studentIds].sort(), ["owned-1", "owned-2"]);
    }
  });

  it("CCA-11 ที่ปรึกษา+ผู้เชี่ยวชาญรวมเฉพาะสังกัดกับเคสที่รับ (ไม่ใช่ทุกคน)", async () => {
    const db = {
      caseReferral: {
        findFirst: async () => null,
        findMany: async () => [{ studentId: "case-1" }],
      },
      studentAdvisorAssignment: {},
      studentInstructorAssignment: {},
    } as unknown as CareChatDb;

    const scope = await resolveStaffChatableStudentScope(
      db,
      {
        id: "multi-1",
        role: Role.ADVISOR,
        additionalRoles: [Role.MENTAL_HEALTH],
      },
      createStore({ listAdvisorStudentIds: async () => ["advisee-1"] })
    );
    assert.equal(scope.mode, "ids");
    if (scope.mode === "ids") {
      assert.deepEqual([...scope.studentIds].sort(), ["advisee-1", "case-1"]);
    }
  });
});
