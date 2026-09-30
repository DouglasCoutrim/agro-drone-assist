import { useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Upload, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ImportableTable = "clientes" | "itens_estoque" | "servicos";

interface CsvImportExportProps {
  tableName: ImportableTable;
  organizationId?: string;
  /** Columns included in the export CSV (sensitive/system columns are excluded). */
  exportColumns: string[];
  /** Headers used for the empty template CSV and expected on import. */
  templateColumns: string[];
  /** Optional row transformer for import. Return null to skip a row. */
  transformRow?: (row: Record<string, string>) => Record<string, any> | null;
  /** Base filename, without extension. e.g. "clientes" -> clientes_export.csv */
  filename: string;
  onImported?: () => void;
  label?: string;
}

export function CsvImportExport({
  tableName,
  organizationId,
  exportColumns,
  templateColumns,
  transformRow,
  filename,
  onImported,
  label = "CSV",
}: CsvImportExportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const downloadCsv = (csv: string, name: string) => {
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    const t = toast.loading("Exportando dados...");
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const cleaned = (data || []).map((r: any) => {
        const o: Record<string, any> = {};
        exportColumns.forEach((c) => {
          o[c] = r[c] ?? "";
        });
        return o;
      });
      const csv = Papa.unparse(cleaned, { columns: exportColumns });
      downloadCsv(csv, `${filename}_export.csv`);
      toast.success(`${cleaned.length} registros exportados`, { id: t });
    } catch (e: any) {
      toast.error("Erro ao exportar: " + (e.message || e), { id: t });
    }
  };

  const handleTemplate = () => {
    const csv = templateColumns.join(",") + "\n";
    downloadCsv(csv, `modelo_${filename}.csv`);
    toast.success("Planilha modelo baixada");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    setBusy(true);
    const t = toast.loading("Importando dados...");
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: async (results) => {
        try {
          const rows = results.data
            .map((r) => (transformRow ? transformRow(r) : r))
            .filter((r): r is Record<string, any> => !!r && Object.keys(r).length > 0)
            // OBRIGATÓRIO: injeta organization_id em todas as linhas (tenant guard)
            .map((r) => ({ ...r, organization_id: organizationId }));

          if (rows.length === 0) {
            toast.error("Nenhum registro válido encontrado no arquivo", { id: t });
            setBusy(false);
            return;
          }

          let imported = 0;
          const BATCH = 500;
          for (let i = 0; i < rows.length; i += BATCH) {
            const chunk = rows.slice(i, i + BATCH);
            const { error } = await supabase.from(tableName).insert(chunk as any);
            if (error) throw error;
            imported += chunk.length;
          }
          toast.success(`${imported} registros importados!`, { id: t });
          onImported?.();
        } catch (err: any) {
          toast.error("Erro na importação: " + (err.message || err), { id: t });
        } finally {
          setBusy(false);
        }
      },
      error: (err) => {
        toast.error("Erro ao ler CSV: " + err.message, { id: t });
        setBusy(false);
      },
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFile}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={busy} className="h-9">
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
            )}
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-2" />
            Exportar CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-2" />
            Importar CSV
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleTemplate}>
            <FileDown className="h-3.5 w-3.5 mr-2" />
            Baixar Planilha Modelo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// ---------- Helpers de transformação ----------

/** Converte "1.234,56" / "150,00" / "150" / "" em número. */
export function parseNumberBR(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function emptyToNull(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
