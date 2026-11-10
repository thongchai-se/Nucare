"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeAdaptiveRowsPerPage,
  slicePageItems,
  type AdaptiveRowsOptions,
  type PageSlice,
} from "@/lib/list-pagination";

type UseListPaginationOptions = AdaptiveRowsOptions & {
  /** ค่าคงที่แทนการคำนวณจากจอ — เช่น การ์ดประวัตินิสิต */
  fixedRowsPerPage?: number;
};

/** จัดการหน้าปัจจุบัน + จำนวนแถวต่อหน้า และรีเซ็ตเมื่อ resetKey เปลี่ยน */
export function useListPagination<T>(
  items: T[],
  resetKey: string | number,
  options: UseListPaginationOptions = {}
): PageSlice<T> & {
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
} {
  const { fixedRowsPerPage, ...adaptiveOptions } = options;
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(fixedRowsPerPage ?? 10);

  useEffect(() => {
    if (typeof fixedRowsPerPage === "number" && fixedRowsPerPage > 0) {
      setRowsPerPage(fixedRowsPerPage);
      return;
    }

    const updateRowsPerPage = () => {
      setRowsPerPage(computeAdaptiveRowsPerPage(window.innerHeight, window.innerWidth, adaptiveOptions));
    };

    updateRowsPerPage();
    window.addEventListener("resize", updateRowsPerPage);
    return () => window.removeEventListener("resize", updateRowsPerPage);
    // adaptiveOptions เป็น object จาก caller — อ่านค่าคงที่ผ่าน deps ที่สำคัญพอ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fixedRowsPerPage,
    adaptiveOptions.reservedHeightDesktop,
    adaptiveOptions.reservedHeightMobile,
    adaptiveOptions.estimatedRowHeightDesktop,
    adaptiveOptions.estimatedRowHeightMobile,
    adaptiveOptions.minRowsDesktop,
    adaptiveOptions.minRowsMobile,
    adaptiveOptions.maxRowsDesktop,
    adaptiveOptions.maxRowsMobile,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  const slice = useMemo(() => slicePageItems(items, currentPage, rowsPerPage), [currentPage, items, rowsPerPage]);

  useEffect(() => {
    if (currentPage !== slice.currentPage) {
      setCurrentPage(slice.currentPage);
    }
  }, [currentPage, slice.currentPage]);

  return {
    ...slice,
    setCurrentPage,
  };
}
