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
          hint: "รูปบนหน้าโฮมนิสิต — ใส่ลิงก์ได้เพื่อให้กดภาพแล้วไปหน้าที่ต้องการ",
        },
      ]}
      heading="ประชาสัมพันธ์ให้นิสิต"
      description="อัปโหลดภาพและใส่ลิงก์เองได้ นิสิตจะเห็นเฉพาะภาพและกดไปตามลิงก์ที่ตั้งไว้"
    />
  );
}
