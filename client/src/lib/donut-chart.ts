export type DonutSliceInput = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export type DonutArc = DonutSliceInput & {
  percent: number;
  path: string;
};

const TAU = Math.PI * 2;

const polar = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
});

/** สร้าง path วงแหวนหนึ่งชิ้นจากมุมเริ่ม–จบ (เรเดียน, 0 = ขวา ตามเข็มนาฬิกาใน SVG ต้องชดเชย) */
export function describeDonutArc(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0 || outerRadius <= innerRadius) {
    return "";
  }

  // เริ่มจากยอด (-90°) ให้ชิ้นแรกอยู่ด้านบน
  const start = startAngle - Math.PI / 2;
  const end = endAngle - Math.PI / 2;
  const largeArc = sweep > Math.PI ? 1 : 0;

  const outerStart = polar(cx, cy, outerRadius, start);
  const outerEnd = polar(cx, cy, outerRadius, end);
  const innerEnd = polar(cx, cy, innerRadius, end);
  const innerStart = polar(cx, cy, innerRadius, start);

  if (sweep >= TAU - 1e-6) {
    // วงเต็ม — แบ่งสองครึ่งเพื่อให้ path วาดได้
    const mid = start + Math.PI;
    const outerMid = polar(cx, cy, outerRadius, mid);
    const innerMid = polar(cx, cy, innerRadius, mid);
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerMid.x} ${outerMid.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerStart.x} ${outerStart.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${innerMid.x} ${innerMid.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${innerStart.x} ${innerStart.y}`,
      "Z",
    ].join(" ");
  }

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

/** คำนวณ arcs โดนัทจากสัดส่วนค่า — ข้ามค่า ≤ 0 · รองรับช่องว่างระหว่างชิ้น */
export function buildDonutArcs(
  slices: DonutSliceInput[],
  options?: {
    cx?: number;
    cy?: number;
    outerRadius?: number;
    innerRadius?: number;
    /** ช่องว่างระหว่างชิ้น (เรเดียน) — ค่าเริ่มต้น 0 */
    gapRadians?: number;
  }
): { total: number; arcs: DonutArc[] } {
  const cx = options?.cx ?? 120;
  const cy = options?.cy ?? 120;
  const outerRadius = options?.outerRadius ?? 96;
  const innerRadius = options?.innerRadius ?? 62;
  const gapRadians = Math.max(0, options?.gapRadians ?? 0);

  const positive = slices.filter((slice) => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) {
    return { total: 0, arcs: [] };
  }

  const gapBudget = positive.length > 1 ? gapRadians * positive.length : 0;
  const usable = Math.max(TAU - gapBudget, TAU * 0.85);

  let angle = gapRadians / 2;
  const arcs: DonutArc[] = positive.map((slice) => {
    const sweep = (slice.value / total) * usable;
    const startAngle = angle;
    const endAngle = angle + sweep;
    angle = endAngle + (positive.length > 1 ? gapRadians : 0);
    return {
      ...slice,
      percent: (slice.value / total) * 100,
      path: describeDonutArc(cx, cy, outerRadius, innerRadius, startAngle, endAngle),
    };
  });

  return { total, arcs };
}
