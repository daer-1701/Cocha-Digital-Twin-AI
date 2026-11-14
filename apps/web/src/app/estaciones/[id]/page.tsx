import Link from "next/link";
import { notFound } from "next/navigation";
import { getStationObservations } from "../../../lib/api";
import { pageOffset } from "../../../lib/pagination";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusPanel } from "../../../components/ui/status-panel";
import { DemoBanner } from "../../../components/ui/demo-banner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisión de registros MÓNICA" };
const flags: Record<string, string> = {
  valid: "Aceptado por el parser; sin validación instrumental", zero: "Cero: requiere revisión",
  negative: "Negativo: requiere revisión", invalid_value: "Valor inválido",
  invalid_timestamp: "Fecha inválida", duplicate: "Duplicado",
};
export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ offset?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const offset = pageOffset((await searchParams).offset);
  const { data, demo } = await getStationObservations(id, offset);
  return <>
    <DemoBanner state={demo} />
    <Link href="/estaciones">Volver a las estaciones</Link>
    <PageHeader title={data ? `Registros de ${data.station_name}` : "Registros de estación"}>
      <p>Revisión de los datos importados. No representa una serie validada para análisis físico ni calibración de LST.</p>
    </PageHeader>
    <div className="note">Fechas tal como se importaron, sin conversión de zona horaria. Metadatos, códigos instrumentales y permiso de redistribución pendientes. Uso local para revisión.</div>
    {!data ? <StatusPanel status="error" title="Estación ausente o servicio no disponible"
      action={<Link href={`/estaciones/${id}`}>Volver a intentar</Link>} /> : <>
      {data.status === "unavailable" ? <StatusPanel status="pending" title="Revisión de registros desactivada">
        <p>El operador debe habilitar la revisión local y confirmar los permisos antes de publicar estos datos.</p>
      </StatusPanel> : !data.items?.length ? <StatusPanel status="empty" title="No hay registros en esta página" /> :
        <div className="table-wrap"><table>
          <caption>PM10 importado, de más reciente a más antiguo. «Sin datos» no equivale a cero.</caption>
          <thead><tr><th>Fecha original, huso no aplicado</th><th>PM10</th><th>Unidad</th><th>Calidad</th><th>Importación</th></tr></thead>
          <tbody>{data.items.map((item) => <tr key={item.id}>
            <th scope="row">{item.observed_at.replace("T", " ")}</th>
            <td>{item.value == null ? "Sin datos" : item.value.toLocaleString("es-BO", { maximumFractionDigits: 4 })}</td>
            <td>{item.unit === "ug/m3" ? "µg/m³" : item.unit ?? "No declarada"}</td>
            <td>{flags[item.quality_flag] ?? item.quality_flag}</td>
            <td>{item.processing_run_id ? <code>{item.processing_run_id}</code> : "Sin referencia"}</td>
          </tr>)}</tbody>
        </table></div>}
      <nav className="pagination" aria-label="Páginas de registros">
        {offset > 0 && <Link href={`/estaciones/${id}?offset=${Math.max(0, offset - 50)}`}>Más recientes</Link>}
        {data.has_more && <Link href={`/estaciones/${id}?offset=${offset + 50}`}>Anteriores</Link>}
      </nav>
    </>}
  </>;
}
