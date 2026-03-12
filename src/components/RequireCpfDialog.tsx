import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (parseInt(digits[9]) !== check) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (parseInt(digits[10]) !== check) return false;

  return true;
}

interface RequireCpfDialogProps {
  open: boolean;
  userId: string;
  onSaved: () => void;
}

export function RequireCpfDialog({ open, userId, onSaved }: RequireCpfDialogProps) {
  const [cpf, setCpf] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido. Verifique e tente novamente.");
      return;
    }

    setSaving(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      const formatted = formatCpf(cleanCpf);

      const { error } = await supabase
        .from("profiles")
        .update({ cpf: formatted })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("CPF cadastrado com sucesso!");
      onSaved();
    } catch (error) {
      console.error("Error saving CPF:", error);
      toast.error("Erro ao salvar CPF. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <DialogTitle>Cadastro de CPF</DialogTitle>
          </div>
          <DialogDescription>
            Para sua segurança e acesso completo aos materiais da plataforma, precisamos do seu CPF. 
            Essa informação é utilizada como medida antiplágio nos downloads de materiais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="cpf-input">CPF</Label>
            <Input
              id="cpf-input"
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              maxLength={14}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar CPF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
