import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, Flag, Loader2, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Comment {
  id: string;
  content: string;
  user_id: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
  user_name?: string;
  user_vote?: 'up' | 'down' | null;
}

interface QuestionCommentsProps {
  questionId: string;
  isOpen: boolean;
}

export function QuestionComments({ questionId, isOpen }: QuestionCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, questionId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      // Load comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('question_comments')
        .select('*')
        .eq('question_id', questionId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;

      // Load user profiles for names
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // Load user votes if logged in
      let userVotes: Record<string, 'up' | 'down'> = {};
      if (userId) {
        const { data: votesData } = await supabase
          .from('question_comment_votes')
          .select('comment_id, vote_type')
          .eq('user_id', userId)
          .in('comment_id', commentsData?.map(c => c.id) || []);

        votesData?.forEach(v => {
          userVotes[v.comment_id] = v.vote_type as 'up' | 'down';
        });
      }

      const commentsWithNames = commentsData?.map(comment => ({
        ...comment,
        user_name: profiles?.find(p => p.user_id === comment.user_id)?.full_name || 
                   profiles?.find(p => p.user_id === comment.user_id)?.email?.split('@')[0] || 
                   'Usuário',
        user_vote: userVotes[comment.id] || null
      })) || [];

      setComments(commentsWithNames);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Erro ao carregar comentários');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !userId) {
      if (!userId) toast.error('Faça login para comentar');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('question_comments')
        .insert({
          question_id: questionId,
          user_id: userId,
          content: newComment.trim()
        });

      if (error) throw error;

      toast.success('Comentário adicionado!');
      setNewComment("");
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erro ao adicionar comentário');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (commentId: string, voteType: 'up' | 'down') => {
    if (!userId) {
      toast.error('Faça login para votar');
      return;
    }

    try {
      const comment = comments.find(c => c.id === commentId);
      const currentVote = comment?.user_vote;

      if (currentVote === voteType) {
        // Remove vote
        await supabase
          .from('question_comment_votes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);

        // Update comment counts
        await supabase
          .from('question_comments')
          .update({
            [voteType === 'up' ? 'upvotes' : 'downvotes']: Math.max(0, (comment?.[voteType === 'up' ? 'upvotes' : 'downvotes'] || 1) - 1)
          })
          .eq('id', commentId);
      } else {
        // Upsert vote
        await supabase
          .from('question_comment_votes')
          .upsert({
            comment_id: commentId,
            user_id: userId,
            vote_type: voteType
          }, { onConflict: 'comment_id,user_id' });

        // Update comment counts
        const updates: Record<string, number> = {
          [voteType === 'up' ? 'upvotes' : 'downvotes']: (comment?.[voteType === 'up' ? 'upvotes' : 'downvotes'] || 0) + 1
        };
        
        if (currentVote) {
          updates[currentVote === 'up' ? 'upvotes' : 'downvotes'] = Math.max(0, (comment?.[currentVote === 'up' ? 'upvotes' : 'downvotes'] || 1) - 1);
        }

        await supabase
          .from('question_comments')
          .update(updates)
          .eq('id', commentId);
      }

      loadComments();
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Erro ao registrar voto');
    }
  };

  const handleReport = (commentId: string) => {
    if (!userId) {
      toast.error('Faça login para denunciar');
      return;
    }
    setReportingCommentId(commentId);
    setReportDialogOpen(true);
  };

  const submitReport = async () => {
    if (!reportReason.trim() || !reportingCommentId || !userId) return;

    setSubmittingReport(true);
    try {
      const { error } = await supabase
        .from('question_comment_reports')
        .insert({
          comment_id: reportingCommentId,
          user_id: userId,
          reason: reportReason.trim()
        });

      if (error) throw error;

      toast.success('Denúncia enviada. Obrigado!');
      setReportDialogOpen(false);
      setReportReason("");
      setReportingCommentId(null);
    } catch (error) {
      console.error('Error reporting:', error);
      toast.error('Erro ao enviar denúncia');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('question_comments')
        .update({ is_active: false })
        .eq('id', commentId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Comentário removido');
      loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Erro ao remover comentário');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 space-y-4">
      <h4 className="font-semibold text-slate-700">Comentários</h4>

      {/* New Comment Form */}
      {userId && (
        <div className="flex gap-3">
          <Textarea
            placeholder="Adicione um comentário..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[60px] resize-none"
          />
          <Button
            onClick={handleSubmitComment}
            disabled={submitting || !newComment.trim()}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">Nenhum comentário ainda. Seja o primeiro!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                    {comment.user_name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-slate-800">{comment.user_name}</span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(comment.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{comment.content}</p>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-4 mt-2">
                    <button
                      onClick={() => handleVote(comment.id, 'up')}
                      className={cn(
                        "flex items-center gap-1 text-sm transition-colors",
                        comment.user_vote === 'up' ? "text-green-600" : "text-slate-400 hover:text-green-600"
                      )}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span>{comment.upvotes}</span>
                    </button>
                    <button
                      onClick={() => handleVote(comment.id, 'down')}
                      className={cn(
                        "flex items-center gap-1 text-sm transition-colors",
                        comment.user_vote === 'down' ? "text-red-600" : "text-slate-400 hover:text-red-600"
                      )}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      <span>{comment.downvotes}</span>
                    </button>
                    <button
                      onClick={() => handleReport(comment.id)}
                      className="flex items-center gap-1 text-sm text-slate-400 hover:text-orange-600 transition-colors"
                    >
                      <Flag className="h-4 w-4" />
                      <span>Denunciar</span>
                    </button>
                    {comment.user_id === userId && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="flex items-center gap-1 text-sm text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar Comentário</DialogTitle>
            <DialogDescription>
              Descreva o motivo da denúncia. Nossa equipe irá analisar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Motivo da denúncia</Label>
              <Textarea
                id="report-reason"
                placeholder="Descreva o motivo..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={submitReport} 
              disabled={submittingReport || !reportReason.trim()}
              className="bg-red-500 hover:bg-red-600"
            >
              {submittingReport ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar Denúncia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
