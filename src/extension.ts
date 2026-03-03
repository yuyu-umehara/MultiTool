import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { ToolEditorProvider } from './ToolEditorProvider';
import { ToolManager } from './ToolManager';


export function activate(context: vscode.ExtensionContext) {
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
