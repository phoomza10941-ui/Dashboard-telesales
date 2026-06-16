import { SkeletonPageHeader, SkeletonForm } from "../components/SkeletonPrimitives";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonForm rows={6} />
    </div>
  );
}
