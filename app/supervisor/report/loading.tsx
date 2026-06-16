import { SkeletonPageHeader, SkeletonStatCards, SkeletonRows } from "@/app/my-desk/components/SkeletonPrimitives";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <SkeletonRows count={7} />
    </div>
  );
}
