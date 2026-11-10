import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import {
  getAssignedRoles,
  hasAssignedRole,
  splitPrimaryAndAdditionalStaffRoles,
} from "./roles";

describe("hasAssignedRole", () => {
  it("RL-01 matches primary role alone", () => {
    assert.equal(hasAssignedRole(Role.ADMIN, Role.ADMIN), true);
    assert.equal(hasAssignedRole(Role.ADMIN, Role.ADVISOR), false);
  });

  it("RL-02 matches role listed in roles array (JWT-style payload)", () => {
    assert.equal(
      hasAssignedRole({ role: Role.ADVISOR, roles: [Role.ADVISOR, Role.ADMIN] }, Role.ADMIN),
      true
    );
  });

  it("RL-03 rejects missing or empty input", () => {
    assert.equal(hasAssignedRole(undefined, Role.STUDENT), false);
    assert.equal(hasAssignedRole([], Role.STUDENT), false);
  });

  it("RL-04 student role does not inherit staff roles", () => {
    assert.equal(hasAssignedRole(Role.STUDENT, Role.STUDENT), true);
    assert.equal(hasAssignedRole(Role.STUDENT, Role.ADMIN), false);
  });
});

describe("getAssignedRoles", () => {
  it("RL-05 students only return STUDENT", () => {
    assert.deepEqual(
      getAssignedRoles({ role: Role.STUDENT, additionalRoles: [Role.ADMIN] }),
      [Role.STUDENT]
    );
  });

  it("RL-06 staff merge primary and additional roles in priority order", () => {
    assert.deepEqual(
      getAssignedRoles({
        role: Role.ADVISOR,
        additionalRoles: [Role.ADMIN],
      }),
      [Role.ADMIN, Role.ADVISOR]
    );
  });

  it("RL-08 collapses legacy INSTRUCTOR into ADVISOR", () => {
    assert.deepEqual(
      getAssignedRoles({
        role: Role.INSTRUCTOR,
        additionalRoles: [Role.ADMIN],
      }),
      [Role.ADMIN, Role.ADVISOR]
    );
    assert.equal(hasAssignedRole(Role.INSTRUCTOR, Role.ADVISOR), true);
    assert.equal(hasAssignedRole(Role.INSTRUCTOR, Role.INSTRUCTOR), true);
  });
});

describe("splitPrimaryAndAdditionalStaffRoles", () => {
  it("RL-07 picks highest-priority staff role as primary", () => {
    const split = splitPrimaryAndAdditionalStaffRoles([Role.ADVISOR, Role.EXECUTIVE]);
    assert.equal(split.primaryRole, Role.EXECUTIVE);
    assert.deepEqual(split.additionalRoles, [Role.ADVISOR]);
  });
});
