module.exports = {
  rules: {
    'sort-imports': {
      meta: {
        type: 'layout',
        docs: {
          description: 'Enforce import sorting',
        },
        fixable: 'code',
      },
      create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode();
        const getSortKey = (source) => source.startsWith('.') ? 2 : source.startsWith('@') ? 0 : 1;

        return {
          Program(node) {
            const importNodes = node.body.filter(n => n.type === 'ImportDeclaration');
            if (importNodes.length === 0) return;

            const blocks = [];
            let currentBlock = [];

            node.body.forEach((n) => {
              if (n.type === 'ImportDeclaration') {
                currentBlock.push(n);
              } else if (currentBlock.length > 0) {
                blocks.push(currentBlock);
                currentBlock = [];
              }
            });
            if (currentBlock.length > 0) blocks.push(currentBlock);

            blocks.forEach(block => {
              block.forEach(importNode => {
                const specifiers = importNode.specifiers.filter(s => s.type === 'ImportSpecifier');
                const importText = sourceCode.getText(importNode);

                if (importText.includes('\n')) {
                  context.report({
                    node: importNode,
                    message: 'Import statement must be a single line.',
                    fix(fixer) {
                      const parts = [];
                      const defaultSpec = importNode.specifiers.find(s => s.type === 'ImportDefaultSpecifier');
                      const namespaceSpec = importNode.specifiers.find(s => s.type === 'ImportNamespaceSpecifier');

                      if (defaultSpec) parts.push(sourceCode.getText(defaultSpec));
                      if (namespaceSpec) parts.push(sourceCode.getText(namespaceSpec));
                      if (specifiers.length > 0) {
                        const sorted = [...specifiers].sort((a, b) => a.local.name.localeCompare(b.local.name));
                        const specifierTexts = sorted.map(s => sourceCode.getText(s)).join(', ');
                        parts.push(`{${specifierTexts}${specifiers.length > 1 ? ',' : ''}}`);
                      }

                      const specifierPart = parts.join(', ');
                      return fixer.replaceText(importNode, specifierPart ? `import ${specifierPart} from '${importNode.source.value}';` : `import '${importNode.source.value}';`);
                    }
                  });
                  return;
                }

                if (specifiers.length > 1) {
                  const sorted = [...specifiers].sort((a, b) => a.local.name.localeCompare(b.local.name));
                  if (specifiers.some((s, i) => s.local.name !== sorted[i].local.name)) {
                    context.report({
                      node: importNode,
                      message: 'Import specifiers must be sorted alphabetically.',
                      fix(fixer) {
                        const sortedText = sorted.map(s => sourceCode.getText(s)).join(', ');
                        const openBrace = importText.indexOf('{');
                        const closeBrace = importText.lastIndexOf('}');
                        const hasMultiple = sorted.length > 1;
                        if (openBrace !== -1 && closeBrace !== -1) {
                           return fixer.replaceTextRange([importNode.range[0] + openBrace + 1, importNode.range[0] + closeBrace], ` ${sortedText}${hasMultiple ? ',' : ''} `);
                        }
                        return fixer.replaceTextRange([specifiers[0].range[0], specifiers[specifiers.length - 1].range[1]], `${sortedText}${hasMultiple ? ',' : ''}`);
                      }
                    });
                  }
                }
              });

              const sortedBlock = [...block].sort((a, b) => {
                const sourceA = a.source.value || '';
                const sourceB = b.source.value || '';
                const keyA = getSortKey(sourceA);
                const keyB = getSortKey(sourceB);
                return keyA !== keyB ? keyA - keyB : sourceA.localeCompare(sourceB);
              });

              if (block.some((n, i) => n.source.value !== sortedBlock[i].source.value)) {
                context.report({
                  node: block[0],
                  message: 'Imports must be sorted alphabetically by module path.',
                  fix(fixer) {
                    return block.map((n, i) => fixer.replaceText(n, sourceCode.getText(sortedBlock[i])));
                  }
                });
                return;
              }

              for (let i = 0; i < block.length - 1; i++) {
                const current = block[i];
                const next = block[i + 1];
                const currentKey = getSortKey(current.source.value || '');
                const nextKey = getSortKey(next.source.value || '');

                const textBetween = sourceCode.text.slice(current.range[1], next.range[0]);
                const hasEmptyLine = (textBetween.match(/\n/g) || []).length >= 2;

                if (currentKey < 2 && nextKey === 2) {
                  if (!hasEmptyLine) {
                    context.report({
                      node: next,
                      message: 'Expected empty line between non-relative and relative imports.',
                      fix: fixer => fixer.insertTextBefore(next, '\n')
                    });
                  }
                } else if (currentKey === nextKey && hasEmptyLine && textBetween.trim() === '') {
                  context.report({
                    node: next,
                    message: 'Unexpected empty line between imports of the same group.',
                    fix: fixer => fixer.replaceTextRange([current.range[1], next.range[0]], '\n')
                  });
                }
              }
            });
          }
        };
      }
    }
  }
};
