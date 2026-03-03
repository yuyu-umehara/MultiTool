import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SidebarProvider } from './SidebarProvider';
import { ToolEditorProvider } from './ToolEditorProvider';
import { ToolManager } from './ToolManager';
import { ToolItem } from './ToolManager';

const MIGRATION_FLAG = 'multiTool.migrated_from_v0';

async function runMigrationIfNeeded(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(MIGRATION_FLAG)) { return; }

  const migrationFile = path.join(os.tmpdir(), 'multitool_migration.json');
  if (!fs.existsSync(migrationFile)) { return; }

  try {
    const imported: ToolItem[] = JSON.parse(fs.readFileSync(migrationFile, 'utf8'));
    const stored = context.globalState.get<ToolItem[]>('multiTool.tools') || [];

    // 既存IDと重複しないものだけ追加
    const existingIds = new Set(stored.map(t => t.id));
    const toAdd = imported.filter(t => !existingIds.has(t.id));

    // 先頭に挿入し、order を振り直す
    const merged = [...toAdd, ...stored];
    merged.forEach((t, i) => { t.order = i; });

    await context.globalState.update('multiTool.tools', merged);
    await context.globalState.update(MIGRATION_FLAG, true);

    fs.unlinkSync(migrationFile);
  } catch {
    // 移行失敗は無視（通常動作を妨げない）
  }
}

export function activate(context: vscode.ExtensionContext) {
  runMigrationIfNeeded(context);

  const toolManager = new ToolManager(context);

  let toolEditorProvider: ToolEditorProvider;

  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    toolManager,
    (tool) => {
      toolEditorProvider.openEditor(tool);
    },
    context
  );

  toolEditorProvider = new ToolEditorProvider(
    context.extensionUri,
    toolManager,
    () => {
      sidebarProvider.sendTools();
    }
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'multi-tool-sidebar',
      sidebarProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multi-tool.addTool', () => {
      toolEditorProvider.openEditor();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multi-tool.editTool', (item: any) => {
      const toolId = typeof item === 'string' ? item : item?.toolId;
      if (!toolId) { return; }

      const tool = toolManager.getTool(toolId);
      if (tool) {
        toolEditorProvider.openEditor(tool);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multi-tool.deleteTool', async (item: any) => {
      const toolId = typeof item === 'string' ? item : item?.toolId;
      if (!toolId) { return; }

      const yes = vscode.l10n.t('Yes');
      const answer = await vscode.window.showWarningMessage(
        vscode.l10n.t('Are you sure you want to delete this tool?'),
        yes, vscode.l10n.t('No')
      );
      if (answer === yes) {
        const deleted = await toolManager.deleteTool(toolId);
        if (deleted) {
          sidebarProvider.sendTools();
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multi-tool.toggleDescriptions', () => {
      sidebarProvider.toggleDescriptions();
    })
  );

}

export function deactivate() {}
