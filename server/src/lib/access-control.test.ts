import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import {
  canAccessStudent,
  getStudentScopeWhere,
  isAdvisorRole,
  type StudentAccessStore,
} from "./access-control";

const createStore = (overrides: Partial<StudentAccessStore> = {}): StudentAccessStore => ({
  findActiveAdvisorAssignment: async () => false,
  findActiveInstructorAssignment: async () => false,
  listAdvisorStudentIds: async () => [],
  listInstructorStudentIds: async () => [],
  ...overrides,
});

describe("isAdvisorRole", () => {
  it("AC-01 detects advisor in primary or role list", () => {
    assert.equal(isAdvisorRole(Role.ADVISOR), true);
    assert.equal(isAdvisorRole([Role.INSTRUCTOR, Role.ADVISOR]), true);
    assert.equal(isAdvisorRole(Role.EXECUTIVE), false);
  });
});

describe("canAccessStudent", () => {
  it("AC-02 allows ADMIN and MENTAL_HEALTH without assignment lookup", async () => {
    const store = createStore({
      findActiveAdvisorAssignment: async () => {
        throw new Error("should not query assignments for admin/mh");
      },
    });
    assert.equal(await canAccessStudent(Role.ADMIN, "admin-1", "student-1", store), true);
    assert.equal(await canAccessStudent(Role.MENTAL_HEALTH, "mh-1", "student-1", store), true);
  });

  it("AC-03 allows ADVISOR only when an active assignment exists", async () => {
    assert.equal(
      await canAccessStudent(
        Role.ADVISOR,
        "adv-1",
        "student-1",
        createStore({ findActiveAdvisorAssignment: async () => true })
      ),
      true
    );
    assert.equal(
      await canAccessStudent(
        Role.ADVISOR,
        "adv-1",
        "student-2",
        createStore({ findActiveAdvisorAssignment: async () => false })
      ),
      false
    );
  });

  it("AC-04 treats legacy INSTRUCTOR as ADVISOR for student access", async () => {
    assert.equal(
      await canAccessStudent(
        Role.INSTRUCTOR,
        "legacy-ins-1",
        "student-1",
        createStore({ findActiveAdvisorAssignment: async () => true })
      ),
      true
    );
    assert.equal(
      await canAccessStudent(
        Role.INSTRUCTOR,
        "legacy-ins-1",
        "student-2",
        createStore({ findActiveAdvisorAssignment: async () => false })
      ),
      false
    );
  });

  it("AC-05 allows EXECUTIVE all students and denies STUDENT", async () => {
    assert.equal(await canAccessStudent(Role.EXECUTIVE, "exec-1", "student-1", createStore()), true);
    assert.equal(await canAccessStudent(Role.STUDENT, "student-1", "student-2", createStore()), false);
  });

  it("AC-06 honors advisor when listed among multiple assigned roles", async () => {
    assert.equal(
      await canAccessStudent(
        [Role.INSTRUCTOR, Role.ADVISOR],
        "staff-1",
        "student-1",
        createStore({ findActiveAdvisorAssignment: async () => true })
      ),
      true
    );
  });
});

describe("getStudentScopeWhere", () => {
  it("AC-07 scopes advisors to assigned student ids", async () => {
    const where = await getStudentScopeWhere(
      Role.ADVISOR,
      "adv-1",
      createStore({ listAdvisorStudentIds: async () => ["s1", "s2"] })
    );
    assert.deepEqual(where, {
      id: { in: ["s1", "s2"] },
      role: Role.STUDENT,
      isActive: true,
    });
  });

  it("AC-08 returns sentinel id when advisor has no assignments", async () => {
    const where = await getStudentScopeWhere(Role.ADVISOR, "adv-empty", createStore());
    assert.deepEqual(where, {
      id: { in: ["__no_student_scope__"] },
      role: Role.STUDENT,
      isActive: true,
    });
  });

  it("AC-09 mental health sees all active students", async () => {
    const where = await getStudentScopeWhere(Role.MENTAL_HEALTH, "mh-1", createStore());
    assert.deepEqual(where, {
      role: Role.STUDENT,
      isActive: true,
    });
  });

  it("AC-10 executive sees all active students", async () => {
    const where = await getStudentScopeWhere(Role.EXECUTIVE, "exec-1", createStore());
    assert.deepEqual(where, {
      role: Role.STUDENT,
      isActive: true,
    });
  });

  it("AC-11 denies unscoped roles with sentinel filter", async () => {
    const where = await getStudentScopeWhere(Role.STUDENT_DEVELOPMENT, "sd-1", createStore());
    assert.deepEqual(where, { id: "__no_student_scope__" });
  });
});
