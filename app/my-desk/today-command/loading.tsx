import { SkeletonPageHeader, SkeletonKpiCards } from "../components/SkeletonPrimitives";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonKpiCards count={4} />
      <div className="animate-pulse bg-white border border-[#E8E8E8] rounded-xl p-4 h-28" />
    </div>
  );
}
