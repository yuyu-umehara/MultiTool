import * as vscode from 'vscode';
import { getNonce } from './utils';
import { ToolManager, ToolItem } from './ToolManager';

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly toolManager: ToolManager,
    private readonly onEditTool: (tool?: ToolItem) => void,
    private readonly context: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'requestTools': {
          this.sendTools();
          break;
        }
        case 'executeTool': {
          await this.executeToolById(data.id);
          break;
        }
        case 'showContextMenu': {
          const tool = this.toolManager.getTool(data.id);
          if (!tool) { return; }

          const edit = vscode.l10n.t('Edit');
          const del = vscode.l10n.t('Delete');
          const selection = await vscode.window.showQuickPick([edit, del], {
            placeHolder: vscode.l10n.t('Tool: {0}', tool.name)
          });

          if (selection === edit) {
            this.onEditTool(tool);
          } else if (selection === del) {
            const yes = vscode.l10n.t('Yes');
            const answer = await vscode.window.showWarningMessage(
              vscode.l10n.t('Are you sure you want to delete this tool?'), yes, vscode.l10n.t('No')
            );
            if (answer === yes) {
              const deleted = await this.toolManager.deleteTool(data.id);
              if (deleted) {
                this.sendTools();
              }
            }
          }
          break;
        }
        case 'editTool': {
          const tool = this.toolManager.getTool(data.id);
          if (tool) {
            this.onEditTool(tool);
          }
          break;
        }
        case 'deleteTool': {
          const yes = vscode.l10n.t('Yes');
          const answer = await vscode.window.showWarningMessage(
            vscode.l10n.t('Are you sure you want to delete this tool?'),
            yes, vscode.l10n.t('No')
          );
          if (answer === yes) {
            const deleted = await this.toolManager.deleteTool(data.id);
            if (deleted) {
              this.sendTools();
            }
          }
          break;
        }
        case 'addTool': {
          this.onEditTool();
          break;
        }
        case 'reorderTools': {
          await this.toolManager.reorderTools(data.fromIndex, data.toIndex);
          this.sendTools();
          break;
        }
        case 'copyToClipboard': {
          await vscode.env.clipboard.writeText(data.text);
          vscode.window.showInformationMessage(vscode.l10n.t('Copied to clipboard'));
          break;
        }
      }
    });
  }

  public sendTools(): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateTools',
        tools: this.toolManager.getTools(),
        config: {
          showDescriptions: this.context.globalState.get<boolean>('showDescriptions', true)
        }
      });
    }
  }

  public async toggleDescriptions(): Promise<void> {
    const current = this.context.globalState.get<boolean>('showDescriptions', true);
    await this.context.globalState.update('showDescriptions', !current);
    this.sendTools();
  }

  private async executeToolById(toolId: string): Promise<void> {
    const tool = this.toolManager.getTool(toolId);
    if (!tool) {
      vscode.window.showErrorMessage(vscode.l10n.t('Tool not found.'));
      return;
    }

    if (tool.isGroup) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(vscode.l10n.t('Please open a text editor.'));
      return;
    }

    const selections = editor.selections;

    if (!selections || selections.length === 0) {
      vscode.window.showWarningMessage(vscode.l10n.t('No cursor position.'));
      return;
    }

    if (tool.onlyWithSelection) {
      const hasSelection = selections.some(s => !s.isEmpty);
      if (!hasSelection) {
        vscode.window.showInformationMessage(vscode.l10n.t('Please select text to transform.'));
        return;
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Running '{0}'...", tool.name),
        cancellable: false
      },
      async () => {
        try {
          const results = await Promise.all(
            selections.map(selection => {
              const selectedText = editor.document.getText(selection);
              const sidebarApi = {
                showUI: (html: string) => {
                  if (this._view) {
                    this._view.webview.postMessage({
                      type: 'updateCustomUI',
                      html: html
                    });
                  }
                }
              };

              return this.toolManager.executeTool(tool, selectedText, vscode, sidebarApi);
            })
          );

          const hasChanges = results.some(r => r !== null);
          if (hasChanges) {
            await editor.edit(editBuilder => {
              for (let i = 0; i < selections.length; i++) {
                if (results[i] !== null) {
                  editBuilder.replace(selections[i], results[i] as string);
                }
              }
            });
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(vscode.l10n.t('Tool execution error: {0}', error.message));
        }
      }
    );
  }

  private getHtml(webview: vscode.Webview): string {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'reset.css')
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'vscode.css')
    );
    const styleSidebarUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.js')
    );

    const nonce = getNonce();

    const i18n = {
      noTools: vscode.l10n.t('No tools. Click + to add one.'),
      edit: vscode.l10n.t('Edit'),
      clickToInput: vscode.l10n.t('Click to input')
    };

    const lang = vscode.env.language.startsWith('ja') ? 'ja' : 'en';

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}' 'unsafe-eval';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleResetUri}" rel="stylesheet">
  <link href="${styleVSCodeUri}" rel="stylesheet">
  <link href="${styleSidebarUri}" rel="stylesheet">
</head>
<body>
  <div id="tool-list" class="tool-list"></div>
  <div id="custom-ui" class="custom-ui"></div>
  <script nonce="${nonce}">window.i18n = ${JSON.stringify(i18n)};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
