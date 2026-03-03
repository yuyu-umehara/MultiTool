// @ts-nocheck
const vscode = acquireVsCodeApi();
const i18n = window.i18n || {};

let allTools = [];

window.addEventListener('load', () => {
  vscode.postMessage({ type: 'requestTools' });
});

window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'updateTools') {
    allTools = message.tools;
    renderTools(allTools, message.config);
  } else if (message.type === 'updateCustomUI') {
    renderCustomUI(message.html);
  }
});

function renderCustomUI(html) {
  const container = document.getElementById('custom-ui');
  if (!container) { return; }

  container.innerHTML = html;

  const scripts = container.getElementsByTagName('script');
  Array.from(scripts).forEach(script => {
    const newScript = document.createElement('script');
    Array.from(script.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    newScript.appendChild(document.createTextNode(script.innerHTML));
    script.parentNode.replaceChild(newScript, script);
  });
}

function renderTools(tools, config = {}) {
  const list = document.getElementById('tool-list');
  list.innerHTML = '';

  if (config.showDescriptions === false) {
    list.classList.add('hide-descriptions');
  } else {
    list.classList.remove('hide-descriptions');
  }

  if (tools.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-message';
    empty.textContent = i18n.noTools || 'No tools. Click + to add one.';
    list.appendChild(empty);
    return;
  }

  tools.forEach((tool, index) => {
    const btn = document.createElement('div');

    if (tool.id === 'builtin-calculator') {
      const calcContainer = document.createElement('div');
      calcContainer.className = 'calculator-container';
      calcContainer.dataset.index = index;
      setupDragEvents(calcContainer);

      calcContainer.innerHTML = `
        <div class="calculator">
          <div class="calc-display-container">
            <div class="calc-info-row">
               <div id="calc-memory" class="calc-memory"></div>
               <div id="calc-history" class="calc-history"></div>
            </div>
            <div id="calc-display" class="calc-display" tabindex="0">0</div>
          </div>
          <div class="calc-buttons">
            <button class="calc-btn clear" data-val="C">C</button>
            <button class="calc-btn" data-val="/">/</button>
            <button class="calc-btn" data-val="*">×</button>
            <button class="calc-btn" data-val="back">⌫</button>

            <button class="calc-btn" data-val="7">7</button>
            <button class="calc-btn" data-val="8">8</button>
            <button class="calc-btn" data-val="9">9</button>
            <button class="calc-btn operator" data-val="-">-</button>

            <button class="calc-btn" data-val="4">4</button>
            <button class="calc-btn" data-val="5">5</button>
            <button class="calc-btn" data-val="6">6</button>
            <button class="calc-btn operator" data-val="+">+</button>

            <button class="calc-btn" data-val="1">1</button>
            <button class="calc-btn" data-val="2">2</button>
            <button class="calc-btn" data-val="3">3</button>
            <button class="calc-btn equals" data-val="=">=</button>

            <button class="calc-btn" data-val="M">M</button>
            <button class="calc-btn" data-val="0">0</button>
            <button class="calc-btn" data-val=".">.</button>

            <button class="calc-btn dot-shift" data-val="dot-left">←.</button>
            <button class="calc-btn dot-shift" data-val="dot-right">.→</button>
            <button class="calc-btn" data-val="undo">↺</button>
            <button class="calc-btn" data-val="redo">↻</button>
          </div>
          <div class="calc-footer"></div>
        </div>
      `;

      list.appendChild(calcContainer);
      initCalculator(calcContainer);
      return;
    } else if (tool.isGroup) {
      btn.className = 'tool-group-header';
    } else {
      btn.className = 'tool-btn';
    }

    btn.dataset.id = tool.id;
    btn.dataset.index = index;
    setupDragEvents(btn);
    btn.title = tool.description || tool.name;

    const info = document.createElement('div');
    info.className = 'tool-info';

    const name = document.createElement('div');
    name.className = 'tool-name';
    name.textContent = tool.name;
    info.appendChild(name);

    if (tool.description) {
      const desc = document.createElement('div');
      desc.className = 'tool-description';
      desc.textContent = tool.description;
      info.appendChild(desc);
    }

    btn.appendChild(info);

    const editBtn = document.createElement('div');
    editBtn.className = 'edit-btn';
    editBtn.title = i18n.edit || 'Edit';
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 14.71l.36.36 5.24-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 7.94z"/></svg>`;

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      vscode.postMessage({ type: 'editTool', id: tool.id });
    });

    btn.appendChild(editBtn);

    if (!tool.isGroup) {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('.edit-btn')) { return; }
        e.preventDefault();
        vscode.postMessage({ type: 'executeTool', id: tool.id });
      });
    }

    list.appendChild(btn);
  });
}


let dragSrcEl = null;

function setupDragEvents(el) {
  el.draggable = true;
  el.addEventListener('dragstart', function(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
    this.classList.add('dragging');
  });
  el.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  });
  el.addEventListener('dragenter', function() {
    this.classList.add('over');
  });
  el.addEventListener('dragleave', function() {
    this.classList.remove('over');
  });
  el.addEventListener('drop', function(e) {
    e.stopPropagation();
    this.classList.remove('over');
    const target = this.closest('.tool-btn') || this.closest('.calculator-container') || this.closest('.tool-group-header');

    if (dragSrcEl && target && dragSrcEl !== target) {
      const fromIndex = parseInt(dragSrcEl.dataset.index);
      const toIndex = parseInt(target.dataset.index);
      vscode.postMessage({
        type: 'reorderTools',
        fromIndex: fromIndex,
        toIndex: toIndex
      });
    }
    return false;
  });
  el.addEventListener('dragend', function() {
    this.classList.remove('dragging');
    document.querySelectorAll('.tool-btn, .calculator-container, .tool-group-header').forEach(item => {
      item.classList.remove('over');
    });
  });
}

function initCalculator(container) {
  const display = container.querySelector('#calc-display');
  const history = container.querySelector('#calc-history');
  const memoryContainer = container.querySelector('#calc-memory');

  let currentExpression = '';
  let memories = [];

  const updateDisplay = (val) => {
    display.textContent = val || '0';
  };

  const updateHistory = (val) => {
    history.textContent = val || '';
  };

  const updateMemoryDisplay = () => {
    memoryContainer.innerHTML = '';
    memories.forEach(val => {
      const span = document.createElement('span');
      span.className = 'memory-item';
      span.textContent = val;
      span.title = i18n.clickToInput || 'Click to input';
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        handleInput(val);
        updateButtonStates();
      });
      memoryContainer.appendChild(span);
    });
  };

  let isResultDisplayed = false;
  let undoStack = [];
  let redoStack = [];
  let lastOp = null;
  let lastOperand = null;

  const saveState = () => {
    undoStack.push({
      expression: currentExpression,
      isResult: isResultDisplayed,
      historyContent: history.textContent
    });
    redoStack = [];
  };

  const handleInput = (val) => {
    if (val === 'C') {
      saveState();
      currentExpression = '';
      updateDisplay('0');
      updateHistory('');
      isResultDisplayed = false;
    } else if (val === 'back') {
      saveState();
      if (isResultDisplayed) {
        isResultDisplayed = false;
      }
      currentExpression = currentExpression.slice(0, -1);
      updateDisplay(currentExpression);
    } else if (val === 'M') {
      if (!currentExpression) { return; }
      if (/^-?\d+(\.\d+)?$/.test(currentExpression)) {
        if (memories.length >= 5) {
          memories.pop();
        }
        memories.unshift(currentExpression);
        updateMemoryDisplay();

        const originalBg = display.style.backgroundColor;
        display.style.backgroundColor = 'var(--vscode-editor-findMatchHighlightBackground)';
        setTimeout(() => {
          display.style.backgroundColor = originalBg;
        }, 200);
      }
    } else if (val === 'undo') {
      if (undoStack.length > 0) {
        redoStack.push({ expression: currentExpression, isResult: isResultDisplayed, historyContent: history.textContent });
        const prev = undoStack.pop();
        currentExpression = prev.expression;
        isResultDisplayed = prev.isResult;
        history.textContent = prev.historyContent;
        updateDisplay(currentExpression || '0');
      }
    } else if (val === 'redo') {
      if (redoStack.length > 0) {
        undoStack.push({ expression: currentExpression, isResult: isResultDisplayed, historyContent: history.textContent });
        const next = redoStack.pop();
        currentExpression = next.expression;
        isResultDisplayed = next.isResult;
        history.textContent = next.historyContent;
        updateDisplay(currentExpression || '0');
      }
    } else if (val === 'dot-left' || val === 'dot-right') {
      if (/^-?\d+(\.\d*)?$/.test(currentExpression)) {
        saveState();
        const neg = currentExpression.startsWith('-');
        const absStr = neg ? currentExpression.slice(1) : currentExpression;
        const dotIdx = absStr.indexOf('.');
        const actualDotIdx = dotIdx === -1 ? absStr.length : dotIdx;
        const digits = absStr.replace('.', '');
        const newDotIdx = val === 'dot-right' ? actualDotIdx + 1 : actualDotIdx - 1;
        let result;
        if (newDotIdx <= 0) {
          result = '0.' + '0'.repeat(-newDotIdx) + digits;
        } else if (newDotIdx >= digits.length) {
          result = digits + '0'.repeat(newDotIdx - digits.length);
        } else {
          result = digits.slice(0, newDotIdx) + '.' + digits.slice(newDotIdx);
        }
        if (result.includes('.')) {
          result = result.replace(/^0+(?=[1-9])/, '').replace(/^0*\./, '0.');
          result = result.replace(/\.?0+$/, '') || '0';
        } else {
          result = result.replace(/^0+/, '') || '0';
        }
        currentExpression = (neg ? '-' : '') + result;
        updateDisplay(currentExpression);
        isResultDisplayed = false;
      }
    } else if (val === '=') {
      try {
        if (isResultDisplayed && lastOp !== null) {
          saveState();
          const expr = currentExpression + lastOp + lastOperand;
          const result = new Function('return ' + expr)();
          let formatted = String(result);
          if (!Number.isInteger(result)) {
            formatted = parseFloat(result.toFixed(6)).toString();
          }
          updateHistory(expr + ' =');
          currentExpression = formatted;
          updateDisplay(formatted);
          isResultDisplayed = true;
        } else {
          if (!currentExpression) { return; }
          saveState();
          const match = currentExpression.match(/^.*?([+\-*/])(-?\d+\.?\d*)$/);
          if (match) {
            lastOp = match[1];
            lastOperand = match[2];
          } else {
            lastOp = null;
            lastOperand = null;
          }
          const result = new Function('return ' + currentExpression)();
          let formatted = String(result);
          if (!Number.isInteger(result)) {
            formatted = parseFloat(result.toFixed(6)).toString();
          }
          updateHistory(currentExpression + ' =');
          currentExpression = formatted;
          updateDisplay(formatted);
          isResultDisplayed = true;
        }
      } catch (e) {
        updateDisplay('Error');
        currentExpression = '';
        updateHistory('');
        isResultDisplayed = false;
        lastOp = null;
        lastOperand = null;
      }
    } else {
      saveState();
      const lastChar = currentExpression.slice(-1);

      if (val.length > 1) {
        if (isResultDisplayed) {
          currentExpression = val;
          isResultDisplayed = false;
        } else if (currentExpression === '0' || currentExpression === '') {
          currentExpression = val;
        } else {
          currentExpression += val;
        }
      } else {
        if (['+', '-', '*', '/'].includes(val)) {
          isResultDisplayed = false;
          if (['+', '-', '*', '/'].includes(lastChar)) {
            currentExpression = currentExpression.slice(0, -1) + val;
          } else {
            currentExpression += val;
          }
        } else {
          if (isResultDisplayed) {
            currentExpression = val;
            isResultDisplayed = false;
            updateHistory('');
          } else {
            if (currentExpression === '0' && val !== '.') {
              currentExpression = val;
            } else {
              currentExpression += val;
            }
          }
        }
      }
      updateDisplay(currentExpression);
    }
  };

  const updateButtonStates = () => {
    const isPureNumber = /^-?\d+(\.\d*)?$/.test(currentExpression);
    const isEmpty = currentExpression === '';
    const setDisabled = (dataVal, disabled) => {
      const btn = container.querySelector(`.calc-btn[data-val="${dataVal}"]`);
      if (btn) { btn.classList.toggle('disabled', disabled); }
    };
    setDisabled('undo', undoStack.length === 0);
    setDisabled('redo', redoStack.length === 0);
    setDisabled('dot-left', !isPureNumber);
    setDisabled('dot-right', !isPureNumber);
    setDisabled('back', isEmpty);
    setDisabled('C', isEmpty && history.textContent === '' && display.textContent !== 'Error');
    setDisabled('=', isEmpty);
    setDisabled('*', isEmpty);
    setDisabled('/', isEmpty);
    setDisabled('+', isEmpty);
    setDisabled('M', !isPureNumber);
  };

  container.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleInput(btn.dataset.val);
      display.focus();
      updateButtonStates();
    });
  });

  display.addEventListener('click', (e) => {
    e.stopPropagation();
    const text = display.textContent;
    if (text && text !== 'Error') {
      vscode.postMessage({
        type: 'copyToClipboard',
        text: text
      });

      const originalBg = display.style.backgroundColor;
      display.style.backgroundColor = 'var(--vscode-editor-findMatchHighlightBackground)';
      setTimeout(() => {
        display.style.backgroundColor = originalBg;
      }, 200);
    }
  });

  display.addEventListener('keydown', (e) => {
    const key = e.key;
    if (/[0-9]/.test(key)) {
      handleInput(key);
    } else if (['+', '-', '*', '/'].includes(key)) {
      handleInput(key);
    } else if (key === '.' || key === ',') {
      handleInput('.');
    } else if (key === 'Enter' || key === '=') {
      handleInput('=');
    } else if (key === 'Backspace') {
      handleInput('back');
    } else if (key === 'Escape' || key === 'c' || key === 'C' || key === 'Delete') {
      handleInput('C');
    } else if (key === 'm' || key === 'M') {
      handleInput('M');
    }
    updateButtonStates();
  });

  container.addEventListener('click', (e) => {
    if (e.target.closest('.calc-btn') || e.target.closest('.calc-display') || e.target.closest('.memory-item')) {
      return;
    }
    display.focus();
  });

  updateButtonStates();
}
