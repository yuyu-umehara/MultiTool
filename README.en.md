# Multi Tool

**Multi Tool** is a VS Code extension that lets you define custom JavaScript functions to transform selected text, with a built-in calculator in the sidebar.

## Features

### Custom Text Transformation Tools
- Define tools with JavaScript functions that receive selected text as `text` and return the transformed result
- Supports `async/await` and `fetch` for network-based transformations
- Multi-cursor support: all selections are transformed simultaneously
- Optional "execute only when text is selected" guard to prevent accidental runs

### Built-in Calculator
- Always available in the sidebar
- Supports keyboard input (numpad-friendly)
- Memory storage (up to 5 values)
- Decimal point shift (`←.` / `.→`) for quick unit conversions
- Undo/Redo history
- Click the display to copy the result to clipboard

### Tool Management
- Add, edit, and delete tools from the sidebar
- Group tools with separators for better organization
- Drag & drop to reorder tools
- Edit JavaScript functions directly in the VS Code editor with live sync
- Install npm packages for use within tool functions

### Localization
- English and Japanese are built-in
- Other languages: contributions are welcome!

---

## Usage

### Creating a Tool

1. Click the **Multi Tool** icon in the Activity Bar
2. Click the **+** button in the toolbar
3. Enter a name and optional description
4. Write a JavaScript function in the editor:

```js
// Convert to uppercase
return text.toUpperCase();
```

5. Click **Save**

### Example Tools

**Base64 Encode**
```js
return Buffer.from(text).toString('base64');
```

**URL Decode**
```js
return decodeURIComponent(text);
```

**Sort Lines**
```js
return text.split('\n').sort().join('\n');
```

**Fetch & Transform (async)**
```js
const res = await fetch(`https://api.example.com/convert?q=${encodeURIComponent(text)}`);
const json = await res.json();
return json.result;
```

### Using the Calculator

- Click the **Multi Tool** icon to open the sidebar
- The calculator is always visible at the top
- Use keyboard shortcuts: `0-9`, `+ - * /`, `Enter` (=), `Backspace`, `Escape` (C), `M` (memory)
- Press `M` to store the current number (up to 5 slots)
- Use `←.` / `.→` to shift the decimal point left/right

---

## Extension Settings

No configuration required. Tool data is stored in VS Code's global state and persists across sessions.

---

## Contributing

Contributions are welcome, especially translations for additional languages.

Repository: [https://github.com/yuyu-umehara/MultiTool](https://github.com/yuyu-umehara/MultiTool)

---

## License

MIT
