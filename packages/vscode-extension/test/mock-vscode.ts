import Module from "module";

export const mockState = {
  activeApiKey: "aimem_live_w3AqVs-Z89tHAx1JJlnRaEojPYk8GOct",
  config: {
    "aimemory.apiUrl": "http://localhost:3000",
    "aimemory.autoResolve": true,
    "aimemory.contextBudget": 8000,
    "aimemory.enableStatusBar": true,
    "aimemory.logLevel": "INFO",
  } as Record<string, any>,
  executedCommands: [] as Array<{ command: string; args: any[] }>,
  registeredCommands: new Map<string, (...args: any[]) => any>(),
  secrets: new Map<string, string>(),
};

export class MockTreeItem {
  constructor(
    public label?: string,
    public collapsibleState: number = 0
  ) {}
  tooltip?: any;
  description?: string;
  contextValue?: string;
  command?: any;
}

export class MockEventEmitter {
  private listeners: Array<() => void> = [];
  event = (listener: () => void) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  fire() {
    for (const l of this.listeners) l();
  }
}

export class MockDisposable {
  constructor(private callOnDispose?: () => void) {}
  dispose() {
    this.callOnDispose?.();
  }
}

export class MockMarkdownString {
  constructor(public value: string) {}
}

export const mockVscode = {
  TreeItem: MockTreeItem,
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ThemeColor: class {
    constructor(public id: string) {}
  },
  EventEmitter: MockEventEmitter,
  Disposable: MockDisposable,
  MarkdownString: MockMarkdownString,
  Uri: {
    parse: (str: string) => ({
      toString: () => str,
      fsPath: str.replace(/^file:\/\/\/?/, ""),
    }),
    file: (fspath: string) => ({
      toString: () => `file:///${fspath.replace(/\\/g, "/")}`,
      fsPath: fspath,
    }),
  },
  window: {
    createOutputChannel: (name: string) => ({
      name,
      appendLine: () => {},
      append: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    createStatusBarItem: (alignment: number, priority: number) => ({
      alignment,
      priority,
      text: "",
      tooltip: "",
      command: undefined as string | undefined,
      backgroundColor: undefined,
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    createTreeView: (viewId: string, options: any) => ({
      viewId,
      ...options,
      dispose: () => {},
    }),
    showInformationMessage: async (msg: string, ...actions: string[]) => actions[0],
    showWarningMessage: async (msg: string, ...actions: string[]) => actions[0],
    showErrorMessage: async (msg: string, ...actions: string[]) => actions[0],
    showInputBox: async (options: any) => options.value || "mock-input",
    showQuickPick: async (items: any[]) => items[0],
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: () => new MockDisposable(),
  },
  workspace: {
    isTrusted: true,
    workspaceFolders: [
      {
        uri: {
          fsPath: "d:\\Freelance\\AiMemorySync",
          toString: () => "file:///d:/Freelance/AiMemorySync",
        },
        name: "AiMemorySync",
        index: 0,
      },
    ],
    getConfiguration: () => ({
      get: (key: string, def?: any) => mockState.config[key] ?? def,
      has: (key: string) => key in mockState.config,
    }),
    getWorkspaceFolder: () => mockVscode.workspace.workspaceFolders[0],
    onDidChangeWorkspaceFolders: () => new MockDisposable(),
    onDidGrantWorkspaceTrust: () => new MockDisposable(),
  },
  commands: {
    registerCommand: (command: string, callback: (...args: any[]) => any) => {
      mockState.registeredCommands.set(command, callback);
      return new MockDisposable(() => mockState.registeredCommands.delete(command));
    },
    executeCommand: async (command: string, ...args: any[]) => {
      mockState.executedCommands.push({ command, args });
      const handler = mockState.registeredCommands.get(command);
      if (handler) {
        return handler(...args);
      }
    },
  },
  env: {
    clipboard: {
      text: "",
      writeText: async (text: string) => {
        mockVscode.env.clipboard.text = text;
      },
      readText: async () => mockVscode.env.clipboard.text,
    },
    openExternal: async (uri: any) => true,
  },
  version: "1.85.0",
};

// Intercept require("vscode")
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...rest: any[]) {
  if (id === "vscode") {
    return mockVscode;
  }
  return originalRequire.apply(this, [id, ...rest]);
};
