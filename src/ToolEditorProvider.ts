import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getNonce } from './utils';
import { ToolManager, ToolItem } from './ToolManager';

export class ToolEditorProvider {
  private panel: vscode.WebviewPanel | undefined;
  private tempFileWatcher: vscode.Disposable | undefined;
  private tempFilePath: string | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly toolManager: ToolManager,
    private readonly onToolSaved: () => void
  ) {}

  public openEditor(tool?: ToolItem): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      if (tool) {
        this.panel.webview.postMessage({ type: 'loadTool', tool });
      } else {
        this.panel.webview.postMessage({ type: 'newTool' });
      }
      return;
    }

    const panelTitle = tool
      ? (tool.isGroup
        ? vscode.l10n.t('Edit group: {0}', tool.name)
        : vscode.l10n.t('Edit tool: {0}', tool.name))
      : vscode.l10n.t('New tool');

    this.panel = vscode.window.createWebviewPanel(
      'multi-tool-editor',
      panelTitle,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
        retainContextWhenHidden: true
      }
    );

    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'ready': {
          if (tool) {
            this.panel?.webview.postMessage({ type: 'loadTool', tool });
          }
          break;
        }
        case 'saveTool': {
          const toolData: ToolItem = data.tool;
          if (toolData.id) {
            await this.toolManager.updateTool(toolData);
            vscode.window.showInformationMessage(vscode.l10n.t("Tool '{0}' updated.", toolData.name));
          } else {
            toolData.id = Date.now().toString();
            toolData.createdAt = Date.now();
            await this.toolManager.addTool(toolData);
            vscode.window.showInformationMessage(vscode.l10n.t("Tool '{0}' added.", toolData.name));
          }
          this.onToolSaved();
          this.panel?.dispose();
          break;
        }
        case 'cancel': {
          this.panel?.dispose();
          break;
        }
        case 'installPackage': {
          await this.installNpmPackage(data.packageName);
          break;
        }
        case 'deleteTool': {
          const toolId = data.id;
          if (toolId) {
            const del = vscode.l10n.t('Delete');
            const answer = await vscode.window.showWarningMessage(
              vscode.l10n.t('Are you sure you want to delete this tool? (permanent)'),
              del, vscode.l10n.t('Cancel')
            );
            if (answer === del) {
              const deleted = await this.toolManager.deleteTool(toolId);
              if (deleted) {
                vscode.window.showInformationMessage(vscode.l10n.t('Tool deleted.'));
                this.onToolSaved();
                this.panel?.dispose();
              }
            }
          }
          break;
        }
        case 'openInEditor': {
          await this.openFunctionInEditor(data.functionBody);
          break;
        }
      }
    });
  }

  private async openFunctionInEditor(functionBody: string): Promise<void> {
    const os = require('os');
    const tmpDir = path.join(os.tmpdir(), 'multi-tool-editor');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    this.tempFilePath = path.join(tmpDir, `tool-function-${Date.now()}.js`);

    const separator = vscode.l10n.t('// --- Edit below this line ---');
    const headerLines = [
      vscode.l10n.t('// Tool function editor'),
      vscode.l10n.t("// The argument 'text' receives the selected text. Use return to return the result."),
      vscode.l10n.t('// Saving will automatically reflect in the tool editor.'),
      separator
    ];
    const content = headerLines.join('\n') + '\n' + functionBody;
    fs.writeFileSync(this.tempFilePath, content, 'utf8');

    const tempFileUri = vscode.Uri.file(this.tempFilePath);

    const doc = await vscode.workspace.openTextDocument(tempFileUri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

    if (this.tempFileWatcher) {
      this.tempFileWatcher.dispose();
    }

    const panel = this.panel;
    this.tempFileWatcher = vscode.workspace.onDidSaveTextDocument((savedDoc) => {
      if (savedDoc.uri.toString() === tempFileUri.toString()) {
        const savedContent = savedDoc.getText();
        const separatorIndex = savedContent.indexOf(separator);
        let body: string;
        if (separatorIndex !== -1) {
          const afterSeparator = separatorIndex + separator.length;
          body = savedContent.substring(afterSeparator);
          if (body.startsWith('\r\n')) {
            body = body.substring(2);
          } else if (body.startsWith('\n')) {
            body = body.substring(1);
          }
        } else {
          body = savedContent;
        }

        panel?.webview.postMessage({
          type: 'updateFunctionBody',
          functionBody: body
        });
      }
    });
  }

  private async installNpmPackage(packageName: string): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage(vscode.l10n.t('No workspace is open.'));
      return;
    }

    const cwd = folders[0].uri.fsPath;
    const fs = require('fs');
    const path = require('path');

    const packageDir = path.join(cwd, 'node_modules', packageName);
    if (fs.existsSync(packageDir)) {
      const yes = vscode.l10n.t('Yes');
      const answer = await vscode.window.showInformationMessage(
        vscode.l10n.t("Package '{0}' is already installed. Reinstall?", packageName),
        yes, vscode.l10n.t('No')
      );
      if (answer !== yes) {
        this.panel?.webview.postMessage({
          type: 'installResult',
          success: true,
          packageName,
          alreadyInstalled: true
        });
        return;
      }
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Installing package '{0}'...", packageName),
        cancellable: false
      },
      async () => {
        return new Promise<void>((resolve, reject) => {
          const cp = require('child_process');
          cp.exec(
            `npm install ${packageName}`,
            { cwd },
            (error: any, stdout: string, stderr: string) => {
              if (error) {
                vscode.window.showErrorMessage(vscode.l10n.t('Installation failed: {0}', error.message));
                reject(error);
              } else {
                vscode.window.showInformationMessage(vscode.l10n.t("Package '{0}' installed.", packageName));
                this.panel?.webview.postMessage({
                  type: 'installResult',
                  success: true,
                  packageName
                });
                resolve();
              }
            }
          );
        });
      }
    );
  }

  private getHtml(webview: vscode.Webview): string {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'reset.css')
    );
    const styleEditorUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'editor.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'editor.js')
    );

    const nonce = getNonce();

    const t = vscode.l10n.t.bind(vscode.l10n);
    const i18n = {
      newTool: t('New tool'),
      editTool: t('Edit tool: {0}', ''),
      editGroup: t('Edit group: {0}', ''),
      new: t('New'),
      done: t('\u2713 Done'),
      install: t('Install')
    };

    const lang = vscode.env.language.startsWith('ja') ? 'ja' : 'en';

    const placeholder = t('// Example: convert to uppercase\nreturn text.toUpperCase();')
      .replace(/\n/g, '&#10;');

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleResetUri}" rel="stylesheet">
  <link href="${styleEditorUri}" rel="stylesheet">
  <title>${t('Edit tool')}</title>
</head>
<body>
  <div class="editor-container">
    <h2 id="editor-title" class="editor-title">${t('Create new tool')}</h2>
    <input type="hidden" id="tool-id" value="" />
    <input type="hidden" id="tool-order" value="0" />

    <div class="form-group type-select-group">
      <label>${t('Type')}</label>
      <div class="radio-group">
        <label>
          <input type="radio" name="tool-type" value="tool" checked> ${t('Tool')}
        </label>
        <label>
          <input type="radio" name="tool-type" value="group"> ${t('Group (separator)')}
        </label>
      </div>
    </div>

    <div class="form-group">
      <label for="tool-name">${t('Name')} <span class="required">*</span></label>
      <input type="text" id="tool-name" placeholder="${t('Tool name or group name')}" />
    </div>

    <div class="form-group">
      <label for="tool-description">${t('Description')}</label>
      <input type="text" id="tool-description" placeholder="${t('Description (shown as tooltip)')}" />
    </div>

    <div id="function-section">
      <div class="form-group">
        <label for="tool-function">${t('Transform function (JavaScript)')} <span class="required">*</span></label>
        <div class="function-hint">
          ${t('The argument {0} receives the selected text. Use {1} to return the result.', '<code>text</code>', '<code>return</code>')}
        </div>
        <textarea id="tool-function" rows="12" placeholder="${placeholder}"></textarea>
        <div class="textarea-actions">
          <button id="open-editor-btn" class="btn btn-link" type="button">${t('Edit in editor \u2197')}</button>
        </div>
      </div>

      <div class="form-group setting-group">
        <label class="checkbox-label">
          <input type="checkbox" id="only-selection" checked />
          ${t('Execute only when text is selected (prevents accidental execution)')}
        </label>
      </div>

      <div class="divider"></div>

      <div class="form-group library-group">
        <label>${t('Library management')}</label>
        <div class="library-row">
          <input type="text" id="library-name" placeholder="${t('npm package name (e.g., lodash)')}" />
          <button id="install-btn" class="btn btn-secondary">${t('Install')}</button>
        </div>
        <div class="library-hint">
          ${t('Installed to workspace node_modules.\nUse {0} in the function.', "<code>require('package-name')</code>")}
        </div>
      </div>
    </div>

    <div class="button-row">
      <button id="delete-btn" class="btn btn-danger" style="display: none; margin-right: auto;">${t('Delete')}</button>
      <button id="cancel-btn" class="btn btn-secondary">${t('Cancel')}</button>
      <button id="save-btn" class="btn btn-primary">${t('Save')}</button>
    </div>
  </div>

  <script nonce="${nonce}">window.i18n = ${JSON.stringify(i18n)};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
