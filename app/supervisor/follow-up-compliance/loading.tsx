import { SkeletonPageHeader, SkeletonRows } from "@/app/my-desk/components/SkeletonPrimitives";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonRows count={7} />
    </div>
  );
}
