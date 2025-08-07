# RPG MCP Server

An MCP (Model Context Protocol) server that enables LLMs to create and manage role-playing games through tools. Perfect for interactive storytelling and game experiences with AI assistants like Claude.

## What is this?

This server provides tools that allow AI assistants to:

- Create custom RPG games with any theme or setting
- Manage game state and character information
- Progress storylines automatically
- Handle player interactions and choices

## Quick Setup for Claude Desktop

### Step 1: Configure Claude Desktop

Edit your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npx",
      "args": ["rpg-mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Step 2: Restart Claude Desktop

Completely close and restart Claude Desktop for the changes to take effect.

### Step 3: Start Playing!

Once configured, you can ask Claude to create RPG games for you:

- "Create a fantasy adventure game where I'm a wizard"
- "Start a romance game set in modern Tokyo"
- "Make a sci-fi game where I'm exploring alien planets"

## Available Game Tools

The server provides these tools that Claude can use:

### createGame

Creates a new game with your chosen theme, characters, and setting.

### updateGame

Updates game state when you make choices or actions.

### getGame

Retrieves current game status and information.

### progressStory

Advances the storyline based on current situation.

### promptUserActions

Presents you with choices and options for what to do next.

## Game Flow

1. **Game Creation**: Claude creates a game based on your request
2. **Story Progression**: The AI advances the plot and describes situations
3. **Player Choice**: You're presented with options for what to do
4. **State Update**: Your choice updates the game world
5. **Repeat**: The cycle continues for ongoing gameplay

## Example Games

### Fantasy Adventure

```
Setting: Medieval fantasy kingdom
Character: Brave knight seeking the lost crown
Features: Magic, dragons, quests, character stats
```

### Romance Simulation

```
Setting: High school in Japan
Character: Transfer student
Features: Relationship building, dialogue choices, multiple love interests
```

### Space Exploration

```
Setting: Year 3024, interstellar travel
Character: Space captain
Features: Alien encounters, ship management, diplomatic choices
```

## Tips for Best Experience

- Be specific about the type of game you want
- Describe your preferred character type or background
- Mention any special features you'd like (combat, romance, puzzles, etc.)
- Don't hesitate to ask Claude to modify the game if something isn't working well

The AI will handle all the complex game mechanics and storytelling - just focus on enjoying your
