import ZoeChat from "@/components/chat/ZoeChat";

/**
 * Full-screen ZOE workspace at /zoe.
 * AMOLED black + white theme. ZoeChat handles its own layout in mode="page".
 */
export default function ZoePage() {
  return (
    <div className="min-h-screen w-full bg-black text-white">
      <ZoeChat mode="page" />
    </div>
  );
}
