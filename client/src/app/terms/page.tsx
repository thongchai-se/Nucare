import Link from "next/link";
import { Cookie, FileText, ShieldCheck } from "lucide-react";
import LegalTopNav from "@/components/legal-top-nav";
import LegalFooter from "@/components/legal-footer";

export default function TermsPage() {
  return (
    <>
      <LegalTopNav active="terms" />

      <main className="min-h-screen bg-slate-50 pb-10 pt-28 sm:pb-14 sm:pt-32">
      <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Nucare Legal</p>
          <h1 className="mt-1 text-2xl font-bold text-blue-900 sm:text-3xl">ข้อกำหนดและนโยบาย</h1>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_1fr] lg:gap-8">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">เมนูเอกสาร</p>
              <nav className="mt-3 space-y-1.5">
                <Link
                  href="/terms"
                  className="group flex items-start gap-2.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                  <span>ข้อกำหนดและเงื่อนไขการใช้งาน</span>
                </Link>
                <Link
                  href="/privacy"
                  className="group flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-800"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-blue-700" />
                  <span>นโยบายความเป็นส่วนตัว</span>
                </Link>
                <Link
                  href="/privacy#cookies"
                  className="group flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-800"
                >
                  <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-blue-700" />
                  <span>นโยบายคุกกี้</span>
                </Link>
              </nav>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold text-cyan-700">TERMS OF USE</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">ข้อกำหนดและเงื่อนไขการใช้งาน</h2>
            </div>

            <div className="space-y-5 text-sm leading-relaxed text-slate-700 sm:text-base">
              <div>
                <h3 className="font-bold text-slate-900">1. การยอมรับข้อกำหนด</h3>
                <p className="mt-1.5">
                  การเข้าใช้งานระบบ Nucare ถือว่าผู้ใช้งานรับทราบและยอมรับข้อกำหนดและเงื่อนไขทั้งหมดในเอกสารนี้
                  หากไม่ยอมรับเงื่อนไขใด ผู้ใช้งานควรยุติการใช้งานระบบทันที
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">2. คุณสมบัติและความรับผิดชอบของผู้ใช้งาน</h3>
                <p className="mt-1.5">
                  ผู้ใช้งานต้องให้ข้อมูลที่ถูกต้อง ครบถ้วน และเป็นปัจจุบัน รวมถึงรับผิดชอบการกระทำทั้งหมดที่เกิดขึ้นภายใต้บัญชีของตน
                  และต้องไม่กระทำการใดที่ขัดต่อกฎหมาย ความสงบเรียบร้อย หรือสิทธิของบุคคลอื่น
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">3. การรักษาความปลอดภัยบัญชี</h3>
                <p className="mt-1.5">
                  ผู้ใช้งานต้องเก็บรักษาชื่อผู้ใช้และรหัสผ่านเป็นความลับ ไม่เปิดเผยแก่บุคคลอื่น และต้องแจ้งผู้ดูแลระบบโดยเร็ว
                  เมื่อสงสัยว่าบัญชีถูกเข้าถึงโดยไม่ได้รับอนุญาต
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">4. การใช้งานที่ต้องห้าม</h3>
                <p className="mt-1.5">
                  ห้ามใช้งานระบบเพื่อเผยแพร่ข้อมูลเท็จ เนื้อหาที่ผิดกฎหมาย การคุกคามบุคคลอื่น การพยายามเจาะระบบ
                  หรือการกระทำที่ส่งผลเสียต่อความมั่นคงปลอดภัยและความพร้อมใช้งานของบริการ
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">5. สิทธิในทรัพย์สินทางปัญญา</h3>
                <p className="mt-1.5">
                  เนื้อหา ชุดข้อมูล เครื่องหมาย และส่วนประกอบของระบบเป็นทรัพย์สินของหน่วยงานหรือผู้ได้รับอนุญาต
                  ห้ามคัดลอก ดัดแปลง เผยแพร่ หรือใช้งานเกินขอบเขตที่ได้รับอนุญาตโดยชัดแจ้ง
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">6. การระงับหรือยกเลิกการใช้งาน</h3>
                <p className="mt-1.5">
                  ผู้ดูแลระบบสงวนสิทธิในการจำกัด ระงับ หรือยกเลิกสิทธิการใช้งานของผู้ใช้งานที่ฝ่าฝืนข้อกำหนด
                  หรือมีพฤติการณ์ที่อาจก่อให้เกิดความเสียหายต่อระบบหรือผู้ใช้งานรายอื่น
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">7. ข้อจำกัดความรับผิด</h3>
                <p className="mt-1.5">
                  ระบบให้บริการตามสภาพที่เป็นอยู่ แม้จะมีมาตรการเพื่อความต่อเนื่องของบริการ แต่อาจเกิดเหตุสุดวิสัย
                  เหตุขัดข้องทางเทคนิค หรือปัจจัยภายนอกที่ทำให้บริการไม่สมบูรณ์ได้ในบางช่วงเวลา
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">8. กฎหมายที่ใช้บังคับและเขตอำนาจศาล</h3>
                <p className="mt-1.5">
                  ข้อกำหนดนี้อยู่ภายใต้บังคับแห่งกฎหมายไทย และหากเกิดข้อพิพาทให้ดำเนินการตามกระบวนการทางกฎหมาย
                  ต่อศาลหรือหน่วยงานที่มีอำนาจตามกฎหมาย
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">9. การแก้ไขข้อกำหนด</h3>
                <p className="mt-1.5">
                  ผู้ดูแลระบบอาจปรับปรุงข้อกำหนดฉบับนี้ตามความจำเป็น โดยประกาศเวอร์ชันล่าสุดบนเว็บไซต์
                  และการใช้งานต่อเนื่องภายหลังประกาศถือเป็นการยอมรับข้อกำหนดฉบับปรับปรุง
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
      </main>
      <LegalFooter />
    </>
  );
}
