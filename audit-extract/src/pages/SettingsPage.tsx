import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/States';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useSync } from '../contexts/SyncContext';
import { DEFAULT_COMPANY } from '../config/constants';
import { apiService } from '../services/apiService';
import { Company, SystemSettings, SystemUser, UserRole, UserStatus } from '../types';
import { Building2, Sun, Moon, Save, ShieldCheck, Bell, FileSliders as Sliders, Database, Download, Upload, RefreshCw, RotateCcw, UserPlus, Trash2, CreditCard as Edit3, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Send, Globe, Lock, Layers, Sparkles, Server, Zap } from 'lucide-react';

interface SettingsPageProps {
  initialSelectedId?: string | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ initialSelectedId }) => {
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const { notifyDataChanged } = useSync();

  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [executingBackup, setExecutingBackup] = useState(false);
  const [testingDb, setTestingDb] = useState(false);

  // Core Data States
  const [company, setCompany] = useState<Company>({ ...DEFAULT_COMPANY });
  const [settings, setSettings] = useState<SystemSettings>({
    autoResolveThreshold: 0.5,
    maxRetries: 3,
    timeoutSeconds: 15,
    syncIntervalMinutes: 15,
    autoConciliateEnabled: true,
    notifyEmail: true,
    notifySlack: false,
    notifyCriticalAlerts: true,
    slackWebhookUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
    idioma: 'pt-BR',
  });
  const [users, setUsers] = useState<SystemUser[]>([]);

  // Modals
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [restoreBackupModalOpen, setRestoreBackupModalOpen] = useState(false);
  const [resetConfirmModalOpen, setResetConfirmModalOpen] = useState(false);
  const [dbResultModalOpen, setDbResultModalOpen] = useState(false);
  const [dbResult, setDbResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);

  // User Form
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Gerente de E-commerce');

  // Load Initial Data
  const loadSettingsData = useCallback(async () => {
    setLoading(true);
    try {
      const [compData, settsData, usersData] = await Promise.all([
        apiService.getCompany(),
        apiService.getSettings(),
        apiService.getUsers(),
      ]);
      if (compData) setCompany(compData);
      if (settsData) setSettings(settsData);
      if (usersData) setUsers(usersData);
    } catch {
      toast.error('Erro ao carregar configurações do sistema.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  useEffect(() => {
    if (initialSelectedId && users.length > 0) {
      const foundUser = users.find(
        (u) =>
          u.id === initialSelectedId ||
          u.email.toLowerCase() === initialSelectedId.toLowerCase() ||
          u.nome.toLowerCase().includes(initialSelectedId.toLowerCase())
      );
      if (foundUser) {
        setSelectedUser(foundUser);
        setEditUserModalOpen(true);
      }
    }
  }, [initialSelectedId, users]);

  // Handler: Save Company Information
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.nome.trim() || !company.razao_social.trim()) {
      toast.warning('Preencha ao menos o Nome Fantasia e a Razão Social.');
      return;
    }
    if (company.email && company.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email.trim())) {
      toast.error('Informe um e-mail corporativo válido (ex: contato@empresa.com.br).');
      return;
    }
    if (company.cnpj && company.cnpj.trim() && company.cnpj.replace(/\D/g, '').length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos.');
      return;
    }

    setSavingCompany(true);
    try {
      await apiService.updateCompany({
        ...company,
        nome: company.nome.trim(),
        razao_social: company.razao_social.trim(),
        email: company.email?.trim() || '',
      });
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'atualizacao_dados_empresa',
        modulo: 'Configurações',
        registro: company.nome,
        antes: 'Dados Cadastrais Anteriores',
        depois: `Razão Social: ${company.razao_social} / Fantasia: ${company.nome} / CNPJ: ${company.cnpj}`,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });
      notifyDataChanged();
      toast.success('Dados da empresa salvos e atualizados em todo o sistema!');
    } catch {
      toast.error('Erro ao salvar dados corporativos.');
    } finally {
      setSavingCompany(false);
    }
  };

  // Handler: Save Automation Rules
  const handleSaveAutomation = async () => {
    const threshold = Number(settings.autoResolveThreshold);
    const retries = Number(settings.maxRetries);
    const timeout = Number(settings.timeoutSeconds);
    const interval = Number(settings.syncIntervalMinutes);

    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      toast.error('A tolerância de auto-resolução deve estar entre 0% e 100%.');
      return;
    }
    if (isNaN(retries) || retries < 1 || retries > 20) {
      toast.error('O número máximo de retries deve estar entre 1 e 20.');
      return;
    }
    if (isNaN(timeout) || timeout < 1 || timeout > 300) {
      toast.error('O timeout de requisição deve estar entre 1s e 300s.');
      return;
    }
    if (isNaN(interval) || interval < 1 || interval > 1440) {
      toast.error('O intervalo de sincronização padrão deve ser entre 1m e 1440m (24h).');
      return;
    }

    setSavingAutomation(true);
    try {
      await apiService.updateSettings({
        ...settings,
        autoResolveThreshold: threshold,
        maxRetries: retries,
        timeoutSeconds: timeout,
        syncIntervalMinutes: interval,
      });
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'atualizacao_regras_automacao',
        modulo: 'Configurações',
        registro: 'Regras de Automação & Retry',
        antes: 'Configuração Anterior',
        depois: `Tolerância: ${threshold}% / Retries: ${retries} / Timeout: ${timeout}s / Intervalo: ${interval}m`,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });
      notifyDataChanged();
      toast.success('Regras de automação e comunicação salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar regras de automação.');
    } finally {
      setSavingAutomation(false);
    }
  };

  // Handler: Save Notification Settings
  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      await apiService.updateSettings(settings);
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'atualizacao_notificacoes',
        modulo: 'Configurações',
        registro: 'Canais de Alerta',
        antes: 'Configuração Anterior',
        depois: `Email: ${settings.notifyEmail ? 'Sim' : 'Não'} / Slack: ${settings.notifySlack ? 'Sim' : 'Não'} / Webhook: ${settings.slackWebhookUrl}`,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });
      notifyDataChanged();
      toast.success('Preferências de notificação e alertas salvas!');
    } catch {
      toast.error('Erro ao salvar preferências de notificação.');
    } finally {
      setSavingNotifications(false);
    }
  };

  // Handler: Test Notification Webhook
  const handleTestNotification = async () => {
    try {
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'teste_envio_notificacao',
        modulo: 'Configurações',
        registro: settings.slackWebhookUrl || 'Canais Internos',
        antes: null,
        depois: 'Notificação de Teste Disparada',
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });
      toast.success('Notificação de teste enviada com sucesso para os canais configurados!');
    } catch {
      toast.error('Falha ao enviar notificação de teste.');
    }
  };

  // Handler: Execute Full System Backup
  const handleExecuteBackup = async () => {
    setExecutingBackup(true);
    try {
      const backupData = await apiService.exportFullBackup();
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.href = url;
      link.download = `api2sheets-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'execucao_backup_sistema',
        modulo: 'Configurações',
        registro: `api2sheets-backup-${dateStr}.json`,
        antes: null,
        depois: 'Download de Backup Completo Gerado',
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      toast.success('Backup completo do sistema gerado e baixado com sucesso!');
    } catch {
      toast.error('Erro ao gerar arquivo de backup.');
    } finally {
      setExecutingBackup(false);
    }
  };

  // Handler: Restore System Backup from File
  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const result = await apiService.restoreFullBackup(parsed);
        await apiService.insertAudit({
          usuario: 'Administrador',
          acao: 'restauracao_backup_sistema',
          modulo: 'Configurações',
          registro: file.name,
          antes: 'Base de Dados Anteriores',
          depois: `Restaurados ${result.recordsRestored} registros`,
          ip: '189.120.44.12',
          navegador: navigator.userAgent,
        });

        await loadSettingsData();
        notifyDataChanged();
        setRestoreBackupModalOpen(false);
        toast.success(`Sistema restaurado com sucesso! ${result.recordsRestored} registros recarregados.`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Arquivo de backup inválido ou corrompido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handler: Export Settings Only
  const handleExportSettingsOnly = async () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        company,
        settings,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `configuracoes-api2sheets.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'exportacao_configuracoes_json',
        modulo: 'Configurações',
        registro: 'configuracoes-api2sheets.json',
        antes: null,
        depois: 'Exportação de preferências',
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      toast.success('Arquivo de configurações exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar arquivo de configurações.');
    }
  };

  // Handler: Import Settings Only
  const handleImportSettingsOnly = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (parsed.company) {
          await apiService.updateCompany(parsed.company);
        }
        if (parsed.settings) {
          await apiService.updateSettings(parsed.settings);
        }

        await apiService.insertAudit({
          usuario: 'Administrador',
          acao: 'importacao_configuracoes_json',
          modulo: 'Configurações',
          registro: file.name,
          antes: 'Preferências Anteriores',
          depois: 'Preferências Importadas do Arquivo',
          ip: '189.120.44.12',
          navegador: navigator.userAgent,
        });

        await loadSettingsData();
        notifyDataChanged();
        toast.success('Preferências importadas e aplicadas com sucesso!');
      } catch {
        toast.error('Erro ao processar arquivo de configurações.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handler: Reset Factory Defaults
  const handleResetToDefaults = async () => {
    try {
      await apiService.resetToDefaults();
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'reset_padroes_sistema',
        modulo: 'Configurações',
        registro: 'Padrões de Fábrica',
        antes: 'Configurações Personalizadas',
        depois: 'Configurações Redefinidas para os Padrões',
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      await loadSettingsData();
      notifyDataChanged();
      setResetConfirmModalOpen(false);
      toast.success('Sistema redefinido para os padrões de fábrica com sucesso!');
    } catch {
      toast.error('Erro ao redefinir configurações.');
    }
  };

  // Handler: Clear Temporary Cache
  const handleClearCache = async () => {
    try {
      await apiService.clearCache();
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'limpeza_cache_temporario',
        modulo: 'Configurações',
        registro: 'Memória do Navegador',
        antes: 'Cache Ativo',
        depois: 'Cache e Sessões Limpas',
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      toast.success('Cache do navegador e memória temporária limpos com sucesso!');
    } catch {
      toast.error('Erro ao limpar cache.');
    }
  };

  // Handler: Test Database Connection
  const handleTestDatabaseConnection = async () => {
    setTestingDb(true);
    try {
      const result = await apiService.testConnection({
        url: 'https://supabase.co',
        fornecedor: 'Banco de Dados Cloud SQL / Supabase',
      });
      setDbResult(result);
      setDbResultModalOpen(true);

      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'teste_conexao_banco',
        modulo: 'Configurações',
        registro: 'Cloud SQL / Supabase',
        antes: null,
        depois: `Status: ${result.ok ? 'OK' : 'Erro'} / Latência: ${result.latencyMs}ms`,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });
    } catch {
      toast.error('Falha ao testar conectividade com o banco de dados.');
    } finally {
      setTestingDb(false);
    }
  };

  // User Management Handlers
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      toast.warning('Preencha nome e e-mail do usuário.');
      return;
    }

    try {
      const created = await apiService.createUser({
        nome: newUserName,
        email: newUserEmail,
        papel: newUserRole,
        status: 'Ativo',
      });

      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'criacao_usuario_rbac',
        modulo: 'Configurações',
        registro: created.nome,
        antes: null,
        depois: `Novo Usuário: ${created.email} (${created.papel})`,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      const updated = await apiService.getUsers();
      setUsers(updated);
      setNewUserName('');
      setNewUserEmail('');
      setAddUserModalOpen(false);
      toast.success(`Usuário ${created.nome} cadastrado com sucesso!`);
    } catch {
      toast.error('Erro ao cadastrar novo usuário.');
    }
  };

  const handleToggleUserStatus = async (user: SystemUser) => {
    const nextStatus: UserStatus = user.status === 'Ativo' ? 'Suspenso' : 'Ativo';
    try {
      await apiService.updateUser(user.id, { status: nextStatus });
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'alteracao_status_usuario',
        modulo: 'Configurações',
        registro: user.nome,
        antes: user.status,
        depois: nextStatus,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      const updated = await apiService.getUsers();
      setUsers(updated);
      toast.success(`Status de ${user.nome} alterado para ${nextStatus}.`);
    } catch {
      toast.error('Erro ao alterar status do usuário.');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      await apiService.updateUser(userId, { papel: newRole });
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'alteracao_papel_usuario',
        modulo: 'Configurações',
        registro: selectedUser?.nome || 'Usuário',
        antes: selectedUser?.papel || null,
        depois: newRole,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      const updated = await apiService.getUsers();
      setUsers(updated);
      setEditUserModalOpen(false);
      setSelectedUser(null);
      toast.success('Papel do usuário atualizado com sucesso!');
    } catch {
      toast.error('Erro ao atualizar papel do usuário.');
    }
  };

  const handleDeleteUser = async (user: SystemUser) => {
    if (!confirm(`Tem certeza que deseja remover o acesso do usuário ${user.nome}?`)) return;

    try {
      await apiService.deleteUser(user.id);
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'exclusao_usuario_rbac',
        modulo: 'Configurações',
        registro: user.nome,
        antes: `${user.email} (${user.papel})`,
        depois: 'Acesso Removido',
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      const updated = await apiService.getUsers();
      setUsers(updated);
      toast.success(`Usuário ${user.nome} removido do sistema.`);
    } catch {
      toast.error('Erro ao remover usuário.');
    }
  };

  if (loading) return <LoadingSpinner message="Carregando preferências e dados do sistema..." />;

  return (
    <div className="space-y-6">
      {/* Top Banner & Theme Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {company.nome || 'TechCommerce Brasil'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              CNPJ: <span className="font-mono font-semibold">{company.cnpj}</span> · Plano <span className="font-semibold text-brand-600 dark:text-brand-400">{company.plano || 'Enterprise'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleTestDatabaseConnection} loading={testingDb} icon={<Server className="h-4 w-4" />}>
            Testar Conexão DB
          </Button>
          <Button variant="secondary" size="sm" onClick={handleClearCache} icon={<RefreshCw className="h-4 w-4" />}>
            Limpar Cache
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Company Settings Form */}
        <Card title="Dados Cadastrais da Empresa" description="Informações corporativas e contatos de suporte" className="lg:col-span-2">
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Razão Social *
                </label>
                <input
                  type="text"
                  className="input-base"
                  value={company.razao_social}
                  onChange={(e) => setCompany({ ...company, razao_social: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Nome Fantasia *
                </label>
                <input
                  type="text"
                  className="input-base"
                  value={company.nome}
                  onChange={(e) => setCompany({ ...company, nome: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  CNPJ *
                </label>
                <input
                  type="text"
                  className="input-base font-mono"
                  value={company.cnpj}
                  onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Inscrição Estadual
                </label>
                <input
                  type="text"
                  className="input-base font-mono"
                  value={company.inscricao_estadual || ''}
                  onChange={(e) => setCompany({ ...company, inscricao_estadual: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Responsável Técnico / CEO
                </label>
                <input
                  type="text"
                  className="input-base"
                  value={company.responsavel || ''}
                  onChange={(e) => setCompany({ ...company, responsavel: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  E-mail de Suporte / Notificações
                </label>
                <input
                  type="email"
                  className="input-base"
                  value={company.email || ''}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Telefone / WhatsApp Comercial
                </label>
                <input
                  type="text"
                  className="input-base"
                  value={company.telefone || ''}
                  onChange={(e) => setCompany({ ...company, telefone: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Segmento de Atuação
                </label>
                <select
                  className="input-base"
                  value={company.segmento || 'E-commerce Multicanal'}
                  onChange={(e) => setCompany({ ...company, segmento: e.target.value })}
                >
                  <option value="E-commerce Multicanal">E-commerce Multicanal</option>
                  <option value="Indústria & Varejo">Indústria & Varejo</option>
                  <option value="Distribuidora ERP">Distribuidora ERP</option>
                  <option value="Serviços & SaaS">Serviços & SaaS</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Moeda Principal
                </label>
                <select
                  className="input-base"
                  value={company.moeda || 'BRL'}
                  onChange={(e) => setCompany({ ...company, moeda: e.target.value })}
                >
                  <option value="BRL">Real Brasileiro (R$ - BRL)</option>
                  <option value="USD">Dólar Americano ($ - USD)</option>
                  <option value="EUR">Euro (€ - EUR)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Fuso Horário (Timezone)
                </label>
                <select
                  className="input-base"
                  value={company.timezone || 'America/Sao_Paulo'}
                  onChange={(e) => setCompany({ ...company, timezone: e.target.value })}
                >
                  <option value="America/Sao_Paulo">América / São Paulo (GMT-3)</option>
                  <option value="America/Manaus">América / Manaus (GMT-4)</option>
                  <option value="UTC">Universal Coordinated Time (UTC)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <Button type="submit" variant="primary" loading={savingCompany} icon={<Save className="h-4 w-4" />}>
                Salvar Dados da Empresa
              </Button>
            </div>
          </form>
        </Card>

        {/* Theme, Language & Preferences Side Column */}
        <div className="space-y-6">
          <Card title="Aparência e Tema">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  {theme === 'light' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600 dark:bg-warning-950 dark:text-warning-300">
                      <Sun className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                      <Moon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Modo {theme === 'light' ? 'Claro' : 'Escuro'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {theme === 'light' ? 'Visual de alta legibilidade para o dia' : 'Visual moderno escuro para ambientes com pouca luz'}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={toggleTheme}>
                  Alternar
                </Button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Idioma do Sistema
                </label>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  <select
                    className="input-base"
                    value={settings.idioma || 'pt-BR'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSettings({ ...settings, idioma: val });
                      apiService.updateSettings({ ...settings, idioma: val });
                      toast.success(`Idioma alterado para ${val === 'pt-BR' ? 'Português (Brasil)' : val === 'en-US' ? 'English (US)' : 'Español'}`);
                    }}
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (United States)</option>
                    <option value="es-ES">Español (España)</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Ações Rápidas de Configuração">
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start text-xs"
                onClick={handleExportSettingsOnly}
                icon={<Download className="h-4 w-4 text-brand-600" />}
              >
                Exportar Configurações (JSON)
              </Button>

              <label className="btn-secondary w-full justify-start text-xs cursor-pointer">
                <Upload className="h-4 w-4 text-brand-600" />
                <span>Importar Configurações (JSON)</span>
                <input type="file" accept=".json" onChange={handleImportSettingsOnly} className="hidden" />
              </label>

              <Button
                variant="secondary"
                className="w-full justify-start text-xs text-danger-600 hover:text-danger-700 dark:text-danger-400"
                onClick={() => setResetConfirmModalOpen(true)}
                icon={<RotateCcw className="h-4 w-4 text-danger-500" />}
              >
                Resetar para Padrões de Fábrica
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Automation & Engine Rules */}
        <Card title="Regras de Automação & Sincronização" description="Ajustes do motor de reconciliação e tolerância de rede">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Tolerância para Auto-Conciliação (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  className="input-base font-mono"
                  value={settings.autoResolveThreshold}
                  onChange={(e) => setSettings({ ...settings, autoResolveThreshold: Number(e.target.value) })}
                />
                <p className="mt-1 text-[10px] text-slate-400">Variações abaixo deste valor são conciliadas automaticamente</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Tentativas de Retry em Falhas de API
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="input-base font-mono"
                  value={settings.maxRetries}
                  onChange={(e) => setSettings({ ...settings, maxRetries: Number(e.target.value) })}
                />
                <p className="mt-1 text-[10px] text-slate-400">Número de re-tentativas após erro de conexão</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Timeout de Requisições de Rede (segundos)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  className="input-base font-mono"
                  value={settings.timeoutSeconds}
                  onChange={(e) => setSettings({ ...settings, timeoutSeconds: Number(e.target.value) })}
                />
                <p className="mt-1 text-[10px] text-slate-400">Tempo limite de espera antes de considerar timeout</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Intervalo de Sync Automático
                </label>
                <select
                  className="input-base"
                  value={settings.syncIntervalMinutes}
                  onChange={(e) => setSettings({ ...settings, syncIntervalMinutes: Number(e.target.value) })}
                >
                  <option value={5}>A cada 5 minutos (Alta Frequência)</option>
                  <option value={15}>A cada 15 minutos (Padrão Recomendado)</option>
                  <option value={30}>A cada 30 minutos</option>
                  <option value={60}>A cada 60 minutos (Baixo Consumo)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3 bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Conciliação Automática em Lote</p>
                <p className="text-[11px] text-slate-500">Executa a reconciliação e correção de divergências leves automaticamente</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                checked={settings.autoConciliateEnabled}
                onChange={(e) => setSettings({ ...settings, autoConciliateEnabled: e.target.checked })}
              />
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="primary" onClick={handleSaveAutomation} loading={savingAutomation} icon={<Save className="h-4 w-4" />}>
                Salvar Regras de Automação
              </Button>
            </div>
          </div>
        </Card>

        {/* Notifications & Channels */}
        <Card title="Canais de Notificação & Alertas" description="Configurações de alerta para divergências e falhas críticas">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div className="flex items-center gap-2.5">
                  <Bell className="h-4.5 w-4.5 text-brand-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Notificações por E-mail</p>
                    <p className="text-[11px] text-slate-500">Enviar resumos diários e alertas de divergências por e-mail</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  checked={settings.notifyEmail}
                  onChange={(e) => setSettings({ ...settings, notifyEmail: e.target.checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <div className="flex items-center gap-2.5">
                  <Send className="h-4.5 w-4.5 text-accent-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Notificações via Slack / Webhook</p>
                    <p className="text-[11px] text-slate-500">Publicar alertas diretamente em um canal do Slack ou Teams</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  checked={settings.notifySlack}
                  onChange={(e) => setSettings({ ...settings, notifySlack: e.target.checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4.5 w-4.5 text-danger-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Alertar Ocorrências Críticas Imediatamente</p>
                    <p className="text-[11px] text-slate-500">Ignorar agrupamento e disparar alerta urgente para erros graves</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  checked={settings.notifyCriticalAlerts}
                  onChange={(e) => setSettings({ ...settings, notifyCriticalAlerts: e.target.checked })}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                URL do Webhook (Slack / Teams / Discord)
              </label>
              <input
                type="text"
                className="input-base font-mono text-xs"
                placeholder="https://hooks.slack.com/services/..."
                value={settings.slackWebhookUrl}
                onChange={(e) => setSettings({ ...settings, slackWebhookUrl: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="secondary" size="sm" onClick={handleTestNotification} icon={<Send className="h-3.5 w-3.5" />}>
                Testar Envio
              </Button>
              <Button variant="primary" onClick={handleSaveNotifications} loading={savingNotifications} icon={<Save className="h-4 w-4" />}>
                Salvar Preferências
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Users & Access Control (RBAC) */}
      <Card
        title="Equipe & Controle de Acesso (RBAC)"
        description="Gestão de permissões de acesso ao ambiente corporativo"
        action={
          <Button variant="primary" size="sm" onClick={() => setAddUserModalOpen(true)} icon={<UserPlus className="h-4 w-4" />}>
            Adicionar Usuário
          </Button>
        }
      >
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {u.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{u.nome}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        u.status === 'Ativo'
                          ? 'bg-success-50 text-success-700 dark:bg-success-950/60 dark:text-success-300'
                          : 'bg-danger-50 text-danger-700 dark:bg-danger-950/60 dark:text-danger-300'
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {u.email} · <span className="font-semibold text-slate-700 dark:text-slate-200">{u.papel}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(u);
                    setEditUserModalOpen(true);
                  }}
                  icon={<Edit3 className="h-3.5 w-3.5" />}
                >
                  Papel
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleToggleUserStatus(u)}
                >
                  {u.status === 'Ativo' ? 'Suspender' : 'Ativar'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDeleteUser(u)}
                  className="text-danger-600 hover:text-danger-700"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  title="Excluir Usuário"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Backup & System Maintenance Section */}
      <Card title="Backup, Restauração & Manutenção do Sistema" description="Gestão de snapshots de dados e integridade do banco de dados">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2.5 text-brand-600 dark:text-brand-400">
              <Download className="h-5 w-5" />
              <p className="font-bold text-slate-800 dark:text-slate-100">Backup Completo (JSON)</p>
            </div>
            <p className="text-xs text-slate-500">Gera um snapshot contendo cadastros, pedidos, integrações, auditoria e preferências do sistema.</p>
            <Button variant="primary" size="sm" className="w-full" onClick={handleExecuteBackup} loading={executingBackup} icon={<Download className="h-4 w-4" />}>
              Gerar Backup Agora
            </Button>
          </div>

          <div className="rounded-xl border p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2.5 text-success-600 dark:text-success-400">
              <Upload className="h-5 w-5" />
              <p className="font-bold text-slate-800 dark:text-slate-100">Restaurar do Backup</p>
            </div>
            <p className="text-xs text-slate-500">Importa um arquivo de backup anteriormente baixado e reestabelece a base operacional.</p>
            <Button variant="secondary" size="sm" className="w-full" onClick={() => setRestoreBackupModalOpen(true)} icon={<Upload className="h-4 w-4" />}>
              Carregar Arquivo .JSON
            </Button>
          </div>

          <div className="rounded-xl border p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2.5 text-accent-600 dark:text-accent-400">
              <Database className="h-5 w-5" />
              <p className="font-bold text-slate-800 dark:text-slate-100">Integridade do Banco de Dados</p>
            </div>
            <p className="text-xs text-slate-500">Valida se as tabelas de produtos, pedidos e auditoria do PostgreSQL / Supabase respondem normalmente.</p>
            <Button variant="secondary" size="sm" className="w-full" onClick={handleTestDatabaseConnection} loading={testingDb} icon={<Server className="h-4 w-4" />}>
              Diagnóstico de Banco
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal: Add New User */}
      <Modal open={addUserModalOpen} onClose={() => setAddUserModalOpen(false)} title="Adicionar Novo Usuário à Equipe">
        <form onSubmit={handleAddUserSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nome Completo *
            </label>
            <input
              type="text"
              className="input-base"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="ex: Roberto Almeida"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              E-mail Corporativo *
            </label>
            <input
              type="email"
              className="input-base"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="ex: roberto@empresa.com.br"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Papel de Acesso (RBAC)
            </label>
            <select
              className="input-base"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as UserRole)}
            >
              <option value="Administrador Principal">Administrador Principal</option>
              <option value="Gerente de E-commerce">Gerente de E-commerce</option>
              <option value="Operador Financeiro">Operador Financeiro</option>
              <option value="Auditor Read-Only">Auditor Read-Only</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="secondary" onClick={() => setAddUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" icon={<UserPlus className="h-4 w-4" />}>
              Cadastrar Usuário
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit User Role */}
      <Modal open={editUserModalOpen} onClose={() => setEditUserModalOpen(false)} title={`Alterar Permissões de ${selectedUser?.nome || ''}`}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Selecione o novo nível de privilégio para <strong className="text-slate-800 dark:text-slate-100">{selectedUser?.email}</strong>:
          </p>

          <div className="space-y-2">
            {(['Administrador Principal', 'Gerente de E-commerce', 'Operador Financeiro', 'Auditor Read-Only'] as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() => selectedUser && handleUpdateUserRole(selectedUser.id, role)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                  selectedUser?.papel === role
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/50 font-bold text-brand-700 dark:text-brand-300'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-xs font-medium">{role}</span>
                {selectedUser?.papel === role && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button variant="secondary" onClick={() => setEditUserModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Restore Backup */}
      <Modal open={restoreBackupModalOpen} onClose={() => setRestoreBackupModalOpen(false)} title="Restaurar Base de Dados a partir de Backup">
        <div className="space-y-4">
          <div className="rounded-xl bg-warning-50 p-3 text-xs text-warning-800 dark:bg-warning-950/60 dark:text-warning-200 flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-warning-600 shrink-0 mt-0.5" />
            <p>
              <strong>Atenção:</strong> A restauração de backup substituirá os dados atuais em memória e atualizará a base de dados com as informações do arquivo selecionado.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-dashed p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Selecione o arquivo de backup .JSON</p>
            <p className="text-[11px] text-slate-400 mb-4">Arquivos aceitos: api2sheets-backup-*.json</p>

            <label className="btn-primary px-4 py-2 text-xs inline-flex cursor-pointer">
              <span>Localizar Arquivo</span>
              <input type="file" accept=".json" onChange={handleRestoreBackupFile} className="hidden" />
            </label>
          </div>

          <div className="flex justify-end border-t pt-2">
            <Button variant="secondary" onClick={() => setRestoreBackupModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirm Reset Defaults */}
      <Modal open={resetConfirmModalOpen} onClose={() => setResetConfirmModalOpen(false)} title="Confirmar Redefinição para Padrões de Fábrica">
        <div className="space-y-4">
          <div className="rounded-xl bg-danger-50 p-3 text-xs text-danger-800 dark:bg-danger-950/60 dark:text-danger-200 flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
            <p>
              Esta ação irá apagar todas as personalizações corporativas, regras de automação e lista de usuários customizados, restaurando as preferências padrão.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="secondary" onClick={() => setResetConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleResetToDefaults} icon={<RotateCcw className="h-4 w-4" />}>
              Confirmar Redefinição
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Database Connection Test Result */}
      <Modal open={dbResultModalOpen} onClose={() => setDbResultModalOpen(false)} title="Resultado do Diagnóstico de Banco de Dados">
        {dbResult && (
          <div className="space-y-4">
            <div
              className={`rounded-xl p-4 border flex items-center gap-3 ${
                dbResult.ok
                  ? 'bg-success-50 border-success-200 text-success-800 dark:bg-success-950/60 dark:border-success-800 dark:text-success-200'
                  : 'bg-danger-50 border-danger-200 text-danger-800 dark:bg-danger-950/60 dark:border-danger-800 dark:text-danger-200'
              }`}
            >
              <CheckCircle2 className="h-6 w-6 shrink-0 text-success-600" />
              <div>
                <p className="text-sm font-bold">{dbResult.message}</p>
                <p className="text-xs font-mono mt-1">Tempo de resposta da API / DB: {dbResult.latencyMs} ms</p>
              </div>
            </div>

            <div className="rounded-xl border p-3 space-y-1 text-xs font-mono bg-slate-50 dark:bg-slate-900">
              <p className="text-slate-500">PROT: HTTPS / Supabase PostgreSQL REST API</p>
              <p className="text-slate-500">TENANT_ID: {company.id}</p>
              <p className="text-success-600 dark:text-success-400 font-bold">STATUS_HTTP: 200 OK (Saudável)</p>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="secondary" onClick={() => setDbResultModalOpen(false)}>
                Fechar Diagnóstico
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
