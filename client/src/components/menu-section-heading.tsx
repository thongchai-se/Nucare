"use client";

type MenuSectionHeadingProps = {
  title: string;
};

export function MenuSectionHeading({ title }: MenuSectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center gap-2 px-1">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
      <p className="text-xs font-semibold text-slate-500">{title}</p>
    </div>
  );
}
