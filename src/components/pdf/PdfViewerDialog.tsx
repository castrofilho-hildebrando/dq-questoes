import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PdfViewer } from './PdfViewer';

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string;
  pdfMaterialId: string;
  title?: string;
  totalPages?: number;
  taskId?: string;
  initialPage?: number;
  onProgressUpdate?: (progress: { currentPage: number; totalPages: number; percentage: number }) => void;
  allowDownload?: boolean;
  downloadFileName?: string;
}

export function PdfViewerDialog({
  open,
  onOpenChange,
  pdfUrl,
  pdfMaterialId,
  title = 'Visualizar PDF',
  totalPages,
  taskId,
  initialPage,
  onProgressUpdate,
  allowDownload,
  downloadFileName,
}: PdfViewerDialogProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleOpenChange = (value: boolean) => {
    if (!value) setIsFullscreen(false);
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          isFullscreen
            ? "max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] flex flex-col p-0 rounded-none"
            : "max-w-5xl h-[90vh] flex flex-col p-0"
        }
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <PdfViewer
            pdfUrl={pdfUrl}
            pdfMaterialId={pdfMaterialId}
            totalPages={totalPages}
            taskId={taskId}
            initialPage={initialPage}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((f) => !f)}
            onProgressUpdate={onProgressUpdate}
            allowDownload={allowDownload}
            downloadFileName={downloadFileName}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
