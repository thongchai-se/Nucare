"use client";

type PlaceholderViewProps = {
  title: string;
  description: string;
};

export function PlaceholderView({ description, title }: PlaceholderViewProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
