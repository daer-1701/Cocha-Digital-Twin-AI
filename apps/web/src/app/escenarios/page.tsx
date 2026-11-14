import type { Metadata } from "next";
import { PendingSection } from "../../components/pending-section";
import { section } from "../../lib/navigation";

const current = section("/escenarios");
export const metadata: Metadata = { title: current.title };

export default function Page() {
  return <PendingSection section={current} />;
}
