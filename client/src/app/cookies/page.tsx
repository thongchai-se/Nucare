import Link from "next/link";
import { Cookie, FileText, ShieldCheck } from "lucide-react";
import LegalTopNav from "@/components/legal-top-nav";
import LegalFooter from "@/components/legal-footer";

export default function CookiesPolicyPage() {
  return (
    <>
      <LegalTopNav active="cookies" />

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
                  className="group flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-800"
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-blue-700" />
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
                  href="/cookies"
                  className="group flex items-start gap-2.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                >
                  <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                  <span>นโยบายคุกกี้</span>
                </Link>
              </nav>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold text-cyan-700">COOKIE POLICY</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">นโยบายคุกกี้</h2>
            </div>

            <div className="space-y-5 text-sm leading-relaxed text-slate-700 sm:text-base">
              <div>
                <h3 className="font-bold text-slate-900">1. ความหมายของคุกกี้</h3>
                <p className="mt-1.5">
                  คุกกี้คือไฟล์ข้อมูลขนาดเล็กที่เว็บไซต์บันทึกไว้ในอุปกรณ์ของผู้ใช้งาน เพื่อช่วยจดจำสถานะการใช้งาน
                  การตั้งค่าที่จำเป็น และข้อมูลด้านความปลอดภัยในการใช้งานระบบ
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">2. ประเภทคุกกี้ที่ใช้งาน</h3>
                <p className="mt-1.5">
                  ระบบ Nucare ใช้คุกกี้ที่จำเป็นต่อการทำงานของแพลตฟอร์มเป็นหลัก เช่น คุกกี้สำหรับการยืนยันตัวตน
                  การรักษา session การป้องกันภัยคุกคาม และการเก็บสถานะการยินยอมคุกกี้ของผู้ใช้งาน
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">3. วัตถุประสงค์ของการใช้คุกกี้</h3>
                <p className="mt-1.5">
                  คุกกี้ถูกใช้เพื่อให้ผู้ใช้งานเข้าถึงบริการได้อย่างต่อเนื่อง ลดความผิดพลาดระหว่างการใช้งาน
                  เพิ่มประสิทธิภาพการทำงานของระบบ และสนับสนุนมาตรการด้านความมั่นคงปลอดภัย
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">4. ระยะเวลาการจัดเก็บคุกกี้</h3>
                <p className="mt-1.5">
                  คุกกี้บางประเภทจะหมดอายุเมื่อผู้ใช้งานปิดเบราว์เซอร์ ขณะที่บางประเภทอาจถูกจัดเก็บเป็นระยะเวลาตามความจำเป็น
                  ของการทำงานระบบและหลักเกณฑ์ที่เกี่ยวข้อง
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">5. การจัดการคุกกี้โดยผู้ใช้งาน</h3>
                <p className="mt-1.5">
                  ผู้ใช้งานสามารถตั้งค่าหรือปิดการใช้งานคุกกี้ผ่านเบราว์เซอร์ของตนได้ อย่างไรก็ตาม การปิดคุกกี้ที่จำเป็น
                  อาจส่งผลให้บางฟังก์ชันของระบบไม่สามารถใช้งานได้เต็มประสิทธิภาพ
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">6. คุกกี้จากบุคคลที่สาม</h3>
                <p className="mt-1.5">
                  โดยหลักระบบจะหลีกเลี่ยงการใช้คุกกี้ที่ไม่จำเป็นจากบุคคลที่สาม หากในอนาคตมีการใช้งานเพิ่มเติม
                  จะมีการแจ้งรายละเอียดให้ผู้ใช้งานทราบผ่านนโยบายฉบับปรับปรุง
                </p>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">7. การปรับปรุงนโยบายคุกกี้</h3>
                <p className="mt-1.5">
                  นโยบายคุกกี้อาจมีการปรับปรุงเพื่อให้สอดคล้องกับกฎหมายและเทคโนโลยีที่เปลี่ยนแปลง
                  โดยจะแสดงฉบับล่าสุดบนหน้าเว็บไซต์อย่างชัดเจน
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
