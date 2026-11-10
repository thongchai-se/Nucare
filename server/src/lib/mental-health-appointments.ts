/** รวมวันที่กับเวลาเป็น Date ตามเวลาเครื่อง หรือ null ถ้าไม่ถูกต้อง */
export const buildScheduledAt = (date: string, time: string): Date | null => {
  const normalizedDate = date.trim();
  const normalizedTime = time.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return null;
  }
  if (!/^\d{2}:\d{2}$/.test(normalizedTime)) {
    return null;
  }

  const scheduledAt = new Date(`${normalizedDate}T${normalizedTime}:00`);
  return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
};

/** แยก Date เป็นวันที่ YYYY-MM-DD และเวลา HH:mm สำหรับ UI นัดหมาย */
export const splitScheduledAt = (scheduledAt: Date): { date: string; time: string } => {
  const year = scheduledAt.getFullYear();
  const month = String(scheduledAt.getMonth() + 1).padStart(2, "0");
  const day = String(scheduledAt.getDate()).padStart(2, "0");
  const hours = String(scheduledAt.getHours()).padStart(2, "0");
  const minutes = String(scheduledAt.getMinutes()).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
};

/** แปลงแถวนัดหมายในฐานข้อมูลเป็น DTO สำหรับพอร์ทัลสุขภาพจิต */
export const serializeMentalHealthAppointment = (appointment: {
  id: string;
  studentId: string;
  scheduledAt: Date;
  location: string;
  note: string | null;
  status: string;
  referralId: string | null;
  student: { name: string };
  mentalHealthUser: { name: string };
}) => {
  const { date, time } = splitScheduledAt(appointment.scheduledAt);

  return {
    id: appointment.id,
    studentId: appointment.studentId,
    studentName: appointment.student.name,
    date,
    time,
    location: appointment.location,
    note: appointment.note ?? "",
    status: appointment.status,
    referralId: appointment.referralId,
    scheduledAt: appointment.scheduledAt.toISOString(),
    providerName: appointment.mentalHealthUser.name,
  };
};
