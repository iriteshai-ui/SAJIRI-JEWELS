import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
  itemLabel = "records",
  className,
}: DataTablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || Math.ceil(totalItems / pageSize) || 1);
  const fromRecord = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toRecord = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxButtons = 5;

    if (safeTotalPages <= maxButtons + 2) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(safeTotalPages - 1, currentPage + 1);

      if (start > 2) pages.push("ellipsis");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < safeTotalPages - 1) pages.push("ellipsis");

      pages.push(safeTotalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 text-sm text-muted-foreground",
        className
      )}
      data-testid="data-table-pagination"
    >
      {/* Left: Record Summary & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span className="text-xs font-medium text-foreground/80">
          Showing <span className="font-bold text-foreground">{fromRecord}</span>–
          <span className="font-bold text-foreground">{toRecord}</span> of{" "}
          <span className="font-bold text-foreground">{totalItems.toLocaleString("en-IN")}</span> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-auto sm:ml-4">
            <span className="text-xs whitespace-nowrap">Show:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                onPageSizeChange(Number(val));
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-8 w-24 text-xs font-bold bg-background" data-testid="select-page-size">
                <SelectValue placeholder={`${pageSize}`} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs font-medium">
                    {opt} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right: Pagination Navigation Controls */}
      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end">
        {/* First Page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 hidden md:flex cursor-pointer"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          title="First Page"
          data-testid="pagination-first-page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>

        {/* Previous Button */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs font-semibold gap-1 cursor-pointer"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          data-testid="pagination-prev-page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Prev</span>
        </Button>

        {/* Page Number Links */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            p === "ellipsis" ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground select-none">
                •••
              </span>
            ) : (
              <Button
                key={p}
                variant={currentPage === p ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 min-w-8 px-2 text-xs font-bold cursor-pointer transition-all",
                  currentPage === p
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent text-foreground/80"
                )}
                onClick={() => onPageChange(p)}
                data-testid={`pagination-page-${p}`}
              >
                {p}
              </Button>
            )
          )}
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs font-semibold gap-1 cursor-pointer"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(currentPage + 1)}
          data-testid="pagination-next-page"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 hidden md:flex cursor-pointer"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          title="Last Page"
          data-testid="pagination-last-page"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
