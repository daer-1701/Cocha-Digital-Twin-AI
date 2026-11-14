import Link from "next/link";
import { StatusPanel } from "../components/ui/status-panel";

export default function NotFound() {
  return (
    <StatusPanel
      status="empty"
      title="Esta página no existe"
      action={<Link href="/">Ir al explorador</Link>}
    >
      <p>Revisa la dirección o elige una sección del menú.</p>
    </StatusPanel>
  );
}
