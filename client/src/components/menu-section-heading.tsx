"use client";

type MenuSectionHeadingProps = {
  title: string;
};

export function MenuSectionHeading({ title }: MenuSectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center gap-2 px-1">
      <span className="h-2 w-2 rounded-full bg-blue-500/80" />
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{title}</p>
    </div>
  );
}
