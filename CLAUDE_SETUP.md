# Claude Desktop MCP 서버 설정 가이드

이 가이드는 RPG MCP 서버를 Claude Desktop에 연동하는 방법을 상세히 설명합니다.

## 설정 방법

### 1단계: Claude Desktop 설정 파일 찾기

운영체제별 설정 파일 위치:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2단계: 설정 파일 편집

설정 파일이 없다면 새로 생성하고, 다음 내용을 추가하세요:

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

기존 설정이 있다면 `mcpServers` 객체 안에 `rpg-game-server` 항목만 추가하세요.

### 3단계: Claude Desktop 재시작

설정을 적용하려면 Claude Desktop을 완전히 종료한 후 다시 시작해야 합니다.

### 4단계: 연결 확인

Claude Desktop에서 다음과 같이 테스트해보세요:

```
안녕! RPG 게임을 만들어줄 수 있어?
```

## 문제 해결

### Node.js 미설치 오류
```
Error: command not found: npx
```

**해결방법**: [Node.js](https://nodejs.org/)를 설치하세요 (v18 이상 권장).

### 권한 오류
```
Error: permission denied
```

**해결방법**: 
- macOS/Linux: `sudo npm install -g rpg-mcp-server`
- Windows: 관리자 권한으로 PowerShell 실행

### 네트워크 오류
```
Error: unable to resolve
```

**해결방법**: 
1. 인터넷 연결 확인
2. 방화벽/프록시 설정 확인
3. 로컬 개발 버전 사용 (아래 참고)

## 로컬 개발 버전 사용

NPM 패키지 대신 로컬 소스를 사용하려면:

1. 이 저장소를 클론
```bash
git clone <repository-url>
cd rpg-mcp-server
npm install
npm run build
```

2. Claude Desktop 설정 수정
```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/full/path/to/rpg-mcp-server",
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

## 고급 설정

### 디버그 모드 활성화
```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npx",
      "args": ["rpg-mcp-server"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "true"
      }
    }
  }
}
```

### 포트 변경 (필요시)
```json
{
  "mcpServers": {
    "rpg-game-server": {
      "command": "npx",
      "args": ["rpg-mcp-server"],
      "env": {
        "PORT": "8080"
      }
    }
  }
}
```

## 지원

문제가 발생하면:
1. Claude Desktop 재시작
2. 설정 파일 문법 확인 (JSON validator 사용)
3. Node.js 버전 확인 (`node --version`)
4. 이슈 트래커에 문제 보고
