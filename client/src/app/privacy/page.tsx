"use client";

import {
  ArrowRight,
  BrainCircuit,
  Calendar,
  Cookie,
  FileText,
  HelpCircle,
  Menu,
  Shield,
  ShieldCheck,
  type LucideIcon,
  UserCheck,
  X,
} from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import LegalTopNav from "@/components/legal-top-nav";
import LegalFooter from "@/components/legal-footer";
import { facultyFullName } from "@/lib/brand";

type SectionId = "terms" | "privacy" | "cookies";

type SectionNavigationItem = {
  id: SectionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

const SECTION_IDS: SectionId[] = ["terms", "privacy", "cookies"];

const SECTION_NAVIGATION_ITEMS: SectionNavigationItem[] = [
  {
    id: "terms",
    label: "เงื่อนไขการใช้งาน",
    description: "ขอบเขตการใช้งาน สิทธิ หน้าที่ และข้อห้ามของผู้ใช้งานระบบ",
    icon: FileText,
  },
  {
    id: "privacy",
    label: "นโยบายความเป็นส่วนตัว",
    description: "การเก็บ ใช้ เปิดเผย และคุ้มครองข้อมูลส่วนบุคคลของผู้ใช้งาน",
    icon: ShieldCheck,
  },
  {
    id: "cookies",
    label: "นโยบายการใช้คุกกี้",
    description: "รายละเอียดคุกกี้ที่จำเป็น การตั้งค่า และการเก็บข้อมูลเชิงเทคนิค",
    icon: Cookie,
  },
];

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("terms");
  const [isMobileTopicsOpen, setIsMobileTopicsOpen] = useState(false);

  const activeNavigationItem = useMemo(
    () => SECTION_NAVIGATION_ITEMS.find((item) => item.id === activeSection) ?? SECTION_NAVIGATION_ITEMS[0],
    [activeSection],
  );

  const scrollToSection = (sectionId: SectionId) => {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    const yOffset = 112;
    const targetY = window.scrollY + target.getBoundingClientRect().top - yOffset;

    setActiveSection(sectionId);
    setIsMobileTopicsOpen(false);
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  const handleSidebarNavigate = (
    event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    sectionId: SectionId,
  ) => {
    event.preventDefault();
    scrollToSection(sectionId);
  };

  useEffect(() => {
    const currentHash = window.location.hash.replace("#", "");
    if (SECTION_IDS.includes(currentHash as SectionId)) {
      setActiveSection(currentHash as SectionId);
    }

    const onScroll = () => {
      let current: SectionId = SECTION_IDS[0];
      let nearestDistance = Number.POSITIVE_INFINITY;
      const viewportAnchor = 128;

      for (const id of SECTION_IDS) {
        const element = document.getElementById(id);
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        const distanceToAnchor = Math.abs(rect.top - viewportAnchor);

        if (rect.top - viewportAnchor <= 0) {
          current = id;
        }

        if (distanceToAnchor < nearestDistance) {
          nearestDistance = distanceToAnchor;
          current = id;
        }
      }

      setActiveSection(current);
    };

    window.addEventListener("scroll", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (isMobileTopicsOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileTopicsOpen]);

  return (
    <>
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_15%_20%,rgba(186,230,253,0.55),transparent_36%),radial-gradient(circle_at_82%_8%,rgba(125,211,252,0.45),transparent_32%),linear-gradient(135deg,#f8fafc_0%,#f0f9ff_40%,#eef2ff_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.35)_40%,transparent_80%)]" />
      <LegalTopNav active="privacy" />

      {isMobileTopicsOpen ? (
        <div className="fixed inset-0 z-[80] bg-slate-950/45 lg:hidden" onClick={() => setIsMobileTopicsOpen(false)}>
          <div
            className="flex h-full w-[88vw] max-w-sm flex-col bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
              <div>
                <p className="text-sm font-bold text-slate-900">หัวข้อเอกสาร</p>
                <p className="text-[11px] text-slate-500">เลือกส่วนที่ต้องการอ่านอย่างรวดเร็ว</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileTopicsOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
                aria-label="close topics drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              <div>
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">เอกสารสำคัญ</p>
                <div className="space-y-1.5">
                  {SECTION_NAVIGATION_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(event) => handleSidebarNavigate(event, item.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                          isActive
                            ? "border-blue-100 bg-blue-50 text-blue-800"
                            : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold">{item.label}</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <HelpCircle className="mb-3 h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-blue-900">ต้องการความช่วยเหลือเพิ่มเติม?</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  หากมีคำถามเกี่ยวกับการคุ้มครองข้อมูลหรือการใช้งานระบบ สามารถติดต่อฝ่ายดูแลระบบได้โดยตรง
                </p>
                <a
                  href="mailto:wellbeing.pdpa@nursing.edu"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline"
                >
                  ติดต่อฝ่ายดูแลระบบ <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <main className="min-h-screen pb-12 pt-28 sm:pt-32">
        <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
            <aside className="hidden w-full shrink-0 lg:block lg:w-1/4">
              <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:mb-0 lg:rounded-none lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
                <h3 className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">หมวดหมู่นโยบาย</h3>
                <nav className="flex flex-col space-y-2">
                  {SECTION_NAVIGATION_ITEMS.map((item) => {
                    const Icon = item.icon;

                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={(event) => handleSidebarNavigate(event, item.id)}
                        className={`flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] transition-colors ${
                          activeSection === item.id
                            ? "bg-blue-50 font-bold text-blue-700"
                            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </a>
                    );
                  })}
                </nav>

                <div className="mt-8 px-3">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                    <HelpCircle className="mb-3 h-6 w-6 text-blue-600" />
                    <h4 className="mb-2 text-[15px] font-bold text-blue-900">มีข้อสงสัยเพิ่มเติม?</h4>
                    <p className="mb-4 text-sm leading-relaxed text-slate-600">
                      หากมีคำถามเกี่ยวกับการใช้งานระบบ การคุ้มครองข้อมูลส่วนบุคคล หรือการจัดการคุกกี้
                    </p>
                    <a
                      href="mailto:wellbeing.pdpa@nursing.edu"
                      className="flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline"
                    >
                      ติดต่อฝ่ายดูแลระบบ <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </aside>

            <div className="w-full rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-md sm:p-10 lg:w-3/4 lg:p-12">
              <div className="mb-10 border-b border-slate-100 pb-8">
                <h1 className="mb-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">ศูนย์ข้อมูลและนโยบาย</h1>
                <p className="mb-4 text-lg text-slate-600">ระบบจัดการและดูแลสุขภาวะนักศึกษา (Wellbeing System)</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> อัปเดตล่าสุด: 30 เมษายน 2026
                  </span>
                </div>
              </div>

              <div className="mb-6 lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileTopicsOpen(true)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">หัวข้อที่กำลังอ่าน</p>
                    <p className="mt-1 truncate text-base font-bold text-slate-900">{activeNavigationItem.label}</p>
                  </div>
                  <Menu className="h-5 w-5 shrink-0 text-slate-500" />
                </button>
              </div>

              <div className="space-y-16">
                <section id="terms" className="scroll-mt-28">
                  <div className="mb-6 flex items-center gap-3 border-b-2 border-blue-100 pb-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">เงื่อนไขการใช้งานระบบ (Terms of Service)</h2>
                  </div>

                  <div className="space-y-5 text-[15px] leading-relaxed text-slate-600">
                    <p>
                      การเข้าใช้งานระบบ Nucare และบริการที่เกี่ยวข้อง ถือว่าผู้ใช้งานรับทราบ เข้าใจ และยอมรับเงื่อนไขการใช้งานฉบับนี้
                      รวมถึงนโยบายความเป็นส่วนตัวและนโยบายคุกกี้ที่ประกาศไว้ในหน้าเดียวกัน หากผู้ใช้งานไม่ยอมรับเงื่อนไขส่วนใด
                      ผู้ใช้งานควรยุติการใช้งานระบบทันที
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-900">วัตถุประสงค์ของระบบ</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          ระบบนี้มีขึ้นเพื่อสนับสนุนการคัดกรอง การติดตาม การประสานงาน และการดูแลสุขภาวะของนักศึกษาในบริบททางการศึกษา
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-900">ขอบเขตผู้ใช้งาน</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          ครอบคลุมนักศึกษา อาจารย์ที่ปรึกษา อาจารย์ผู้สอน ผู้เชี่ยวชาญ ผู้บริหาร และผู้ดูแลระบบตามสิทธิที่ได้รับ
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">1. การยืนยันตัวตนและสิทธิการเข้าใช้งาน</h4>
                      <p>
                        ผู้ใช้งานต้องเข้าใช้งานด้วยบัญชีที่ได้รับอนุญาตจากหน่วยงานเท่านั้น ห้ามใช้บัญชีของผู้อื่น
                        หรือพยายามหลีกเลี่ยงกลไกด้านความปลอดภัยของระบบ การเข้าถึงข้อมูลแต่ละส่วนจะถูกจำกัดตามบทบาท
                        และหน้าที่ที่ได้รับมอบหมาย
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">2. ความถูกต้องและความรับผิดชอบต่อข้อมูล</h4>
                      <p>
                        ผู้ใช้งานต้องกรอกข้อมูลที่ถูกต้อง ครบถ้วน และเป็นปัจจุบัน โดยเฉพาะข้อมูลที่เกี่ยวข้องกับการประเมินสุขภาวะ
                        การติดต่อฉุกเฉิน และการประสานงานเชิงวิชาชีพ ข้อมูลที่คลาดเคลื่อนอาจส่งผลต่อคุณภาพการดูแล
                        และการตัดสินใจของผู้เกี่ยวข้อง
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">3. การรักษาความลับของบัญชี</h4>
                      <p>
                        ผู้ใช้งานต้องเก็บรักษาชื่อผู้ใช้ รหัสผ่าน ลิงก์รีเซ็ตรหัสผ่าน และช่องทางยืนยันตัวตนอื่นเป็นความลับ
                        หากสงสัยว่าบัญชีอาจถูกเข้าถึงโดยไม่ได้รับอนุญาต ต้องรีบเปลี่ยนรหัสผ่านและแจ้งผู้ดูแลระบบโดยเร็ว
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">4. การใช้งานที่ได้รับอนุญาต</h4>
                      <ul className="list-disc space-y-2 pl-6">
                        <li>ใช้เพื่อการคัดกรอง ดูแล ติดตาม และส่งต่อข้อมูลตามกระบวนการที่ได้รับอนุมัติ</li>
                        <li>ใช้เพื่อสนับสนุนการเรียนการสอน การให้คำปรึกษา และการดูแลเชิงสหวิชาชีพ</li>
                        <li>ใช้เพื่อวิเคราะห์ภาพรวมเชิงสถิติในระดับที่ไม่เปิดเผยตัวตนตามสิทธิที่กำหนด</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">5. การใช้งานที่ต้องห้าม</h4>
                      <ul className="list-disc space-y-2 pl-6">
                        <li>ห้ามนำข้อมูลในระบบไปเผยแพร่ ส่งต่อ หรือใช้เกินกว่าขอบเขตงานที่ได้รับมอบหมาย</li>
                        <li>ห้ามเข้าถึงข้อมูลของบุคคลอื่นโดยไม่มีเหตุผลที่เกี่ยวข้องกับภารกิจการดูแล</li>
                        <li>ห้ามพยายามสแกนช่องโหว่ เจาะระบบ หรือดัดแปลงกลไกความปลอดภัยของระบบ</li>
                        <li>ห้ามใช้ระบบเพื่อการตีตรา เลือกปฏิบัติ หรือสร้างผลกระทบทางลบต่อผู้ใช้งานรายอื่น</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">6. การส่งต่อและการดูแลกรณีมีความเสี่ยง</h4>
                      <p>
                        เมื่อระบบตรวจพบสัญญาณเสี่ยง หรือเมื่อบุคลากรบันทึกเหตุการณ์ที่อาจกระทบต่อความปลอดภัยและสุขภาวะของนักศึกษา
                        ระบบอาจส่งต่อข้อมูลที่จำเป็นไปยังอาจารย์ที่ปรึกษา ผู้เชี่ยวชาญ หรือหน่วยงานที่เกี่ยวข้องตามกระบวนการดูแล
                        เพื่อคุ้มครองความปลอดภัยของเจ้าของข้อมูล
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">7. ทรัพย์สินทางปัญญาและเอกสารในระบบ</h4>
                      <p>
                        เนื้อหา เครื่องหมาย ข้อมูลเชิงออกแบบ เอกสาร คู่มือ และส่วนประกอบของระบบเป็นทรัพย์สินของหน่วยงานหรือผู้ได้รับอนุญาต
                        ห้ามคัดลอก ดัดแปลง หรือนำไปใช้เชิงพาณิชย์โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">8. การระงับสิทธิและการเปลี่ยนแปลงเงื่อนไข</h4>
                      <p>
                        ผู้ดูแลระบบสงวนสิทธิในการจำกัด ระงับ หรือยกเลิกการเข้าใช้งานของผู้ใช้ที่ฝ่าฝืนข้อกำหนด
                        รวมถึงสิทธิในการปรับปรุงเอกสารฉบับนี้ตามความจำเป็น โดยจะประกาศฉบับล่าสุดบนเว็บไซต์
                      </p>
                    </div>
                  </div>
                </section>

                <section id="privacy" className="scroll-mt-28">
                  <div className="mb-6 flex items-center gap-3 border-b-2 border-blue-100 pb-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">นโยบายความเป็นส่วนตัว (Privacy Policy)</h2>
                  </div>

                  <div className="space-y-5 text-[15px] leading-relaxed text-slate-600">
                    <p>
                      {facultyFullName} ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของผู้ใช้งาน โดยเฉพาะข้อมูลสุขภาพ
                      และข้อมูลที่สะท้อนภาวะสุขภาวะซึ่งจัดเป็นข้อมูลอ่อนไหว ระบบจึงถูกออกแบบให้มีการคุ้มครองข้อมูลทั้งด้านเทคนิค
                      ขั้นตอนการทำงาน และการกำกับสิทธิ์ของผู้เกี่ยวข้อง
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-900">ข้อมูลที่ได้รับการคุ้มครอง</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          ข้อมูลระบุตัวตน ข้อมูลติดต่อ ข้อมูลด้านการศึกษา ผลประเมินสุขภาวะ ข้อมูลการดูแล และข้อมูลเหตุฉุกเฉิน
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-900">หลักการสำคัญ</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          เก็บเท่าที่จำเป็น ใช้ตามวัตถุประสงค์ ควบคุมสิทธิ์เข้าถึง ตรวจสอบย้อนหลังได้ และลดการเปิดเผยตัวตนเท่าที่ทำได้
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">1. ประเภทข้อมูลที่เก็บรวบรวม</h4>
                      <ul className="list-disc space-y-2 pl-6">
                        <li>
                          <strong>ข้อมูลระบุตัวตน:</strong> ชื่อ-นามสกุล รหัสนักศึกษา รหัสบุคลากร อีเมล และข้อมูลสังกัด
                        </li>
                        <li>
                          <strong>ข้อมูลด้านการศึกษาและการดูแล:</strong> ชั้นปี กลุ่มเรียน ข้อมูลอาจารย์ที่ปรึกษา บันทึกติดตาม และประวัติการส่งต่อ
                        </li>
                        <li>
                          <strong>ข้อมูลสุขภาวะ:</strong> ผลประเมิน ความเสี่ยง สัญญาณเฝ้าระวัง และข้อมูลที่เกี่ยวข้องกับการดูแลเชิงวิชาชีพ
                        </li>
                        <li>
                          <strong>ข้อมูลทางเทคนิค:</strong> เวลาใช้งาน บันทึกเหตุการณ์ การเข้าสู่ระบบ และข้อมูลเพื่อความปลอดภัยของระบบ
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">2. วัตถุประสงค์ในการใช้ข้อมูล</h4>
                      <ul className="list-disc space-y-2 pl-6">
                        <li>เพื่อยืนยันตัวตนและจัดการสิทธิ์การเข้าใช้งานของแต่ละบทบาท</li>
                        <li>เพื่อคัดกรองความเสี่ยง วางแผนการดูแล ติดตามผล และประสานการส่งต่อ</li>
                        <li>เพื่อปกป้องความปลอดภัยของนักศึกษาในกรณีที่มีเหตุเร่งด่วนหรือพบความเสี่ยงสูง</li>
                        <li>เพื่อปรับปรุงคุณภาพบริการ วิเคราะห์สถิติในภาพรวม และสนับสนุนการบริหารในระดับที่เหมาะสม</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">3. สิทธิการเข้าถึงข้อมูลตามบทบาท</h4>
                      <p>
                        ระบบใช้แนวทาง Role-Based Access Control และหลักการเข้าถึงข้อมูลเท่าที่จำเป็น (Need-to-Know Basis)
                        โดยมีการบันทึกประวัติการเข้าถึงเพื่อใช้ในการตรวจสอบย้อนหลัง
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-1 text-sm font-bold text-slate-800">
                            <UserCheck className="mr-1 inline-block h-4 w-4 text-blue-600" /> อาจารย์ที่ปรึกษา
                          </p>
                          <p className="text-xs text-slate-600">
                            เข้าถึงข้อมูลของนักศึกษาในความดูแลเพื่อการติดตาม การให้คำปรึกษา และการประสานงานต่อเนื่อง
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-1 text-sm font-bold text-slate-800">
                            <BrainCircuit className="mr-1 inline-block h-4 w-4 text-indigo-600" /> ผู้เชี่ยวชาญ/ทีมสุขภาพจิต
                          </p>
                          <p className="text-xs text-slate-600">
                            เข้าถึงข้อมูลเมื่อมีการส่งต่อเคสหรือมีเหตุผลเชิงวิชาชีพที่จำเป็นต่อการประเมินและดูแลเชิงลึก
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">4. การเปิดเผยข้อมูลต่อบุคคลภายนอก</h4>
                      <p>
                        โดยหลักระบบจะไม่เปิดเผยข้อมูลส่วนบุคคลแก่บุคคลภายนอก เว้นแต่เป็นการเปิดเผยเท่าที่จำเป็นตามกฎหมาย
                        ตามคำสั่งของหน่วยงานที่มีอำนาจ หรือเพื่อคุ้มครองชีวิตและความปลอดภัยของเจ้าของข้อมูลหรือผู้อื่นในกรณีฉุกเฉิน
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">5. ระยะเวลาเก็บรักษาข้อมูล</h4>
                      <p>
                        ข้อมูลจะถูกเก็บรักษาตามระยะเวลาที่จำเป็นต่อวัตถุประสงค์ของการดูแล การตรวจสอบย้อนหลัง
                        และข้อกำหนดทางกฎหมายหรือระเบียบของหน่วยงาน เมื่อพ้นระยะเวลาแล้ว ระบบจะดำเนินการลบ ทำลาย
                        หรือแปลงข้อมูลให้อยู่ในรูปแบบที่ไม่สามารถระบุตัวตนได้ตามความเหมาะสม
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">6. มาตรการคุ้มครองข้อมูล</h4>
                      <ul className="list-disc space-y-2 pl-6">
                        <li>การควบคุมสิทธิ์การเข้าถึงตามบทบาทและบันทึกประวัติการใช้งาน</li>
                        <li>การเข้ารหัสรหัสผ่านและการควบคุม session เพื่อเพิ่มความปลอดภัยของบัญชี</li>
                        <li>การออกแบบหน้าจอและรายงานให้ลดการเปิดเผยข้อมูลเกินความจำเป็น</li>
                        <li>การตรวจสอบเหตุผิดปกติและจำกัดการเข้าถึงข้อมูลอ่อนไหวในกรณีที่ยังไม่รับเคส</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">7. สิทธิของเจ้าของข้อมูล</h4>
                      <p>
                        เจ้าของข้อมูลสามารถติดต่อหน่วยงานเพื่อสอบถาม ขอเข้าถึง ขอแก้ไขข้อมูลที่ไม่ถูกต้อง
                        หรือใช้สิทธิตามกฎหมายที่เกี่ยวข้อง ภายใต้เงื่อนไขและข้อยกเว้นที่กฎหมายกำหนด
                      </p>
                    </div>

                    <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                      * ผู้ที่ไม่เกี่ยวข้องกับกระบวนการดูแลจะไม่สามารถเข้าถึงผลประเมินเชิงสุขภาพจิตของผู้ใช้งานได้
                    </p>
                  </div>
                </section>

                <section id="cookies" className="scroll-mt-28">
                  <div className="mb-6 flex items-center gap-3 border-b-2 border-blue-100 pb-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <Cookie className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">นโยบายการใช้คุกกี้ (Cookie Policy)</h2>
                  </div>

                  <div className="space-y-5 text-[15px] leading-relaxed text-slate-600">
                    <p>
                      คุกกี้คือไฟล์ข้อมูลขนาดเล็กที่จัดเก็บในอุปกรณ์ของผู้ใช้งานเมื่อเข้าเว็บไซต์ โดยระบบใช้คุกกี้และเทคโนโลยีที่ใกล้เคียงกัน
                      เพื่อให้บริการพื้นฐานทำงานได้อย่างปลอดภัย มีความต่อเนื่อง และสามารถจดจำการตั้งค่าที่จำเป็นของผู้ใช้งาน
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-900">คุกกี้ที่จำเป็น</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          ใช้สำหรับการเข้าสู่ระบบ ความปลอดภัยของ session การจดจำสถานะการใช้งาน และการป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-900">คุกกี้เชิงวิเคราะห์</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          อาจใช้ข้อมูลเชิงสถิติที่ไม่ระบุตัวบุคคลเพื่อวิเคราะห์ประสิทธิภาพของเว็บไซต์และปรับปรุงประสบการณ์ใช้งาน
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">1. วัตถุประสงค์การใช้คุกกี้</h4>
                      <ul className="list-disc space-y-2 pl-6">
                        <li>รักษาสถานะการเข้าสู่ระบบและป้องกันการหลุดจากระบบโดยไม่จำเป็น</li>
                        <li>ช่วยให้การใช้งานหน้าต่าง ๆ ของเว็บไซต์ทำงานได้ต่อเนื่องและถูกต้อง</li>
                        <li>จดจำการตั้งค่าที่จำเป็น เช่น การยอมรับคุกกี้ หรือรูปแบบการแสดงผลบางส่วน</li>
                        <li>ตรวจวัดการใช้งานเชิงภาพรวมเพื่อปรับปรุงคุณภาพบริการ โดยไม่ใช้เพื่อการตลาดเชิงพาณิชย์</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">2. การจัดการคุกกี้ของผู้ใช้งาน</h4>
                      <p>
                        ผู้ใช้งานสามารถตั้งค่าเบราว์เซอร์ให้ปฏิเสธ ลบ หรือแจ้งเตือนก่อนจัดเก็บคุกกี้บางประเภทได้
                        อย่างไรก็ตาม การปิดคุกกี้ที่จำเป็นอาจทำให้บางส่วนของเว็บไซต์ไม่สามารถทำงานได้ตามปกติ
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">3. ระยะเวลาเก็บคุกกี้</h4>
                      <p>
                        ระบบจะเก็บคุกกี้ตามระยะเวลาที่จำเป็นต่อวัตถุประสงค์ของคุกกี้แต่ละประเภท โดยบางรายการอาจสิ้นสุดเมื่อปิดเบราว์เซอร์
                        และบางรายการอาจคงอยู่ชั่วคราวเพื่อรองรับประสบการณ์ใช้งานที่ต่อเนื่องในครั้งถัดไป
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">4. คุกกี้จากบุคคลที่สาม</h4>
                      <p>
                        หากมีการใช้บริการภายนอกเพื่อการวิเคราะห์หรือสนับสนุนการทำงานของเว็บไซต์ ระบบจะเลือกใช้เฉพาะบริการที่เหมาะสม
                        และควบคุมการเปิดเผยข้อมูลเท่าที่จำเป็น โดยจะไม่ใช้คุกกี้เพื่อการโฆษณาเฉพาะบุคคลหรือการติดตามข้ามเว็บไซต์
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <Shield className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>
                        <strong>รับประกันความเป็นส่วนตัว:</strong> ระบบไม่มีการใช้คุกกี้เพื่อโฆษณาเชิงพาณิชย์
                        หรือการติดตามข้ามเว็บไซต์ที่ไม่เกี่ยวข้องกับการให้บริการของระบบ
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>
      <LegalFooter />
    </>
  );
}
