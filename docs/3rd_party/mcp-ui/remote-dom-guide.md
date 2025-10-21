# RemoteDOMResourceRenderer Component

The `<RemoteDOMResourceRenderer />` component is used to render UI resources with the `application/vnd.mcp-ui.remote-dom` mime type. It leverages Shopify's [`remote-dom`](https://github.com/Shopify/remote-dom) library to securely render host-native components from a server-provided UI description.

This approach offers greater flexibility and security compared to `<iframe>`-based HTML resources, enabling UIs that seamlessly integrate with the host application's look and feel.

## How It Works

1. The MCP server sends a resource containing a script that builds a "remote" DOM structure.
2. The `@mcp-ui/client` securely executes this script in a sandboxed environment (a Web Worker inside an iframe).
3. As the remote DOM is manipulated, a series a JSON messages describing the changes are sent to the host window.
4. `<RemoteDOMResourceRenderer />` receives these messages and translates them into React component tree updates.

This ensures that no arbitrary code from the server runs in the main application thread, maintaining security while allowing dynamic and interactive UIs.

## Props

- **`resource`**: The `resource` object from an MCP message. The `mimeType` must be `application/vnd.mcp-ui.remote-dom+javascript; framework={react | webcomponents}`.
- **`library`**: A component library that maps remote element tag names (e.g., "button") to your host's React components.
- **`onUIAction`**: A callback function to handle events (e.g., button clicks) initiated from the remote UI.

## Component Libraries

A component library is a `Map` where keys are remote element tag names (as strings) and values are the corresponding React components that should render them.

`@mcp-ui/client` exports a `basicComponentLibrary` that maps standard HTML tags like `<p>`, `<div>`, `<h1>`, and `<button>` to simple React equivalents.

### Example: Custom Library

```tsx
import { MyButton, MyCard } from './MyComponents';

const customLibrary = new Map([
  ['fancy-button', MyButton],
  ['info-card', MyCard],
]);

<RemoteDOMResourceRenderer resource={resource} library={customLibrary} />;
```

If the remote DOM contains `<fancy-button>`, it will be rendered using your `MyButton` component.

## Usage

The `<UIResourceRenderer />` component automatically handles rendering `<RemoteDOMResourceRenderer />` when it detects the correct mime type, so you typically won't use this component directly.

```tsx
import React from 'react';
import { UIResourceRenderer } from '@mcp-ui/client';

function App({ mcpResource }) {
  if (
    mcpResource.type === 'resource' &&
    mcpResource.resource.uri?.startsWith('ui://')
  ) {
    // UIResourceRenderer will instantiate RemoteDOMResourceRenderer internally
    // if the resource mimeType is 'application/vnd.mcp-ui.remote-dom'.
    return (
      <UIResourceRenderer
        resource={mcpResource.resource}
        onUIAction={(action) => console.log('UI Action:', action)}
      />
    );
  }
  return <p>Unsupported resource</p>;
}
```
