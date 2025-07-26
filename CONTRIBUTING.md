# Contributing to ReceiptGold

Thank you for your interest in contributing to ReceiptGold! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Git
- Expo CLI
- iOS Simulator or Android Emulator

### Development Setup

1. **Fork the repository**

   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/ReceiptGold.git
   cd ReceiptGold
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment**

   ```bash
   cp .env.example .env
   # Fill in your configuration values
   ```

4. **Start development server**
   ```bash
   npm start
   ```

## 🎯 Development Workflow

### Branch Naming Convention

- `feature/feature-name` - New features
- `bugfix/issue-description` - Bug fixes
- `hotfix/critical-issue` - Critical fixes
- `chore/task-description` - Maintenance tasks

### Commit Message Format

Use conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

Examples:

```
feat(auth): add user authentication with Firebase
fix(ui): resolve theme switching bug on Android
docs(readme): update installation instructions
```

## 📋 Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Follow the coding standards
   - Add tests if applicable
   - Update documentation

3. **Test your changes**

   ```bash
   npm test
   npm run lint
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat(scope): your feature description"
   ```

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Use a descriptive title
   - Fill out the PR template
   - Link related issues
   - Request reviews

## 🎨 Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper interfaces and types
- Avoid `any` type unless absolutely necessary

### React Native

- Use functional components with hooks
- Follow React Native best practices
- Use proper prop types and default values

### Styling

- Use the theme system for colors
- Follow the design system guidelines
- Ensure responsive design
- Test on both iOS and Android

### File Structure

```
src/
├── components/     # Reusable UI components
├── screens/        # Screen components
├── navigation/     # Navigation configuration
├── theme/          # Theme and styling
├── types/          # TypeScript definitions
├── utils/          # Utility functions
└── hooks/          # Custom React hooks
```

### Component Structure

```typescript
// ComponentName.tsx
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface ComponentNameProps {
  title: string;
  onPress?: () => void;
}

export const ComponentName: React.FC<ComponentNameProps> = ({
  title,
  onPress,
}) => {
  const { theme } = useTheme();

  return (
    <View style={{ backgroundColor: theme.background.primary }}>
      <Text style={{ color: theme.text.primary }}>{title}</Text>
    </View>
  );
};
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- Unit tests for utility functions
- Component tests for UI components
- Integration tests for workflows
- E2E tests for critical user journeys

### Test Naming

```
ComponentName.test.tsx
utils.test.ts
integration.test.ts
```

## 📝 Documentation

### Code Documentation

- Use JSDoc comments for functions
- Document complex logic
- Include examples where helpful

### README Updates

- Update README for new features
- Include setup instructions
- Document API changes

## 🐛 Bug Reports

When reporting bugs, please include:

- Device/OS information
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/videos if applicable
- Console logs/error messages

## 💡 Feature Requests

For feature requests:

- Check existing issues first
- Provide clear use case
- Include mockups if UI-related
- Consider implementation complexity

## 🔍 Code Review Guidelines

### For Authors

- Keep PRs focused and small
- Write clear descriptions
- Respond to feedback promptly
- Update based on review comments

### For Reviewers

- Be constructive and respectful
- Focus on code quality and standards
- Test the changes locally
- Approve when ready

## 📱 Platform-Specific Guidelines

### iOS

- Test on multiple iOS versions
- Follow iOS Human Interface Guidelines
- Handle safe areas properly
- Test on different screen sizes

### Android

- Test on multiple Android versions
- Follow Material Design principles
- Handle different screen densities
- Test back button behavior

### Web

- Ensure responsive design
- Test keyboard navigation
- Verify accessibility features
- Check browser compatibility

## 🚀 Release Process

1. **Version Bump**

   ```bash
   npm version patch|minor|major
   ```

2. **Update Changelog**

   - Document new features
   - List bug fixes
   - Note breaking changes

3. **Create Release**
   - Tag the version
   - Create GitHub release
   - Generate release notes

## 📞 Getting Help

- **Discord**: [Link to Discord server]
- **GitHub Issues**: For bugs and feature requests
- **Email**: dev@receiptgold.com
- **Documentation**: [Link to docs]

## 🎉 Recognition

Contributors will be recognized in:

- README contributors section
- Release notes
- Annual contributor highlights

Thank you for contributing to ReceiptGold! 🙏
