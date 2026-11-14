/**
 * ค่าสำรองบอร์ดข่าวงานพัฒนานิสิตบนหน้าโฮมนักศึกษา — ใช้หลังโหลด API แล้วเท่านั้น
 * งานพัฒนานิสิต/แอดมินเพิ่ม-ลบรูปและใส่ลิงก์กดได้ที่พอร์ทัล SD (view=publicity) หรือ `/admin/site-media`
 * ถ้ายังไม่มีรายการในฐานข้อมูล จะใช้ค่าด้านล่าง (แสดงพื้นหลังจนกว่าจะอัปโหลดรูป)
 */

export type StudentDevBoardItem = {
  id: string;
  title: string;
  summary: string;
  /** ว่างได้ — จะแสดงพื้นหลังแทนรูป */
  imageSrc: string;
  imageAlt: string;
  /** ลิงก์เมื่อกดภาพ — path ในแอปหรือ http(s) */
  href?: string;
  ctaLabel?: string;
  tag?: string;
};

export type StudentDevBoardConfig = {
  title: string;
  description: string;
  featured: StudentDevBoardItem;
  items: StudentDevBoardItem[];
};

export const studentDevelopmentBoard: StudentDevBoardConfig = {
  title: "จากงานพัฒนานิสิต",
  description: "ภาพประชาสัมพันธ์ที่งานพัฒนานิสิตอัปโหลด — กดตามลิงก์ที่ตั้งไว้",
  featured: {
    id: "featured-wellness",
    title: "พื้นที่ดูแลใจและกิจกรรมคณะ",
    summary: "ติดตามกิจกรรม สวัสดิการ และช่องทางขอคำปรึกษาจากงานพัฒนานิสิตได้ที่นี่",
    imageSrc: "",
    imageAlt: "ภาพประชาสัมพันธ์งานพัฒนานิสิต",
    href: "/student/advisor",
  },
  items: [
    {
      id: "invite-peer-support",
      title: "ชวนคุยกับเพื่อนในระบบ",
      summary: "ถ้าอยากระบายสั้น ๆ ก่อนคุยคนจริง เริ่มจากเพื่อน AI ได้",
      imageSrc: "",
      imageAlt: "ภาพชวนคุยกับเพื่อน",
      href: "/student/chat?persona=peer-male",
    },
    {
      id: "invite-consult",
      title: "ขอรับคำปรึกษาจากอาจารย์",
      summary: "ส่งคำขอเมื่อต้องการคนจริงช่วยคิดหรือนัดคุย",
      imageSrc: "",
      imageAlt: "ภาพขอรับคำปรึกษา",
      href: "/student/advisor",
    },
    {
      id: "invite-feedback",
      title: "ข้อเสนอแนะถึงงานพัฒนานิสิต",
      summary: "มีกิจกรรมหรือสวัสดิการที่อยากเห็น บอกทีมดูแลผ่านช่องทางปรึกษาได้",
      imageSrc: "",
      imageAlt: "ภาพรับข้อเสนอแนะ",
      href: "/student/advisor",
    },
  ],
};
