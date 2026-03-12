import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Save, Mail, Eye, RefreshCw, Plus, Copy, Package } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  body_html: string;
  description: string | null;
  available_variables: string | null;
  is_active: boolean;
  product_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
}

const templateLabels: Record<string, string> = {
  trial_welcome: 'Email de Boas-vindas (Trial)',
  trial_expiration: 'Email de Expiração',
  password_recovery: 'Recuperação de Senha',
  authorized_welcome: 'Email de Boas-vindas',
};

const templateIcons: Record<string, string> = {
  trial_welcome: '👋',
  trial_expiration: '⏰',
  password_recovery: '🔐',
  authorized_welcome: '✉️',
};

export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, Partial<EmailTemplate>>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateProduct, setNewTemplateProduct] = useState<string>("");
  const [duplicateFrom, setDuplicateFrom] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('template_type');

      if (error) throw error;
      setTemplates((data || []) as any as EmailTemplate[]);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('product_definitions' as any)
        .select('id, name, slug')
        .eq('is_active', true)
        .order('created_at');
      if (error) throw error;
      setProducts((data || []) as any as Product[]);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchProducts();
  }, []);

  const handleChange = (templateId: string, field: keyof EmailTemplate, value: string) => {
    setEditedTemplates(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [field]: value,
      },
    }));
  };

  const getEditedValue = (template: EmailTemplate, field: keyof EmailTemplate): string => {
    const edited = editedTemplates[template.id];
    if (edited && field in edited) {
      return edited[field] as string;
    }
    return template[field] as string;
  };

  const hasChanges = (templateId: string): boolean => {
    return !!editedTemplates[templateId] && Object.keys(editedTemplates[templateId]).length > 0;
  };

  const toggleActive = async (template: EmailTemplate) => {
    setTogglingId(template.id);
    try {
      const newActive = !template.is_active;
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active: newActive })
        .eq('id', template.id);

      if (error) throw error;

      setTemplates(prev =>
        prev.map(t => t.id === template.id ? { ...t, is_active: newActive } : t)
      );
      toast.success(newActive ? 'Envio de email ativado' : 'Envio de email desativado');
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Erro ao alterar status');
    } finally {
      setTogglingId(null);
    }
  };

  const saveTemplate = async (template: EmailTemplate) => {
    const changes = editedTemplates[template.id];
    if (!changes) return;

    setSaving(template.id);
    try {
      const { error } = await supabase
        .from('email_templates')
        .update(changes)
        .eq('id', template.id);

      if (error) throw error;

      toast.success('Template salvo com sucesso!');
      
      setTemplates(prev =>
        prev.map(t =>
          t.id === template.id ? { ...t, ...changes } : t
        )
      );
      
      setEditedTemplates(prev => {
        const newState = { ...prev };
        delete newState[template.id];
        return newState;
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
    } finally {
      setSaving(null);
    }
  };

  const handleCreateProductTemplate = async () => {
    if (!newTemplateProduct) {
      toast.error("Selecione um produto");
      return;
    }

    setCreating(true);
    try {
      let subject = "Bem-vindo(a) ao {{product_name}}!";
      let bodyHtml = "<h1>Bem-vindo(a)!</h1><p>Você agora tem acesso ao <strong>{{product_name}}</strong>.</p><p>Acesse a plataforma: <a href='{{platform_url}}'>{{platform_url}}</a></p>";
      let availableVars = "{{email}}, {{platform_url}}, {{product_name}}";

      // If duplicating from existing
      if (duplicateFrom) {
        const source = templates.find(t => t.id === duplicateFrom);
        if (source) {
          subject = source.subject;
          bodyHtml = source.body_html;
          availableVars = source.available_variables || availableVars;
        }
      }

      const { error } = await supabase
        .from('email_templates')
        .insert({
          template_type: 'authorized_welcome',
          subject,
          body_html: bodyHtml,
          description: `Template de boas-vindas específico para o produto`,
          available_variables: availableVars,
          is_active: true,
          product_id: newTemplateProduct,
        } as any);

      if (error) throw error;

      toast.success("Template criado com sucesso!");
      setCreateDialogOpen(false);
      setNewTemplateProduct("");
      setDuplicateFrom("");
      fetchTemplates();
    } catch (error: any) {
      console.error("Error creating template:", error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const getPreviewHtml = (template: EmailTemplate): string => {
    let html = getEditedValue(template, 'body_html');
    
    const exampleValues: Record<string, string> = {
      '{{name}}': 'João Silva',
      '{{email}}': 'joao@exemplo.com',
      '{{expires_at}}': '10/01/2026',
      '{{time_remaining}}': '2 dias',
      '{{upgrade_url}}': '#',
      '{{reset_url}}': '#',
      '{{expires_in}}': '1 hora',
      '{{platform_url}}': 'https://db-questoes.dissecandoquestoes.com/auth',
      '{{product_name}}': 'Dossiê IF',
    };

    Object.entries(exampleValues).forEach(([variable, value]) => {
      html = html.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return html;
  };

  const getProductName = (productId: string | null) => {
    if (!productId) return null;
    return products.find(p => p.id === productId)?.name || productId;
  };

  // Group templates: generic first, then by product
  const genericTemplates = templates.filter(t => !t.product_id);
  const productTemplates = templates.filter(t => !!t.product_id);

  // Products that already have an authorized_welcome template
  const productsWithTemplate = new Set(
    productTemplates
      .filter(t => t.template_type === 'authorized_welcome')
      .map(t => t.product_id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderTemplateEditor = (template: EmailTemplate) => (
    <div className="space-y-6" key={template.id}>
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <Switch
            checked={template.is_active}
            onCheckedChange={() => toggleActive(template)}
            disabled={togglingId === template.id}
          />
          <div>
            <p className="font-medium text-sm">
              {template.is_active ? 'Envio ativado' : 'Envio desativado'}
            </p>
            <p className="text-xs text-muted-foreground">
              {template.is_active
                ? 'Este email será enviado automaticamente'
                : 'Este email não será enviado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {template.product_id && (
            <Badge variant="outline" className="gap-1">
              <Package className="w-3 h-3" />
              {getProductName(template.product_id)}
            </Badge>
          )}
          {!template.is_active && (
            <Badge variant="secondary" className="text-xs">Inativo</Badge>
          )}
        </div>
      </div>

      {template.description && (
        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
          ℹ️ {template.description}
        </p>
      )}

      {template.available_variables && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Variáveis disponíveis:</span>
          {template.available_variables.split(', ').map(variable => (
            <Badge key={variable} variant="outline" className="font-mono text-xs">
              {variable}
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={`subject-${template.id}`}>Assunto do Email</Label>
        <Input
          id={`subject-${template.id}`}
          value={getEditedValue(template, 'subject')}
          onChange={(e) => handleChange(template.id, 'subject', e.target.value)}
          placeholder="Assunto do email"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`body-${template.id}`}>Corpo do Email (HTML)</Label>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Pré-visualizar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Pré-visualização do Email</DialogTitle>
              </DialogHeader>
              <div className="border rounded-lg p-4 bg-white">
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-muted-foreground">Assunto:</p>
                  <p className="font-medium">{getEditedValue(template, 'subject').replace(/\{\{[^}]+\}\}/g, match => {
                    const exampleValues: Record<string, string> = {
                      '{{name}}': 'João Silva',
                      '{{time_remaining}}': '2 dias',
                      '{{product_name}}': 'Dossiê IF',
                    };
                    return exampleValues[match] || match;
                  })}</p>
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml(template) }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Textarea
          id={`body-${template.id}`}
          value={getEditedValue(template, 'body_html')}
          onChange={(e) => handleChange(template.id, 'body_html', e.target.value)}
          placeholder="HTML do email"
          className="min-h-[400px] font-mono text-sm"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() => saveTemplate(template)}
          disabled={!hasChanges(template.id) || saving === template.id}
        >
          {saving === template.id ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Templates de Email
              </CardTitle>
              <CardDescription>
                Edite os templates de email enviados automaticamente pelo sistema. 
                Templates específicos por produto têm prioridade sobre o genérico.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Template por Produto
              </Button>
              <Button variant="outline" size="sm" onClick={fetchTemplates}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum template encontrado
            </p>
          ) : (
            <Tabs defaultValue={templates[0]?.id} className="w-full">
              <TabsList className="w-full justify-start mb-4 flex-wrap h-auto gap-1">
                {genericTemplates.map(template => (
                  <TabsTrigger
                    key={template.id}
                    value={template.id}
                    className="flex items-center gap-2"
                  >
                    <span>{templateIcons[template.template_type] || '📧'}</span>
                    {templateLabels[template.template_type] || template.template_type}
                    {hasChanges(template.id) && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        editado
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
                {productTemplates.map(template => (
                  <TabsTrigger
                    key={template.id}
                    value={template.id}
                    className="flex items-center gap-2"
                  >
                    <Package className="w-3 h-3" />
                    {getProductName(template.product_id)}
                    {hasChanges(template.id) && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        editado
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {templates.map(template => (
                <TabsContent key={template.id} value={template.id}>
                  {renderTemplateEditor(template)}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Create Product Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Criar Template de Boas-vindas por Produto
            </DialogTitle>
            <DialogDescription>
              Crie um template específico de boas-vindas para um produto. 
              Quando um aluno comprar esse produto, receberá este email ao invés do genérico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={newTemplateProduct} onValueChange={setNewTemplateProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter(p => !productsWithTemplate.has(p.id))
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {products.filter(p => !productsWithTemplate.has(p.id)).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todos os produtos já possuem templates de boas-vindas.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Duplicar conteúdo de (opcional)</Label>
              <Select value={duplicateFrom} onValueChange={setDuplicateFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="Começar do zero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Começar do zero</SelectItem>
                  {templates
                    .filter(t => t.template_type === 'authorized_welcome')
                    .map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.product_id ? getProductName(t.product_id) : 'Genérico'} — {t.subject}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateProductTemplate} disabled={creating || !newTemplateProduct}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Criar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
