import { StatusPanel } from "../components/ui/status-panel";

export default function Loading() {
  return <StatusPanel status="loading" title="Consultando la evidencia publicada…" />;
}
