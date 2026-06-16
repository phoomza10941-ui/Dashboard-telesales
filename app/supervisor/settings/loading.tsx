import { SkeletonPageHeader, SkeletonForm } from "@/app/my-desk/components/SkeletonPrimitives";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonForm rows={4} />
    </div>
  );
}
