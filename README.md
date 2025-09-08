# RPG MCP Server

An immersive RPG server using the MCP protocol. Provides a complete tool chain for story progression, action prompts, and choice handling.

## Purpose

- LLMs can create/update game state and progress stories through tool calls
- MCP-UI renders HTML resources for interactive choice selection
- Seamless integration between AI narrative and user interaction

## Available Tools

- **createGame**: Create new game with initial state (JSON), returns gameId
- **updateGame**: Update game state using field paths, tracks deltas
- **getGame**: Retrieve current game state
- **progressStory**: Advance story progression, returns previous/current state
- **promptUserActions**: Present choices with text/html UI resource
- **selectAction**: Process user selection from UI and continue game flow

## Required MCP Client Capabilities

- **Tools API**: list_tools, call_tool support
- **Resource Rendering**: content.type="resource", mimeType="text/html", text body rendering
  - Optional: respect _meta.preferredRenderContext="main"
- **UI Event Bridge**: Handle window.postMessage({ type: 'tool', payload: { toolName, params } }) and relay to call_tool(selectAction)
- **stdio Transport**: Standard input/output transport connection

## Client Setup (Claude Desktop Example)

Simplest setup using npx:

```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npx",
      "args": ["rpg-mcp-server"]
    }
  }
}
```

For local development:

```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/your/rpg-mcp-server"
    }
  }
}
```

Additional examples in `examples/claude-desktop-configs.md`. Basic sample included in `claude-desktop-config.json`.

## Requirements

- Node.js >= 18
- MCP client with MCP-UI integration support
  - Use any MCP client that supports MCP-UI
  - If you don't have one, try [synaptic-flow](https://github.com/fritzprix/synaptic-flow) - a Tauri 2.0-based MCP client with full MCP-UI support

## License

MIT License - see [LICENSE](LICENSE) file for details.
