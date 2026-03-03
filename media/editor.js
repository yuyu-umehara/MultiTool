// @ts-nocheck
const vscode = acquireVsCodeApi();
const i18n = window.i18n || {};

const editorTitle = document.getElementById('editor-title');
const toolIdInput = document.getElementById('tool-id');
const toolOrderInput = document.getElementById('tool-order');
const toolNameInput = document.getElementById('tool-name');
const toolDescInput = document.getElementById('tool-description');
const toolFunctionInput = document.getElementById('tool-function');
const functionSection = document.getElementById('function-section');

const typeSelectGroup = document.querySelector('.type-select-group');
const onlySelectionCheckbox = document.getElementById('only-selection');
const settingGroup = document.querySelector('.setting-group');

const radioTool = document.querySelector('input[name="tool-type"][value="tool"]');
const radioGroup = document.querySelector('input[name="tool-type"][value="group"]');

const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const deleteBtn = document.getElementById('delete-btn');
const installBtn = document.getElementById('install-btn');
const libraryNameInput = document.getElementById('library-name');
const openEditorBtn = document.getElementById('open-editor-btn');

function updateFormVisibility() {
  const isGroup = radioGroup.checked;
  if (isGroup) {
    functionSection.style.display = 'none';
    if (settingGroup) { settingGroup.style.display = 'none'; }
  } else {
    functionSection.style.display = 'block';
    if (settingGroup) { settingGroup.style.display = 'block'; }
  }
}

radioTool.addEventListener('change', updateFormVisibility);
radioGroup.addEventListener('change', updateFormVisibility);

deleteBtn.addEventListener('click', () => {
  const toolId = toolIdInput.value;
  if (toolId) {
    vscode.postMessage({ type: 'deleteTool', id: toolId });
  }
});

toolFunctionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = toolFunctionInput.selectionStart;
    const end = toolFunctionInput.selectionEnd;
    toolFunctionInput.value =
      toolFunctionInput.value.substring(0, start) + '  ' + toolFunctionInput.value.substring(end);
    toolFunctionInput.selectionStart = toolFunctionInput.selectionEnd = start + 2;
  }
});

saveBtn.addEventListener('click', () => {
  const name = toolNameInput.value.trim();
  if (!name) {
    toolNameInput.style.borderColor = 'var(--vscode-errorForeground)';
    toolNameInput.focus();
    return;
  }

  const isGroup = radioGroup.checked;

  let functionBody = '';
  if (!isGroup) {
    functionBody = toolFunctionInput.value.trim();
    if (!functionBody) {
      toolFunctionInput.style.borderColor = 'var(--vscode-errorForeground)';
      toolFunctionInput.focus();
      return;
    }
  }

  const tool = {
    id: toolIdInput.value || '',
    name: name,
    description: toolDescInput.value.trim(),
    functionBody: functionBody,
    order: parseInt(toolOrderInput.value) || 0,
    isGroup: isGroup,
    onlyWithSelection: onlySelectionCheckbox.checked,
    createdAt: 0
  };

  vscode.postMessage({ type: 'saveTool', tool });
});

cancelBtn.addEventListener('click', () => {
  vscode.postMessage({ type: 'cancel' });
});

installBtn.addEventListener('click', () => {
  const packageName = libraryNameInput.value.trim();
  if (!packageName) {
    libraryNameInput.style.borderColor = 'var(--vscode-errorForeground)';
    libraryNameInput.focus();
    return;
  }

  vscode.postMessage({ type: 'installPackage', packageName });
  libraryNameInput.value = '';
});

toolNameInput.addEventListener('input', () => {
  toolNameInput.style.borderColor = '';
});
toolFunctionInput.addEventListener('input', () => {
  toolFunctionInput.style.borderColor = '';
});
libraryNameInput.addEventListener('input', () => {
  libraryNameInput.style.borderColor = '';
});

openEditorBtn.addEventListener('click', () => {
  const functionBody = toolFunctionInput.value;
  vscode.postMessage({ type: 'openInEditor', functionBody });
});

window.addEventListener('message', event => {
  const message = event.data;

  switch (message.type) {
    case 'loadTool': {
      const tool = message.tool;
      editorTitle.textContent = tool.isGroup
        ? (i18n.editGroup || 'Edit group: ').replace('{0}', '').trim() + tool.name
        : (i18n.editTool || 'Edit tool: ').replace('{0}', '').trim() + tool.name;

      if (typeSelectGroup) {
        typeSelectGroup.style.display = 'none';
      }

      toolIdInput.value = tool.id;
      toolOrderInput.value = tool.order;
      toolNameInput.value = tool.name;
      toolDescInput.value = tool.description || '';
      if (onlySelectionCheckbox) {
        onlySelectionCheckbox.checked = !!tool.onlyWithSelection;
      }

      if (tool.isGroup) {
        radioGroup.checked = true;
        toolFunctionInput.value = '';
      } else {
        radioTool.checked = true;
        toolFunctionInput.value = tool.functionBody || '';
      }
      updateFormVisibility();

      if (!tool.isBuiltIn) {
        deleteBtn.style.display = 'block';
      } else {
        deleteBtn.style.display = 'none';
      }
      break;
    }
    case 'newTool': {
      editorTitle.textContent = i18n.new || 'New';

      if (typeSelectGroup) {
        typeSelectGroup.style.display = 'block';
      }

      toolIdInput.value = '';
      toolOrderInput.value = '0';
      toolNameInput.value = '';
      toolDescInput.value = '';
      toolFunctionInput.value = '';
      if (onlySelectionCheckbox) {
        onlySelectionCheckbox.checked = true;
      }
      radioTool.checked = true;
      updateFormVisibility();
      deleteBtn.style.display = 'none';
      break;
    }
    case 'installResult': {
      if (message.success) {
        installBtn.textContent = i18n.done || '✓ Done';
        setTimeout(() => {
          installBtn.textContent = i18n.install || 'Install';
        }, 2000);
      }
      break;
    }
    case 'updateFunctionBody': {
      toolFunctionInput.value = message.functionBody;
      break;
    }
  }
});

vscode.postMessage({ type: 'ready' });
