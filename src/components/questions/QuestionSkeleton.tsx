import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface QuestionSkeletonProps {
  variant?: "card" | "table";
}

export function QuestionCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Question text */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        
        {/* Options */}
        <div className="space-y-2 pt-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export function QuestionTableRowSkeleton() {
  return (
    <tr className="border-b">
      <td className="p-3">
        <Skeleton className="h-4 w-4" />
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="p-3">
        <div className="space-y-1">
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-2/3 max-w-sm" />
        </div>
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="p-3">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="p-3">
        <Skeleton className="h-5 w-12 rounded-full" />
      </td>
      <td className="p-3">
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </td>
    </tr>
  );
}

export function QuestionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <QuestionCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function QuestionTableSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="border-b">
            <th className="p-3 text-left"><Skeleton className="h-4 w-4" /></th>
            <th className="p-3 text-left"><Skeleton className="h-4 w-16" /></th>
            <th className="p-3 text-left"><Skeleton className="h-4 w-20" /></th>
            <th className="p-3 text-left"><Skeleton className="h-4 w-20" /></th>
            <th className="p-3 text-left"><Skeleton className="h-4 w-16" /></th>
            <th className="p-3 text-left"><Skeleton className="h-4 w-12" /></th>
            <th className="p-3 text-left"><Skeleton className="h-4 w-12" /></th>
            <th className="p-3 text-left"><Skeleton className="h-4 w-16" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }).map((_, i) => (
            <QuestionTableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
