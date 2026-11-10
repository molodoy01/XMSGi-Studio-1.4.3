import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useConfirm } from '@/components/useConfirm';
import { useLocale } from '@studio/lib/i18n';
import {
  createTemplate,
  deleteTemplate,
  mergeTemplateBackup,
  parseTemplateBackup,
  serializeTemplateBackup,
  TEMPLATE_IMPORT_MAX_BYTES,
  updateTemplate,
} from '../lib/templates';
import { saveTemplates } from '../lib/storage';
import { loadTemplatesWithDefault } from '../pages/WorkspacePageHelpers';
import type { Template } from '../types';

type WorkspaceTemplatesOptions = {
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
  setStageMode: Dispatch<SetStateAction<'editor' | 'schedule' | 'template' | 'draft' | 'chat'>>;
};

export function useWorkspaceTemplates({ showFeedback, setStageMode }: WorkspaceTemplatesOptions) {
  const { t } = useLocale();
  const confirm = useConfirm();
  const [initialTemplateState] = useState(loadTemplatesWithDefault);
  const [templates, setTemplates] = useState<Template[]>(initialTemplateState.templates);
  const importedTemplatesRef = useRef<Template[] | null>(null);
  const [templateStorageError, setTemplateStorageError] = useState(initialTemplateState.storageError);
  const [templateEditingId, setTemplateEditingId] = useState<string | null>(null);
  const [templateDraftName, setTemplateDraftName] = useState('');
  const [templateDraftBody, setTemplateDraftBody] = useState('');

  useEffect(() => {
    if (templateStorageError) {
      showFeedback(t('studio.templateStorageError'), 'warning');
      return;
    }

    if (importedTemplatesRef.current === templates) {
      importedTemplatesRef.current = null;
      return;
    }

    try {
      saveTemplates(templates);
    } catch {
      setTemplateStorageError(true);
    }
  }, [showFeedback, t, templateStorageError, templates]);

  const handleCreateTemplate = (input: Pick<Template, 'name' | 'body'>) => {
    setTemplates((current) => [
      createTemplate(input),
      ...current,
    ]);
  };

  const handleUpdateTemplate = (
    id: string,
    input: Pick<Template, 'name' | 'body'>,
  ) => {
    setTemplates((current) =>
      current.map((template) =>
        template.id === id ? updateTemplate(template, input) : template,
      ),
    );
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (!await confirm({
      message: t('studio.confirmDeleteTemplate', { name: template.name }),
      confirmLabel: t('common.remove'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    })) return;

    setTemplates((current) => deleteTemplate(current, template.id));
    showFeedback(t('studio.templateDeleted'), 'success');
  };

  const openTemplateEditor = (template?: Template) => {
    setStageMode('template');
    setTemplateEditingId(template?.id ?? 'new');
    setTemplateDraftName(template?.name ?? '');
    setTemplateDraftBody(template?.body ?? '');
  };

  const closeTemplateEditor = useCallback(() => {
    setTemplateEditingId(null);
    setTemplateDraftName('');
    setTemplateDraftBody('');
  }, []);

  const saveTemplateStage = () => {
    if (!templateDraftName.trim() || !templateDraftBody.trim()) return;

    if (templateEditingId === 'new') {
      handleCreateTemplate({ name: templateDraftName, body: templateDraftBody });
      showFeedback(t('studio.templateCreated'), 'success');
    } else if (templateEditingId) {
      handleUpdateTemplate(templateEditingId, {
        name: templateDraftName,
        body: templateDraftBody,
      });
      showFeedback(t('studio.templateUpdated'), 'success');
    }

    closeTemplateEditor();
  };

  const handleExportTemplates = () => {
    try {
      const backup = serializeTemplateBackup(templates);
      const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `xmsgi-templates-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      showFeedback(t('studio.templatesExported'), 'success');
    } catch (error) {
      showFeedback(
        error instanceof Error && error.message.includes('5 MB')
          ? t('studio.templateBackupTooLarge')
          : t('studio.templatesExportFailed'),
        'warning',
      );
    }
  };

  const handleImportTemplates = async (file: File) => {
    if (file.size > TEMPLATE_IMPORT_MAX_BYTES) {
      showFeedback(t('studio.templateBackupTooLarge'), 'warning');
      return;
    }

    try {
      const importedTemplates = parseTemplateBackup(await file.text());
      const mergedTemplates = mergeTemplateBackup(templates, importedTemplates);
      serializeTemplateBackup(mergedTemplates);
      saveTemplates(mergedTemplates);
      importedTemplatesRef.current = mergedTemplates;
      setTemplates(mergedTemplates);
      setTemplateStorageError(false);
      showFeedback(t('studio.templatesImported', { count: importedTemplates.length }), 'success');
    } catch (error) {
      showFeedback(
        error instanceof Error && error.message.includes('5 MB')
          ? t('studio.templateBackupTooLarge')
          : t('studio.templatesImportFailed'),
        'warning',
      );
    }
  };

  return {
    templates,
    templateEditingId,
    templateDraftName,
    setTemplateDraftName,
    templateDraftBody,
    setTemplateDraftBody,
    openTemplateEditor,
    closeTemplateEditor,
    saveTemplateStage,
    handleDeleteTemplate,
    handleExportTemplates,
    handleImportTemplates,
  };
}

export type WorkspacePageTemplates = ReturnType<typeof useWorkspaceTemplates>;
