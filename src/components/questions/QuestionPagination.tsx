import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function QuestionPagination({ 
  currentPage, 
  totalPages, 
  totalCount,
  onPageChange 
}: QuestionPaginationProps) {
  const handlePageChange = (page: number) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onPageChange(page);
  };
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2;
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);

    if (rangeStart > 2) {
      pages.push('...');
    }

    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    if (rangeEnd < totalPages - 1) {
      pages.push('...');
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        <span className="px-4 py-2 text-sm text-muted-foreground">
          Página {currentPage} de {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="gap-1"
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap justify-center gap-1">
        {getPageNumbers().map((page, index) => (
          <span key={index}>
            {page === '...' ? (
              <span className="px-3 py-1 text-muted-foreground">...</span>
            ) : (
              <Button
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page as number)}
                className={cn(
                  "min-w-[36px]",
                  page === currentPage && "pointer-events-none"
                )}
              >
                {page}
              </Button>
            )}
          </span>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Total: {totalCount} questões
      </p>
    </div>
  );
}
