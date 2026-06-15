import ScriptHelperClient from "./ScriptHelperClient";

export default function ScriptHelperPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">Script ช่วยขาย</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">สคริปต์รับมือทุกสถานการณ์</p>
      </div>
      <ScriptHelperClient />
    </div>
  );
}
