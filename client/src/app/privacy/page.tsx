"use client";

import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Calendar,
  Cookie,
  FileText,
  HelpCircle,
  Shield,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";
import LegalTopNav from "@/components/legal-top-nav";
import LegalFooter from "@/components/legal-footer";

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState<"terms" | "privacy" | "cookies">("terms");
  const sectionIds: Array<"terms" | "privacy" | "cookies"> = ["terms", "privacy", "cookies"];

  const handleSidebarNavigate = (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: "terms" | "privacy" | "cookies",
  ) => {
    event.preventDefault();
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    const yOffset = 112;
    const targetY = window.scrollY + target.getBoundingClientRect().top - yOffset;

    setActiveSection(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  useEffect(() => {
    const onScroll = () => {
      let current: "terms" | "privacy" | "cookies" = sectionIds[0];
      let nearestDistance = Number.POSITIVE_INFINITY;
      const viewportAnchor = 128;

      for (const id of sectionIds) {
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

  return (
    <>
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_15%_20%,rgba(186,230,253,0.55),transparent_36%),radial-gradient(circle_at_82%_8%,rgba(125,211,252,0.45),transparent_32%),linear-gradient(135deg,#f8fafc_0%,#f0f9ff_40%,#eef2ff_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.35)_40%,transparent_80%)]" />
      <LegalTopNav active="privacy" />

      <main className="min-h-screen pb-12 pt-28 sm:pt-32">
        <div className="mx-auto max-w-[102rem] px-3 sm:px-4 lg:px-5">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
            <aside className="w-full shrink-0 lg:w-1/4">
              <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:mb-0 lg:rounded-none lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
                <h3 className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">หมวดหมู่นโยบาย</h3>
                <nav className="flex flex-col space-y-2">
                  <a
                    href="#terms"
                    onClick={(event) => handleSidebarNavigate(event, "terms")}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] transition-colors ${
                      activeSection === "terms"
                        ? "bg-blue-50 font-bold text-blue-700"
                        : "font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                    }`}
                  >
                    <FileText className="h-5 w-5 shrink-0" />
                    เงื่อนไขการใช้งาน
                  </a>
                  <a
                    href="#privacy"
                    onClick={(event) => handleSidebarNavigate(event, "privacy")}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] transition-colors ${
                      activeSection === "privacy"
                        ? "bg-blue-50 font-bold text-blue-700"
                        : "font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                    }`}
                  >
                    <ShieldCheck className="h-5 w-5 shrink-0" />
                    นโยบายความเป็นส่วนตัว
                  </a>
                  <a
                    href="#cookies"
                    onClick={(event) => handleSidebarNavigate(event, "cookies")}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] transition-colors ${
                      activeSection === "cookies"
                        ? "bg-blue-50 font-bold text-blue-700"
                        : "font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                    }`}
                  >
                    <Cookie className="h-5 w-5 shrink-0" />
                    นโยบายการใช้คุกกี้
                  </a>
                </nav>

                <div className="mt-8 hidden px-3 lg:block">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                    <HelpCircle className="mb-3 h-6 w-6 text-blue-600" />
                    <h4 className="mb-2 text-[15px] font-bold text-blue-900">มีข้อสงสัยเพิ่มเติม?</h4>
                    <p className="mb-4 text-sm leading-relaxed text-slate-600">
                      หากมีคำถามเกี่ยวกับการใช้งานระบบ หรือการคุ้มครองข้อมูลส่วนบุคคล
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

            <div className="w-full rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md p-6 shadow-sm sm:p-10 lg:w-3/4 lg:p-12">
              <div className="mb-10 border-b border-slate-100 pb-8">
                <h1 className="mb-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">ศูนย์ข้อมูลและนโยบาย</h1>
                <p className="mb-4 text-lg text-slate-600">ระบบจัดการและดูแลสุขภาวะนักศึกษา (Wellbeing System)</p>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> อัปเดตล่าสุด: 19 เมษายน 2026
                  </span>
                </div>
              </div>

              <div className="space-y-16">
                <section id="terms" className="scroll-mt-28">
                  <div className="mb-6 flex items-center gap-3 border-b-2 border-blue-100 pb-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">เงื่อนไขการใช้งานระบบ (Terms of Service)</h2>
                  </div>

                  <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
                    <p>
                      การเข้าสู่ระบบและใช้งาน Wellbeing System ถือว่าผู้ใช้งานได้รับทราบและตกลงที่จะปฏิบัติตามเงื่อนไขที่กำหนดไว้
                      เพื่อให้การให้บริการเป็นไปอย่างปลอดภัย โปร่งใส และสอดคล้องกับกฎหมายที่เกี่ยวข้อง
                    </p>
                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">1. การยืนยันตัวตนและความรับผิดชอบ</h4>
                      <p>
                        การเข้าใช้งานระบบกระทำผ่านบัญชีผู้ใช้ที่ได้รับอนุญาต ผู้ใช้งานต้องรักษาความลับของข้อมูลบัญชี
                        และต้องรับผิดชอบต่อการกระทำทั้งหมดที่เกิดขึ้นภายใต้บัญชีของตน
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">2. ความถูกต้องของข้อมูล</h4>
                      <p>
                        ผู้ใช้งานตกลงให้ข้อมูลที่ถูกต้องและเป็นปัจจุบัน โดยเฉพาะข้อมูลที่ใช้เพื่อการประเมินภาวะสุขภาวะ
                        เพื่อให้การดูแลและการประสานงานเชิงวิชาชีพเป็นไปอย่างเหมาะสม
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">3. วัตถุประสงค์การใช้งาน</h4>
                      <p>
                        ระบบนี้ใช้เพื่อสนับสนุนการดูแลนักศึกษาในเชิงสุขภาวะ ห้ามนำข้อมูลในระบบไปใช้ในทางที่ละเมิดสิทธิส่วนบุคคล
                        หรือใช้เพื่อวัตถุประสงค์ที่ไม่เกี่ยวข้องกับภารกิจการดูแลนักศึกษา
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

                  <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
                    <p>
                      คณะพยาบาลศาสตร์ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคล โดยเฉพาะข้อมูลด้านสุขภาพซึ่งเป็นข้อมูลอ่อนไหว
                      ระบบจึงใช้มาตรการคุ้มครองข้อมูลทั้งในเชิงเทคนิคและกระบวนการทำงานของบุคลากรที่เกี่ยวข้อง
                    </p>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">ข้อมูลที่เก็บรวบรวมและวัตถุประสงค์</h4>
                      <ul className="list-disc space-y-2 pl-6">
                        <li>
                          <strong>ข้อมูลระบุตัวตน:</strong> ชื่อ-นามสกุล รหัสนักศึกษา คณะ/ชั้นปี เพื่อยืนยันตัวตนและจัดสรรผู้ดูแล
                        </li>
                        <li>
                          <strong>ข้อมูลสุขภาพ:</strong> ผลประเมินและข้อมูลติดตามที่จำเป็น เพื่อคัดกรองความเสี่ยงและวางแผนดูแล
                        </li>
                        <li>
                          <strong>กรณีฉุกเฉิน:</strong> เมื่อพบความเสี่ยงสูง ระบบอาจแจ้งทีมผู้เชี่ยวชาญเพื่อคุ้มครองความปลอดภัยของผู้ใช้งาน
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 mt-6 font-bold text-slate-800">การรักษาความลับและสิทธิการเข้าถึงข้อมูล</h4>
                      <p>
                        ระบบใช้แนวทาง Role-Based Access Control โดยบุคลากรแต่ละบทบาทจะเข้าถึงข้อมูลเท่าที่จำเป็นตามหน้าที่เท่านั้น
                        และมีการบันทึกการเข้าถึงข้อมูลเพื่อให้ตรวจสอบย้อนหลังได้
                      </p>
                    </div>

                    <div className="my-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-1 text-sm font-bold text-slate-800">
                          <UserCheck className="mr-1 inline-block h-4 w-4 text-blue-600" /> อาจารย์ที่ปรึกษา
                        </p>
                        <p className="text-xs text-slate-600">เข้าถึงข้อมูลนักศึกษาที่อยู่ในความดูแลเท่าที่จำเป็น</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-1 text-sm font-bold text-slate-800">
                          <BrainCircuit className="mr-1 inline-block h-4 w-4 text-indigo-600" /> ทีมสุขภาพจิต/ผู้เชี่ยวชาญ
                        </p>
                        <p className="text-xs text-slate-600">เข้าถึงข้อมูลเมื่อมีการส่งต่อเพื่อประเมินหรือดูแลเชิงลึก</p>
                      </div>
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

                  <div className="space-y-4 text-[15px] leading-relaxed text-slate-600">
                    <p>
                      คุกกี้คือไฟล์ข้อมูลขนาดเล็กที่จัดเก็บในอุปกรณ์ของผู้ใช้งานเมื่อเข้าเว็บไซต์ โดยระบบใช้คุกกี้ที่จำเป็นต่อการทำงาน
                      เช่น การรักษาสถานะ session การยืนยันความปลอดภัย และการจดจำการตั้งค่าพื้นฐาน
                    </p>

                    <ul className="mt-4 list-disc space-y-2 pl-6">
                      <li>
                        <strong className="text-slate-800">คุกกี้ที่จำเป็นอย่างยิ่ง:</strong> รองรับการเข้าสู่ระบบ ความปลอดภัย และความต่อเนื่องของบริการ
                      </li>
                      <li>
                        <strong className="text-slate-800">คุกกี้เชิงวิเคราะห์:</strong> อาจใช้ข้อมูลสถิติแบบไม่ระบุตัวบุคคลเพื่อปรับปรุงประสบการณ์ใช้งาน
                      </li>
                    </ul>

                    <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <Shield className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>
                        <strong>รับประกันความเป็นส่วนตัว:</strong> ระบบไม่มีการใช้คุกกี้เพื่อโฆษณาหรือการติดตามข้ามเว็บไซต์
                        เพื่อการตลาดเชิงพาณิชย์
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
