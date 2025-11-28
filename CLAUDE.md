# CLAUDE.md - AI Assistant Guide for AI-Search-App

This document provides essential context for AI assistants working on this codebase.

## Project Overview

**AI-Search-App** is an AI-powered search application. This is a new project in its initial stages.

## Repository Structure

```
AI-Search-App/
├── CLAUDE.md           # AI assistant guidelines (this file)
├── README.md           # Project documentation
├── package.json        # Node.js dependencies and scripts
├── src/                # Source code
│   ├── components/     # UI components
│   ├── services/       # API and business logic
│   ├── utils/          # Utility functions
│   └── types/          # TypeScript type definitions
├── tests/              # Test files
├── public/             # Static assets
└── config/             # Configuration files
```

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Code Conventions

### General Principles

1. **Keep it simple** - Prefer straightforward solutions over clever abstractions
2. **Type safety** - Use TypeScript with strict mode enabled
3. **Test coverage** - Write tests for business logic and critical paths
4. **Documentation** - Document public APIs and complex logic

### Naming Conventions

- **Files**: Use kebab-case for files (`search-service.ts`)
- **Components**: Use PascalCase for React components (`SearchBar.tsx`)
- **Functions**: Use camelCase for functions (`performSearch`)
- **Constants**: Use UPPER_SNAKE_CASE for constants (`MAX_RESULTS`)
- **Types/Interfaces**: Use PascalCase with descriptive names (`SearchResult`, `QueryOptions`)

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons at end of statements
- Maximum line length: 100 characters
- Use ES6+ features (arrow functions, destructuring, template literals)

### File Organization

- One component per file
- Keep files under 300 lines where possible
- Group related functionality in directories
- Export public APIs from index files

## Git Workflow

### Branch Naming

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `claude/*` - AI assistant development branches

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(search): add fuzzy matching support`
- `fix(api): handle empty query gracefully`
- `docs: update API documentation`

### Pull Request Guidelines

1. Keep PRs focused on a single feature or fix
2. Include tests for new functionality
3. Update documentation as needed
4. Ensure all CI checks pass

## AI Assistant Guidelines

### When Making Changes

1. **Read before editing** - Always read relevant files before making changes
2. **Understand context** - Check related files and dependencies
3. **Minimal changes** - Only change what's necessary for the task
4. **Preserve style** - Match existing code conventions
5. **Test changes** - Run tests and verify functionality

### What to Avoid

- Don't add unnecessary abstractions or over-engineering
- Don't modify unrelated code while fixing bugs
- Don't add comments to code you didn't change
- Don't create documentation files unless explicitly requested
- Don't guess at implementations - ask for clarification

### Security Considerations

- Never commit secrets, API keys, or credentials
- Validate and sanitize all user inputs
- Use parameterized queries for database operations
- Follow OWASP security best practices

### Error Handling

- Use try-catch blocks for async operations
- Provide meaningful error messages
- Log errors with appropriate context
- Fail gracefully with user-friendly messages

## Environment Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn package manager
- Git

### Environment Variables

Create a `.env.local` file for local development:

```env
# API Configuration
API_URL=http://localhost:3000
API_KEY=your-development-key

# Search Configuration
SEARCH_PROVIDER=default
MAX_RESULTS=50
```

Note: Never commit `.env` files with real credentials.

## Testing Strategy

### Test Types

1. **Unit Tests** - Test individual functions and utilities
2. **Integration Tests** - Test API endpoints and services
3. **Component Tests** - Test React component behavior
4. **E2E Tests** - Test critical user flows

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.spec.ts

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

## Common Tasks

### Adding a New Feature

1. Create feature branch from `develop`
2. Implement feature with tests
3. Update documentation if needed
4. Submit PR for review

### Fixing a Bug

1. Reproduce the bug
2. Write a failing test
3. Fix the bug
4. Verify test passes
5. Submit PR

### Updating Dependencies

1. Check for breaking changes
2. Update package.json
3. Run tests
4. Update code if needed

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Jest Testing Framework](https://jestjs.io/)
- [OWASP Security Guidelines](https://owasp.org/)

---

*Last updated: 2025-11-28*
