import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FiscalHeader } from "@/components/fiscal/fiscalShared";

export default function NfeComplementar() {
  return (
    <MainLayout>
      <div className="space-y-4 py-6">
        <FiscalHeader titulo="NF-e complementar" operacao="Complemento de valores ou impostos" />
        <Card><CardContent className="p-8 text-center text-muted-foreground">Em breve</CardContent></Card>
      </div>
    </MainLayout>
  );
}
