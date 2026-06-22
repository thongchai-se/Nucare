"use client";

import { LogOut } from "lucide-react";
import { StaffRoleSwitcher } from "@/components/staff-role-switcher";
import {
  STAFF_SIDEBAR_FOOTER,
  STAFF_SIDEBAR_LOGOUT_BUTTON,
} from "@/lib/ui-classes";

type StaffSidebarFooterProps = {
  onLogout: () => Promise<void> | void;
  onRoleSelect?: () => void;
};

export function StaffSidebarFooter({ onLogout, onRoleSelect }: StaffSidebarFooterProps) {
  return (
    <div className={STAFF_SIDEBAR_FOOTER}>
      <StaffRoleSwitcher className="mb-3" onRoleSelect={onRoleSelect} />
      <button
        type="button"
        onClick={() => {
          void onLogout();
        }}
        className={STAFF_SIDEBAR_LOGOUT_BUTTON}
      >
        <LogOut size={18} /> ออกจากระบบ
      </button>
    </div>
  );
}
