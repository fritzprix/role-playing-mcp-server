# MCP-UI Integration Guide

This document explains how MCP-UI (Model Context Protocol UI) has been integrated into SynapticFlow, allowing AI agents to return interactive web components directly in chat messages.

## 🎯 Overview

MCP-UI brings interactive web components to the Model Context Protocol. Instead of just returning text, MCP tools can now return rich UI resources that are rendered directly in the chat interface:

- **HTML Components**: Interactive HTML/CSS/JavaScript components rendered in sandboxed iframes
- **External URLs**: Web pages embedded safely with fallback to external links
- **Remote DOM**: Placeholder implementation ready for future @mcp-ui/client integration

## 🏗️ Architecture

### Data Flow

1. **Tool Execution**: MCP tool returns `UIResource` object in response
2. **Response Processing**: `ToolCaller` detects and preserves `UIResource` structures
3. **Message Storage**: `UIResource` is stored in `Message.uiResource` field
4. **Rendering**: `MessageBubbleRouter` routes to `UIResourceRenderer`
5. **Interaction**: UI actions are captured and converted back to tool calls

### Key Components

#### UIResource Type

```typescript
interface UIResource {
  uri?: string; // ui://... identifier
  mimeType: string; // 'text/html' | 'text/uri-list' | 'application/vnd.mcp-ui.remote-dom'
  text?: string; // Inline content
  blob?: string; // Base64-encoded content
}
```

#### Message Model Extension

```typescript
interface Message {
  // ... existing fields
  uiResource?: UIResource | UIResource[]; // NEW: UI resources
}
```

## 🛠️ Creating MCP-UI Tools

### HTML Component Example

```typescript
import { UIResource } from '@/models/chat';
import { MCPResponse, MCPUIResourceContent } from '@/lib/mcp-types';

function createInteractiveChart(): MCPResponse {
  const uiResource: UIResource = {
    uri: 'ui://charts/bar-chart',
    mimeType: 'text/html',
    text: `
      <div style="padding: 20px; font-family: sans-serif;">
        <h3>📊 Sales Data</h3>
        <div id="chart"></div>
        <button onclick="updateChart()">Update Data</button>
        
        <script>
          function updateChart() {
            // Send tool call back to host
            window.parent.postMessage({
              type: 'tool',
              payload: {
                toolName: 'refresh_sales_data',
                params: { period: 'last_month' }
              }
            }, '*');
          }
        </script>
      </div>
    `,
  };

  return {
    jsonrpc: '2.0',
    id: 'chart-tool-123',
    result: {
      content: [
        {
          type: 'resource',
          resource: uiResource,
        } as MCPUIResourceContent,
      ],
    },
  };
}
```

### External URL Example

```typescript
function createDocumentationViewer(url: string): MCPResponse {
  const uiResource: UIResource = {
    uri: 'ui://docs/viewer',
    mimeType: 'text/uri-list',
    text: url,
  };

  return {
    jsonrpc: '2.0',
    id: 'docs-viewer-123',
    result: {
      content: [
        {
          type: 'resource',
          resource: uiResource,
        } as MCPUIResourceContent,
      ],
    },
  };
}
```

## 🎮 UI Actions

UI components can interact with the host through standardized actions:

### Tool Calls

```javascript
// From within iframe/component
window.parent.postMessage(
  {
    type: 'tool',
    payload: {
      toolName: 'update_data',
      params: { id: 123, value: 'new_value' },
    },
  },
  '*',
);
```

### User Prompts

```javascript
window.parent.postMessage(
  {
    type: 'prompt',
    payload: {
      prompt: 'Please explain this data visualization',
    },
  },
  '*',
);
```

### Notifications

```javascript
window.parent.postMessage(
  {
    type: 'notify',
    payload: {
      message: 'Data updated successfully!',
    },
  },
  '*',
);
```

### External Links

```javascript
window.parent.postMessage(
  {
    type: 'link',
    payload: {
      url: 'https://example.com/docs',
    },
  },
  '*',
);
```

## 🔒 Security

### Iframe Sandboxing

All HTML content is rendered in sandboxed iframes with restricted permissions:

```html
<iframe
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
  srcdoc="..."
/>
```

### Content Security

- **Same-Origin Policy**: Components run in isolated context
- **Message Validation**: All postMessage communications are validated
- **Script Restrictions**: No access to parent window or host APIs
- **External URL Handling**: X-Frame-Options respected with fallback to external links

## 🧪 Testing

### Demo Tools

Use the built-in demo tools for testing:

```typescript
import { mcpUiDemoTools } from '@/examples/mcp-ui-demo';

// Create HTML demo
const htmlDemo = mcpUiDemoTools.createHtmlDemo();

// Create URL demo
const urlDemo = mcpUiDemoTools.createUrlDemo();

// Create mixed content demo
const mixedDemo = mcpUiDemoTools.createMixedDemo();
```

### Manual Testing

1. Create a tool that returns UIResource
2. Execute the tool in chat
3. Verify component renders correctly
4. Test UI interactions work
5. Check error handling for invalid resources

## 🎨 Best Practices

### Component Design

1. **Mobile Responsive**: Design for various screen sizes
2. **Accessibility**: Use semantic HTML and ARIA labels
3. **Performance**: Keep components lightweight
4. **Error Handling**: Handle missing data gracefully

### Security Guidelines

1. **Validate Input**: Always validate data from host
2. **Sanitize Content**: Clean any user-provided content
3. **Minimal Permissions**: Request only necessary iframe permissions
4. **Safe Defaults**: Fail safely when resources unavailable

### User Experience

1. **Loading States**: Show loading indicators
2. **Error Messages**: Provide clear error feedback
3. **Action Feedback**: Confirm user actions
4. **Intuitive Controls**: Use familiar UI patterns

## 🔧 Configuration

### Supported Content Types

Configure which resource types are allowed:

```typescript
<UIResourceRenderer
  resource={uiResource}
  supportedContentTypes={['rawHtml', 'externalUrl', 'remoteDom']}
  onUIAction={handleAction}
/>
```

### Iframe Properties

Customize iframe behavior:

```typescript
<UIResourceRenderer
  resource={uiResource}
  htmlProps={{
    style: { height: '600px' },
    iframeProps: {
      sandbox: 'allow-scripts allow-same-origin'
    },
    autoResizeIframe: true,
    iframeRenderData: { theme: 'dark', user: currentUser }
  }}
/>
```

## 🐛 Troubleshooting

### Common Issues

**UIResource not rendering:**

- Check `Message.uiResource` is populated
- Verify `mimeType` is supported
- Check console for React errors

**Iframe not loading:**

- Verify HTML is valid
- Check for Content Security Policy issues
- Ensure sandbox permissions are sufficient

**UI Actions not working:**

- Verify postMessage format is correct
- Check message event listeners are active
- Ensure action handlers are implemented

**External URLs blocked:**

- Check for X-Frame-Options header
- Verify URL is accessible
- Use fallback link rendering

### Debug Mode

Enable detailed logging:

```typescript
import { getLogger } from '@/lib/logger';
const logger = getLogger('UIResourceRenderer');
logger.setLevel('debug');
```

## 🚀 Future Enhancements

- **Official MCP-UI Client Integration**: Replace custom implementation with @mcp-ui/client
- **Remote DOM Integration**: Full remote-dom framework support
- **Component Libraries**: Pre-built component collections
- **Theme Support**: Automatic host theme propagation
- **State Persistence**: Component state preservation across renders
- **WebComponent Support**: Native web component rendering
- **Performance Optimization**: Virtual scrolling for large UIs

## 📋 Current Implementation Notes

The current implementation **uses the official @mcp-ui/client library** for UIResource rendering while maintaining full customization capabilities. Here's how external packages are used:

### 🔧 External Package Usage

#### ✅ Currently Used: @mcp-ui/client

- **Package**: `@mcp-ui/client: ^5.6.2` (installed and actively used)
- **Usage**:

  ```typescript
  import { UIResourceRenderer as ExternalUIResourceRenderer } from '@mcp-ui/client';
  ```

- **Purpose**: Official MCP-UI rendering with standard compliance
- **Location**: `src/components/ui/UIResourceRenderer.tsx`

#### ✅ Available: @mcp-ui/server

- **Package**: `@mcp-ui/server: ^5.2.0` (installed, ready for server-side usage)
- **Purpose**: Server-side UIResource creation utilities
- **Usage Example**:

  ```typescript
  import { createUIResource } from '@mcp-ui/server';

  const htmlResource = createUIResource({
    uri: 'ui://greeting/1',
    content: { type: 'rawHtml', htmlString: '<p>Hello, MCP UI!</p>' },
    encoding: 'text',
  });
  ```

#### 🚫 Not Used: @remote-dom/core

- **Status**: Not installed (would need manual installation)
- **Purpose**: Remote DOM framework for native component rendering
- **Would Enable**: `application/vnd.mcp-ui.remote-dom` support

### 💡 UIResource Creation Options

#### Option 1: Manual Creation (Currently Used)

```typescript
// Direct object creation - no external dependencies
const uiResource: UIResource = {
  uri: 'ui://charts/bar-chart',
  mimeType: 'text/html',
  text: '<div>Custom HTML content</div>',
};
```

#### Option 2: @mcp-ui/server Helper (Available)

```typescript
// Using official server utilities - recommended for standardization
import { createUIResource } from '@mcp-ui/server';

const uiResource = createUIResource({
  uri: 'ui://charts/bar-chart',
  content: { type: 'rawHtml', htmlString: '<div>Custom HTML content</div>' },
  encoding: 'text',
});
```

#### Option 3: Remote-DOM (Requires Installation)

```typescript
// Requires: npm install @remote-dom/core
import { createUIResource } from '@mcp-ui/server';

const remoteDomResource = createUIResource({
  uri: 'ui://remote-component/button',
  content: {
    type: 'remoteDom',
    script: `const button = document.createElement('ui-button');...`,
    framework: 'react',
  },
  encoding: 'text',
});
```

### 🎯 Recommendation for Export Feature

For the workspace export functionality, you can use either approach:

**Option A: Manual Creation (Simpler)**

```rust
// In Rust MCP server
let ui_resource = json!({
    "type": "resource",
    "resource": {
        "uri": format!("ui://export/file/{}", request_id),
        "mimeType": "text/html",
        "text": html_content
    }
});
```

**Option B: @mcp-ui/server (Standardized)**

```typescript
// If implementing in TypeScript/Node.js MCP server
import { createUIResource } from '@mcp-ui/server';

const exportUI = createUIResource({
  uri: `ui://export/file/${requestId}`,
  content: { type: 'rawHtml', htmlString: htmlContent },
  encoding: 'text',
});
```

The current SynapticFlow implementation **fully supports both approaches** since it uses the official @mcp-ui/client for rendering, ensuring complete compatibility with the MCP-UI standard.

## 📚 References

- [MCP-UI Documentation](https://mcpui.dev)
- [MCP Specification](https://modelcontextprotocol.io)
- [Iframe Security Guide](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#security_concerns)
- [PostMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
