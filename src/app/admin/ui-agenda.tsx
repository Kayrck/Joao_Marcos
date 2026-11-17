import type { ClientListItem, Page } from "../../../shared/types";
import { SelectField, useGet } from "./ui";

export * from "./ui";

/** Seletor de cliente que também devolve o nome (para preencher o campo de nome do compromisso). */
export function ClientSelectProxy({ value, onChange }: { value: string | null; onChange: (id: string | null, name: string) => void }) {
  const q = useGet<Page<ClientListItem>>(["clients", "select"], "/api/admin/clients?pageSize=200");
  return (
    <SelectField label="Cliente cadastrado (opcional)" value={value ?? ""} onChange={(e) => onChange(e.target.value || null, q.data?.items.find((c) => c.id === e.target.value)?.fullName ?? "")}>
      <option value="">— Outra pessoa (digite o nome abaixo) —</option>
      {q.data?.items.map((c) => (
        <option key={c.id} value={c.id}>
          {c.fullName}
        </option>
      ))}
    </SelectField>
  );
}
