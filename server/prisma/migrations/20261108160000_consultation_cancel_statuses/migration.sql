-- AlterEnum: นิสิตขอยกเลิก → อาจารย์ยืนยัน → CANCELLED
ALTER TYPE "ConsultationRequestStatus" ADD VALUE 'CANCEL_REQUESTED';
ALTER TYPE "ConsultationRequestStatus" ADD VALUE 'CANCELLED';
