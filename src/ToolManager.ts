import * as vscode from 'vscode';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  functionBody: string;
  order: number;
  isGroup?: boolean;
  onlyWithSelection?: boolean;
  type?: 'script' | 'calculator';
  createdAt: number;
}

export class ToolManager {
  private static readonly STORAGE_KEY = 'multiTool.tools';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public getTools(): ToolItem[] {
    const stored = this.context.globalState.get<ToolItem[]>(ToolManager.STORAGE_KEY);
    let tools = stored || [];

    if (!tools.find((t: ToolItem) => t.id === 'builtin-calculator')) {
      tools.push({
        id: 'builtin-calculator',
        name: vscode.l10n.t('Calculator'),
        description: vscode.l10n.t('A handy calculator tool'),
        functionBody: '',
        order: tools.length,
        type: 'calculator',
        createdAt: Date.now()
      });
      this.saveTools(tools);
    }

    return tools.sort((a: ToolItem, b: ToolItem) => a.order - b.order);
  }

  public async saveTools(tools: ToolItem[]): Promise<void> {
    await this.context.globalState.update(ToolManager.STORAGE_KEY, tools);
  }

  public async addTool(tool: ToolItem): Promise<void> {
    const tools = this.getTools();
    tool.order = tools.length;
    tools.push(tool);
    await this.saveTools(tools);
  }

  public async updateTool(tool: ToolItem): Promise<void> {
    const tools = this.getTools();
    const index = tools.findIndex(t => t.id === tool.id);
    if (index !== -1) {
      tools[index] = tool;
      await this.saveTools(tools);
    }
  }

  public async deleteTool(id: string): Promise<boolean> {
    const tools = this.getTools();
    if (id === 'builtin-calculator') {
      vscode.window.showWarningMessage(vscode.l10n.t('This tool cannot be deleted.'));
      return false;
    }
    const filtered = tools.filter(t => t.id !== id);
    await this.saveTools(filtered);
    return true;
  }

  public getTool(id: string): ToolItem | undefined {
    return this.getTools().find(t => t.id === id);
  }

  public async executeTool(tool: ToolItem, text: string, vscodeApi?: any, sidebarApi?: any): Promise<string | null> {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('text', 'fetch', 'vscode', 'sidebar', tool.functionBody);
      const result = await fn(text, (globalThis as any).fetch, vscodeApi, sidebarApi);
      if (result === undefined || result === null) {
        return null;
      }
      return String(result);
    } catch (e: any) {
      vscode.window.showErrorMessage(vscode.l10n.t("Error running tool '{0}': {1}", tool.name, e.message));
      return null;
    }
  }

  public async reorderTools(fromIndex: number, toIndex: number): Promise<void> {
    const tools = this.getTools();
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex < tools.length && toIndex < tools.length) {
      const [moved] = tools.splice(fromIndex, 1);
      tools.splice(toIndex, 0, moved);
      tools.forEach((t, i) => { t.order = i; });
      await this.saveTools(tools);
    }
  }
}
