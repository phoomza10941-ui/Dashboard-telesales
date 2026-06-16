import { SkeletonPageHeader, SkeletonAppointmentCards } from "../components/SkeletonPrimitives";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonAppointmentCards count={5} />
    </div>
  );
}
