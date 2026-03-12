import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

interface ReportErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string;
  questionCode: string;
}

const errorTypes = [
  { value: 'enunciado', label: 'Erro no Enunciado', description: 'Texto da questão incorreto ou mal formatado' },
  { value: 'comentario', label: 'Erro no Comentário', description: 'Comentário do professor incorreto ou incompleto' },
  { value: 'gabarito', label: 'Erro no Gabarito', description: 'Resposta correta está errada' },
] as const;

export function ReportErrorDialog({ open, onOpenChange, questionId, questionCode }: ReportErrorDialogProps) {
  const [errorType, setErrorType] = useState<string>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!errorType || !details.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { error } = await supabase
        .from('question_error_reports')
        .insert({
          question_id: questionId,
          user_id: user.id,
          error_type: errorType,
          details: details.trim(),
        });

      if (error) throw error;

      toast.success("Erro reportado com sucesso!");
      onOpenChange(false);
      setErrorType('');
      setDetails('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error("Erro ao enviar relatório");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Notificar Erro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Questão: <span className="font-medium text-foreground">{questionCode}</span>
          </p>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Erro</Label>
            <RadioGroup value={errorType} onValueChange={setErrorType} className="space-y-2">
              {errorTypes.map((type) => (
                <div
                  key={type.value}
                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    errorType === type.value 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setErrorType(type.value)}
                >
                  <RadioGroupItem value={type.value} id={type.value} className="mt-0.5" />
                  <div className="space-y-1">
                    <Label htmlFor={type.value} className="font-medium cursor-pointer">
                      {type.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details" className="text-sm font-medium">
              Detalhes do Erro
            </Label>
            <Textarea
              id="details"
              placeholder="Descreva o erro encontrado em detalhes..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!errorType || !details.trim() || isSubmitting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isSubmitting ? "Enviando..." : "Enviar Relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
