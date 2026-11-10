"use client";

import { SiteMediaManager } from "@/components/site-media/site-media-manager";

/** จัดการภาพประชาสัมพันธ์ที่แสดงบนหน้านิสิต (คารูเซลกิจกรรม) */
export function PublicityView() {
  return (
    <SiteMediaManager
      apiBasePath="/api/student-development/site-media"
      lockedSlot="STUDENT_ACTIVITY"
      alwaysShowActivityFields
      slots={[
        {
          value: "STUDENT_ACTIVITY",
          label: "กิจกรรมหน้านิสิต",
          hint: "รูปที่แสดงในคารูเซล «จากงานพัฒนานิสิต» บนหน้าโฮมนิสิต",
        },
      ]}
      heading="ประชาสัมพันธ์ให้นิสิต"
      description="เพิ่ม แก้ไข หรือลบรูปกิจกรรมที่นิสิตเห็นบนหน้าหลัก"
    />
  );
}
