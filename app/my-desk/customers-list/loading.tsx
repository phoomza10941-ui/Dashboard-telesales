import { SkeletonPageHeader, SkeletonRows } from "../components/SkeletonPrimitives";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonRows count={9} />
    </div>
  );
}
