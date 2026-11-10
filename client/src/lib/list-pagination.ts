export type AdaptiveRowsOptions = {
  reservedHeightMobile?: number;
  reservedHeightDesktop?: number;
  estimatedRowHeightMobile?: number;
  estimatedRowHeightDesktop?: number;
  minRowsMobile?: number;
  minRowsDesktop?: number;
  maxRowsMobile?: number;
  maxRowsDesktop?: number;
};

export type PageSlice<T> = {
  pageItems: T[];
  total: number;
  totalPages: number;
  currentPage: number;
  rowsPerPage: number;
  rangeStart: number;
  rangeEnd: number;
  canGoPrev: boolean;
  canGoNext: boolean;
};

const DEFAULT_ADAPTIVE: Required<AdaptiveRowsOptions> = {
  reservedHeightMobile: 520,
  reservedHeightDesktop: 340,
  estimatedRowHeightMobile: 152,
  estimatedRowHeightDesktop: 56,
  minRowsMobile: 3,
  minRowsDesktop: 8,
  maxRowsMobile: 8,
  maxRowsDesktop: 16,
};

/** คำนวณจำนวนแถวต่อหน้าจากขนาดจอ — แนวเดียวกับหน้าจัดการนิสิตของ admin */
export function computeAdaptiveRowsPerPage(
  viewportHeight: number,
  viewportWidth: number,
  options: AdaptiveRowsOptions = {}
): number {
  const config = { ...DEFAULT_ADAPTIVE, ...options };
  const isMobileViewport = viewportWidth < 768;
  const reservedHeight = isMobileViewport ? config.reservedHeightMobile : config.reservedHeightDesktop;
  const estimatedRowHeight = isMobileViewport
    ? config.estimatedRowHeightMobile
    : config.estimatedRowHeightDesktop;
  const minRows = isMobileViewport ? config.minRowsMobile : config.minRowsDesktop;
  const maxRows = isMobileViewport ? config.maxRowsMobile : config.maxRowsDesktop;
  const safeHeight = Math.max(0, viewportHeight - reservedHeight);
  const computedRows = Math.max(minRows, Math.floor(safeHeight / estimatedRowHeight));
  return Math.min(maxRows, computedRows);
}

/** ตัดรายการตามหน้าและคืนช่วงแสดงผล — กันหน้าเกินเมื่อจำนวนลดลง */
export function slicePageItems<T>(items: T[], page: number, rowsPerPage: number): PageSlice<T> {
  const total = items.length;
  const safeRows = Math.max(1, Math.floor(rowsPerPage) || 1);
  const totalPages = Math.max(1, Math.ceil(total / safeRows));
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (currentPage - 1) * safeRows;
  const pageItems = items.slice(start, start + safeRows);
  const rangeStart = total === 0 ? 0 : start + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(start + pageItems.length, total);

  return {
    pageItems,
    total,
    totalPages,
    currentPage,
    rowsPerPage: safeRows,
    rangeStart,
    rangeEnd,
    canGoPrev: currentPage > 1,
    canGoNext: currentPage < totalPages,
  };
}
