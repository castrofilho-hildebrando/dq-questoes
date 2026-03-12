import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { Question } from "@/hooks/useQuestions";
import { cn } from "@/lib/utils";
import { sanitizeHTML } from "@/hooks/useSanitizedHTML";

interface QuestionDetailViewProps {
  question: Question;
  onSubmitAnswer: (questionId: string, answer: string) => Promise<{ isCorrect: boolean; correctAnswer: string; profComment: string | null } | null>;
  onClose: () => void;
}

const optionColors: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-white' },
  B: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-white' },
  C: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-white' },
  D: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-white' },
  E: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-white' },
  V: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-white' },
  F: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-white' },
};

export function QuestionDetailView({ question, onSubmitAnswer, onClose }: QuestionDetailViewProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(question.user_answered);
  const [isCorrect, setIsCorrect] = useState(question.user_is_correct);
  const [correctAnswer, setCorrectAnswer] = useState<string | undefined>(question.answer);
  const [profComment, setProfComment] = useState<string | null | undefined>(question.prof_comment);

  const options = [
    { key: 'A', value: question.option_a },
    { key: 'B', value: question.option_b },
    { key: 'C', value: question.option_c },
    { key: 'D', value: question.option_d },
    { key: 'E', value: question.option_e },
  ].filter(opt => opt.value);

  const isTrueFalse = question.question_type === 'tf';

  const handleSubmit = async () => {
    if (!selectedAnswer) return;

    setIsSubmitting(true);
    const result = await onSubmitAnswer(question.id, selectedAnswer);
    
    if (result !== null) {
      setHasSubmitted(true);
      setIsCorrect(result.isCorrect);
      setCorrectAnswer(result.correctAnswer);
      setProfComment(result.profComment);
    }
    setIsSubmitting(false);
  };

  const OptionCircle = ({ letter }: { letter: string }) => {
    const colors = optionColors[letter] || optionColors.A;
    return (
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0",
        colors.bg,
        colors.text
      )}>
        {letter}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-100 px-6 py-4 rounded-t-lg border-b border-slate-200">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {/* Question code and discipline breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600 font-medium">{question.code}</span>
              {question.discipline_name && (
                <>
                  <span className="text-slate-400">›</span>
                  <span className="text-slate-600">{question.discipline_name}</span>
                </>
              )}
              {question.topic_name && (
                <>
                  <span className="text-slate-400">›</span>
                  <span className="text-slate-600">{question.topic_name}</span>
                </>
              )}
            </div>
            
            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {question.year && (
                <span>
                  <span className="text-slate-700 font-medium">Ano:</span>{' '}
                  <span className="text-slate-600">{question.year}</span>
                </span>
              )}
              {question.banca_name && (
                <span>
                  <span className="text-slate-700 font-medium">Banca:</span>{' '}
                  <span className="text-blue-600 hover:underline cursor-pointer">{question.banca_name}</span>
                </span>
              )}
              {question.orgao_name && (
                <span>
                  <span className="text-slate-700 font-medium">Órgão:</span>{' '}
                  <span className="text-blue-600 hover:underline cursor-pointer">{question.orgao_name}</span>
                </span>
              )}
            </div>
            
            {/* Prova line */}
            {question.prova_name && (
              <div className="text-sm">
                <span className="text-slate-700 font-medium">Prova:</span>{' '}
                <span className="text-blue-600 hover:underline cursor-pointer">{question.prova_name}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Question Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Question Text */}
        <div 
          className="text-slate-800 leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHTML(question.question) }}
        />

        {/* Answer Options */}
        {isTrueFalse ? (
          <RadioGroup
            value={selectedAnswer}
            onValueChange={setSelectedAnswer}
            disabled={hasSubmitted}
            className="space-y-3"
          >
            {['V', 'F'].map((option) => (
              <div
                key={option}
                className={cn(
                  "flex items-center gap-4 py-2 cursor-pointer",
                  hasSubmitted && correctAnswer === option && "font-medium"
                )}
                onClick={() => !hasSubmitted && setSelectedAnswer(option)}
              >
                <RadioGroupItem value={option} id={`option-${option}`} className="hidden" />
                <OptionCircle letter={option} />
                <Label 
                  htmlFor={`option-${option}`}
                  className="flex-1 cursor-pointer text-slate-700 text-base"
                >
                  {option === 'V' ? 'Verdadeiro (Certo)' : 'Falso (Errado)'}
                </Label>
              </div>
            ))}
          </RadioGroup>
        ) : (
          <RadioGroup
            value={selectedAnswer}
            onValueChange={setSelectedAnswer}
            disabled={hasSubmitted}
            className="space-y-4"
          >
            {options.map((option) => (
              <div
                key={option.key}
                className={cn(
                  "flex items-start gap-4 cursor-pointer",
                  hasSubmitted && correctAnswer === option.key && "font-medium"
                )}
                onClick={() => !hasSubmitted && setSelectedAnswer(option.key)}
              >
                <RadioGroupItem value={option.key} id={`option-${option.key}`} className="hidden" />
                <OptionCircle letter={option.key} />
                <Label 
                  htmlFor={`option-${option.key}`}
                  className="flex-1 cursor-pointer text-slate-700 text-base leading-relaxed pt-1"
                >
                  {option.value}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {/* Submit Button */}
        {!hasSubmitted && (
          <div className="flex justify-center pt-2">
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedAnswer || isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white px-10 py-2 rounded-full font-medium"
            >
              {isSubmitting ? "Enviando..." : "Responder"}
            </Button>
          </div>
        )}
      </div>

      {/* Answer Feedback Section */}
      {hasSubmitted && (
        <div className="px-6 pb-6 space-y-4">
          {/* Gabarito Box */}
          <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
            <h4 className="text-slate-800 font-semibold mb-1">Gabarito</h4>
            <p className={cn(
              "font-medium",
              isCorrect ? "text-green-600" : "text-red-600"
            )}>
              Letra {correctAnswer}
            </p>
          </div>

          {/* Gabarito Comentado */}
          {profComment && (
            <div>
              <span className="inline-block px-3 py-1 text-sm font-medium text-green-700 border border-green-600 rounded-full mb-3">
                Gabarito Comentado
              </span>
              
              <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                <div 
                  className="text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-strong:text-slate-900"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(profComment) }}
                />
              </div>
            </div>
          )}

          {/* Related Content */}
          {question.related_contents && (
            <div className="bg-amber-50 rounded-lg p-5 border border-amber-100">
              <h4 className="text-amber-900 font-semibold mb-2">Conteúdo Relacionado</h4>
              <p className="text-amber-800 text-sm">{question.related_contents}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
