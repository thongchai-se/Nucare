"use client";

import { ConfirmSubmitLabel } from "@/components/ui/confirm-submit-label";
import { ListPaginationFooter } from "@/components/ui/list-pagination-footer";
import {
  RosterCountBadge,
  RosterMobileCard,
  RosterMobileList,
  RosterPersonCell,
  RosterRow,
  RosterSearchInput,
  RosterTable,
  RosterTableCard,
  RosterTd,
  RosterToolbarEnd,
} from "@/components/ui/roster-table";
import { useListPagination } from "@/hooks/use-list-pagination";
import { stripSeedMarkers } from "@/lib/history-display";
import { UI_ACTION_PRIMARY_COMPACT, UI_ACTION_SECONDARY_COMPACT } from "@/lib/ui-classes";
import type { MentalHealthCase, MentalHealthReferral, RiskClasses } from "./types";

type ReferralsViewProps = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filteredReferrals: MentalHealthReferral[];
  activeCaseByReferralId: Map<string, MentalHealthCase>;
  busyReferralId: string | null;
  formatThaiDateTime: (value: string) => string;
  getRiskClasses: (riskLevel: MentalHealthReferral["student"]["riskLevel"]) => RiskClasses;
  handleUpdateReferral: (referralId: string, status: MentalHealthReferral["status"]) => void | Promise<void>;
  openCareModal: (item: MentalHealthCase) => void;
};

function ReferralActions({
  item,
  activeCaseByReferralId,
  busyReferralId,
  handleUpdateReferral,
  openCareModal,
}: {
  item: MentalHealthReferral;
  activeCaseByReferralId: Map<string, MentalHealthCase>;
  busyReferralId: string | null;
  handleUpdateReferral: (referralId: string, status: MentalHealthReferral["status"]) => void | Promise<void>;
  openCareModal: (item: MentalHealthCase) => void;
}) {
  const busy = busyReferralId === item.id;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {item.status === "PENDING" ? (
        <button
          type="button"
          disabled={Boolean(busyReferralId)}
          onClick={() => handleUpdateReferral(item.id, "ACCEPTED")}
          className={UI_ACTION_PRIMARY_COMPACT}
        >
          <ConfirmSubmitLabel busy={busy}>
            {busy ? "กำลังรับเคส..." : "ยืนยันรับเคส"}
          </ConfirmSubmitLabel>
        </button>
      ) : null}
      {item.status === "ACCEPTED" ? (
        <button
          type="button"
          onClick={() => {
            const target = activeCaseByReferralId.get(item.id);
            if (target) {
              openCareModal(target);
            }
          }}
          className={UI_ACTION_SECONDARY_COMPACT}
        >
          บันทึกผล
        </button>
      ) : null}
      {item.status === "PENDING" ? (
        <button
          type="button"
          disabled={Boolean(busyReferralId)}
          onClick={() => handleUpdateReferral(item.id, "CLOSED")}
          className={UI_ACTION_SECONDARY_COMPACT}
        >
          {busy ? "กำลังดำเนินการ..." : "ปฏิเสธคิว"}
        </button>
      ) : null}
      {item.status === "ACCEPTED" ? (
        <button
          type="button"
          disabled={Boolean(busyReferralId)}
          onClick={() => handleUpdateReferral(item.id, "CLOSED")}
          className={UI_ACTION_SECONDARY_COMPACT}
        >
          {busy ? "กำลังปิดเคส..." : "ปิดเคส"}
        </button>
      ) : null}
    </div>
  );
}

export function ReferralsView({
  searchQuery,
  setSearchQuery,
  filteredReferrals,
  activeCaseByReferralId,
  busyReferralId,
  formatThaiDateTime,
  getRiskClasses,
  handleUpdateReferral,
  openCareModal,
}: ReferralsViewProps) {
  const pagination = useListPagination(filteredReferrals, searchQuery);
  const pageItems = pagination.pageItems;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">รายการส่งต่อ</h2>
        <p className="mt-1 text-sm text-slate-600">
          ดูประวัติเพื่อประเมินได้ที่เมนู “คิวรอรับ” ก่อนกดรับ — นิสิตมีเคสเปิดได้ทีละ 1 รายการ และปิด/บันทึกได้เฉพาะผู้รับเคส
        </p>
      </div>

      <RosterTableCard
        toolbar={
          <>
            <RosterSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="ค้นหา referral, ผู้ส่งต่อ..."
              aria-label="ค้นหารายการส่งต่อ"
            />
            <RosterToolbarEnd>
              <RosterCountBadge count={filteredReferrals.length} />
            </RosterToolbarEnd>
          </>
        }
      >
        <RosterTable
          columns={[
            { key: "student", label: "นักศึกษา", width: "30%" },
            { key: "risk", label: "ความเสี่ยง", width: "14%" },
            { key: "advisor", label: "ผู้ส่งต่อ", width: "18%" },
            { key: "date", label: "วันที่ส่งเรื่อง", width: "16%" },
            { key: "actions", label: "จัดการ", align: "center", width: "22%" },
          ]}
          emptyMessage="ไม่พบรายการส่งต่อที่ตรงกับคำค้นหา"
        >
          {pageItems.map((item) => {
            const risk = getRiskClasses(item.student.riskLevel);
            const statusLabel =
              item.status === "PENDING" ? "รอรับ" : item.status === "ACCEPTED" ? "กำลังดูแล" : "ปิดแล้ว";
            return (
              <RosterRow key={item.id}>
                <RosterTd>
                  <RosterPersonCell
                    name={item.student.name}
                    meta={`${item.student.studentId || "ไม่ระบุรหัส"} · ปี ${item.student.year} · ${statusLabel}`}
                    avatarText={item.student.name}
                  />
                </RosterTd>
                <RosterTd>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${risk.badge}`}>
                    {risk.label}
                  </span>
                </RosterTd>
                <RosterTd className="text-slate-600">
                  <p className="truncate">{item.advisorName}</p>
                  {item.currentOwnerName ? (
                    <p className="mt-1 truncate text-xs text-slate-500">ผู้รับเคส: {item.currentOwnerName}</p>
                  ) : null}
                </RosterTd>
                <RosterTd className="whitespace-nowrap text-slate-500">
                  {formatThaiDateTime(item.createdAt)}
                </RosterTd>
                <RosterTd align="center">
                  <ReferralActions
                    item={item}
                    activeCaseByReferralId={activeCaseByReferralId}
                    busyReferralId={busyReferralId}
                    handleUpdateReferral={handleUpdateReferral}
                    openCareModal={openCareModal}
                  />
                </RosterTd>
              </RosterRow>
            );
          })}
        </RosterTable>

        <RosterMobileList emptyMessage="ไม่พบรายการส่งต่อที่ตรงกับคำค้นหา">
          {pageItems.map((item) => {
            const risk = getRiskClasses(item.student.riskLevel);
            const statusLabel =
              item.status === "PENDING" ? "รอรับ" : item.status === "ACCEPTED" ? "กำลังดูแล" : "ปิดแล้ว";
            return (
              <RosterMobileCard key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <RosterPersonCell
                    name={item.student.name}
                    meta={`${item.student.studentId || "ไม่ระบุรหัส"} · ปี ${item.student.year} · ${statusLabel} · ${item.advisorName}`}
                    avatarText={item.student.name}
                  />
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${risk.badge}`}>
                    {risk.label}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {stripSeedMarkers(item.reason) || item.reason}
                </p>
                {item.currentOwnerName ? (
                  <p className="mt-2 text-xs text-slate-500">ผู้รับเคส: {item.currentOwnerName}</p>
                ) : null}
                <div className="mt-4">
                  <ReferralActions
                    item={item}
                    activeCaseByReferralId={activeCaseByReferralId}
                    busyReferralId={busyReferralId}
                    handleUpdateReferral={handleUpdateReferral}
                    openCareModal={openCareModal}
                  />
                </div>
              </RosterMobileCard>
            );
          })}
        </RosterMobileList>

        {pagination.total > pagination.rowsPerPage ? (
          <ListPaginationFooter
            total={pagination.total}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            currentPage={pagination.currentPage}
            canGoPrev={pagination.canGoPrev}
            canGoNext={pagination.canGoNext}
            onPrev={() => pagination.setCurrentPage((prev) => Math.max(1, prev - 1))}
            onNext={() => pagination.setCurrentPage((prev) => prev + 1)}
          />
        ) : null}
      </RosterTableCard>
    </div>
  );
}
