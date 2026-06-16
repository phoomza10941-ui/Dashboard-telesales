import { SkeletonPageHeader, SkeletonStatCards, SkeletonChart } from "@/app/my-desk/components/SkeletonPrimitives";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <SkeletonChart />
    </div>
  );
}
