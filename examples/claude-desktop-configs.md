# Claude Desktop 설정 예시들

## 기본 설정 (NPX 사용)

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

## 로컬 개발 설정

```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/Users/username/projects/rpg-mcp-server"
    }
  }
}
```

## 여러 MCP 서버와 함께 사용

```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npx",
      "args": ["rpg-mcp-server"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```
