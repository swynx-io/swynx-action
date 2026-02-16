export const id = 719;
export const ids = [719];
export const modules = {

/***/ 6611:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   parseJavaScript: () => (/* binding */ parseJavaScript)
/* harmony export */ });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9896);
/* harmony import */ var _babel_parser__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(5429);
/* harmony import */ var _babel_traverse__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(148);
// src/scanner/parsers/javascript.mjs
// Enterprise-grade JavaScript/TypeScript parser using Babel AST
// Captures every function, class, method, and code structure with exact boundaries





// Handle both ESM and CJS default exports
const traverse = _babel_traverse__WEBPACK_IMPORTED_MODULE_2__["default"] || _babel_traverse__WEBPACK_IMPORTED_MODULE_2__;

/**
 * Parse a JavaScript/TypeScript file with full AST analysis
 * Captures every function, class, method with exact line numbers and sizes
 */
async function parseJavaScript(file) {
  const filePath = typeof file === 'string' ? file : file.path;
  const relativePath = typeof file === 'string' ? file : file.relativePath;

  if (!(0,fs__WEBPACK_IMPORTED_MODULE_0__.existsSync)(filePath)) {
    return createEmptyResult(filePath, relativePath, 'File not found');
  }

  let content;
  try {
    content = (0,fs__WEBPACK_IMPORTED_MODULE_0__.readFileSync)(filePath, 'utf-8');
  } catch (error) {
    return createEmptyResult(filePath, relativePath, `Read error: ${error.message}`);
  }

  // Handle Vue Single File Components (.vue)
  // Extract script content from <script> or <script setup> block
  let scriptContent = content;
  let isVueSFC = false;
  let scriptLineOffset = 0;

  if (filePath.endsWith('.vue') || filePath.endsWith('.svelte')) {
    isVueSFC = true;
    const scriptMatch = content.match(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/i);
    if (scriptMatch) {
      scriptContent = scriptMatch[1];
      // Calculate line offset to adjust reported line numbers
      const beforeScript = content.slice(0, scriptMatch.index);
      scriptLineOffset = (beforeScript.match(/\n/g) || []).length + 1;
    } else {
      // No script block found - return empty but valid result
      return {
        file: { path: filePath, relativePath },
        content,
        functions: [],
        classes: [],
        exports: [],
        imports: [],
        lines: content.split('\n').length,
        size: content.length,
        parseMethod: filePath.endsWith('.svelte') ? 'svelte-no-script' : 'vue-no-script'
      };
    }
  }

  const lines = content.split('\n');

  try {
    // Parse with Babel - supports JSX, TypeScript, and all modern syntax
    const ast = (0,_babel_parser__WEBPACK_IMPORTED_MODULE_1__.parse)(scriptContent, {
      sourceType: 'unambiguous', // Auto-detect module vs script
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'classStaticBlock',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'importMeta',
        'nullishCoalescingOperator',
        'optionalChaining',
        'optionalCatchBinding',
        'topLevelAwait',
        'asyncGenerators',
        'objectRestSpread',
        'numericSeparator',
        'bigInt',
        'throwExpressions',
        'regexpUnicodeSets',       // ES2024 regex features (v flag)
        'importAttributes',        // import assertions/attributes
        'explicitResourceManagement', // using declarations
        'sourcePhaseImports',      // source imports
        'deferredImportEvaluation' // deferred imports
      ],
      errorRecovery: true, // Continue parsing on errors
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true
    });

    const functions = [];
    const classes = [];
    const exports = [];
    const imports = [];

    traverse(ast, {
      // ═══════════════════════════════════════════════════════════════════
      // FUNCTION DECLARATIONS: function name() {}
      // ═══════════════════════════════════════════════════════════════════
      FunctionDeclaration(path) {
        if (!path.node.id) return; // Skip anonymous

        const func = extractFunctionInfo(path.node, content, 'function');
        func.name = path.node.id.name;
        func.exported = isExported(path);
        functions.push(func);
      },

      // ═══════════════════════════════════════════════════════════════════
      // ARROW FUNCTIONS: const name = () => {} or const name = async () => {}
      // ═══════════════════════════════════════════════════════════════════
      VariableDeclarator(path) {
        const init = path.node.init;
        if (!init) return;
        if (!path.node.id || path.node.id.type !== 'Identifier') return;

        const name = path.node.id.name;

        // Arrow function or function expression assigned to variable
        if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
          const func = extractFunctionInfo(init, content, init.type === 'ArrowFunctionExpression' ? 'arrow' : 'expression');
          func.name = name;

          // Get the full declaration including 'const name = '
          const parent = path.parentPath?.node;
          if (parent?.loc) {
            func.line = parent.loc.start.line;
            func.column = parent.loc.start.column;
          }

          // Check if exported
          const grandParent = path.parentPath?.parentPath;
          func.exported = grandParent?.node?.type === 'ExportNamedDeclaration';

          // Recalculate size with full declaration
          func.sizeBytes = extractCodeSize(content, func.line, func.endLine);

          functions.push(func);
        }
      },

      // ═══════════════════════════════════════════════════════════════════
      // CLASS DECLARATIONS: class Name {}
      // ═══════════════════════════════════════════════════════════════════
      ClassDeclaration(path) {
        const node = path.node;
        if (!node.id) return;

        const classInfo = {
          name: node.id.name,
          type: 'class',
          line: node.loc?.start?.line || 0,
          endLine: node.loc?.end?.line || 0,
          column: node.loc?.start?.column || 0,
          lineCount: 0,
          sizeBytes: 0,
          exported: isExported(path),
          superClass: node.superClass?.name || null,
          methods: [],
          properties: [],
          // Extract decorators for DI detection (@Service, @Injectable, etc.)
          decorators: (node.decorators || []).map(dec => {
            const expr = dec.expression;
            let name = null;
            let args = null;

            if (expr.type === 'CallExpression') {
              // @Service() or @Module.forRoot()
              name = expr.callee?.name || expr.callee?.property?.name;
              // Extract first argument if it's an object literal (for @Injectable({ providedIn: 'root' }))
              if (expr.arguments?.[0]?.type === 'ObjectExpression') {
                args = {};
                for (const prop of expr.arguments[0].properties || []) {
                  if (prop.key?.name && prop.value) {
                    // Handle string literals and identifiers
                    if (prop.value.type === 'StringLiteral' || prop.value.type === 'Literal') {
                      args[prop.key.name] = prop.value.value;
                    } else if (prop.value.type === 'Identifier') {
                      args[prop.key.name] = prop.value.name;
                    }
                  }
                }
              }
            } else if (expr.type === 'Identifier') {
              // @Service (without parentheses)
              name = expr.name;
            } else if (expr.type === 'MemberExpression') {
              // @Module.Service
              name = expr.property?.name;
            }

            return { name, args, line: dec.loc?.start?.line || 0 };
          }).filter(d => d.name)
        };

        classInfo.lineCount = classInfo.endLine - classInfo.line + 1;
        classInfo.sizeBytes = extractCodeSize(content, classInfo.line, classInfo.endLine);

        // Extract methods
        if (node.body && node.body.body) {
          for (const member of node.body.body) {
            if (member.type === 'ClassMethod' || member.type === 'ClassPrivateMethod') {
              const method = extractMethodInfo(member, content, classInfo.name);
              classInfo.methods.push(method);
              functions.push(method); // Also add to global functions for duplicate detection
            } else if (member.type === 'ClassProperty' || member.type === 'ClassPrivateProperty') {
              // Check if property is assigned a function
              if (member.value?.type === 'ArrowFunctionExpression' ||
                  member.value?.type === 'FunctionExpression') {
                const method = extractFunctionInfo(member.value, content, 'property');
                method.name = member.key?.name || member.key?.id?.name || 'anonymous';
                method.className = classInfo.name;
                method.line = member.loc?.start?.line || 0;
                method.endLine = member.loc?.end?.line || 0;
                method.sizeBytes = extractCodeSize(content, method.line, method.endLine);
                classInfo.methods.push(method);
                functions.push(method);
              } else {
                classInfo.properties.push({
                  name: member.key?.name || 'unknown',
                  line: member.loc?.start?.line || 0,
                  static: member.static || false
                });
              }
            }
          }
        }

        classes.push(classInfo);
      },

      // ═══════════════════════════════════════════════════════════════════
      // OBJECT METHODS: { methodName() {} } or { methodName: function() {} }
      // ═══════════════════════════════════════════════════════════════════
      ObjectMethod(path) {
        if (!path.node.key) return;

        const name = path.node.key.name || path.node.key.value || 'anonymous';
        const func = extractFunctionInfo(path.node, content, 'method');
        func.name = name;
        func.isObjectMethod = true;

        // Try to find parent object name
        const parent = path.parentPath?.parentPath;
        if (parent?.node?.type === 'VariableDeclarator' && parent.node.id?.name) {
          func.objectName = parent.node.id.name;
        }

        functions.push(func);
      },

      ObjectProperty(path) {
        const value = path.node.value;
        if (!value) return;

        // Property with function value: { name: function() {} } or { name: () => {} }
        if (value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression') {
          const name = path.node.key?.name || path.node.key?.value || 'anonymous';
          const func = extractFunctionInfo(value, content, 'property');
          func.name = name;
          func.isObjectProperty = true;

          // Get full property bounds
          func.line = path.node.loc?.start?.line || func.line;
          func.endLine = path.node.loc?.end?.line || func.endLine;
          func.sizeBytes = extractCodeSize(content, func.line, func.endLine);

          functions.push(func);
        }
      },

      // ═══════════════════════════════════════════════════════════════════
      // IMPORTS
      // ═══════════════════════════════════════════════════════════════════
      ImportDeclaration(path) {
        const node = path.node;
        const source = node.source?.value;
        if (!source) return;

        const importInfo = {
          module: source,
          line: node.loc?.start?.line || 0,
          type: 'esm',
          specifiers: []
        };

        for (const spec of node.specifiers || []) {
          if (spec.type === 'ImportDefaultSpecifier') {
            importInfo.specifiers.push({
              name: spec.local?.name,
              type: 'default'
            });
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            importInfo.specifiers.push({
              name: spec.local?.name,
              type: 'namespace'
            });
          } else if (spec.type === 'ImportSpecifier') {
            importInfo.specifiers.push({
              name: spec.imported?.name || spec.local?.name,
              localName: spec.local?.name,
              type: 'named'
            });
          }
        }

        imports.push(importInfo);
      },

      // Handle dynamic imports: import('./module')
      Import(path) {
        // The parent is a CallExpression with the dynamic import
        const parent = path.parentPath;
        if (parent?.node?.type === 'CallExpression') {
          const arg = parent.node.arguments?.[0];
          if (arg?.type === 'StringLiteral' || arg?.type === 'Literal') {
            const modulePath = arg.value;
            if (modulePath) {
              imports.push({
                module: modulePath,
                line: parent.node.loc?.start?.line || 0,
                type: 'dynamic-import',
                isDynamic: true
              });
            }
          }
        }
      },

      // Handle require() calls and dynamic module loading patterns
      CallExpression(path) {
        const node = path.node;

        // Handle dynamic import() as CallExpression (older parser versions)
        if (node.callee?.type === 'Import' && node.arguments?.[0]) {
          const arg = node.arguments[0];
          const modulePath = arg.value || arg.quasis?.[0]?.value?.raw;
          if (modulePath && typeof modulePath === 'string') {
            imports.push({
              module: modulePath,
              line: node.loc?.start?.line || 0,
              type: 'dynamic-import',
              isDynamic: true
            });
          }
        }

        // Handle require('module')
        if (node.callee?.name === 'require' && node.arguments?.[0]?.value) {
          imports.push({
            module: node.arguments[0].value,
            line: node.loc?.start?.line || 0,
            type: 'commonjs'
          });
        }

        // Handle glob.sync('**/*.node.ts') - Node.js glob
        if (node.callee?.type === 'MemberExpression' &&
            node.callee.object?.name === 'glob' &&
            node.callee.property?.name === 'sync') {
          const pattern = node.arguments?.[0]?.value;
          if (pattern && typeof pattern === 'string') {
            imports.push({
              module: pattern,
              line: node.loc?.start?.line || 0,
              type: 'glob-sync',
              isGlob: true
            });
          }
        }

        // Handle globSync('**/*.ts') - glob v9+ named export
        if (node.callee?.name === 'globSync' && node.arguments?.[0]?.value) {
          const pattern = node.arguments[0].value;
          if (typeof pattern === 'string') {
            imports.push({
              module: pattern,
              line: node.loc?.start?.line || 0,
              type: 'glob-sync',
              isGlob: true
            });
          }
        }

        // Handle import.meta.glob('**/*.ts') - Vite
        if (node.callee?.type === 'MemberExpression' &&
            node.callee.object?.type === 'MetaProperty' &&
            node.callee.property?.name === 'glob') {
          const pattern = node.arguments?.[0]?.value;
          if (pattern && typeof pattern === 'string') {
            imports.push({
              module: pattern,
              line: node.loc?.start?.line || 0,
              type: 'import-meta-glob',
              isGlob: true
            });
          }
        }

        // Handle require.context('./', true, /\.ts$/) - Webpack
        if (node.callee?.type === 'MemberExpression' &&
            node.callee.object?.name === 'require' &&
            node.callee.property?.name === 'context') {
          const dir = node.arguments?.[0]?.value;
          const regexNode = node.arguments?.[2];
          if (dir) {
            imports.push({
              module: dir,
              line: node.loc?.start?.line || 0,
              type: 'require-context',
              isGlob: true,
              recursive: node.arguments?.[1]?.value ?? false,
              pattern: regexNode?.regex?.pattern || regexNode?.pattern || '.*'
            });
          }
        }
      },

      // ═══════════════════════════════════════════════════════════════════
      // EXPORTS
      // ═══════════════════════════════════════════════════════════════════
      ExportNamedDeclaration(path) {
        const node = path.node;
        const decl = node.declaration;

        if (decl) {
          if (decl.type === 'FunctionDeclaration' && decl.id) {
            exports.push({
              name: decl.id.name,
              type: 'function',
              line: node.loc?.start?.line || 0
            });
          } else if (decl.type === 'VariableDeclaration') {
            for (const d of decl.declarations) {
              if (d.id?.name) {
                exports.push({
                  name: d.id.name,
                  type: 'variable',
                  line: node.loc?.start?.line || 0
                });
              }
            }
          } else if (decl.type === 'ClassDeclaration' && decl.id) {
            exports.push({
              name: decl.id.name,
              type: 'class',
              line: node.loc?.start?.line || 0
            });
          }
        }

        // export { foo, bar } or export { foo } from './module'
        for (const spec of node.specifiers || []) {
          exports.push({
            name: spec.exported?.name || spec.local?.name,
            type: 'reexport',
            line: node.loc?.start?.line || 0,
            sourceModule: node.source?.value || null  // Capture re-export source for barrel files
          });
        }
      },

      // ═══════════════════════════════════════════════════════════════════
      // EXPORT ALL: export * from './module'
      // ═══════════════════════════════════════════════════════════════════
      ExportAllDeclaration(path) {
        exports.push({
          name: '*',
          type: 'reexport-all',
          sourceModule: path.node.source?.value || null,
          line: path.node.loc?.start?.line || 0
        });
      },

      ExportDefaultDeclaration(path) {
        const node = path.node;
        let name = 'default';

        if (node.declaration) {
          if (node.declaration.id?.name) {
            name = node.declaration.id.name;
          } else if (node.declaration.type === 'Identifier') {
            name = node.declaration.name;
          }
        }

        exports.push({
          name,
          type: 'default',
          isDefault: true,
          line: node.loc?.start?.line || 0
        });
      }
    });

    // Sort functions by line number
    functions.sort((a, b) => a.line - b.line);
    classes.sort((a, b) => a.line - b.line);

    return {
      file: { path: filePath, relativePath },
      content,
      functions,
      classes,
      exports,
      imports,
      lines: lines.length,
      size: content.length,
      parseMethod: isVueSFC ? 'babel-ast-vue' : 'babel-ast',
      ...(isVueSFC && { scriptLineOffset })  // Include offset for Vue SFCs
    };

  } catch (parseError) {
    // Fallback to regex parsing for files Babel can't handle
    // Suppress warnings for Vue/Svelte — Babel can't parse the full SFC, regex fallback is expected
    if (!isVueSFC && process.env.SWYNX_VERBOSE) {
      console.warn(`[Parser] Babel failed for ${relativePath}, using regex fallback: ${parseError.message}`);
    }
    return parseWithRegex(filePath, relativePath, content, lines);
  }
}

/**
 * Extract function information from AST node
 */
function extractFunctionInfo(node, content, type) {
  const loc = node.loc || {};
  const startLine = loc.start?.line || 0;
  const endLine = loc.end?.line || 0;
  const startColumn = loc.start?.column || 0;

  const info = {
    name: node.id?.name || 'anonymous',
    type,
    line: startLine,
    endLine,
    column: startColumn,
    lineCount: endLine - startLine + 1,
    sizeBytes: 0,
    async: node.async || false,
    generator: node.generator || false,
    params: [],
    signature: ''
  };

  // Extract parameters
  for (const param of node.params || []) {
    if (param.type === 'Identifier') {
      info.params.push(param.name);
    } else if (param.type === 'AssignmentPattern' && param.left?.name) {
      info.params.push(`${param.left.name}=`);
    } else if (param.type === 'RestElement' && param.argument?.name) {
      info.params.push(`...${param.argument.name}`);
    } else if (param.type === 'ObjectPattern') {
      info.params.push('{...}');
    } else if (param.type === 'ArrayPattern') {
      info.params.push('[...]');
    }
  }

  // Build signature
  const asyncPrefix = info.async ? 'async ' : '';
  const genPrefix = info.generator ? '*' : '';
  info.signature = `${asyncPrefix}function${genPrefix} ${info.name}(${info.params.join(', ')})`;

  // Compute size without storing full body (saves ~5GB on large repos)
  info.sizeBytes = extractCodeSize(content, startLine, endLine);

  return info;
}

/**
 * Extract class method information
 */
function extractMethodInfo(node, content, className) {
  const loc = node.loc || {};
  const startLine = loc.start?.line || 0;
  const endLine = loc.end?.line || 0;

  let name = 'anonymous';
  if (node.key) {
    if (node.key.type === 'Identifier') {
      name = node.key.name;
    } else if (node.key.type === 'PrivateName') {
      name = `#${node.key.id?.name || 'private'}`;
    }
  }

  const info = {
    name,
    type: 'method',
    kind: node.kind || 'method', // 'constructor', 'method', 'get', 'set'
    className,
    line: startLine,
    endLine,
    column: loc.start?.column || 0,
    lineCount: endLine - startLine + 1,
    sizeBytes: 0,
    async: node.async || false,
    generator: node.generator || false,
    static: node.static || false,
    params: [],
    signature: ''
  };

  // Extract parameters
  for (const param of node.params || []) {
    if (param.type === 'Identifier') {
      info.params.push(param.name);
    } else if (param.type === 'AssignmentPattern' && param.left?.name) {
      info.params.push(`${param.left.name}=`);
    } else if (param.type === 'RestElement' && param.argument?.name) {
      info.params.push(`...${param.argument.name}`);
    }
  }

  // Build signature
  const staticPrefix = info.static ? 'static ' : '';
  const asyncPrefix = info.async ? 'async ' : '';
  info.signature = `${staticPrefix}${asyncPrefix}${name}(${info.params.join(', ')})`;

  // Compute size without storing full body (saves ~5GB on large repos)
  info.sizeBytes = extractCodeSize(content, startLine, endLine);

  return info;
}

/**
 * Check if a node is exported
 */
function isExported(path) {
  const parent = path.parentPath;
  if (!parent) return false;

  return parent.node?.type === 'ExportNamedDeclaration' ||
         parent.node?.type === 'ExportDefaultDeclaration';
}

/**
 * Extract code between line numbers
 */
function extractCode(content, startLine, endLine) {
  if (!startLine || !endLine) return '';

  const lines = content.split('\n');
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);

  return lines.slice(start, end).join('\n');
}

/**
 * Calculate code size between line numbers
 */
function extractCodeSize(content, startLine, endLine) {
  return extractCode(content, startLine, endLine).length;
}

/**
 * Create empty result for error cases
 */
function createEmptyResult(filePath, relativePath, error) {
  return {
    file: { path: filePath, relativePath },
    content: '',
    functions: [],
    classes: [],
    exports: [],
    imports: [],
    lines: 0,
    size: 0,
    error,
    parseMethod: 'none'
  };
}

/**
 * Fallback regex-based parsing for files Babel can't handle
 */
function parseWithRegex(filePath, relativePath, content, lines) {
  const functions = [];
  const classes = [];
  const exports = [];
  const imports = [];

  // Track brace depth for finding function boundaries
  const functionPatterns = [
    /^(\s*)(export\s+)?(async\s+)?function\s*\*?\s*(\w+)\s*\(/,
    /^(\s*)(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
    /^(\s*)(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?(\w+)\s*=>/,
    /^(\s*)(export\s+)?class\s+(\w+)/
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for function patterns
    for (const pattern of functionPatterns) {
      const match = line.match(pattern);
      if (match) {
        const startLine = i + 1;
        const endLine = findBlockEnd(lines, i);
        const name = match[4] || match[3] || 'anonymous';
        const body = lines.slice(i, endLine).join('\n');

        if (pattern.source.includes('class')) {
          classes.push({
            name,
            type: 'class',
            line: startLine,
            endLine,
            lineCount: endLine - startLine + 1,
            sizeBytes: body.length
          });
        } else {
          functions.push({
            name,
            type: 'function',
            line: startLine,
            endLine,
            lineCount: endLine - startLine + 1,
            sizeBytes: body.length,
            signature: line.trim().replace(/\{.*$/, '').trim()
          });
        }
        break;
      }
    }

    // Check for imports
    const importMatch = line.match(/^import\s+.*from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      imports.push({ module: importMatch[1], line: i + 1, type: 'esm' });
    }

    const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (requireMatch) {
      imports.push({ module: requireMatch[1], line: i + 1, type: 'commonjs' });
    }

    // Check for exports
    if (/^export\s+(default\s+)?/.test(line)) {
      const exportMatch = line.match(/export\s+(default\s+)?(function|class|const|let|var)?\s*(\w+)?/);
      if (exportMatch) {
        exports.push({
          name: exportMatch[3] || 'default',
          type: exportMatch[2] || 'default',
          isDefault: !!exportMatch[1],
          line: i + 1
        });
      }
    }
  }

  return {
    file: { path: filePath, relativePath },
    content,
    functions,
    classes,
    exports,
    imports,
    lines: lines.length,
    size: content.length,
    parseMethod: 'regex-fallback'
  };
}

/**
 * Find the end of a code block by tracking braces
 */
function findBlockEnd(lines, startIndex) {
  let braceDepth = 0;
  let started = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // Skip strings and comments (simplified)
    let inString = false;
    let stringChar = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];

      // Handle strings
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
        continue;
      }
      if (inString && char === stringChar && line[j - 1] !== '\\') {
        inString = false;
        continue;
      }
      if (inString) continue;

      // Handle single-line comments
      if (char === '/' && nextChar === '/') break;

      // Count braces
      if (char === '{') {
        braceDepth++;
        started = true;
      } else if (char === '}') {
        braceDepth--;
        if (started && braceDepth === 0) {
          return i + 1;
        }
      }
    }
  }

  return startIndex + 1;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({ parseJavaScript });


/***/ }),

/***/ 2719:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  scanDeadCode: () => (/* binding */ scanDeadCode)
});

// EXTERNAL MODULE: external "os"
var external_os_ = __webpack_require__(857);
// EXTERNAL MODULE: external "worker_threads"
var external_worker_threads_ = __webpack_require__(8167);
// EXTERNAL MODULE: external "url"
var external_url_ = __webpack_require__(7016);
// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(6928);
// EXTERNAL MODULE: external "fs"
var external_fs_ = __webpack_require__(9896);
// EXTERNAL MODULE: ./node_modules/glob/dist/esm/index.js + 9 modules
var esm = __webpack_require__(9067);
;// CONCATENATED MODULE: ./shared/scanner/discovery.mjs
// src/scanner/discovery.mjs
// File discovery utilities





/**
 * Parse .gitmodules file to extract submodule paths
 * @param {string} projectPath - Project root path
 * @returns {string[]} - Array of submodule paths (as glob patterns)
 */
function getGitSubmodulePaths(projectPath) {
  const gitmodulesPath = (0,external_path_.join)(projectPath, '.gitmodules');
  if (!(0,external_fs_.existsSync)(gitmodulesPath)) return [];

  const submodulePaths = [];
  try {
    const content = (0,external_fs_.readFileSync)(gitmodulesPath, 'utf-8');
    // Match: path = vendor/shared-lib
    const pathMatches = content.matchAll(/^\s*path\s*=\s*(.+)$/gm);
    for (const match of pathMatches) {
      const submodulePath = match[1].trim();
      // Add as glob pattern to exclude entire directory
      submodulePaths.push(`${submodulePath}/**`);
    }
  } catch {
    // Ignore parse errors
  }
  return submodulePaths;
}

const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/bower_components/**',
  '**/jspm_packages/**',
  '**/web_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.swynx-quarantine/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.min.css',
  // Vendored third-party code
  '**/third_party/**',
  '**/3rdparty/**',
  '**/vendor/**',
  // Exclude log directories and files (can be huge, not code)
  '**/logs/**',
  '**/log/**',
  '**/*.log',
  // Exclude temp/cache directories
  '**/tmp/**',
  '**/temp/**',
  '**/.cache/**',
  '**/cache/**',
  // Exclude Python cache
  '**/__pycache__/**',
  '**/*.pyc',
  '**/*.pyo',
  // Exclude other common non-JS caches
  '**/.pytest_cache/**',
  '**/.mypy_cache/**',
  // Exclude data files
  '**/*.sql',
  '**/*.sqlite',
  '**/*.sqlite3',
  '**/*.db',
  // Exclude large binary/media (analyzed separately via assets)
  '**/*.mp4',
  '**/*.mov',
  '**/*.avi',
  '**/*.zip',
  '**/*.tar',
  '**/*.gz',
  '**/*.rar',
  // Test fixture / baseline directories
  '**/testdata/**',
  '**/test-data/**',
  '**/test_data/**',
  '**/fixtures/**',
  '**/fixture/**',
  '**/TestData/**',
  '**/test-cases/**',
  '**/test_cases/**',
  '**/testcases/**',
  '**/conformance/**',
  '**/test-fixture/**',
  '**/tests/baselines/**',
  '**/test/baselines/**',
  // Compiler test input directories
  '**/cases/**/*.ts',
  '**/test/cases/**',
  // C# intermediate / compiled output
  '**/obj/**',
  '**/bin/Debug/**',
  '**/bin/Release/**',
  // C# scaffolding baselines (test-generated output)
  '**/Scaffolding/Baselines/**',
  // Rust compiler test inputs (standalone files compiled by test harness, not source code)
  '**/tests/ui/**', '**/tests/derive_ui/**', '**/tests/compile-fail/**',
  '**/tests/run-pass/**', '**/tests/run-fail/**', '**/tests/ui-fulldeps/**',
  '**/tests/pretty/**', '**/tests/mir-opt/**', '**/tests/assembly/**',
  '**/tests/codegen/**', '**/tests/debuginfo/**', '**/tests/incremental/**',
  '**/tests/codegen-llvm/**', '**/tests/rustdoc-html/**', '**/tests/crashes/**',
  '**/tests/assembly-llvm/**', '**/tests/rustdoc-ui/**', '**/tests/rustdoc-js/**',
  '**/tests/rustdoc-json/**', '**/tests/codegen-units/**', '**/tests/coverage-run-rustdoc/**',
  // Cypress/E2E system test fixture projects (standalone apps used as test targets)
  '**/system-tests/projects/**', '**/system-tests/project-fixtures/**',
  // RustPython test snippet inputs
  '**/extra_tests/snippets/**',
  // Python stdlib copies (RustPython, cpython)
  '**/Lib/encodings/**',
  // Python vendored third-party code
  '**/_vendor/**', '**/_distutils/**',
  // Compiled/bundled static assets (Phoenix/Elixir)
  '**/static/assets/**',
  // Generated protobuf/gRPC output directories
  '**/gen/proto/**',
  // Snapshots
  '**/__snapshots__/**',
  '**/snapshots/**',
];

/**
 * Discover all files in project
 */
async function discoverFiles(projectPath, options = {}) {
  // Get git submodule paths to exclude
  const submodulePaths = getGitSubmodulePaths(projectPath);

  // Combine default excludes with submodule paths
  const exclude = [...(options.exclude || DEFAULT_EXCLUDE), ...submodulePaths];
  const include = options.include || ['**/*'];
  const onProgress = options.onProgress || (() => {});

  const files = [];

  // Report that we're starting the glob (this allows heartbeat to show activity)
  onProgress({ current: 0, total: 0, file: 'Scanning directory structure...' });

  for (const pattern of include) {
    // Use async glob to allow event loop to run (enables heartbeat during large scans)
    const matches = await (0,esm.glob)(pattern, {
      cwd: projectPath,
      ignore: exclude,
      nodir: true,
      absolute: false
    });

    const total = matches.length;
    let processed = 0;

    // Report that glob is complete, now processing files
    onProgress({ current: 0, total, file: `Found ${total} files, processing...` });

    for (const match of matches) {
      const fullPath = (0,external_path_.join)(projectPath, match);
      if ((0,external_fs_.existsSync)(fullPath)) {
        try {
          const stats = (0,external_fs_.statSync)(fullPath);
          files.push({
            path: fullPath,
            relativePath: match,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            ext: (0,external_path_.extname)(match).toLowerCase()
          });
        } catch (e) {
          // Skip files we can't stat
        }
      }

      processed++;
      // Report progress every 500 files (was every 2 — 50K setImmediate calls for 100K files)
      if (processed % 500 === 0 || processed === total) {
        onProgress({ current: processed, total, file: match });
        // Yield to event loop to allow heartbeat to fire
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  return files;
}

/**
 * Categorize files by type
 */
function categoriseFiles(files) {
  const categories = {
    javascript: [],
    python: [],
    java: [],
    kotlin: [],
    csharp: [],
    go: [],
    rust: [],
    css: [],
    assets: [],
    other: []
  };

  for (const file of files) {
    const ext = file.ext;
    if (['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.vue', '.svelte'].includes(ext)) {
      categories.javascript.push(file);
    } else if (['.py', '.pyi'].includes(ext)) {
      categories.python.push(file);
    } else if (['.java'].includes(ext)) {
      categories.java.push(file);
    } else if (['.kt', '.kts'].includes(ext)) {
      categories.kotlin.push(file);
    } else if (['.cs'].includes(ext)) {
      categories.csharp.push(file);
    } else if (['.go'].includes(ext)) {
      categories.go.push(file);
    } else if (['.rs'].includes(ext)) {
      categories.rust.push(file);
    } else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
      categories.css.push(file);
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      categories.assets.push(file);
    } else {
      categories.other.push(file);
    }
  }

  return categories;
}

/**
 * Get total size of files
 */
function getTotalSize(files) {
  return files.reduce((sum, f) => sum + (f.size || 0), 0);
}

/* harmony default export */ const discovery = ({ discoverFiles, categoriseFiles, getTotalSize });

// EXTERNAL MODULE: ./shared/scanner/parsers/javascript.mjs
var javascript = __webpack_require__(6611);
;// CONCATENATED MODULE: ./shared/scanner/parsers/registry.mjs
// src/scanner/parsers/registry.mjs
// Multi-language parser registry with lazy loading



/**
 * Parser result structure (common across all languages)
 * @typedef {Object} ParseResult
 * @property {Object} file - File info (path, relativePath)
 * @property {string} content - File content
 * @property {Array} functions - Detected functions/methods
 * @property {Array} classes - Detected classes/types
 * @property {Array} exports - Detected exports
 * @property {Array} imports - Detected imports/dependencies
 * @property {Array} annotations - Detected annotations/decorators
 * @property {number} lines - Line count
 * @property {number} size - Byte size
 * @property {string} parseMethod - Parser used
 * @property {string} [error] - Error message if parsing failed
 */

/**
 * Parser registry with lazy loading
 * Each parser is loaded on-demand to reduce startup time
 */
const parserRegistry = {
  // JavaScript/TypeScript (primary, always loaded)
  '.js': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.mjs': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.cjs': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.jsx': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.ts': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.mts': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.cts': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.tsx': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.vue': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),
  '.svelte': () => Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 6611)),

  // Java/Kotlin (JVM)
  '.java': () => __webpack_require__.e(/* import() */ 682).then(__webpack_require__.bind(__webpack_require__, 7682)),
  '.kt': () => __webpack_require__.e(/* import() */ 693).then(__webpack_require__.bind(__webpack_require__, 2693)),
  '.kts': () => __webpack_require__.e(/* import() */ 693).then(__webpack_require__.bind(__webpack_require__, 2693)),

  // .NET
  '.cs': () => __webpack_require__.e(/* import() */ 43).then(__webpack_require__.bind(__webpack_require__, 9043)),
  // '.fs': () => import('./fsharp.mjs'),  // TODO: Not implemented
  // '.vb': () => import('./vb.mjs'),      // TODO: Not implemented

  // Python
  '.py': () => __webpack_require__.e(/* import() */ 228).then(__webpack_require__.bind(__webpack_require__, 7228)),
  '.pyi': () => __webpack_require__.e(/* import() */ 228).then(__webpack_require__.bind(__webpack_require__, 7228)),

  // Go
  '.go': () => __webpack_require__.e(/* import() */ 368).then(__webpack_require__.bind(__webpack_require__, 6368)),

  // Rust
  '.rs': () => __webpack_require__.e(/* import() */ 392).then(__webpack_require__.bind(__webpack_require__, 5392))

  // TODO: Future language support
  // '.rb': () => import('./ruby.mjs'),
  // '.php': () => import('./php.mjs'),
  // '.swift': () => import('./swift.mjs'),
  // '.scala': () => import('./scala.mjs'),
  // '.sc': () => import('./scala.mjs')
};

// Cache for loaded parsers
const loadedParsers = new Map();

/**
 * Get the appropriate parser for a file extension
 * @param {string} extension - File extension (with dot, e.g., '.java')
 * @returns {Promise<Object|null>} - Parser module or null if not supported
 */
async function getParser(extension) {
  const normalizedExt = extension.toLowerCase();
  const loader = parserRegistry[normalizedExt];

  if (!loader) {
    return null;
  }

  // Check cache
  if (loadedParsers.has(normalizedExt)) {
    return loadedParsers.get(normalizedExt);
  }

  // Load parser
  try {
    const module = await loader();
    const parser = module.default || module;
    loadedParsers.set(normalizedExt, parser);
    return parser;
  } catch (error) {
    // Parser not implemented yet - return null
    console.warn(`[ParserRegistry] Failed to load parser for ${extension}: ${error.message}`);
    return null;
  }
}

/**
 * Check if a file extension is supported
 * @param {string} extension - File extension (with dot)
 * @returns {boolean} - True if supported
 */
function isSupported(extension) {
  return extension.toLowerCase() in parserRegistry;
}

/**
 * Get all supported extensions
 * @returns {string[]} - Array of supported extensions
 */
function getSupportedExtensions() {
  return Object.keys(parserRegistry);
}

/**
 * Parse a file using the appropriate parser
 * @param {Object|string} file - File object with path/relativePath or just path string
 * @param {Object} options - Parser options
 * @returns {Promise<ParseResult|null>} - Parse result or null if unsupported
 */
async function parseFile(file, options = {}) {
  const filePath = typeof file === 'string' ? file : (file.path || file.relativePath);
  const extension = (0,external_path_.extname)(filePath);

  const parser = await getParser(extension);
  if (!parser) {
    return null;
  }

  // Find the parse function
  const parseFn = parser.parse || parser.parseFile || parser.parseJavaScript || parser.default;
  if (typeof parseFn !== 'function') {
    console.warn(`[ParserRegistry] No parse function found for ${extension}`);
    return null;
  }

  try {
    return await parseFn(file, options);
  } catch (error) {
    return {
      file: { path: filePath, relativePath: filePath },
      content: '',
      functions: [],
      classes: [],
      exports: [],
      imports: [],
      annotations: [],
      lines: 0,
      size: 0,
      parseMethod: 'error',
      error: error.message
    };
  }
}

/**
 * Parse multiple files in parallel
 * @param {Array<Object|string>} files - Array of file objects or paths
 * @param {Object} options - Parser options
 * @param {number} [options.concurrency=10] - Max concurrent parses
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<ParseResult[]>} - Array of parse results
 */
async function parseFiles(files, options = {}) {
  const { concurrency = 10, onProgress } = options;
  const results = [];
  const total = files.length;

  // Process in batches
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(file => parseFile(file, options))
    );

    results.push(...batchResults.filter(r => r !== null));

    if (onProgress) {
      onProgress({ current: Math.min(i + concurrency, total), total });
    }
  }

  return results;
}

/**
 * Get language info for a file extension
 * @param {string} extension - File extension
 * @returns {Object} - Language info
 */
function getLanguageInfo(extension) {
  const ext = extension.toLowerCase();
  const languageMap = {
    '.js': { name: 'JavaScript', family: 'js' },
    '.mjs': { name: 'JavaScript', family: 'js' },
    '.cjs': { name: 'JavaScript', family: 'js' },
    '.jsx': { name: 'JSX', family: 'js' },
    '.ts': { name: 'TypeScript', family: 'js' },
    '.mts': { name: 'TypeScript', family: 'js' },
    '.cts': { name: 'TypeScript', family: 'js' },
    '.tsx': { name: 'TSX', family: 'js' },
    '.vue': { name: 'Vue', family: 'js' },
    '.svelte': { name: 'Svelte', family: 'js' },
    '.java': { name: 'Java', family: 'jvm' },
    '.kt': { name: 'Kotlin', family: 'jvm' },
    '.kts': { name: 'Kotlin Script', family: 'jvm' },
    '.scala': { name: 'Scala', family: 'jvm' },
    '.cs': { name: 'C#', family: 'dotnet' },
    '.fs': { name: 'F#', family: 'dotnet' },
    '.vb': { name: 'Visual Basic', family: 'dotnet' },
    '.py': { name: 'Python', family: 'python' },
    '.pyi': { name: 'Python Stub', family: 'python' },
    '.go': { name: 'Go', family: 'go' },
    '.rs': { name: 'Rust', family: 'rust' },
    '.rb': { name: 'Ruby', family: 'ruby' },
    '.php': { name: 'PHP', family: 'php' },
    '.swift': { name: 'Swift', family: 'swift' }
  };

  return languageMap[ext] || { name: 'Unknown', family: 'unknown' };
}

/* harmony default export */ const registry = ({
  getParser,
  isSupported,
  getSupportedExtensions,
  parseFile,
  parseFiles,
  getLanguageInfo
});

;// CONCATENATED MODULE: ./shared/scanner/analysers/imports.mjs
// src/scanner/analysers/imports.mjs
// Import/export graph analysis

/**
 * Analyse import relationships
 */
async function analyseImports(jsAnalysis, onProgress = () => {}) {
  const graph = new Map();
  const usedPackages = new Set();
  const unusedExports = [];
  const total = jsAnalysis.length;

  for (let i = 0; i < jsAnalysis.length; i++) {
    const file = jsAnalysis[i];

    // Report progress every 2 files and yield to event loop
    if (i % 2 === 0 || i === total - 1) {
      onProgress({ current: i + 1, total, file: file.file?.relativePath || file.file });
      await new Promise(resolve => setImmediate(resolve));
    }
    const filePath = file.file?.relativePath || file.file;

    // Track imports
    for (const imp of file.imports || []) {
      const module = imp.module;
      if (typeof module !== "string") continue;

      // Track npm packages
      if (!module.startsWith('.') && !module.startsWith('/')) {
        const packageName = module.startsWith('@')
          ? module.split('/').slice(0, 2).join('/')
          : module.split('/')[0];
        usedPackages.add(packageName);
      }

      // Build graph
      if (!graph.has(filePath)) {
        graph.set(filePath, { imports: [], exports: [], importedBy: [] });
      }
      graph.get(filePath).imports.push(module);
    }

    // Track exports
    for (const exp of file.exports || []) {
      if (!graph.has(filePath)) {
        graph.set(filePath, { imports: [], exports: [], importedBy: [] });
      }
      graph.get(filePath).exports.push(exp);
    }
  }

  return {
    graph,
    usedPackages,
    unusedExports,
    fileCount: graph.size
  };
}

/* harmony default export */ const imports = ({ analyseImports });

// EXTERNAL MODULE: ./node_modules/@babel/parser/lib/index.js
var lib = __webpack_require__(5429);
// EXTERNAL MODULE: ./node_modules/@babel/traverse/lib/index.js
var traverse_lib = __webpack_require__(148);
// EXTERNAL MODULE: external "child_process"
var external_child_process_ = __webpack_require__(5317);
;// CONCATENATED MODULE: ./shared/scanner/analysers/buildSystems.mjs
// src/scanner/analysers/buildSystems.mjs
// Enterprise build system detection for monorepos and multi-language projects





/**
 * Detected build system info
 * @typedef {Object} BuildSystemInfo
 * @property {string} type - Build system type (gradle, maven, bazel, etc.)
 * @property {string} configFile - Path to config file
 * @property {string[]} packages - Detected package/module directories
 * @property {Object} metadata - Additional metadata
 */

/**
 * Detect all build systems in a project
 * @param {string} projectPath - Path to project root
 * @returns {BuildSystemInfo[]} - Array of detected build systems
 */
function detectBuildSystems(projectPath) {
  if (!projectPath || !(0,external_fs_.existsSync)(projectPath)) return [];

  const systems = [];

  // JavaScript/TypeScript (already partially handled)
  systems.push(...detectTurborepo(projectPath));

  // JVM
  systems.push(...detectGradle(projectPath));
  systems.push(...detectMaven(projectPath));

  // Bazel/Buck/Pants
  systems.push(...detectBazel(projectPath));
  systems.push(...detectBuck(projectPath));
  systems.push(...detectPants(projectPath));

  // Go
  systems.push(...detectGoWorkspace(projectPath));

  // .NET
  systems.push(...detectDotNet(projectPath));

  // Rust
  systems.push(...detectCargo(projectPath));

  // Python
  systems.push(...detectPythonProject(projectPath));

  return systems;
}

/**
 * Get all package directories from detected build systems
 * @param {string} projectPath - Path to project root
 * @returns {string[]} - Array of package directory paths (relative)
 */
function getPackageDirectories(projectPath) {
  const systems = detectBuildSystems(projectPath);
  const dirs = new Set();

  for (const system of systems) {
    for (const pkg of system.packages || []) {
      dirs.add(pkg);
    }
  }

  return [...dirs];
}

// ═══════════════════════════════════════════════════════════════════════════
// Turborepo
// ═══════════════════════════════════════════════════════════════════════════

function detectTurborepo(projectPath) {
  const turboPath = (0,external_path_.join)(projectPath, 'turbo.json');
  if (!(0,external_fs_.existsSync)(turboPath)) return [];

  try {
    const content = (0,external_fs_.readFileSync)(turboPath, 'utf-8');
    const turbo = JSON.parse(content);

    // Turborepo uses package.json workspaces for packages
    // turbo.json defines the pipeline
    const pipelines = Object.keys(turbo.pipeline || turbo.tasks || {});

    return [{
      type: 'turborepo',
      configFile: 'turbo.json',
      packages: [],  // Packages come from package.json workspaces
      metadata: { pipelines }
    }];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Gradle (Java/Kotlin)
// ═══════════════════════════════════════════════════════════════════════════

function detectGradle(projectPath) {
  const settingsFiles = ['settings.gradle', 'settings.gradle.kts'];
  const results = [];

  for (const settingsFile of settingsFiles) {
    const settingsPath = (0,external_path_.join)(projectPath, settingsFile);
    if (!(0,external_fs_.existsSync)(settingsPath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(settingsPath, 'utf-8');
      const packages = [];

      // Parse include statements
      // include ':app', ':core', ':shared:utils'
      // include(":app", ":core")
      const includePatterns = [
        /include\s*\(\s*['"]([^'"]+)['"]/g,              // include(":app")
        /include\s+['"]([^'"]+)['"]/g,                    // include ':app'
        /include\s*\(\s*([^)]+)\)/g,                      // include(":app", ":core")
      ];

      for (const pattern of includePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const modules = match[1].split(/[,\s]+/).map(m =>
            m.replace(/['"]/g, '').replace(/^:/, '').replace(/:/g, '/')
          ).filter(m => m);
          packages.push(...modules);
        }
      }

      // Parse includeFlat
      const flatPattern = /includeFlat\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = flatPattern.exec(content)) !== null) {
        packages.push(`../${match[1]}`);
      }

      results.push({
        type: 'gradle',
        configFile: settingsFile,
        packages: [...new Set(packages)],
        metadata: { isKotlinDsl: settingsFile.endsWith('.kts') }
      });
    } catch {
      // Ignore parse errors
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// Maven (Java)
// ═══════════════════════════════════════════════════════════════════════════

function detectMaven(projectPath) {
  const pomPath = (0,external_path_.join)(projectPath, 'pom.xml');
  if (!(0,external_fs_.existsSync)(pomPath)) return [];

  try {
    const content = (0,external_fs_.readFileSync)(pomPath, 'utf-8');
    const packages = [];

    // Parse <modules> section
    // <modules>
    //   <module>core</module>
    //   <module>api</module>
    // </modules>
    const modulesMatch = content.match(/<modules>([\s\S]*?)<\/modules>/);
    if (modulesMatch) {
      const modulePattern = /<module>([^<]+)<\/module>/g;
      let match;
      while ((match = modulePattern.exec(modulesMatch[1])) !== null) {
        packages.push(match[1].trim());
      }
    }

    // Recursively check for submodule pom.xml files
    for (const pkg of [...packages]) {
      const subPomPath = (0,external_path_.join)(projectPath, pkg, 'pom.xml');
      if ((0,external_fs_.existsSync)(subPomPath)) {
        try {
          const subContent = (0,external_fs_.readFileSync)(subPomPath, 'utf-8');
          const subModulesMatch = subContent.match(/<modules>([\s\S]*?)<\/modules>/);
          if (subModulesMatch) {
            const modulePattern = /<module>([^<]+)<\/module>/g;
            let match;
            while ((match = modulePattern.exec(subModulesMatch[1])) !== null) {
              packages.push(`${pkg}/${match[1].trim()}`);
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    // Extract artifactId for metadata
    const artifactIdMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
    const groupIdMatch = content.match(/<groupId>([^<]+)<\/groupId>/);

    return [{
      type: 'maven',
      configFile: 'pom.xml',
      packages: [...new Set(packages)],
      metadata: {
        artifactId: artifactIdMatch?.[1],
        groupId: groupIdMatch?.[1]
      }
    }];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Bazel
// ═══════════════════════════════════════════════════════════════════════════

function detectBazel(projectPath) {
  const workspaceFiles = ['WORKSPACE', 'WORKSPACE.bazel', 'MODULE.bazel'];
  let foundConfig = null;

  for (const wsFile of workspaceFiles) {
    const wsPath = (0,external_path_.join)(projectPath, wsFile);
    if ((0,external_fs_.existsSync)(wsPath)) {
      foundConfig = wsFile;
      break;
    }
  }

  if (!foundConfig) return [];

  // Find all BUILD files to identify packages
  const packages = [];
  try {
    const buildFiles = (0,esm.globSync)('**/BUILD{,.bazel}', {
      cwd: projectPath,
      ignore: ['bazel-*/**', 'node_modules/**', '.git/**']
    });

    for (const buildFile of buildFiles) {
      const dir = (0,external_path_.dirname)(buildFile);
      if (dir !== '.') {
        packages.push(dir);
      }
    }
  } catch {
    // Ignore glob errors
  }

  return [{
    type: 'bazel',
    configFile: foundConfig,
    packages,
    metadata: { isBzlmod: foundConfig === 'MODULE.bazel' }
  }];
}

// ═══════════════════════════════════════════════════════════════════════════
// Buck/Buck2 (Meta)
// ═══════════════════════════════════════════════════════════════════════════

function detectBuck(projectPath) {
  const buckConfigs = ['.buckconfig'];
  let foundConfig = null;

  for (const cfg of buckConfigs) {
    if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, cfg))) {
      foundConfig = cfg;
      break;
    }
  }

  if (!foundConfig) return [];

  // Find all BUCK files
  const packages = [];
  try {
    const buckFiles = (0,esm.globSync)('**/BUCK{,.v2}', {
      cwd: projectPath,
      ignore: ['buck-out/**', 'node_modules/**', '.git/**']
    });

    for (const buckFile of buckFiles) {
      const dir = (0,external_path_.dirname)(buckFile);
      if (dir !== '.') {
        packages.push(dir);
      }
    }
  } catch {
    // Ignore glob errors
  }

  return [{
    type: 'buck',
    configFile: foundConfig,
    packages,
    metadata: {}
  }];
}

// ═══════════════════════════════════════════════════════════════════════════
// Pants
// ═══════════════════════════════════════════════════════════════════════════

function detectPants(projectPath) {
  const pantsPath = (0,external_path_.join)(projectPath, 'pants.toml');
  if (!(0,external_fs_.existsSync)(pantsPath)) return [];

  const packages = [];

  try {
    const content = (0,external_fs_.readFileSync)(pantsPath, 'utf-8');

    // Parse source_roots from pants.toml
    // [source]
    // root_patterns = ["src/*", "tests/*"]
    const rootPatternsMatch = content.match(/root_patterns\s*=\s*\[(.*?)\]/s);
    if (rootPatternsMatch) {
      const patterns = rootPatternsMatch[1].match(/["']([^"']+)["']/g);
      if (patterns) {
        for (const p of patterns) {
          const pattern = p.replace(/["']/g, '');
          const baseDir = pattern.replace(/\/?\*.*$/, '');
          if (baseDir && (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, baseDir))) {
            try {
              const entries = (0,external_fs_.readdirSync)((0,external_path_.join)(projectPath, baseDir), { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  packages.push(`${baseDir}/${entry.name}`);
                }
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Also find BUILD files (Pants uses same format as Bazel)
  try {
    const buildFiles = (0,esm.globSync)('**/BUILD', {
      cwd: projectPath,
      ignore: ['dist/**', 'node_modules/**', '.git/**', '.pants.d/**']
    });

    for (const buildFile of buildFiles) {
      const dir = (0,external_path_.dirname)(buildFile);
      if (dir !== '.' && !packages.includes(dir)) {
        packages.push(dir);
      }
    }
  } catch {
    // Ignore glob errors
  }

  return [{
    type: 'pants',
    configFile: 'pants.toml',
    packages: [...new Set(packages)],
    metadata: {}
  }];
}

// ═══════════════════════════════════════════════════════════════════════════
// Go Workspaces
// ═══════════════════════════════════════════════════════════════════════════

function detectGoWorkspace(projectPath) {
  const goWorkPath = (0,external_path_.join)(projectPath, 'go.work');
  if (!(0,external_fs_.existsSync)(goWorkPath)) return [];

  try {
    const content = (0,external_fs_.readFileSync)(goWorkPath, 'utf-8');
    const packages = [];

    // Parse use directives
    // use (
    //     ./cmd/server
    //     ./pkg/utils
    // )
    // or: use ./cmd/server
    const useBlockMatch = content.match(/use\s*\(([\s\S]*?)\)/);
    if (useBlockMatch) {
      const lines = useBlockMatch[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('//')) {
          packages.push(trimmed.replace(/^\.\//, ''));
        }
      }
    }

    // Single use directive
    const singleUsePattern = /^use\s+(\S+)/gm;
    let match;
    while ((match = singleUsePattern.exec(content)) !== null) {
      if (!match[1].startsWith('(')) {
        packages.push(match[1].replace(/^\.\//, ''));
      }
    }

    return [{
      type: 'go-workspace',
      configFile: 'go.work',
      packages: [...new Set(packages)],
      metadata: {}
    }];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// .NET Solutions
// ═══════════════════════════════════════════════════════════════════════════

function detectDotNet(projectPath) {
  const results = [];

  try {
    // Find .sln files
    const slnFiles = (0,esm.globSync)('*.sln', { cwd: projectPath });

    for (const slnFile of slnFiles) {
      const slnPath = (0,external_path_.join)(projectPath, slnFile);
      const content = (0,external_fs_.readFileSync)(slnPath, 'utf-8');
      const packages = [];

      // Parse Project lines
      // Project("{GUID}") = "ProjectName", "path\to\project.csproj", "{GUID}"
      const projectPattern = /Project\("[^"]+"\)\s*=\s*"([^"]+)",\s*"([^"]+)",\s*"[^"]+"/g;
      let match;
      while ((match = projectPattern.exec(content)) !== null) {
        const projectPath = match[2].replace(/\\/g, '/');
        // Get directory containing the .csproj
        const projectDir = (0,external_path_.dirname)(projectPath);
        if (projectDir && projectDir !== '.') {
          packages.push(projectDir);
        }
      }

      results.push({
        type: 'dotnet-solution',
        configFile: slnFile,
        packages: [...new Set(packages)],
        metadata: {}
      });
    }
  } catch {
    // Ignore errors
  }

  // Also detect Directory.Build.props for SDK-style projects
  if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'Directory.Build.props'))) {
    // Find all .csproj files
    try {
      const csprojFiles = (0,esm.globSync)('**/*.csproj', {
        cwd: projectPath,
        ignore: ['**/bin/**', '**/obj/**', 'node_modules/**']
      });

      const packages = csprojFiles.map(f => (0,external_path_.dirname)(f)).filter(d => d !== '.');

      if (packages.length > 0 && !results.some(r => r.type === 'dotnet-solution')) {
        results.push({
          type: 'dotnet-sdk',
          configFile: 'Directory.Build.props',
          packages: [...new Set(packages)],
          metadata: {}
        });
      }
    } catch {
      // Ignore
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cargo Workspaces (Rust)
// ═══════════════════════════════════════════════════════════════════════════

function detectCargo(projectPath) {
  const cargoPath = (0,external_path_.join)(projectPath, 'Cargo.toml');
  if (!(0,external_fs_.existsSync)(cargoPath)) return [];

  try {
    const content = (0,external_fs_.readFileSync)(cargoPath, 'utf-8');
    const packages = [];

    // Check for [workspace] section
    if (!content.includes('[workspace]')) {
      // Single crate, not a workspace
      return [{
        type: 'cargo-single',
        configFile: 'Cargo.toml',
        packages: [],
        metadata: {}
      }];
    }

    // Parse members
    // [workspace]
    // members = ["crates/*", "tools/cli"]
    const membersMatch = content.match(/members\s*=\s*\[([\s\S]*?)\]/);
    if (membersMatch) {
      const memberStrings = membersMatch[1].match(/["']([^"']+)["']/g);
      if (memberStrings) {
        for (const memberStr of memberStrings) {
          const member = memberStr.replace(/["']/g, '');
          if (member.includes('*')) {
            // Glob pattern - expand it
            const baseDir = member.replace(/\/?\*.*$/, '');
            if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, baseDir))) {
              try {
                const entries = (0,external_fs_.readdirSync)((0,external_path_.join)(projectPath, baseDir), { withFileTypes: true });
                for (const entry of entries) {
                  if (entry.isDirectory() && (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, baseDir, entry.name, 'Cargo.toml'))) {
                    packages.push(`${baseDir}/${entry.name}`);
                  }
                }
              } catch {
                // Ignore
              }
            }
          } else {
            packages.push(member);
          }
        }
      }
    }

    // Parse exclude (these should NOT be packages)
    const excludeMatch = content.match(/exclude\s*=\s*\[([\s\S]*?)\]/);
    const excludes = new Set();
    if (excludeMatch) {
      const excludeStrings = excludeMatch[1].match(/["']([^"']+)["']/g);
      if (excludeStrings) {
        for (const excStr of excludeStrings) {
          excludes.add(excStr.replace(/["']/g, ''));
        }
      }
    }

    return [{
      type: 'cargo-workspace',
      configFile: 'Cargo.toml',
      packages: packages.filter(p => !excludes.has(p)),
      metadata: { excludes: [...excludes] }
    }];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Python Projects
// ═══════════════════════════════════════════════════════════════════════════

function detectPythonProject(projectPath) {
  const results = [];

  // Check pyproject.toml (PEP 518)
  const pyprojectPath = (0,external_path_.join)(projectPath, 'pyproject.toml');
  if ((0,external_fs_.existsSync)(pyprojectPath)) {
    try {
      const content = (0,external_fs_.readFileSync)(pyprojectPath, 'utf-8');
      const packages = [];

      // Check for Poetry workspaces (experimental)
      // [tool.poetry.packages]
      // or src layout detection
      if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'src'))) {
        try {
          const srcEntries = (0,external_fs_.readdirSync)((0,external_path_.join)(projectPath, 'src'), { withFileTypes: true });
          for (const entry of srcEntries) {
            if (entry.isDirectory() && !entry.name.startsWith('_')) {
              packages.push(`src/${entry.name}`);
            }
          }
        } catch {
          // Ignore
        }
      }

      // Check for package names in [tool.poetry] or [project]
      const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);

      results.push({
        type: 'python-pyproject',
        configFile: 'pyproject.toml',
        packages,
        metadata: { name: nameMatch?.[1] }
      });
    } catch {
      // Ignore
    }
  }

  // Check setup.py
  const setupPyPath = (0,external_path_.join)(projectPath, 'setup.py');
  if ((0,external_fs_.existsSync)(setupPyPath)) {
    results.push({
      type: 'python-setup',
      configFile: 'setup.py',
      packages: (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'src')) ? ['src'] : [],
      metadata: {}
    });
  }

  return results;
}

/**
 * Merge packages from all build systems into the monorepo detection
 * This is called from deadcode.mjs extractPathAliases
 * @param {string} projectPath - Path to project root
 * @returns {Array<{dir: string, prefix: string}>} - Config dirs for alias extraction
 */
function getConfigDirsFromBuildSystems(projectPath) {
  const systems = detectBuildSystems(projectPath);
  const configDirs = [];

  for (const system of systems) {
    for (const pkg of system.packages || []) {
      configDirs.push({ dir: pkg, prefix: `${pkg}/` });
    }
  }

  return configDirs;
}

/* harmony default export */ const buildSystems = ({
  detectBuildSystems,
  getPackageDirectories,
  getConfigDirsFromBuildSystems
});

;// CONCATENATED MODULE: ./shared/scanner/analysers/generatedCode.mjs
// src/scanner/analysers/generatedCode.mjs
// Detection and exclusion of generated code files




/**
 * Default patterns for generated code files
 * These files should be excluded from dead code analysis
 */
const DEFAULT_GENERATED_PATTERNS = [
  // JavaScript/TypeScript
  /\.generated\.(ts|tsx|js|jsx|mjs)$/,
  /\.g\.(ts|js)$/,
  /\/generated\//,
  /\/__generated__\//,
  /\/codegen\//,

  // GraphQL
  /\/graphql\.(ts|tsx|js)$/,
  /\/gql\.(ts|tsx|js)$/,
  /\.graphql\.(ts|tsx|js)$/,
  /types\.generated\.(ts|tsx|js)$/,
  /\/__graphql__\//,

  // Protocol Buffers
  /_pb\.(js|d\.ts)$/,
  /_pb2\.py$/,
  /_pb2_grpc\.py$/,
  /\.pb\.(go|cc|h)$/,

  // OpenAPI/Swagger
  /\/api-client\//,
  /\/swagger-client\//,
  /\/openapi\/.*\.generated\./,

  // Java build outputs
  /\/target\/generated-sources\//,
  /\/target\/generated-test-sources\//,
  /\/build\/generated\//,
  /\/build\/generated-sources\//,
  /_\.java$/,  // MapStruct generated

  // .NET build outputs
  /\/obj\//,
  /\.Designer\.cs$/,
  /\.g\.cs$/,
  /\.g\.i\.cs$/,
  /\/Migrations\/.*\.cs$/,
  /^Migrations\/.*\.cs$/,           // Migrations at repo root (relative paths)
  /\.AssemblyAttributes\.cs$/,      // Auto-generated assembly attributes
  /GlobalSuppressions\.cs$/,        // Auto-generated code analysis suppressions

  // Go generated
  /_gen\.go$/,
  /mock_.*\.go$/,
  /.*_mock\.go$/,
  /\/mocks\/.*\.go$/,
  /_string\.go$/,  // stringer

  // Rust
  /\.rs\.bk$/,

  // Build outputs (all languages)
  /\/dist\//,
  /\/build\//,
  /\/out\//,
  /\/output\//,
  /\/.next\//,
  /\/.nuxt\//,
  /\/.output\//,
  /\/node_modules\//,
  /\/vendor\//,

  // Bazel outputs
  /\/bazel-bin\//,
  /\/bazel-out\//,
  /\/bazel-testlogs\//
];

/**
 * Header comments that indicate generated code
 */
const GENERATED_HEADERS = [
  /^\/\/ Code generated .* DO NOT EDIT/i,
  /^\/\/ AUTO-GENERATED/i,
  /^\/\/ GENERATED CODE/i,
  /^\/\/ This file was auto-?generated/i,
  /^# Generated by/i,
  /^# DO NOT EDIT/i,
  /^\s*\* @generated/,
  /^\/\*\s*eslint-disable\s*\*\//,  // Often in generated files
  /^\/\/ @ts-nocheck/,  // Often in generated files
  /@generated/,
  /DO NOT EDIT THIS FILE/i,
  /This file is auto-?generated/i,
  /Generated from /i
];

/**
 * Check if a file path matches generated code patterns
 * @param {string} filePath - File path to check
 * @param {RegExp[]} customPatterns - Additional patterns to check
 * @returns {Object} - { isGenerated: boolean, matchedPattern: string|null }
 */
function isGeneratedPath(filePath, customPatterns = []) {
  const allPatterns = [...DEFAULT_GENERATED_PATTERNS, ...customPatterns];

  for (const pattern of allPatterns) {
    if (pattern.test(filePath)) {
      return {
        isGenerated: true,
        matchedPattern: pattern.toString(),
        reason: 'path'
      };
    }
  }

  return { isGenerated: false, matchedPattern: null };
}

/**
 * Check if file content indicates generated code (by header comments)
 * @param {string} content - File content
 * @param {number} linesToCheck - Number of lines to check from start (default 20)
 * @returns {Object} - { isGenerated: boolean, matchedPattern: string|null }
 */
function isGeneratedContent(content, linesToCheck = 20) {
  if (!content) return { isGenerated: false };

  const lines = content.split('\n').slice(0, linesToCheck);
  const headerText = lines.join('\n');

  for (const pattern of GENERATED_HEADERS) {
    if (pattern.test(headerText)) {
      return {
        isGenerated: true,
        matchedPattern: pattern.toString(),
        reason: 'header'
      };
    }
  }

  return { isGenerated: false, matchedPattern: null };
}

/**
 * Check if a file is generated (by path or content)
 * @param {string} filePath - File path
 * @param {string} [content] - File content (optional, will be read if not provided)
 * @param {Object} options - Options
 * @returns {Object} - { isGenerated: boolean, reason: string|null }
 */
function isGeneratedFile(filePath, content = null, options = {}) {
  const { customPatterns = [], checkContent = true } = options;

  // First check path
  const pathCheck = isGeneratedPath(filePath, customPatterns);
  if (pathCheck.isGenerated) {
    return pathCheck;
  }

  // Then check content if requested
  if (checkContent) {
    let fileContent = content;
    if (!fileContent && (0,external_fs_.existsSync)(filePath)) {
      try {
        fileContent = (0,external_fs_.readFileSync)(filePath, 'utf-8');
      } catch {
        // Can't read file, assume not generated
        return { isGenerated: false };
      }
    }

    if (fileContent) {
      const contentCheck = isGeneratedContent(fileContent);
      if (contentCheck.isGenerated) {
        return contentCheck;
      }
    }
  }

  return { isGenerated: false, reason: null };
}

/**
 * Filter out generated files from a list
 * @param {Array} files - Array of file objects with path/relativePath
 * @param {Object} options - Options
 * @returns {Object} - { included: Array, excluded: Array }
 */
function filterGeneratedFiles(files, options = {}) {
  const included = [];
  const excluded = [];

  for (const file of files) {
    const filePath = file.relativePath || file.path || file;
    const content = file.content || null;

    const check = isGeneratedFile(filePath, content, options);
    if (check.isGenerated) {
      excluded.push({
        file: filePath,
        reason: check.reason,
        pattern: check.matchedPattern
      });
    } else {
      included.push(file);
    }
  }

  return { included, excluded };
}

/**
 * Get patterns for a specific codegen type
 * @param {string} type - Codegen type (graphql, protobuf, openapi, etc.)
 * @returns {RegExp[]} - Patterns for that type
 */
function getPatternsForCodegenType(type) {
  const typePatterns = {
    graphql: [
      /\.graphql\.(ts|tsx|js)$/,
      /\/graphql\.(ts|tsx|js)$/,
      /\/gql\.(ts|tsx|js)$/,
      /types\.generated\.(ts|tsx|js)$/,
      /\/__generated__\//,
      /operations\.(ts|tsx|js)$/
    ],
    protobuf: [
      /_pb\.(js|d\.ts)$/,
      /_pb2\.py$/,
      /_pb2_grpc\.py$/,
      /\.pb\.(go|cc|h)$/,
      /\.pb\.ts$/
    ],
    openapi: [
      /\/api-client\//,
      /\/swagger-client\//,
      /\/openapi\/.*\.generated\./,
      /api\.generated\.(ts|js)$/
    ],
    thrift: [
      /_types\.(js|ts)$/,
      /\.thrift\.ts$/
    ],
    grpc: [
      /_grpc_pb\.(js|ts)$/,
      /_grpc\.pb\.go$/
    ]
  };

  return typePatterns[type] || [];
}

/**
 * Find codegen config files in a project
 * @param {string} projectPath - Path to project root
 * @param {Object} codegenConfigs - Config file patterns by type
 * @returns {Array} - Found config files
 */
function findCodegenConfigs(projectPath, codegenConfigs = {}) {
  const defaults = {
    graphql: ['codegen.yml', 'codegen.yaml', 'codegen.ts', 'codegen.js', '.graphqlrc.yml', '.graphqlrc.json'],
    protobuf: ['buf.yaml', 'buf.gen.yaml', 'buf.work.yaml'],
    openapi: ['openapi.yaml', 'openapi.yml', 'openapi.json', 'swagger.yaml', 'swagger.json'],
    grpc: ['grpc-tools.config.js']
  };

  const configs = { ...defaults, ...codegenConfigs };
  const found = [];

  for (const [type, files] of Object.entries(configs)) {
    for (const file of files) {
      const fullPath = `${projectPath}/${file}`;
      if ((0,external_fs_.existsSync)(fullPath)) {
        found.push({
          type,
          file,
          path: fullPath
        });
      }
    }
  }

  return found;
}

/* harmony default export */ const generatedCode = ({
  isGeneratedPath,
  isGeneratedContent,
  isGeneratedFile,
  filterGeneratedFiles,
  getPatternsForCodegenType,
  findCodegenConfigs,
  DEFAULT_GENERATED_PATTERNS
});

;// CONCATENATED MODULE: ./shared/scanner/analysers/configParsers.mjs
// src/scanner/analysers/configParsers.mjs
// CI/CD and Bundler configuration parsers for entry point detection





/**
 * Parse Webpack configuration for entry points
 * @param {string} projectPath - Project root path
 * @returns {Object} - { entries: string[], mode: string }
 */
function parseWebpackConfig(projectPath) {
  const configFiles = [
    'webpack.config.js',
    'webpack.config.mjs',
    'webpack.config.ts',
    'webpack.config.cjs',
    'webpack.dev.js',
    'webpack.prod.js',
    'webpack.common.js'
  ];

  const entries = [];
  let mode = 'unknown';

  for (const configFile of configFiles) {
    const configPath = (0,external_path_.join)(projectPath, configFile);
    if (!(0,external_fs_.existsSync)(configPath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(configPath, 'utf-8');

      // Extract entry points
      // Pattern: entry: './src/index.js' or entry: { main: './src/index.js' }
      const singleEntryMatch = content.match(/entry\s*:\s*['"]([^'"]+)['"]/);
      if (singleEntryMatch) {
        entries.push(singleEntryMatch[1]);
      }

      // Object entries: entry: { name: 'path' }
      const objectEntryMatch = content.match(/entry\s*:\s*\{([^}]+)\}/s);
      if (objectEntryMatch) {
        const entryBlock = objectEntryMatch[1];
        const pathMatches = entryBlock.matchAll(/['"]([^'"]+\.(?:js|ts|jsx|tsx|mjs))['"]/g);
        for (const match of pathMatches) {
          entries.push(match[1]);
        }
      }

      // Array entries: entry: ['./src/a.js', './src/b.js']
      const arrayEntryMatch = content.match(/entry\s*:\s*\[([^\]]+)\]/s);
      if (arrayEntryMatch) {
        const arrayBlock = arrayEntryMatch[1];
        const pathMatches = arrayBlock.matchAll(/['"]([^'"]+)['"]/g);
        for (const match of pathMatches) {
          entries.push(match[1]);
        }
      }

      // Detect mode
      if (content.includes("mode: 'production'") || content.includes('mode: "production"')) {
        mode = 'production';
      } else if (content.includes("mode: 'development'") || content.includes('mode: "development"')) {
        mode = 'development';
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { entries: [...new Set(entries)], mode };
}

/**
 * Parse Vite configuration for entry points
 * @param {string} projectPath - Project root path
 * @returns {Object} - { entries: string[], framework: string|null }
 */
function parseViteConfig(projectPath) {
  const configFiles = [
    'vite.config.js',
    'vite.config.ts',
    'vite.config.mjs'
  ];

  const entries = [];
  let framework = null;

  for (const configFile of configFiles) {
    const configPath = (0,external_path_.join)(projectPath, configFile);
    if (!(0,external_fs_.existsSync)(configPath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(configPath, 'utf-8');

      // Default entry is index.html, but check for custom entries
      // build.rollupOptions.input
      const inputMatch = content.match(/input\s*:\s*['"]([^'"]+)['"]/);
      if (inputMatch) {
        entries.push(inputMatch[1]);
      }

      // Object input: { main: 'src/main.ts' }
      const objectInputMatch = content.match(/input\s*:\s*\{([^}]+)\}/s);
      if (objectInputMatch) {
        const inputBlock = objectInputMatch[1];
        const pathMatches = inputBlock.matchAll(/['"]([^'"]+\.(?:html|js|ts|jsx|tsx))['"]/g);
        for (const match of pathMatches) {
          entries.push(match[1]);
        }
      }

      // Detect framework
      if (content.includes('@vitejs/plugin-react') || content.includes('vite-plugin-react')) {
        framework = 'react';
      } else if (content.includes('@vitejs/plugin-vue')) {
        framework = 'vue';
      } else if (content.includes('@sveltejs/vite-plugin-svelte')) {
        framework = 'svelte';
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check for index.html as default entry
  if (entries.length === 0 && (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'index.html'))) {
    entries.push('index.html');
  }

  return { entries: [...new Set(entries)], framework };
}

/**
 * Parse Rollup configuration for entry points
 * @param {string} projectPath - Project root path
 * @returns {Object} - { entries: string[], outputFormats: string[] }
 */
function parseRollupConfig(projectPath) {
  const configFiles = [
    'rollup.config.js',
    'rollup.config.mjs',
    'rollup.config.ts'
  ];

  const entries = [];
  const outputFormats = [];

  for (const configFile of configFiles) {
    const configPath = (0,external_path_.join)(projectPath, configFile);
    if (!(0,external_fs_.existsSync)(configPath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(configPath, 'utf-8');

      // Input: 'src/index.js' or input: ['src/a.js', 'src/b.js']
      const singleInputMatch = content.match(/input\s*:\s*['"]([^'"]+)['"]/);
      if (singleInputMatch) {
        entries.push(singleInputMatch[1]);
      }

      const arrayInputMatch = content.match(/input\s*:\s*\[([^\]]+)\]/s);
      if (arrayInputMatch) {
        const arrayBlock = arrayInputMatch[1];
        const pathMatches = arrayBlock.matchAll(/['"]([^'"]+)['"]/g);
        for (const match of pathMatches) {
          entries.push(match[1]);
        }
      }

      // Detect output formats
      const formatMatches = content.matchAll(/format\s*:\s*['"](\w+)['"]/g);
      for (const match of formatMatches) {
        outputFormats.push(match[1]);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { entries: [...new Set(entries)], outputFormats: [...new Set(outputFormats)] };
}

/**
 * Parse esbuild configuration for entry points
 * @param {string} projectPath - Project root path
 * @returns {Object} - { entries: string[] }
 */
function parseEsbuildConfig(projectPath) {
  const configFiles = [
    'esbuild.config.js',
    'esbuild.config.mjs',
    'esbuild.mjs',
    'build.mjs'
  ];

  const entries = [];

  for (const configFile of configFiles) {
    const configPath = (0,external_path_.join)(projectPath, configFile);
    if (!(0,external_fs_.existsSync)(configPath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(configPath, 'utf-8');

      // entryPoints: ['src/index.ts']
      const entryPointsMatch = content.match(/entryPoints\s*:\s*\[([^\]]+)\]/s);
      if (entryPointsMatch) {
        const arrayBlock = entryPointsMatch[1];
        const pathMatches = arrayBlock.matchAll(/['"]([^'"]+)['"]/g);
        for (const match of pathMatches) {
          entries.push(match[1]);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { entries: [...new Set(entries)] };
}

/**
 * Parse Parcel configuration (uses package.json source/main)
 * @param {string} projectPath - Project root path
 * @returns {Object} - { entries: string[] }
 */
function parseParcelConfig(projectPath) {
  const entries = [];

  const pkgPath = (0,external_path_.join)(projectPath, 'package.json');
  if ((0,external_fs_.existsSync)(pkgPath)) {
    try {
      const pkg = JSON.parse((0,external_fs_.readFileSync)(pkgPath, 'utf-8'));

      // Parcel uses 'source' field
      if (pkg.source) {
        if (Array.isArray(pkg.source)) {
          entries.push(...pkg.source);
        } else {
          entries.push(pkg.source);
        }
      }

      // Also check for targets in .parcelrc
      const parcelrcPath = (0,external_path_.join)(projectPath, '.parcelrc');
      if ((0,external_fs_.existsSync)(parcelrcPath)) {
        const parcelrc = JSON.parse((0,external_fs_.readFileSync)(parcelrcPath, 'utf-8'));
        // Extract entries from targets if defined
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { entries: [...new Set(entries)] };
}

/**
 * Parse GitHub Actions workflow for script references
 * @param {string} projectPath - Project root path
 * @returns {Object} - { scripts: string[], testCommands: string[] }
 */
function parseGitHubActions(projectPath) {
  const workflowDir = (0,external_path_.join)(projectPath, '.github', 'workflows');
  if (!(0,external_fs_.existsSync)(workflowDir)) {
    return { scripts: [], testCommands: [] };
  }

  const scripts = [];
  const testCommands = [];

  try {
    const workflowFiles = (0,esm.globSync)('*.{yml,yaml}', { cwd: workflowDir });

    for (const file of workflowFiles) {
      const content = (0,external_fs_.readFileSync)((0,external_path_.join)(workflowDir, file), 'utf-8');

      // Extract run commands
      const runMatches = content.matchAll(/run\s*:\s*(?:\|-)?\s*\n?\s*(.+)/g);
      for (const match of runMatches) {
        const command = match[1].trim();

        // Look for script executions
        const scriptMatch = command.match(/(?:node|npx|ts-node|tsx)\s+([^\s|&;]+)/);
        if (scriptMatch) {
          scripts.push(scriptMatch[1]);
        }

        // Look for test commands
        if (command.includes('test') || command.includes('jest') || command.includes('vitest') ||
            command.includes('mocha') || command.includes('cypress') || command.includes('playwright')) {
          testCommands.push(command);
        }
      }

      // Extract npm/yarn script references
      const npmRunMatches = content.matchAll(/(?:npm|yarn|pnpm)\s+(?:run\s+)?(\w+)/g);
      for (const match of npmRunMatches) {
        scripts.push(`npm:${match[1]}`);
      }
    }
  } catch {
    // Ignore errors
  }

  return { scripts: [...new Set(scripts)], testCommands: [...new Set(testCommands)] };
}

/**
 * Parse GitLab CI configuration
 * @param {string} projectPath - Project root path
 * @returns {Object} - { scripts: string[], stages: string[] }
 */
function parseGitLabCI(projectPath) {
  const ciPath = (0,external_path_.join)(projectPath, '.gitlab-ci.yml');
  if (!(0,external_fs_.existsSync)(ciPath)) {
    return { scripts: [], stages: [] };
  }

  const scripts = [];
  const stages = [];

  try {
    const content = (0,external_fs_.readFileSync)(ciPath, 'utf-8');

    // Extract stages
    const stagesMatch = content.match(/stages:\s*\n((?:\s+-\s+\w+\n?)*)/);
    if (stagesMatch) {
      const stageLines = stagesMatch[1].split('\n');
      for (const line of stageLines) {
        const match = line.match(/^\s*-\s+(\w+)/);
        if (match) stages.push(match[1]);
      }
    }

    // Extract script commands
    const scriptMatches = content.matchAll(/script:\s*\n?((?:\s+-\s+.+\n?)*)/g);
    for (const match of scriptMatches) {
      const scriptLines = match[1].split('\n');
      for (const line of scriptLines) {
        const cmdMatch = line.match(/^\s*-\s+(.+)/);
        if (cmdMatch) {
          const command = cmdMatch[1].trim();
          const scriptMatch = command.match(/(?:node|npx|ts-node|tsx)\s+([^\s|&;]+)/);
          if (scriptMatch) {
            scripts.push(scriptMatch[1]);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return { scripts: [...new Set(scripts)], stages: [...new Set(stages)] };
}

/**
 * Parse Jenkins configuration (Jenkinsfile)
 * @param {string} projectPath - Project root path
 * @returns {Object} - { scripts: string[], stages: string[] }
 */
function parseJenkinsfile(projectPath) {
  const jenkinsfiles = ['Jenkinsfile', 'jenkinsfile', 'Jenkinsfile.groovy'];
  const scripts = [];
  const stages = [];

  for (const jenkinsfile of jenkinsfiles) {
    const filePath = (0,external_path_.join)(projectPath, jenkinsfile);
    if (!(0,external_fs_.existsSync)(filePath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(filePath, 'utf-8');

      // Extract stage names
      const stageMatches = content.matchAll(/stage\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of stageMatches) {
        stages.push(match[1]);
      }

      // Extract sh commands
      const shMatches = content.matchAll(/sh\s+['"]([^'"]+)['"]/g);
      for (const match of shMatches) {
        const command = match[1];
        const scriptMatch = command.match(/(?:node|npx|ts-node|tsx)\s+([^\s|&;]+)/);
        if (scriptMatch) {
          scripts.push(scriptMatch[1]);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return { scripts: [...new Set(scripts)], stages: [...new Set(stages)] };
}

/**
 * Parse Docker configuration for entry points
 * @param {string} projectPath - Project root path
 * @returns {Object} - { entrypoints: string[], cmdScripts: string[] }
 */
function parseDockerConfig(projectPath) {
  const dockerfiles = ['Dockerfile', 'dockerfile', 'Dockerfile.dev', 'Dockerfile.prod'];
  const entrypoints = [];
  const cmdScripts = [];

  for (const dockerfile of dockerfiles) {
    const filePath = (0,external_path_.join)(projectPath, dockerfile);
    if (!(0,external_fs_.existsSync)(filePath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(filePath, 'utf-8');

      // Extract ENTRYPOINT
      const entrypointMatches = content.matchAll(/ENTRYPOINT\s+\[([^\]]+)\]/g);
      for (const match of entrypointMatches) {
        const parts = match[1].match(/['"]([^'"]+)['"]/g);
        if (parts) {
          const script = parts.find(p => p.includes('.js') || p.includes('.ts') || p.includes('.mjs'));
          if (script) entrypoints.push(script.replace(/['"]/g, ''));
        }
      }

      // Extract CMD
      const cmdMatches = content.matchAll(/CMD\s+\[([^\]]+)\]/g);
      for (const match of cmdMatches) {
        const parts = match[1].match(/['"]([^'"]+)['"]/g);
        if (parts) {
          const script = parts.find(p => p.includes('.js') || p.includes('.ts') || p.includes('.mjs'));
          if (script) cmdScripts.push(script.replace(/['"]/g, ''));
        }
      }

      // Shell form: CMD node app.js
      const shellCmdMatch = content.match(/CMD\s+(?:node|npm|yarn|npx)\s+([^\s\n]+)/);
      if (shellCmdMatch) {
        cmdScripts.push(shellCmdMatch[1]);
      }
    } catch {
      // Ignore errors
    }
  }

  // Check docker-compose.yml
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  for (const composeFile of composeFiles) {
    const filePath = (0,external_path_.join)(projectPath, composeFile);
    if (!(0,external_fs_.existsSync)(filePath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(filePath, 'utf-8');

      // Extract command from services
      const commandMatches = content.matchAll(/command:\s*(?:\[([^\]]+)\]|(.+))/g);
      for (const match of commandMatches) {
        const cmdBlock = match[1] || match[2];
        const scriptMatch = cmdBlock?.match(/(?:node|npm|yarn|npx)\s+([^\s|&;'"]+)/);
        if (scriptMatch) {
          cmdScripts.push(scriptMatch[1]);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return {
    entrypoints: [...new Set(entrypoints)],
    cmdScripts: [...new Set(cmdScripts)]
  };
}

/**
 * Parse Webpack Module Federation exposes configuration
 * Searches root and common subdirectories for monorepo-style projects
 * @param {string} projectPath - Project root path
 * @returns {Object} - { exposes: string[], remotes: string[] }
 */
function parseModuleFederationConfig(projectPath) {
  const configFileNames = [
    'webpack.config.js',
    'webpack.config.mjs',
    'webpack.config.ts',
    'webpack.dev.js',
    'webpack.prod.js'
  ];

  const exposes = [];
  const remotes = [];

  // Search in root and subdirectories
  const searchDirs = [''];

  // Find potential app directories
  try {
    const entries = (0,esm.globSync)('*/', { cwd: projectPath, ignore: ['node_modules/'] });
    for (const entry of entries) {
      const entryPath = entry.replace(/\/$/, '');
      // Check if this directory has a webpack config
      for (const configName of configFileNames) {
        if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, entryPath, configName))) {
          searchDirs.push(entryPath);
          break;
        }
      }
    }
  } catch {
    // Ignore glob errors
  }

  for (const searchDir of searchDirs) {
    const basePath = searchDir ? (0,external_path_.join)(projectPath, searchDir) : projectPath;
    const relativePrefix = searchDir ? searchDir + '/' : '';

    for (const configFile of configFileNames) {
      const configPath = (0,external_path_.join)(basePath, configFile);
      if (!(0,external_fs_.existsSync)(configPath)) continue;

      try {
        const content = (0,external_fs_.readFileSync)(configPath, 'utf-8');

        // Check for ModuleFederationPlugin
        if (!content.includes('ModuleFederationPlugin')) continue;

        // Extract entry point (add as entry)
        const entryMatch = content.match(/entry\s*:\s*['"]([^'"]+)['"]/);
        if (entryMatch) {
          exposes.push(relativePrefix + entryMatch[1].replace(/^\.\//, ''));
        }

        // Extract exposes paths
        // exposes: { './Button': './src/components/Button' }
        const exposesMatch = content.match(/exposes\s*:\s*\{([^}]+)\}/s);
        if (exposesMatch) {
          const exposesBlock = exposesMatch[1];
          // Match: './key': './src/path' or './key': 'src/path'
          const pathMatches = exposesBlock.matchAll(/['"][^'"]+['"]\s*:\s*['"]\.?\/?(src\/[^'"]+|[^'"\/][^'"]+)['"]/g);
          for (const match of pathMatches) {
            const exposePath = match[1].replace(/^\.\//, '');
            // Add with the relative prefix for monorepo support
            exposes.push(relativePrefix + exposePath);
            // Also add common extensions
            exposes.push(relativePrefix + exposePath + '.js');
            exposes.push(relativePrefix + exposePath + '.jsx');
            exposes.push(relativePrefix + exposePath + '.ts');
            exposes.push(relativePrefix + exposePath + '.tsx');
          }
        }

        // Extract remotes for reference
        const remotesMatch = content.match(/remotes\s*:\s*\{([^}]+)\}/s);
        if (remotesMatch) {
          const remotesBlock = remotesMatch[1];
          const nameMatches = remotesBlock.matchAll(/['"](\w+)['"]\s*:/g);
          for (const match of nameMatches) {
            remotes.push(match[1]);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return { exposes: [...new Set(exposes)], remotes: [...new Set(remotes)] };
}

/**
 * Parse Serverless Framework configuration for handler entry points
 * @param {string} projectPath - Project root path
 * @returns {Object} - { handlers: string[] }
 */
function parseServerlessConfig(projectPath) {
  const configFiles = [
    'serverless.yml',
    'serverless.yaml',
    'serverless.ts',
    'serverless.js'
  ];

  const handlers = [];

  for (const configFile of configFiles) {
    const configPath = (0,external_path_.join)(projectPath, configFile);
    if (!(0,external_fs_.existsSync)(configPath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(configPath, 'utf-8');

      // Match handler patterns like: handler: src/handlers/hello.handler
      const handlerMatches = content.matchAll(/handler\s*:\s*['"]?([^\s'"#\n]+)['"]?/g);
      for (const match of handlerMatches) {
        const handlerPath = match[1].trim();
        // Handler format: path/to/file.functionName - extract file path
        const filePath = handlerPath.replace(/\.[^.]+$/, ''); // Remove .handler suffix
        // Add common extensions
        handlers.push(filePath + '.js');
        handlers.push(filePath + '.ts');
        handlers.push(filePath + '.mjs');
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { handlers: [...new Set(handlers)] };
}

/**
 * Parse Next.js configuration and detect page/app router entry points
 * @param {string} projectPath - Project root path
 * @returns {Object} - { pages: string[], appRoutes: string[], apiRoutes: string[] }
 */
function parseNextjsConfig(projectPath) {
  const pages = [];
  const appRoutes = [];
  const apiRoutes = [];

  // Check for Next.js indicators
  const nextConfigFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
  let isNextProject = false;
  for (const configFile of nextConfigFiles) {
    if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, configFile))) {
      isNextProject = true;
      break;
    }
  }

  // Also check package.json for next dependency
  const pkgPath = (0,external_path_.join)(projectPath, 'package.json');
  if ((0,external_fs_.existsSync)(pkgPath)) {
    try {
      const pkg = JSON.parse((0,external_fs_.readFileSync)(pkgPath, 'utf-8'));
      if (pkg.dependencies?.next || pkg.devDependencies?.next) {
        isNextProject = true;
      }
    } catch {}
  }

  if (!isNextProject) return { pages, appRoutes, apiRoutes };

  // Scan for pages directory (Pages Router)
  const pagesDirs = ['pages', 'src/pages'];
  for (const pagesDir of pagesDirs) {
    const fullDir = (0,external_path_.join)(projectPath, pagesDir);
    if ((0,external_fs_.existsSync)(fullDir)) {
      try {
        const pageFiles = (0,esm.globSync)('**/*.{js,jsx,ts,tsx}', { cwd: fullDir, nodir: true });
        for (const file of pageFiles) {
          if (file.startsWith('api/')) {
            apiRoutes.push((0,external_path_.join)(pagesDir, file));
          } else {
            pages.push((0,external_path_.join)(pagesDir, file));
          }
        }
      } catch {}
    }
  }

  // Scan for app directory (App Router)
  const appDirs = ['app', 'src/app'];
  for (const appDir of appDirs) {
    const fullDir = (0,external_path_.join)(projectPath, appDir);
    if ((0,external_fs_.existsSync)(fullDir)) {
      try {
        // App router files: page.tsx, layout.tsx, route.ts, loading.tsx, error.tsx, etc.
        const appFiles = (0,esm.globSync)('**/{page,layout,route,loading,error,not-found,template}.{js,jsx,ts,tsx}', { cwd: fullDir, nodir: true });
        for (const file of appFiles) {
          if (file.includes('/api/') || file.startsWith('api/')) {
            apiRoutes.push((0,external_path_.join)(appDir, file));
          } else {
            appRoutes.push((0,external_path_.join)(appDir, file));
          }
        }
      } catch {}
    }
  }

  return { pages, appRoutes, apiRoutes };
}

/**
 * Parse Cypress configuration for spec and support files
 * @param {string} projectPath - Project root path
 * @returns {Object} - { specFiles: string[], supportFiles: string[] }
 */
function parseCypressConfig(projectPath) {
  const configFiles = [
    'cypress.config.js',
    'cypress.config.ts',
    'cypress.config.mjs',
    'cypress.json' // Legacy config
  ];

  const specFiles = [];
  const supportFiles = [];

  for (const configFile of configFiles) {
    const configPath = (0,external_path_.join)(projectPath, configFile);
    if (!(0,external_fs_.existsSync)(configPath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(configPath, 'utf-8');

      // Extract specPattern
      const specPatternMatch = content.match(/specPattern\s*:\s*['"]([^'"]+)['"]/);
      if (specPatternMatch) {
        const pattern = specPatternMatch[1];
        // Resolve glob pattern to actual files
        try {
          const files = (0,esm.globSync)(pattern, { cwd: projectPath, nodir: true });
          specFiles.push(...files);
        } catch {}
      }

      // Extract supportFile
      const supportFileMatch = content.match(/supportFile\s*:\s*['"]([^'"]+)['"]/);
      if (supportFileMatch) {
        supportFiles.push(supportFileMatch[1]);
      }

      // Legacy cypress.json format
      if (configFile === 'cypress.json') {
        try {
          const config = JSON.parse(content);
          if (config.integrationFolder || config.testFiles) {
            const folder = config.integrationFolder || 'cypress/integration';
            const pattern = config.testFiles || '**/*.*';
            const files = (0,esm.globSync)(`${folder}/${pattern}`, { cwd: projectPath, nodir: true });
            specFiles.push(...files);
          }
          if (config.supportFile) {
            supportFiles.push(config.supportFile);
          }
        } catch {}
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Default patterns if config not found but cypress folder exists
  if (specFiles.length === 0 && (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'cypress'))) {
    try {
      const defaultSpecs = (0,esm.globSync)('cypress/e2e/**/*.cy.{js,ts,jsx,tsx}', { cwd: projectPath, nodir: true });
      specFiles.push(...defaultSpecs);
      // Also check legacy integration folder
      const legacySpecs = (0,esm.globSync)('cypress/integration/**/*.{js,ts,jsx,tsx}', { cwd: projectPath, nodir: true });
      specFiles.push(...legacySpecs);
    } catch {}
  }

  if (supportFiles.length === 0 && (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'cypress/support'))) {
    // Default support file location
    if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'cypress/support/e2e.ts'))) {
      supportFiles.push('cypress/support/e2e.ts');
    } else if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'cypress/support/e2e.js'))) {
      supportFiles.push('cypress/support/e2e.js');
    } else if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'cypress/support/index.ts'))) {
      supportFiles.push('cypress/support/index.ts');
    } else if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'cypress/support/index.js'))) {
      supportFiles.push('cypress/support/index.js');
    }
  }

  return { specFiles: [...new Set(specFiles)], supportFiles: [...new Set(supportFiles)] };
}

/**
 * Parse Jest configuration for test patterns and setup files
 * @param {string} projectPath - Project root path
 * @returns {Object} - { testFiles: string[], setupFiles: string[] }
 */
function parseJestConfig(projectPath) {
  const configFiles = [
    'jest.config.js',
    'jest.config.ts',
    'jest.config.mjs',
    'jest.config.json'
  ];

  const testFiles = [];
  const setupFiles = [];

  // Check package.json jest config
  const pkgPath = (0,external_path_.join)(projectPath, 'package.json');
  if ((0,external_fs_.existsSync)(pkgPath)) {
    try {
      const pkg = JSON.parse((0,external_fs_.readFileSync)(pkgPath, 'utf-8'));
      if (pkg.jest) {
        if (pkg.jest.setupFilesAfterEnv) {
          setupFiles.push(...pkg.jest.setupFilesAfterEnv.map(f => f.replace(/^<rootDir>\//, '')));
        }
        if (pkg.jest.setupFiles) {
          setupFiles.push(...pkg.jest.setupFiles.map(f => f.replace(/^<rootDir>\//, '')));
        }
      }
    } catch {}
  }

  for (const configFile of configFiles) {
    const configPath = (0,external_path_.join)(projectPath, configFile);
    if (!(0,external_fs_.existsSync)(configPath)) continue;

    try {
      const content = (0,external_fs_.readFileSync)(configPath, 'utf-8');

      // Extract setupFilesAfterEnv
      const setupMatch = content.match(/setupFilesAfterEnv\s*:\s*\[([^\]]+)\]/s);
      if (setupMatch) {
        const files = setupMatch[1].matchAll(/['"]([^'"]+)['"]/g);
        for (const match of files) {
          setupFiles.push(match[1].replace(/^<rootDir>\//, ''));
        }
      }

      // Extract testMatch patterns
      const testMatchMatch = content.match(/testMatch\s*:\s*\[([^\]]+)\]/s);
      if (testMatchMatch) {
        const patterns = testMatchMatch[1].matchAll(/['"]([^'"]+)['"]/g);
        for (const match of patterns) {
          const pattern = match[1].replace(/^<rootDir>\//, '').replace(/\*\*\//, '');
          try {
            const files = (0,esm.globSync)(pattern, { cwd: projectPath, nodir: true });
            testFiles.push(...files);
          } catch {}
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Default test patterns if none found
  if (testFiles.length === 0) {
    try {
      const defaultTests = (0,esm.globSync)('**/*.{test,spec}.{js,ts,jsx,tsx}', {
        cwd: projectPath,
        nodir: true,
        ignore: ['node_modules/**']
      });
      testFiles.push(...defaultTests);

      const testDirTests = (0,esm.globSync)('**/__tests__/**/*.{js,ts,jsx,tsx}', {
        cwd: projectPath,
        nodir: true,
        ignore: ['node_modules/**']
      });
      testFiles.push(...testDirTests);
    } catch {}
  }

  return { testFiles: [...new Set(testFiles)], setupFiles: [...new Set(setupFiles)] };
}

/**
 * Parse Nx workspace configuration for entry points
 * Looks for project.json files in apps/ and libs/ directories
 * @param {string} projectPath - Project root path
 * @returns {{ entries: string[] }}
 */
function parseNxConfig(projectPath) {
  const entries = [];

  try {
    // Find all project.json files in apps/ and libs/
    const projectPatterns = [
      'apps/*/project.json',
      'apps/*/*/project.json',
      'libs/*/project.json',
      'libs/*/*/project.json',
      'packages/*/project.json'
    ];

    for (const pattern of projectPatterns) {
      try {
        const matches = (0,esm.globSync)(pattern, { cwd: projectPath, nodir: true });
        for (const match of matches) {
          try {
            const projectJsonPath = (0,external_path_.join)(projectPath, match);
            const content = JSON.parse((0,external_fs_.readFileSync)(projectJsonPath, 'utf-8'));

            // Only treat applications as entry points, not libraries
            // Libraries are only "live" if something imports from them
            const isApplication = content.projectType === 'application';
            if (!isApplication) continue;

            // Look for main entry in targets.build.options
            if (content.targets?.build?.options?.main) {
              entries.push(content.targets.build.options.main);
            }

            // Also check for executor-specific entries
            for (const [, target] of Object.entries(content.targets || {})) {
              if (target.options?.main && !entries.includes(target.options.main)) {
                entries.push(target.options.main);
              }
              // Check for browser/server entries (Angular-style)
              if (target.options?.browser) {
                entries.push(target.options.browser);
              }
              if (target.options?.server) {
                entries.push(target.options.server);
              }
            }
          } catch {
            // Ignore individual project.json parse errors
          }
        }
      } catch {
        // Ignore glob errors
      }
    }
  } catch {
    // Ignore errors
  }

  return { entries: [...new Set(entries)] };
}

/**
 * Parse Angular workspace configuration for entry points
 * @param {string} projectPath - Project root path
 * @returns {{ entries: string[] }}
 */
function parseAngularConfig(projectPath) {
  const entries = [];

  try {
    const angularJsonPath = (0,external_path_.join)(projectPath, 'angular.json');
    if ((0,external_fs_.existsSync)(angularJsonPath)) {
      const content = JSON.parse((0,external_fs_.readFileSync)(angularJsonPath, 'utf-8'));

      for (const [, project] of Object.entries(content.projects || {})) {
        // Check architect/build/options/main
        if (project.architect?.build?.options?.main) {
          entries.push(project.architect.build.options.main);
        }
        // Check for environment files in fileReplacements
        if (project.architect?.build?.configurations) {
          for (const [, config] of Object.entries(project.architect.build.configurations)) {
            if (config.fileReplacements) {
              for (const replacement of config.fileReplacements) {
                if (replacement.replace) entries.push(replacement.replace);
                if (replacement.with) entries.push(replacement.with);
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return { entries: [...new Set(entries)] };
}

/**
 * Collect all entry points from bundler and CI/CD configs
 * @param {string} projectPath - Project root path
 * @returns {Object} - Aggregated entry point information
 */
function collectConfigEntryPoints(projectPath) {
  const webpack = parseWebpackConfig(projectPath);
  const vite = parseViteConfig(projectPath);
  const rollup = parseRollupConfig(projectPath);
  const esbuild = parseEsbuildConfig(projectPath);
  const parcel = parseParcelConfig(projectPath);
  const github = parseGitHubActions(projectPath);
  const gitlab = parseGitLabCI(projectPath);
  const jenkins = parseJenkinsfile(projectPath);
  const docker = parseDockerConfig(projectPath);
  const moduleFederation = parseModuleFederationConfig(projectPath);
  const serverless = parseServerlessConfig(projectPath);
  const nextjs = parseNextjsConfig(projectPath);
  const cypress = parseCypressConfig(projectPath);
  const jest = parseJestConfig(projectPath);
  const nx = parseNxConfig(projectPath);
  const angular = parseAngularConfig(projectPath);

  // Combine all entries
  const allEntries = [
    ...webpack.entries,
    ...vite.entries,
    ...rollup.entries,
    ...esbuild.entries,
    ...parcel.entries,
    ...github.scripts.filter(s => !s.startsWith('npm:')),
    ...gitlab.scripts,
    ...jenkins.scripts,
    ...docker.entrypoints,
    ...docker.cmdScripts,
    ...moduleFederation.exposes,
    ...serverless.handlers,
    ...nextjs.pages,
    ...nextjs.appRoutes,
    ...nextjs.apiRoutes,
    ...cypress.specFiles,
    ...cypress.supportFiles,
    ...jest.testFiles,
    ...jest.setupFiles,
    ...nx.entries,
    ...angular.entries
  ];

  // Normalize paths (remove leading ./)
  const normalizedEntries = allEntries.map(e =>
    e.replace(/^\.\//, '')
  );

  return {
    bundler: {
      webpack: webpack.entries.length > 0 ? webpack : null,
      vite: vite.entries.length > 0 ? vite : null,
      rollup: rollup.entries.length > 0 ? rollup : null,
      esbuild: esbuild.entries.length > 0 ? esbuild : null,
      parcel: parcel.entries.length > 0 ? parcel : null,
      moduleFederation: moduleFederation.exposes.length > 0 ? moduleFederation : null
    },
    cicd: {
      github: github.scripts.length > 0 ? github : null,
      gitlab: gitlab.scripts.length > 0 ? gitlab : null,
      jenkins: jenkins.scripts.length > 0 ? jenkins : null,
      docker: (docker.entrypoints.length > 0 || docker.cmdScripts.length > 0) ? docker : null,
      serverless: serverless.handlers.length > 0 ? serverless : null
    },
    framework: {
      nextjs: (nextjs.pages.length > 0 || nextjs.appRoutes.length > 0) ? nextjs : null
    },
    testing: {
      cypress: (cypress.specFiles.length > 0 || cypress.supportFiles.length > 0) ? cypress : null,
      jest: (jest.testFiles.length > 0 || jest.setupFiles.length > 0) ? jest : null
    },
    entries: [...new Set(normalizedEntries)],
    npmScripts: github.scripts.filter(s => s.startsWith('npm:')).map(s => s.replace('npm:', ''))
  };
}

/**
 * Check if a file is referenced in bundler/CI configs
 * @param {string} filePath - Relative file path
 * @param {Object} configData - Result from collectConfigEntryPoints
 * @returns {Object} - { isEntry: boolean, source: string|null }
 */
function isConfigEntry(filePath, configData) {
  const normalizedPath = filePath.replace(/^\.\//, '');

  for (const entry of configData.entries) {
    // Direct match
    if (normalizedPath === entry || normalizedPath.endsWith(entry)) {
      return { isEntry: true, source: 'bundler/ci-config' };
    }

    // Match without extension
    const withoutExt = entry.replace(/\.[^.]+$/, '');
    const fileWithoutExt = normalizedPath.replace(/\.[^.]+$/, '');
    if (fileWithoutExt === withoutExt || fileWithoutExt.endsWith(withoutExt)) {
      return { isEntry: true, source: 'bundler/ci-config' };
    }
  }

  return { isEntry: false, source: null };
}

/* harmony default export */ const configParsers = ({
  parseWebpackConfig,
  parseViteConfig,
  parseRollupConfig,
  parseEsbuildConfig,
  parseParcelConfig,
  parseGitHubActions,
  parseGitLabCI,
  parseJenkinsfile,
  parseDockerConfig,
  parseModuleFederationConfig,
  parseServerlessConfig,
  parseNextjsConfig,
  parseCypressConfig,
  parseJestConfig,
  collectConfigEntryPoints,
  isConfigEntry
});

;// CONCATENATED MODULE: ./shared/scanner/analysers/entryPointDetector.mjs
// src/scanner/analysers/entryPointDetector.mjs
// Unified entry point detection for multi-language dead code analysis







/**
 * Default entry point file patterns (language-agnostic)
 */
const DEFAULT_ENTRY_PATTERNS = [
  // JavaScript/TypeScript
  /^index\.(m?js|jsx?|tsx?)$/,
  /^main\.(m?js|jsx?|tsx?)$/,
  /^app\.(m?js|jsx?|tsx?)$/,
  /^server\.(m?js|jsx?|tsx?)$/,
  /^cli\.(m?js|jsx?|tsx?)$/,
  /^entry\.(m?js|jsx?|tsx?)$/,
  /src\/index\.(m?js|jsx?|tsx?)$/,
  /src\/main\.(m?js|jsx?|tsx?)$/,
  /src\/app\.(m?js|jsx?|tsx?)$/,

  // Python
  /^__main__\.py$/,
  /^main\.py$/,
  /^app\.py$/,
  /^manage\.py$/,
  /^wsgi\.py$/,
  /^asgi\.py$/,

  // Go
  /^main\.go$/,
  /cmd\/[^/]+\/main\.go$/,

  // Java
  /^Main\.java$/,
  /Application\.java$/,
  /SpringBootApplication/,

  // C#
  /^Program\.cs$/,
  /^Startup\.cs$/,

  // Ruby
  /^Rakefile$/,
  /^config\.ru$/,
  /^application\.rb$/,

  // PHP
  /^index\.php$/,
  /^artisan$/,

  // Rust
  /^main\.rs$/,
  /src\/main\.rs$/,
  /src\/bin\/[^/]+\.rs$/
];

/**
 * DI decorator patterns by language/framework
 */
const DI_DECORATORS_BY_LANGUAGE = {
  javascript: [
    'Service', 'Injectable', 'Controller', 'Module', 'Component',
    'Entity', 'Repository', 'Resolver', 'Guard', 'Pipe',
    'EventSubscriber', 'Subscriber', 'Singleton'
  ],
  java: [
    'Service', 'Component', 'Repository', 'Controller', 'RestController',
    'Configuration', 'Bean', 'Autowired', 'Inject', 'Named', 'Singleton',
    'Entity', 'ManagedBean', 'Stateless', 'Stateful'
  ],
  csharp: [
    'Controller', 'ApiController', 'Service', 'Scoped', 'Singleton', 'Transient',
    'Entity', 'Table', 'DbContext', 'Injectable'
  ],
  python: [
    'app.route', 'router.get', 'router.post', 'router.put', 'router.delete',
    'task', 'shared_task', 'celery.task'
  ]
};

/**
 * Unified entry point detection result
 */
class EntryPointResult {
  constructor() {
    this.entryPoints = new Map();  // filePath -> { reason, source, confidence, isDynamic }
    this.sources = {
      packageJson: [],
      html: [],
      bundlerConfig: [],
      ciConfig: [],
      diAnnotation: [],
      convention: [],
      buildSystem: []
    };
  }

  add(filePath, info) {
    const existing = this.entryPoints.get(filePath);
    if (!existing || info.confidence > (existing.confidence || 0)) {
      this.entryPoints.set(filePath, info);
    }
    if (info.source && this.sources[info.source]) {
      this.sources[info.source].push(filePath);
    }
  }

  has(filePath) {
    return this.entryPoints.has(filePath);
  }

  get(filePath) {
    return this.entryPoints.get(filePath);
  }

  getAll() {
    return [...this.entryPoints.entries()].map(([file, info]) => ({
      file,
      ...info
    }));
  }

  getFiles() {
    return new Set(this.entryPoints.keys());
  }
}

/**
 * Extract entry points from package.json
 */
function extractPackageJsonEntries(packageJson, projectPath = '') {
  const entries = [];

  if (!packageJson) return entries;

  // main field
  if (packageJson.main) {
    entries.push({
      path: packageJson.main.replace(/^\.\//, ''),
      reason: 'Package main entry',
      source: 'packageJson',
      confidence: 0.9
    });
  }

  // module field (ESM entry)
  if (packageJson.module) {
    entries.push({
      path: packageJson.module.replace(/^\.\//, ''),
      reason: 'Package module entry (ESM)',
      source: 'packageJson',
      confidence: 0.9
    });
  }

  // bin field
  if (packageJson.bin) {
    const bins = typeof packageJson.bin === 'string'
      ? [packageJson.bin]
      : Object.values(packageJson.bin);
    for (const bin of bins) {
      entries.push({
        path: bin.replace(/^\.\//, ''),
        reason: 'Package bin entry',
        source: 'packageJson',
        confidence: 0.95
      });
    }
  }

  // exports field
  if (packageJson.exports) {
    const extractExports = (exp, path = '') => {
      if (typeof exp === 'string') {
        entries.push({
          path: exp.replace(/^\.\//, ''),
          reason: `Package exports entry${path ? ` (${path})` : ''}`,
          source: 'packageJson',
          confidence: 0.9
        });
      } else if (typeof exp === 'object' && exp !== null) {
        for (const [key, value] of Object.entries(exp)) {
          extractExports(value, key);
        }
      }
    };
    extractExports(packageJson.exports);
  }

  // scripts (extract referenced files)
  if (packageJson.scripts) {
    for (const [name, script] of Object.entries(packageJson.scripts)) {
      // Match node/npx/ts-node commands
      const matches = script.matchAll(/(?:node|npx|ts-node|tsx)\s+([^\s&|;]+)/g);
      for (const match of matches) {
        const file = match[1].replace(/^\.\//, '');
        if (file.match(/\.(m?js|ts|tsx?)$/)) {
          entries.push({
            path: file,
            reason: `Referenced in npm script "${name}"`,
            source: 'packageJson',
            confidence: 0.85
          });
        }
      }
    }
  }

  return entries;
}

/**
 * Extract entry points from HTML files
 */
function extractHtmlEntries(projectPath) {
  const entries = [];

  if (!projectPath) return entries;

  const htmlPatterns = [
    '*.html',
    'public/*.html',
    'src/*.html',
    'static/*.html',
    'views/**/*.html',
    'templates/**/*.html'
  ];

  for (const pattern of htmlPatterns) {
    try {
      const htmlFiles = (0,esm.globSync)(pattern, {
        cwd: projectPath,
        nodir: true,
        ignore: ['node_modules/**', 'dist/**', 'build/**']
      });

      for (const htmlFile of htmlFiles) {
        const fullPath = (0,external_path_.join)(projectPath, htmlFile);
        try {
          const content = (0,external_fs_.readFileSync)(fullPath, 'utf-8');
          const htmlDir = (0,external_path_.dirname)(htmlFile);

          // Match script tags with src attribute
          const scriptPattern = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
          let match;
          while ((match = scriptPattern.exec(content)) !== null) {
            let src = match[1];

            // Skip external scripts
            if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
              continue;
            }

            // Resolve relative paths
            if (src.startsWith('./')) {
              src = (0,external_path_.join)(htmlDir, src.slice(2));
            } else if (src.startsWith('/')) {
              src = src.slice(1);
            } else if (!src.includes('://')) {
              src = (0,external_path_.join)(htmlDir, src);
            }

            src = src.replace(/\\/g, '/').replace(/^\.\//, '');

            entries.push({
              path: src,
              reason: `Referenced in ${htmlFile}`,
              source: 'html',
              confidence: 0.9
            });
          }
        } catch {
          // Ignore read errors
        }
      }
    } catch {
      // Ignore glob errors
    }
  }

  return entries;
}

/**
 * Check if a file matches entry point patterns
 */
function matchesEntryPattern(filePath, customPatterns = []) {
  const allPatterns = [...DEFAULT_ENTRY_PATTERNS, ...customPatterns];

  for (const pattern of allPatterns) {
    if (pattern.test(filePath)) {
      return {
        matches: true,
        pattern: pattern.toString(),
        confidence: 0.7
      };
    }
  }

  return { matches: false };
}

/**
 * Detect entry points from multi-language build systems
 */
function detectBuildSystemEntries(projectPath) {
  const entries = [];

  if (!projectPath) return entries;

  const buildSystems = detectBuildSystems(projectPath);

  for (const system of buildSystems) {
    // Each build system may define entry points differently
    switch (system.type) {
      case 'gradle':
      case 'maven':
        // Java: look for src/main/java/**/Application.java
        try {
          const javaFiles = (0,esm.globSync)('src/main/java/**/*Application.java', {
            cwd: projectPath,
            nodir: true
          });
          for (const file of javaFiles) {
            entries.push({
              path: file,
              reason: `Spring Boot application (${system.type})`,
              source: 'buildSystem',
              confidence: 0.9
            });
          }
        } catch { /* ignore */ }
        break;

      case 'cargo':
        // Rust: src/main.rs and src/bin/*.rs
        if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'src/main.rs'))) {
          entries.push({
            path: 'src/main.rs',
            reason: 'Cargo binary entry',
            source: 'buildSystem',
            confidence: 0.95
          });
        }
        try {
          const binFiles = (0,esm.globSync)('src/bin/*.rs', {
            cwd: projectPath,
            nodir: true
          });
          for (const file of binFiles) {
            entries.push({
              path: file,
              reason: 'Cargo binary entry',
              source: 'buildSystem',
              confidence: 0.95
            });
          }
        } catch { /* ignore */ }
        break;

      case 'go':
        // Go: main.go and cmd/*/main.go
        if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'main.go'))) {
          entries.push({
            path: 'main.go',
            reason: 'Go main entry',
            source: 'buildSystem',
            confidence: 0.95
          });
        }
        try {
          const cmdFiles = (0,esm.globSync)('cmd/*/main.go', {
            cwd: projectPath,
            nodir: true
          });
          for (const file of cmdFiles) {
            entries.push({
              path: file,
              reason: 'Go cmd entry',
              source: 'buildSystem',
              confidence: 0.95
            });
          }
        } catch { /* ignore */ }
        break;

      case 'dotnet':
        // C#: Program.cs
        if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'Program.cs'))) {
          entries.push({
            path: 'Program.cs',
            reason: '.NET Program entry',
            source: 'buildSystem',
            confidence: 0.95
          });
        }
        break;

      case 'python':
        // Python: __main__.py, manage.py
        for (const file of ['__main__.py', 'manage.py', 'app.py', 'main.py']) {
          if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, file))) {
            entries.push({
              path: file,
              reason: 'Python entry point',
              source: 'buildSystem',
              confidence: 0.9
            });
          }
        }
        break;
    }
  }

  return entries;
}

/**
 * Unified entry point detector
 */
class EntryPointDetector {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.packageJson = options.packageJson || {};
    this.customPatterns = options.customPatterns || [];
    this.diDecorators = options.diDecorators || DI_DECORATORS_BY_LANGUAGE.javascript;
    this.result = new EntryPointResult();
    this.initialized = false;
  }

  /**
   * Initialize detection - collect all entry points from various sources
   */
  initialize() {
    if (this.initialized) return this.result;

    // 1. Package.json entries
    const pkgEntries = extractPackageJsonEntries(this.packageJson, this.projectPath);
    for (const entry of pkgEntries) {
      this.result.add(entry.path, entry);
    }

    // 2. HTML entries
    const htmlEntries = extractHtmlEntries(this.projectPath);
    for (const entry of htmlEntries) {
      this.result.add(entry.path, entry);
    }

    // 3. Bundler/CI config entries
    const configData = collectConfigEntryPoints(this.projectPath);
    for (const entryPath of configData.entries) {
      this.result.add(entryPath, {
        reason: 'Bundler/CI config entry',
        source: 'bundlerConfig',
        confidence: 0.85
      });
    }

    // 4. Build system entries
    const buildEntries = detectBuildSystemEntries(this.projectPath);
    for (const entry of buildEntries) {
      this.result.add(entry.path, entry);
    }

    this.initialized = true;
    return this.result;
  }

  /**
   * Check if a file is an entry point
   * @param {string} filePath - Relative file path
   * @param {Object} options - Additional context (classes, decorators, etc.)
   */
  isEntryPoint(filePath, options = {}) {
    this.initialize();

    const normalizedPath = filePath.replace(/^\.\//, '');

    // 1. Check pre-collected entries
    const preCollected = this.result.get(normalizedPath);
    if (preCollected) {
      return { isEntry: true, ...preCollected };
    }

    // 2. Check pattern matches
    const patternMatch = matchesEntryPattern(normalizedPath, this.customPatterns);
    if (patternMatch.matches) {
      return {
        isEntry: true,
        reason: 'Matches entry point pattern',
        source: 'convention',
        confidence: patternMatch.confidence
      };
    }

    // 3. Check DI decorators on classes
    if (options.classes?.length) {
      for (const cls of options.classes) {
        if (cls.decorators?.length) {
          const diMatch = cls.decorators.find(d =>
            this.diDecorators.includes(d.name)
          );
          if (diMatch) {
            return {
              isEntry: true,
              reason: `Class ${cls.name} has DI decorator: @${diMatch.name}`,
              source: 'diAnnotation',
              confidence: 0.9,
              isDynamic: true
            };
          }
        }
      }
    }

    // 4. Check for framework-specific patterns in file metadata
    if (options.metadata) {
      // Python frameworks
      if (options.metadata.hasMainBlock) {
        return {
          isEntry: true,
          reason: 'Has __main__ block',
          source: 'convention',
          confidence: 0.95
        };
      }
      if (options.metadata.isCelery) {
        return {
          isEntry: true,
          reason: 'Celery task file',
          source: 'diAnnotation',
          confidence: 0.9,
          isDynamic: true
        };
      }

      // Go frameworks
      if (options.metadata.hasMainFunction && options.metadata.isMainPackage) {
        return {
          isEntry: true,
          reason: 'Go main package with main()',
          source: 'convention',
          confidence: 0.95
        };
      }
      if (options.metadata.usesWire || options.metadata.usesFx || options.metadata.usesDig) {
        return {
          isEntry: true,
          reason: 'Uses Go DI framework',
          source: 'diAnnotation',
          confidence: 0.9,
          isDynamic: true
        };
      }

      // Java frameworks
      if (options.metadata.isSpringComponent) {
        return {
          isEntry: true,
          reason: 'Spring component',
          source: 'diAnnotation',
          confidence: 0.9,
          isDynamic: true
        };
      }

      // C# frameworks
      if (options.metadata.hasMainMethod || options.metadata.hasTopLevelStatements) {
        return {
          isEntry: true,
          reason: 'C# entry point',
          source: 'convention',
          confidence: 0.95
        };
      }
    }

    return { isEntry: false };
  }

  /**
   * Get all detected entry point files
   */
  getEntryPointFiles() {
    this.initialize();
    return this.result.getFiles();
  }

  /**
   * Get detailed entry point information
   */
  getEntryPointDetails() {
    this.initialize();
    return this.result.getAll();
  }

  /**
   * Get entry points grouped by source
   */
  getEntryPointsBySource() {
    this.initialize();
    return this.result.sources;
  }
}

/**
 * Create a detector with default configuration
 */
function createEntryPointDetector(projectPath, packageJson = {}, options = {}) {
  return new EntryPointDetector({
    projectPath,
    packageJson,
    ...options
  });
}

/**
 * Quick check if a file is likely an entry point (without full initialization)
 */
function isLikelyEntryPoint(filePath) {
  return matchesEntryPattern(filePath).matches;
}

/* harmony default export */ const entryPointDetector = ({
  EntryPointDetector,
  createEntryPointDetector,
  isLikelyEntryPoint,
  DEFAULT_ENTRY_PATTERNS,
  DI_DECORATORS_BY_LANGUAGE
});

;// CONCATENATED MODULE: ./shared/scanner/analysers/deadcode.mjs
// src/scanner/analysers/deadcode.mjs
// Deep dead code detection with export-level analysis












// Cache for nested package.json discoveries
let _nestedPackageCache = null;
let _nestedPackageCacheProjectPath = null;
let _dependedPackagesCache = null;

// Cache for extractPathAliases results (keyed by projectPath)
let _pathAliasesCache = null;
let _pathAliasesCacheProjectPath = null;

/**
 * Find all nested package.json files in a project (for monorepo support)
 * Returns a map of package directory -> package.json contents
 */
function findNestedPackageJsons(projectPath) {
  if (!projectPath) return new Map();

  // Use cached results if available for same project
  if (_nestedPackageCacheProjectPath === projectPath && _nestedPackageCache) {
    return _nestedPackageCache;
  }

  const packages = new Map();

  try {
    // 1. Look in common monorepo directories (hardcoded patterns)
    const monorepoPatterns = [
      'packages/*/package.json',
      'apps/*/package.json',
      'libs/*/package.json',
      'modules/*/package.json',
      'services/*/package.json',
      'plugins/*/package.json',
      // Nested packages (e.g., packages/scope/name)
      'packages/*/*/package.json',
      'apps/*/*/package.json',
      // General depth-2 discovery for collection repos (e.g., vercel/examples)
      // where each top-level dir has independent sub-projects with their own package.json
      '*/*/package.json'
    ];

    // Collect workspace exclusion patterns (e.g., "!apps/api" in pnpm-workspace.yaml)
    const wsExclusions = [];

    // 2. Read workspace configuration to discover ALL workspace packages
    // This covers AWS SDK (clients/), Azure SDK (sdk/**), etc.
    try {
      const rootPkgPath = (0,external_path_.join)(projectPath, 'package.json');
      if ((0,external_fs_.existsSync)(rootPkgPath)) {
        const rootPkg = JSON.parse((0,external_fs_.readFileSync)(rootPkgPath, 'utf-8'));
        const wsConfig = rootPkg.workspaces;
        const wsPatterns = Array.isArray(wsConfig) ? wsConfig : (wsConfig?.packages || []);
        for (const wp of wsPatterns) {
          const clean = wp.replace(/\/$/, '');
          if (clean.startsWith('!')) {
            wsExclusions.push(clean.slice(1)); // collect negation patterns
            continue;
          }
          monorepoPatterns.push(clean.endsWith('/package.json') ? clean : clean + '/package.json');
        }
      }
    } catch { /* ignore */ }

    // 3. Read pnpm-workspace.yaml
    try {
      const pnpmWsPath = (0,external_path_.join)(projectPath, 'pnpm-workspace.yaml');
      if ((0,external_fs_.existsSync)(pnpmWsPath)) {
        const wsContent = (0,external_fs_.readFileSync)(pnpmWsPath, 'utf-8');
        const wsPatternRe = /^\s*-\s*['"]?([^'"#\n]+?)['"]?\s*$/gm;
        let wsMatch;
        while ((wsMatch = wsPatternRe.exec(wsContent)) !== null) {
          const clean = wsMatch[1].trim().replace(/\/$/, '');
          if (!clean) continue;
          if (clean.startsWith('!')) {
            wsExclusions.push(clean.slice(1)); // collect negation patterns
            continue;
          }
          monorepoPatterns.push(clean.endsWith('/package.json') ? clean : clean + '/package.json');
        }
      }
    } catch { /* ignore */ }

    // 4. Read lerna.json
    try {
      const lernaPath = (0,external_path_.join)(projectPath, 'lerna.json');
      if ((0,external_fs_.existsSync)(lernaPath)) {
        const lerna = JSON.parse((0,external_fs_.readFileSync)(lernaPath, 'utf-8'));
        for (const lp of (lerna.packages || [])) {
          const clean = lp.replace(/\/$/, '');
          monorepoPatterns.push(clean.endsWith('/package.json') ? clean : clean + '/package.json');
        }
      }
    } catch { /* ignore */ }

    // Deduplicate patterns
    const uniquePatterns = [...new Set(monorepoPatterns)];

    // Build exclusion matchers from workspace negation patterns (e.g., "!apps/api")
    const exclusionMatchers = wsExclusions.map(ex => {
      // Convert glob pattern to regex: apps/api → exact match, apps/* → wildcard
      const regexStr = ex.replace(/\./g, '\\.').replace(/\*\*/g, '<<<GLOBSTAR>>>').replace(/\*/g, '[^/]*').replace(/<<<GLOBSTAR>>>/g, '.*');
      return new RegExp('^' + regexStr + '$');
    });

    for (const pattern of uniquePatterns) {
      try {
        const matches = (0,esm.globSync)(pattern, { cwd: projectPath, nodir: true, ignore: ['**/node_modules/**'] });
        for (const match of matches) {
          try {
            const pkgPath = (0,external_path_.join)(projectPath, match);
            const pkgContent = JSON.parse((0,external_fs_.readFileSync)(pkgPath, 'utf-8'));
            const pkgDir = (0,external_path_.dirname)(match);
            // Skip packages excluded by workspace negation patterns (e.g., "!apps/api")
            if (exclusionMatchers.some(re => re.test(pkgDir))) continue;
            if (!packages.has(pkgDir)) {
              packages.set(pkgDir, pkgContent);
            }
          } catch {
            // Ignore individual package.json parse errors
          }
        }
      } catch {
        // Ignore glob errors
      }
    }
  } catch {
    // Ignore errors
  }

  _nestedPackageCache = packages;
  _nestedPackageCacheProjectPath = projectPath;

  // Also compute which packages are depended upon
  _dependedPackagesCache = new Set();
  for (const [, pkgJson] of packages) {
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
      ...pkgJson.peerDependencies
    };
    for (const depName of Object.keys(allDeps)) {
      _dependedPackagesCache.add(depName);
    }
  }
  // Also check root package.json
  try {
    const rootPkgPath = (0,external_path_.join)(projectPath, 'package.json');
    if ((0,external_fs_.existsSync)(rootPkgPath)) {
      const rootPkg = JSON.parse((0,external_fs_.readFileSync)(rootPkgPath, 'utf-8'));
      const rootDeps = {
        ...rootPkg.dependencies,
        ...rootPkg.devDependencies,
        ...rootPkg.peerDependencies
      };
      for (const depName of Object.keys(rootDeps)) {
        _dependedPackagesCache.add(depName);
      }
    }
  } catch {
    // Ignore root package.json errors
  }

  return packages;
}

/**
 * Check if a file is the main entry for a nested monorepo package
 * Only returns true if the package is depended upon by another package in the workspace
 * @param {string} filePath - Relative file path
 * @param {string} projectPath - Project root path
 * @returns {{ isMain: boolean, packageDir?: string, packageName?: string }}
 */
function isNestedPackageMain(filePath, projectPath) {
  if (!projectPath) return { isMain: false };

  const nestedPackages = findNestedPackageJsons(projectPath);

  for (const [pkgDir, pkgJson] of nestedPackages) {
    if (!filePath.startsWith(pkgDir + '/')) continue;

    // Check if this package is part of the ecosystem:
    // 1. It's depended upon by another package, OR
    // 2. It has dependencies on other internal packages (showing it's integrated)
    const pkgName = pkgJson.name;
    const pkgDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
      ...pkgJson.peerDependencies
    };

    // Check if any of this package's dependencies are internal packages
    const hasInternalDeps = Object.keys(pkgDeps).some(dep => {
      // Check if this dep is another package in the monorepo
      for (const [, otherPkg] of _nestedPackageCache || []) {
        if (otherPkg.name === dep) return true;
      }
      return false;
    });

    // If package is neither depended upon NOR has internal dependencies, it's potentially abandoned.
    // BUT: packages with main/module/source fields are likely published independently (e.g., Alpine plugins),
    // so only flag truly empty packages as abandoned.
    if (pkgName && !_dependedPackagesCache?.has(pkgName) && !hasInternalDeps) {
      const hasPublishableFields = pkgJson.main || pkgJson.module || pkgJson.source || pkgJson.exports;
      // Framework apps (Ember, Angular, etc.) are valid even without main/module/exports
      const isFrameworkApp = pkgJson.ember || pkgJson['ember-addon'] ||
        pkgJson.angular || pkgJson['ng-package'] ||
        (pkgJson.scripts && (pkgJson.scripts.start || pkgJson.scripts.dev || pkgJson.scripts.build));
      // Non-JS projects (Python, Go, Rust, etc.) with a minimal package.json for tooling
      const pkgAbsDir = (0,external_path_.join)(projectPath, pkgDir);
      const isNonJsProject = ['pyproject.toml', 'setup.py', 'setup.cfg', 'go.mod', 'Cargo.toml',
        'build.gradle', 'pom.xml', 'Gemfile', 'mix.exs', 'Package.swift'].some(
        f => (0,external_fs_.existsSync)((0,external_path_.join)(pkgAbsDir, f)));
      if (!hasPublishableFields && !isFrameworkApp && !isNonJsProject) {
        return { isMain: false, isAbandoned: true };
      }
    }

    // Check if this file is the package's main entry
    if (pkgJson.main) {
      const mainPath = (0,external_path_.join)(pkgDir, pkgJson.main.replace(/^\.\//, ''));
      if (filePath === mainPath) {
        return { isMain: true, packageDir: pkgDir, packageName: pkgName };
      }
      // When main points to a directory (e.g., "./lib"), resolve to dir/index.{js,ts,...}
      if (!mainPath.match(/\.\w+$/)) {
        for (const ext of ['.js', '.ts', '.tsx', '.mjs', '.jsx']) {
          if (filePath === mainPath + '/index' + ext) {
            return { isMain: true, packageDir: pkgDir, packageName: pkgName };
          }
        }
      }
    }

    // Check source field (explicit source entry point)
    if (pkgJson.source) {
      const sourcePath = (0,external_path_.join)(pkgDir, pkgJson.source.replace(/^\.\//, ''));
      if (filePath === sourcePath) {
        return { isMain: true, packageDir: pkgDir, packageName: pkgName };
      }
    }

    // Check module field (ESM entry)
    if (pkgJson.module) {
      const modulePath = (0,external_path_.join)(pkgDir, pkgJson.module.replace(/^\.\//, ''));
      if (filePath === modulePath) {
        return { isMain: true, packageDir: pkgDir, packageName: pkgName };
      }
    }

    // Check types/typings field (.d.ts declaration entry)
    for (const typesField of [pkgJson.types, pkgJson.typings].filter(Boolean)) {
      const typesPath = (0,external_path_.join)(pkgDir, typesField.replace(/^\.\//, ''));
      if (filePath === typesPath) {
        return { isMain: true, packageDir: pkgDir, packageName: pkgName };
      }
    }

    // When main/module points to build output (lib/, dist/, build/, out/),
    // map back to source (src/) since we analyze source files, not build output
    const _buildDirRe = /^(lib|dist|dist-\w+|build|out)\//;
    // Known build output format subdirs (tshy, tsup, etc.) — dist/commonjs/ → src/, dist/esm/ → src/
    const _formatSubdirRe = /^(dist|dist-\w+)\/(commonjs|cjs|esm|browser|react-native|workerd|node|default|types)\//;
    const _srcExts = ['.ts', '.tsx', '.mts', '.js', '.mjs', '.jsx'];
    let hasBuildDirFields = false;
    for (const field of [pkgJson.main, pkgJson.module].filter(Boolean)) {
      const fieldPath = field.replace(/^\.\//, '');
      if (_buildDirRe.test(fieldPath)) {
        hasBuildDirFields = true;
        // Map lib/framework.js → src/framework.ts etc.
        // Also handle dist/commonjs/index.js → src/index.ts (strip format subdir)
        const stems = [fieldPath.replace(_buildDirRe, 'src/').replace(/\.[mc]?[jt]sx?$/, '')];
        if (_formatSubdirRe.test(fieldPath)) {
          stems.push(fieldPath.replace(_formatSubdirRe, 'src/').replace(/\.[mc]?[jt]sx?$/, ''));
        }
        for (const stem of stems) {
          for (const ext of _srcExts) {
            const candidate = (0,external_path_.join)(pkgDir, stem + ext);
            if (filePath === candidate) {
              return { isMain: true, packageDir: pkgDir, packageName: pkgName };
            }
          }
        }
      }
    }

    // When main/module points to build output, check ALL common src entry points as entries.
    // Multiple build entries are common (e.g., framework.ts + entry-bundler.ts in vuetify).
    if (hasBuildDirFields) {
      for (const entry of ['src/index', 'src/main', 'src/entry-bundler', 'src/entry']) {
        for (const ext of _srcExts) {
          const candidate = (0,external_path_.join)(pkgDir, entry + ext);
          if (filePath === candidate) {
            return { isMain: true, packageDir: pkgDir, packageName: pkgName };
          }
        }
      }
    }

    // Workspace fallback: when no main/module field exists, treat src/index.{ts,tsx,js} as entry
    if (!pkgJson.main && !pkgJson.module) {
      for (const entry of ['src/index', 'src/main', 'src/app', 'index', 'main', 'app']) {
        for (const ext of _srcExts) {
          const candidate = (0,external_path_.join)(pkgDir, entry + ext);
          if (filePath === candidate) {
            return { isMain: true, packageDir: pkgDir, packageName: pkgName };
          }
        }
      }
    }

    // Check exports field
    if (pkgJson.exports) {
      const checkExport = (exp, key) => {
        if (typeof exp === 'string') {
          // Handle wildcard exports: "./icons/*" → "./lib/icons/*.mjs"
          if (key && key.includes('*') && exp.includes('*')) {
            return _checkWildcardExport(filePath, pkgDir, key, exp, _buildDirRe, _srcExts);
          }
          const expPath = (0,external_path_.join)(pkgDir, exp.replace(/^\.\//, ''));
          if (filePath === expPath) return true;
          // Also check source equivalent for build-dir exports
          const cleanExp = exp.replace(/^\.\//, '');
          if (_buildDirRe.test(cleanExp)) {
            const stems = [cleanExp.replace(_buildDirRe, 'src/').replace(/\.[mc]?[jt]sx?$/, '')];
            // Also strip format subdir: dist/commonjs/index.js → src/index.ts
            if (_formatSubdirRe.test(cleanExp)) {
              stems.push(cleanExp.replace(_formatSubdirRe, 'src/').replace(/\.[mc]?[jt]sx?$/, ''));
            }
            for (const stem of stems) {
              for (const ext of _srcExts) {
                if (filePath === (0,external_path_.join)(pkgDir, stem + ext)) return true;
              }
            }
          }
        } else if (exp && typeof exp === 'object') {
          for (const [k, value] of Object.entries(exp)) {
            if (checkExport(value, key || k)) return true;
          }
        }
        return false;
      };
      for (const [key, value] of Object.entries(pkgJson.exports)) {
        if (checkExport(value, key)) {
          return { isMain: true, packageDir: pkgDir, packageName: pkgName };
        }
      }
    }

    // File is in this package but not its main entry — still return the packageDir
    // so callers can check entry point patterns relative to the package root
    return { isMain: false, packageDir: pkgDir, packageName: pkgName };
  }

  return { isMain: false };
}

/**
 * Check if a file matches a wildcard export pattern.
 * e.g., key="./icons/*", value="./lib/icons/*.mjs" → match src/icons/Home.tsx
 */
function _checkWildcardExport(filePath, pkgDir, key, value, _buildDirRe, _srcExts) {
  // Extract the directory part from the value pattern
  const cleanValue = value.replace(/^\.\//, '');
  // Convert wildcard pattern to a directory prefix: "lib/icons/*.mjs" → "lib/icons/"
  const starIdx = cleanValue.indexOf('*');
  if (starIdx < 0) return false;
  const valuePrefix = cleanValue.substring(0, starIdx);
  const valueSuffix = cleanValue.substring(starIdx + 1);
  // Map build dir to src dir
  const srcPrefix = _buildDirRe.test(valuePrefix)
    ? valuePrefix.replace(_buildDirRe, 'src/')
    : valuePrefix;
  // Check if filePath matches: pkgDir/srcPrefix + name + srcExt
  const relPath = filePath.startsWith(pkgDir + '/') ? filePath.slice(pkgDir.length + 1) : null;
  if (!relPath) return false;
  if (!relPath.startsWith(srcPrefix)) {
    // Also try the original (non-mapped) prefix for non-build-dir exports
    if (!relPath.startsWith(valuePrefix)) return false;
  }
  // Extract the file name part after the prefix, check extension
  const afterPrefix = relPath.startsWith(srcPrefix) ? relPath.slice(srcPrefix.length) : relPath.slice(valuePrefix.length);
  // It should be a single filename (no deeper nesting) with a source extension
  if (afterPrefix.includes('/')) return false;
  const extMatch = afterPrefix.match(/\.[^.]+$/);
  if (!extMatch) return false;
  const ext = extMatch[0];
  // Accept any source extension
  if (_srcExts.includes(ext) || ext === '.mjs' || ext === '.cjs' || ext === '.js') return true;
  return false;
}

/**
 * Extract path aliases from tsconfig.json and vite.config.ts
 * Returns a map of package directory -> Map of alias prefix -> resolved path
 * For monorepos, each package can have its own @/ alias
 * e.g., { '': { '@/': 'src/' }, 'packages/cli': { '@/': 'packages/cli/src/' } }
 */
// Recursively resolve export targets from conditional exports
// Handles nested conditions like { browser: { import: "./dist/solid.js" }, node: { import: "./dist/server.js" } }
// and direct source pointers like { code: "./src/index.ts", default: "./dist/index.js" }
function _resolveExportTarget(target) {
  if (typeof target === 'string') return target;
  if (typeof target !== 'object' || target === null) return null;
  // Priority: code/source (direct source pointers), then import, require, module, default
  for (const key of ['code', 'source', 'import', 'require', 'module', 'default']) {
    const val = target[key];
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
      const resolved = _resolveExportTarget(val);
      if (resolved) return resolved;
    }
  }
  // Try any other keys (browser, node, worker, deno, development, etc.)
  for (const [key, val] of Object.entries(target)) {
    if (key === 'types') continue; // Skip type-only fields
    const resolved = _resolveExportTarget(val);
    if (resolved) return resolved;
  }
  return null;
}

// Collect ALL unique export paths from conditional exports (for entry point marking)
// Different conditions may point to different source files (e.g., browser vs node)
function _collectAllExportPaths(target, paths = new Set()) {
  if (typeof target === 'string') { paths.add(target); return paths; }
  if (typeof target !== 'object' || target === null) return paths;
  for (const [key, val] of Object.entries(target)) {
    if (key === 'types') continue;
    _collectAllExportPaths(val, paths);
  }
  return paths;
}

function extractPathAliases(projectPath) {
  // Return cached result if available for same projectPath
  if (_pathAliasesCacheProjectPath === projectPath && _pathAliasesCache) {
    return _pathAliasesCache;
  }

  const aliases = new Map();  // Global aliases (from root)
  const packageAliases = new Map();  // Per-package aliases: packageDir -> Map<alias, target>

  if (!projectPath) return { aliases, packageAliases, packageBaseUrls: new Map(), workspacePackages: new Map(), goModulePath: null, javaSourceRoots: [] };

  // Check for config files in root and common subdirectories
  // For monorepos like client/server structure
  const configDirs = [
    { dir: '', prefix: '' },
    { dir: 'client', prefix: 'client/' },
    { dir: 'app', prefix: 'app/' },
    { dir: 'web', prefix: 'web/' },
    { dir: 'frontend', prefix: 'frontend/' },
    { dir: 'server', prefix: 'server/' },
    { dir: 'api', prefix: 'api/' },
    { dir: 'backend', prefix: 'backend/' },
    { dir: 'core', prefix: 'core/' },
    { dir: 'shared', prefix: 'shared/' },
    { dir: 'common', prefix: 'common/' },
  ];

  // Detect workspace directories from monorepo config files
  const workspaceDirs = new Set();

  // Resolve a workspace glob pattern like "packages/*", "packages/*/*",
  // "examples/*/src/plugins/*", or "libs/**" by walking the filesystem
  const resolveWorkspaceGlob = (pattern) => {
    const segments = pattern.split('/');
    const walk = (currentPath, segIndex) => {
      if (segIndex >= segments.length) {
        workspaceDirs.add(currentPath);
        return;
      }
      const seg = segments[segIndex];
      if (seg === '**') {
        // Recursive glob: add current + all nested subdirectories
        if (currentPath) workspaceDirs.add(currentPath);
        const addRecursive = (dir, depth) => {
          if (depth > 5) return;
          const fullPath = (0,external_path_.join)(projectPath, dir);
          try {
            const entries = (0,external_fs_.readdirSync)(fullPath, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                const subDir = `${dir}/${entry.name}`;
                workspaceDirs.add(subDir);
                addRecursive(subDir, depth + 1);
              }
            }
          } catch {}
        };
        addRecursive(currentPath || '.', 0);
      } else if (seg === '*') {
        // Single-level glob: enumerate subdirectories and continue with remaining segments
        const dirToRead = currentPath || '.';
        const fullPath = (0,external_path_.join)(projectPath, dirToRead);
        try {
          const entries = (0,external_fs_.readdirSync)(fullPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              const subDir = currentPath ? `${currentPath}/${entry.name}` : entry.name;
              walk(subDir, segIndex + 1);
            }
          }
        } catch {}
      } else {
        // Fixed segment: append and continue
        const next = currentPath ? `${currentPath}/${seg}` : seg;
        walk(next, segIndex + 1);
      }
    };
    walk('', 0);
  };

  // 1. Check package.json workspaces (npm/yarn workspaces)
  const rootPkgPath = (0,external_path_.join)(projectPath, 'package.json');
  if ((0,external_fs_.existsSync)(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse((0,external_fs_.readFileSync)(rootPkgPath, 'utf-8'));
      const workspaces = rootPkg.workspaces;
      if (workspaces) {
        // Workspaces can be array or object with packages property
        const patterns = Array.isArray(workspaces) ? workspaces : (workspaces.packages || []);
        for (const pattern of patterns) {
          if (pattern.includes('*')) {
            resolveWorkspaceGlob(pattern);
          } else {
            // Direct workspace path (no glob) like "www", "www/og-image"
            const dir = pattern.replace(/\/$/, '');
            if (dir) {
              workspaceDirs.add(dir);
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 2. Check pnpm-workspace.yaml (pnpm workspaces)
  const pnpmWorkspacePath = (0,external_path_.join)(projectPath, 'pnpm-workspace.yaml');
  if ((0,external_fs_.existsSync)(pnpmWorkspacePath)) {
    try {
      const content = (0,external_fs_.readFileSync)(pnpmWorkspacePath, 'utf-8');
      // Simple YAML parsing for packages array
      const packagesMatch = content.match(/packages:\s*\n((?:\s+-\s+[^\n]+\n?)*)/);
      if (packagesMatch) {
        const lines = packagesMatch[1].split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*-\s+['"]?([^'"#\n]+)['"]?/);
          if (match) {
            const pattern = match[1].trim();
            if (pattern.includes('*')) {
              resolveWorkspaceGlob(pattern);
            } else {
              // Direct workspace path (no glob) like "www", "www/og-image"
              const dir = pattern.replace(/\/$/, '');
              if (dir) {
                workspaceDirs.add(dir);
              }
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 3. Check lerna.json (Lerna monorepos)
  const lernaPath = (0,external_path_.join)(projectPath, 'lerna.json');
  if ((0,external_fs_.existsSync)(lernaPath)) {
    try {
      const lerna = JSON.parse((0,external_fs_.readFileSync)(lernaPath, 'utf-8'));
      for (const pattern of lerna.packages || ['packages/*']) {
        if (pattern.includes('*')) {
          resolveWorkspaceGlob(pattern);
        } else {
          const dir = pattern.replace(/\/$/, '');
          if (dir) workspaceDirs.add(dir);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 4. Check nx.json / workspace.json (Nx monorepos)
  const nxPath = (0,external_path_.join)(projectPath, 'nx.json');
  const workspaceJsonPath = (0,external_path_.join)(projectPath, 'workspace.json');
  if ((0,external_fs_.existsSync)(nxPath) || (0,external_fs_.existsSync)(workspaceJsonPath)) {
    // Nx typically uses apps/, libs/, packages/, tools/
    for (const dir of ['apps', 'libs', 'packages', 'tools', 'services']) {
      resolveWorkspaceGlob(dir + '/*');
    }
  }

  // 5. Check rush.json (Rush monorepos - Microsoft)
  const rushPath = (0,external_path_.join)(projectPath, 'rush.json');
  if ((0,external_fs_.existsSync)(rushPath)) {
    try {
      // Rush JSON has comments, strip them
      const content = (0,external_fs_.readFileSync)(rushPath, 'utf-8');
      const cleaned = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const rush = JSON.parse(cleaned);
      for (const project of rush.projects || []) {
        if (project.projectFolder) {
          const dir = (0,external_path_.dirname)(project.projectFolder);
          if (dir && dir !== '.') {
            resolveWorkspaceGlob(dir + '/*');
          }
          workspaceDirs.add(project.projectFolder);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 6. Common monorepo directory patterns (fallback)
  const commonDirs = ['packages', 'libs', 'apps', 'modules', 'services', 'tools', 'plugins', 'extensions'];
  for (const dir of commonDirs) {
    resolveWorkspaceGlob(dir + '/*');
  }

  // 7. Auto-detect standalone sub-projects with their own tsconfig.json/package.json
  // These are directories like companion/, admin/, dashboard/ that aren't in workspace config
  // but have their own TypeScript configuration with path aliases
  try {
    const topLevelEntries = (0,external_fs_.readdirSync)(projectPath, { withFileTypes: true });
    for (const entry of topLevelEntries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const dirName = entry.name;
        // Skip directories we already handle
        if (workspaceDirs.has(dirName) || commonDirs.includes(dirName)) continue;
        // Check if this directory has its own tsconfig.json (indicating it's a sub-project)
        const hasTsconfig = (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, dirName, 'tsconfig.json'));
        const hasPkgJson = (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, dirName, 'package.json'));
        if (hasTsconfig || hasPkgJson) {
          workspaceDirs.add(dirName);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  // 8. Enterprise build systems (Gradle, Maven, Bazel, Cargo, Go, .NET, etc.)
  try {
    const buildSystemDirs = getConfigDirsFromBuildSystems(projectPath);
    for (const { dir } of buildSystemDirs) {
      if (dir && !workspaceDirs.has(dir)) {
        workspaceDirs.add(dir);
      }
    }
  } catch {
    // Ignore build system detection errors
  }

  // 9. Nested workspace discovery — sub-projects may define their own workspaces
  // e.g., streamlit's frontend/package.json has workspaces: ["app", "lib", "connection", ...]
  // which resolve to frontend/app, frontend/lib, frontend/connection, etc.
  const nestedQueue = [...workspaceDirs];
  for (const parentDir of nestedQueue) {
    const nestedPkgPath = (0,external_path_.join)(projectPath, parentDir, 'package.json');
    if (!(0,external_fs_.existsSync)(nestedPkgPath)) continue;
    try {
      const nestedPkg = JSON.parse((0,external_fs_.readFileSync)(nestedPkgPath, 'utf-8'));
      const nestedWs = nestedPkg.workspaces;
      if (!nestedWs) continue;
      const patterns = Array.isArray(nestedWs) ? nestedWs : (nestedWs.packages || []);
      for (const pattern of patterns) {
        // Resolve workspace paths relative to the parent directory
        const fullPattern = `${parentDir}/${pattern.replace(/\/$/, '')}`;
        if (fullPattern.includes('*')) {
          resolveWorkspaceGlob(fullPattern);
        } else if (!workspaceDirs.has(fullPattern)) {
          workspaceDirs.add(fullPattern);
          nestedQueue.push(fullPattern);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Add all discovered workspace directories
  for (const wsDir of workspaceDirs) {
    configDirs.push({ dir: wsDir, prefix: `${wsDir}/` });
  }

  // Build workspace package map: package name -> { dir, entryPoint }
  // This allows resolving imports like '@n8n/rest-api-client' to local workspace packages
  const workspacePackages = new Map();
  for (const wsDir of workspaceDirs) {
    const pkgJsonPath = (0,external_path_.join)(projectPath, wsDir, 'package.json');
    if ((0,external_fs_.existsSync)(pkgJsonPath)) {
      try {
        const pkgJson = JSON.parse((0,external_fs_.readFileSync)(pkgJsonPath, 'utf-8'));
        if (pkgJson.name) {
          // Determine entry point - check various fields
          let entryPoint = 'src/index';

          // Check exports field first (modern packages)
          if (pkgJson.exports) {
            const mainExport = pkgJson.exports['.'];
            if (mainExport) {
              const exportPath = _resolveExportTarget(mainExport);
              if (exportPath) {
                // Convert dist path to src path (handles dist/, dist-cjs/, dist-es/, dist/commonjs/, etc.)
                entryPoint = exportPath
                  .replace(/^\.\//, '')
                  .replace(/^(dist-\w+|dist)\/(commonjs|cjs|esm|browser|react-native|workerd|node|default|types)\//, 'src/')
                  .replace(/^(dist-\w+|dist|lib|build|out)\//, 'src/')
                  .replace(/\.(c|m)?js$/, '')
                  .replace(/\.d\.(c|m)?ts$/, '');
              }
            }
          }
          // Fallback to module/main fields
          else if (pkgJson.module) {
            entryPoint = pkgJson.module.replace(/^\.\//, '')
              .replace(/^(dist-\w+|dist)\/(commonjs|cjs|esm|browser|react-native|workerd|node|default|types)\//, 'src/')
              .replace(/^(dist-\w+|dist|lib|build|out)\//, 'src/')
              .replace(/\.(c|m)?js$/, '');
          } else if (pkgJson.main) {
            entryPoint = pkgJson.main.replace(/^\.\//, '')
              .replace(/^(dist-\w+|dist)\/(commonjs|cjs|esm|browser|react-native|workerd|node|default|types)\//, 'src/')
              .replace(/^(dist-\w+|dist|lib|build|out)\//, 'src/')
              .replace(/\.(c|m)?js$/, '');
          }

          // Build subpath exports map from package.json exports field
          // Maps subpath (e.g., "strapi-server") to raw dist path for later resolution
          // Uses _resolveExportTarget to handle nested conditional exports
          const exportsMap = new Map();
          if (pkgJson.exports && typeof pkgJson.exports === 'object') {
            for (const [subpath, target] of Object.entries(pkgJson.exports)) {
              if (subpath === '.' || subpath === './package.json') continue;
              const exportTarget = _resolveExportTarget(target);
              if (typeof exportTarget === 'string') {
                const rawPath = exportTarget.replace(/^\.\//, '').replace(/\.(c|m)?js$/, '').replace(/\.d\.(c|m)?ts$/, '');
                exportsMap.set(subpath.replace(/^\.\//, ''), rawPath);
              }
            }
          }

          workspacePackages.set(pkgJson.name, {
            dir: wsDir,
            entryPoint: entryPoint,
            exportsMap: exportsMap
          });
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Store baseUrl per directory for resolving bare imports
  const packageBaseUrls = new Map();

  for (const { dir, prefix } of configDirs) {
    const configDir = dir ? (0,external_path_.join)(projectPath, dir) : projectPath;
    if (dir && !(0,external_fs_.existsSync)(configDir)) continue;

    // Create a map for this package's aliases
    const dirAliases = new Map();

    // Try tsconfig.json in this directory
    // Include tsconfig.base.json which Nx uses for workspace-wide path aliases
    const tsconfigFiles = ['tsconfig.json', 'tsconfig.base.json', 'tsconfig.app.json', 'jsconfig.json'];

    /**
     * Recursively read tsconfig and follow extends chain.
     * Returns paths with targets already resolved to project-relative form,
     * so callers don't need to apply directory prefix or baseUrl.
     * @param {string} tsconfigPath - Path to tsconfig file
     * @param {Set} visited - Set of already visited configs to prevent cycles
     * @returns {{ resolvedPaths: Map<string, string>, rawPaths: Object, baseUrl: string }}
     */
    const readTsconfigWithExtends = (tsconfigPath, visited = new Set()) => {
      if (visited.has(tsconfigPath) || !(0,external_fs_.existsSync)(tsconfigPath)) {
        return { resolvedPaths: new Map(), rawPaths: {}, baseUrl: '.' };
      }
      visited.add(tsconfigPath);

      try {
        const content = (0,external_fs_.readFileSync)(tsconfigPath, 'utf-8');
        // Remove comments (tsconfig allows them) but NOT inside strings
        // First, temporarily replace string contents to protect them
        const stringPlaceholders = [];
        const contentWithPlaceholders = content.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
          stringPlaceholders.push(match);
          return `"__STRING_${stringPlaceholders.length - 1}__"`;
        });
        // Now remove comments
        const withoutComments = contentWithPlaceholders.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        // Restore strings
        const cleaned = withoutComments.replace(/"__STRING_(\d+)__"/g, (_, idx) => stringPlaceholders[parseInt(idx)]);
        const tsconfig = JSON.parse(cleaned);

        // Compute project-relative prefix for this tsconfig's directory
        const tsconfigDir = (0,external_path_.dirname)(tsconfigPath);
        let relDir = (0,external_path_.relative)(projectPath, tsconfigDir).replace(/\\/g, '/');
        const tsconfigPrefix = relDir ? relDir + '/' : '';

        // Start with inherited resolved paths from extends
        let inheritedResolvedPaths = new Map();

        if (tsconfig.extends) {
          // TypeScript 5.0+ supports array extends - process each one
          const extendsArray = Array.isArray(tsconfig.extends) ? tsconfig.extends : [tsconfig.extends];

          for (const extendsValue of extendsArray) {
            if (typeof extendsValue !== 'string') continue;

            let extendsPath;

            if (extendsValue.startsWith('.')) {
              // Relative path - resolve from current tsconfig's directory
              extendsPath = (0,external_path_.join)((0,external_path_.dirname)(tsconfigPath), extendsValue);
              // Add .json if not present
              if (!extendsPath.endsWith('.json')) {
                extendsPath += '.json';
              }
            } else if (extendsValue.startsWith('@') || !extendsValue.includes('/')) {
              // Package reference like "@tsconfig/node20" or "tsconfig/recommended"
              // Try to resolve from node_modules
              const nodeModulesPath = (0,external_path_.join)(projectPath, 'node_modules', extendsValue);
              if ((0,external_fs_.existsSync)(nodeModulesPath)) {
                extendsPath = (0,external_fs_.existsSync)((0,external_path_.join)(nodeModulesPath, 'tsconfig.json'))
                  ? (0,external_path_.join)(nodeModulesPath, 'tsconfig.json')
                  : nodeModulesPath;
              }
            } else {
              // Absolute-ish path
              extendsPath = (0,external_path_.join)((0,external_path_.dirname)(tsconfigPath), extendsValue);
              if (!extendsPath.endsWith('.json')) {
                extendsPath += '.json';
              }
            }

            if (extendsPath && (0,external_fs_.existsSync)(extendsPath)) {
              const inherited = readTsconfigWithExtends(extendsPath, visited);
              // Merge inherited resolved paths (later extends override earlier)
              // Inherited paths are already project-relative from the recursive call
              for (const [alias, target] of inherited.resolvedPaths) {
                inheritedResolvedPaths.set(alias, target);
              }
            }
          }
        }

        // Resolve current config's paths to project-relative form
        const currentPaths = tsconfig.compilerOptions?.paths || {};
        const currentBaseUrl = tsconfig.compilerOptions?.baseUrl;

        for (const [alias, targets] of Object.entries(currentPaths)) {
          if (targets && targets.length > 0) {
            const aliasPrefix = alias.replace(/\*$/, '');
            let targetPath = targets[0].replace(/\*$/, '').replace(/^\.\//, '');

            // Combine with baseUrl if not absolute
            if (currentBaseUrl && currentBaseUrl !== '.') {
              targetPath = (0,external_path_.join)(currentBaseUrl.replace(/^\.\//, ''), targetPath);
            }

            // Apply this tsconfig's project-relative prefix
            targetPath = tsconfigPrefix + targetPath;

            // Normalize paths with ../
            if (targetPath.includes('..')) {
              targetPath = (0,external_path_.normalize)(targetPath).replace(/\\/g, '/');
            }

            // Only add trailing slash for directory-style aliases (those that had *)
            // But not for empty targetPath (maps to project root, e.g. "@/*": ["./*"])
            const isDirectoryAlias = alias.endsWith('*') || targets[0].endsWith('*');
            if (isDirectoryAlias && targetPath && !targetPath.endsWith('/')) targetPath += '/';

            // Current config overrides inherited
            inheritedResolvedPaths.set(aliasPrefix, targetPath);
          }
        }

        return {
          resolvedPaths: inheritedResolvedPaths,
          rawPaths: { ...Object.fromEntries([...inheritedResolvedPaths]), ...currentPaths },
          baseUrl: currentBaseUrl || '.'
        };
      } catch (e) {
        return { resolvedPaths: new Map(), rawPaths: {}, baseUrl: '.' };
      }
    };

    for (const tsconfigFile of tsconfigFiles) {
      const tsconfigPath = (0,external_path_.join)(configDir, tsconfigFile);
      if ((0,external_fs_.existsSync)(tsconfigPath)) {
        try {
          const { resolvedPaths, baseUrl } = readTsconfigWithExtends(tsconfigPath);

          // resolvedPaths are already project-relative (prefix and baseUrl applied
          // at each level of the extends chain)
          for (const [aliasPrefix, targetPath] of resolvedPaths) {
            dirAliases.set(aliasPrefix, targetPath);
            // Also add to global aliases for backwards compatibility
            if (!aliases.has(aliasPrefix)) {
              aliases.set(aliasPrefix, targetPath);
            }
          }

          // Store baseUrl for this directory (project-relative)
          // e.g., baseUrl: "." in apps/studio/tsconfig.json -> "apps/studio/"
          // For root tsconfig (dir=''), baseUrl: "." means project root -> prefix ""
          if (baseUrl) {
            const baseUrlPrefix = baseUrl === '.'
              ? prefix
              : prefix + baseUrl.replace(/^\.\//, '').replace(/\/$/, '') + '/';
            // Use dir or empty string for root
            packageBaseUrls.set(dir || '', baseUrlPrefix);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    // Also try vite.config.ts/js in this directory
    const viteConfigFiles = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs'];

    for (const viteConfigFile of viteConfigFiles) {
      const viteConfigPath = (0,external_path_.join)(configDir, viteConfigFile);
      if ((0,external_fs_.existsSync)(viteConfigPath)) {
        try {
          const content = (0,external_fs_.readFileSync)(viteConfigPath, 'utf-8');

          // Look for resolve.alias patterns
          // Common patterns:
          // '@': path.resolve(__dirname, './src')
          // '@/': '/src/'
          // alias: { '@': ... }

          const aliasPatterns = [
            // '@': path.resolve(..., './src') or '@': './src'
            /['"](@[^'"]*)['"]\s*:\s*(?:path\.resolve\s*\([^)]*,\s*)?['"]\.?\/?(src[^'"]*)['"]/g,
            // alias: { '@': ... }
            /['"](@\/?)['"].*?['"]\.?\/?([^'"]+)['"]/g
          ];

          for (const pattern of aliasPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              let alias = match[1];
              let target = match[2];

              // Normalize alias to end with /
              if (!alias.endsWith('/')) alias += '/';
              // Normalize target and add prefix
              target = prefix + target.replace(/^\.\//, '').replace(/\/$/, '') + '/';

              if (!dirAliases.has(alias)) {
                dirAliases.set(alias, target);
              }
              if (!aliases.has(alias)) {
                aliases.set(alias, target);
              }
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    // Store per-package aliases if any were found
    if (dirAliases.size > 0 && dir) {
      packageAliases.set(dir, dirAliases);
    }
  }

  // Common defaults if nothing found
  if (aliases.size === 0) {
    // Check for client/src pattern first (more specific)
    if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'client', 'src'))) {
      aliases.set('@/', 'client/src/');
    }
    // Check if src/ directory exists, assume @/ -> src/
    else if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, 'src'))) {
      aliases.set('@/', 'src/');
    }
  }

  // Detect Docusaurus @site alias
  // Docusaurus injects @site as an alias to the documentation root (where docusaurus.config.* lives)
  // Check both workspace dirs and common documentation directory names
  const docusaurusFiles = ['docusaurus.config.js', 'docusaurus.config.ts', 'docusaurus.config.mjs'];
  const docDirsToCheck = new Set(configDirs.map(d => d.dir));
  // Also check common documentation directories that may not be workspace packages
  for (const docDir of ['docs', 'documentation', 'website', 'doc']) {
    if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, docDir))) {
      docDirsToCheck.add(docDir);
    }
  }
  for (const dir of docDirsToCheck) {
    const configDir = dir ? (0,external_path_.join)(projectPath, dir) : projectPath;
    const hasDocusaurus = docusaurusFiles.some(f => (0,external_fs_.existsSync)((0,external_path_.join)(configDir, f)));
    if (hasDocusaurus) {
      const prefix = dir ? dir + '/' : '';
      const siteAlias = '@site/';
      if (dir) {
        if (!packageAliases.has(dir)) {
          packageAliases.set(dir, new Map());
        }
        packageAliases.get(dir).set(siteAlias, prefix);
      } else {
        aliases.set(siteAlias, '');
      }
      // Ensure this dir is in configDirs so its tsconfig gets read too
      if (!configDirs.some(d => d.dir === dir)) {
        configDirs.push({ dir, prefix });
      }
    }
  }

  // Parse go.mod for Go module path (used for import resolution)
  let goModulePath = null;
  const goModPath = (0,external_path_.join)(projectPath, 'go.mod');
  if ((0,external_fs_.existsSync)(goModPath)) {
    try {
      const goModContent = (0,external_fs_.readFileSync)(goModPath, 'utf8');
      const moduleMatch = goModContent.match(/^module\s+(\S+)/m);
      if (moduleMatch) {
        goModulePath = moduleMatch[1];
      }
    } catch {
      // Ignore read errors
    }
  }

  // Detect Java/Kotlin source roots (Maven/Gradle conventions)
  // These help resolve package imports like com.example.Service -> src/main/java/com/example/Service.java
  const javaSourceRoots = [];
  const javaSourceRootCandidates = [
    'src/main/java',
    'src/test/java',
    'src/main/kotlin',
    'src/test/kotlin',
  ];

  // Check for source roots in the project root and in submodules/subprojects
  const checkJavaDir = (baseDir, prefix) => {
    for (const candidate of javaSourceRootCandidates) {
      const fullCandidate = (0,external_path_.join)(baseDir, candidate);
      try {
        if ((0,external_fs_.statSync)(fullCandidate).isDirectory()) {
          javaSourceRoots.push(prefix ? prefix + '/' + candidate : candidate);
        }
      } catch {}
    }
  };
  // Check root
  checkJavaDir(projectPath, '');
  // Check subdirectories up to 3 levels deep (for multi-module Maven/Gradle projects)
  // e.g. spring-boot-project/spring-boot/src/main/java
  try {
    for (const entry of (0,external_fs_.readdirSync)(projectPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      checkJavaDir((0,external_path_.join)(projectPath, entry.name), entry.name);
      try {
        for (const subEntry of (0,external_fs_.readdirSync)((0,external_path_.join)(projectPath, entry.name), { withFileTypes: true })) {
          if (!subEntry.isDirectory() || subEntry.name.startsWith('.')) continue;
          checkJavaDir((0,external_path_.join)(projectPath, entry.name, subEntry.name), entry.name + '/' + subEntry.name);
          try {
            for (const sub2Entry of (0,external_fs_.readdirSync)((0,external_path_.join)(projectPath, entry.name, subEntry.name), { withFileTypes: true })) {
              if (!sub2Entry.isDirectory() || sub2Entry.name.startsWith('.')) continue;
              checkJavaDir((0,external_path_.join)(projectPath, entry.name, subEntry.name, sub2Entry.name), entry.name + '/' + subEntry.name + '/' + sub2Entry.name);
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}

  const result = { aliases, packageAliases, packageBaseUrls, workspacePackages, goModulePath, javaSourceRoots };
  _pathAliasesCache = result;
  _pathAliasesCacheProjectPath = projectPath;
  return result;
}

// Handle both ESM and CJS default exports from @babel/traverse
const traverse = traverse_lib["default"] || traverse_lib;

// Dynamic patterns from config - files matching these are NOT dead (dynamically loaded)
let DYNAMIC_PATTERNS = [];
let DYNAMIC_PATTERN_SOURCES = [];

/**
 * Set dynamic patterns from config
 * @param {string[]} patterns - Glob patterns for dynamically loaded files
 */
function setDynamicPatterns(patterns) {
  DYNAMIC_PATTERN_SOURCES = patterns;
  DYNAMIC_PATTERNS = patterns.map(p => {
    // Convert glob to regex
    const regex = p
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*')
      .replace(/\./g, '\\.')
      .replace(/\?/g, '.');
    return new RegExp(regex);
  });
}

// DI (Dependency Injection) patterns for detecting framework-injected classes
let DI_DECORATORS = new Set();
let DI_CONTAINER_PATTERNS = [];

/**
 * Set DI patterns from config
 * @param {string[]} decorators - Decorator names that mark classes as DI entry points
 * @param {string[]} containerPatterns - Regex patterns for DI container access
 */
function setDIPatterns(decorators = [], containerPatterns = []) {
  DI_DECORATORS = new Set(decorators);
  DI_CONTAINER_PATTERNS = containerPatterns.map(p => new RegExp(p));
}

/**
 * Check if a class has DI decorators that make it an entry point
 * @param {Object} classInfo - Parsed class info with decorators array
 * @returns {{ hasDI: boolean, decorators: string[] }}
 */
function hasDIDecorators(classInfo) {
  if (!classInfo?.decorators?.length) return { hasDI: false, decorators: [] };

  const matched = [];

  for (const decorator of classInfo.decorators) {
    const name = decorator.name;

    // Standard DI decorators (NestJS @Controller, @Module, etc.)
    if (DI_DECORATORS.has(name)) {
      matched.push(name);
      continue;
    }

    // Special case: Angular @Injectable({ providedIn: 'root' }) or providedIn: 'any'
    // These are tree-shakeable singletons that are auto-registered
    if (name === 'Injectable' && decorator.args) {
      const providedIn = decorator.args.providedIn;
      if (providedIn === 'root' || providedIn === 'any' || providedIn === 'platform') {
        matched.push(`Injectable(providedIn: '${providedIn}')`);
        continue;
      }
    }

    // Special case: NestJS @Injectable() with useFactory/useClass in module
    // Note: Basic @Injectable() without providedIn is NOT an entry point
    // It requires registration in a module's providers array
  }

  return { hasDI: matched.length > 0, decorators: matched };
}

/**
 * Extract class names referenced via DI container access patterns
 * e.g., Container.get(MyService), container.resolve<IService>(ServiceImpl)
 * @param {string} content - File content to scan
 * @returns {string[]} - Array of class names found
 */
function extractDIContainerReferences(content) {
  if (!content || DI_CONTAINER_PATTERNS.length === 0) return [];

  const classNames = new Set();

  for (const pattern of DI_CONTAINER_PATTERNS) {
    // Find all matches of the container pattern
    const matches = content.matchAll(new RegExp(pattern.source, 'g'));
    for (const match of matches) {
      // Get the text after the match to find the class name
      const afterMatch = content.slice(match.index + match[0].length);

      // Pattern 1: Container.get<Generic>(ClassName) - extract ClassName from after generic
      // Pattern 2: Container.get(ClassName) - extract ClassName directly
      // Class names are PascalCase identifiers
      const classMatch = afterMatch.match(/^(?:<[^>]+>\s*\(?\s*)?([A-Z][a-zA-Z0-9_]*)/);
      if (classMatch && classMatch[1]) {
        classNames.add(classMatch[1]);
      }
    }
  }

  return [...classNames];
}

/**
 * Extract C# class references from file content
 * Detects: new ClassName, typeof(ClassName), ClassName variable, generic types <ClassName>
 * @param {string} content - File content to scan
 * @param {Set<string>} knownClasses - Set of known class names to match against
 * @returns {string[]} - Array of class names found
 */
function extractCSharpClassReferences(content, knownClasses) {
  if (!content || !knownClasses || knownClasses.size === 0) return [];

  const classNames = new Set();

  // Pattern 1: new ClassName (instantiation)
  const newPattern = /new\s+([A-Z][a-zA-Z0-9_]*)\s*[({<]/g;
  let match;
  while ((match = newPattern.exec(content)) !== null) {
    if (knownClasses.has(match[1])) {
      classNames.add(match[1]);
    }
  }

  // Pattern 2: typeof(ClassName)
  const typeofPattern = /typeof\s*\(\s*([A-Z][a-zA-Z0-9_]*)\s*\)/g;
  while ((match = typeofPattern.exec(content)) !== null) {
    if (knownClasses.has(match[1])) {
      classNames.add(match[1]);
    }
  }

  // Pattern 3: Generic type arguments <ClassName> or <ClassName, OtherClass>
  const genericPattern = /<\s*([A-Z][a-zA-Z0-9_]*)\s*(?:[,>])/g;
  while ((match = genericPattern.exec(content)) !== null) {
    if (knownClasses.has(match[1])) {
      classNames.add(match[1]);
    }
  }

  // Pattern 4: ActionResult<ClassName>, IEnumerable<ClassName>, etc.
  const wrappedGenericPattern = /<[A-Za-z]+<\s*([A-Z][a-zA-Z0-9_]*)\s*>/g;
  while ((match = wrappedGenericPattern.exec(content)) !== null) {
    if (knownClasses.has(match[1])) {
      classNames.add(match[1]);
    }
  }

  return [...classNames];
}

/**
 * Extract C# extension method names from a file's content
 * Extension methods have 'this' as the first parameter modifier
 * @param {Object} file - Parsed file with content
 * @returns {string[]} - Array of extension method names
 */
function extractCSharpExtensionMethods(file) {
  const content = file.content || '';
  if (!content) return [];

  const methodNames = [];

  // Look for static methods with 'this' parameter (extension methods)
  // Pattern matches: public static ReturnType MethodName(this Type param, ...)
  // Handles multi-line signatures by using [\s\S]*? for the parameter list
  const extensionMethodPattern = /public\s+static\s+[\w<>\[\],\s?]+\s+(\w+)\s*\([^)]*\bthis\s+/g;

  let match;
  while ((match = extensionMethodPattern.exec(content)) !== null) {
    methodNames.push(match[1]);
  }

  return methodNames;
}

/**
 * Check if a method call in content matches any known extension method
 * @param {string} content - File content to scan
 * @param {Map<string, string>} methodToFile - Map of method names to file paths
 * @returns {string[]} - Array of file paths that define called extension methods
 */
function findCalledExtensionMethods(content, methodToFile) {
  if (!content || methodToFile.size === 0) return [];

  const calledFiles = new Set();

  for (const [methodName, filePath] of methodToFile) {
    // Look for method call: .MethodName( or .MethodName<
    const pattern = new RegExp(`\\.${methodName}\\s*[(<]`, 'g');
    if (pattern.test(content)) {
      calledFiles.add(filePath);
    }
  }

  return [...calledFiles];
}

/**
 * Parse .csproj files to build a project dependency graph via ProjectReferences.
 * Returns a Set of project directories that are transitively referenced by any "app" project
 * (a project containing Program.cs or Startup.cs).
 * All .cs files in these directories should be treated as entry points.
 * @param {string} projectPath - Root path of the repository
 * @returns {Set<string>} - Set of project directory prefixes (relative to projectPath)
 */
function parseCsprojReferences(projectPath) {
  const referencedDirs = new Set();
  if (!projectPath) return referencedDirs;

  let csprojFiles;
  try {
    csprojFiles = (0,esm.globSync)('**/*.csproj', {
      cwd: projectPath,
      ignore: ['**/bin/**', '**/obj/**', '**/node_modules/**']
    });
  } catch { return referencedDirs; }

  if (csprojFiles.length === 0) return referencedDirs;

  // Build dependency graph: projectDir -> Set<referencedProjectDirs>
  const graph = new Map();
  const projectDirs = new Set();

  for (const csprojFile of csprojFiles) {
    const projDir = (0,external_path_.dirname)(csprojFile);
    projectDirs.add(projDir);

    try {
      const content = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, csprojFile), 'utf-8');
      const refs = new Set();

      // Extract <ProjectReference Include="..\..\OtherProject\OtherProject.csproj" />
      const refPattern = /<ProjectReference\s+Include="([^"]+)"/gi;
      let match;
      while ((match = refPattern.exec(content)) !== null) {
        // Normalize Windows backslash paths to forward slash
        const refPath = match[1].replace(/\\/g, '/');
        // Resolve relative to the .csproj directory
        const resolvedRef = (0,external_path_.normalize)((0,external_path_.join)(projDir, refPath));
        const refDir = (0,external_path_.dirname)(resolvedRef);
        refs.add(refDir);
      }

      graph.set(projDir, refs);
    } catch {
      graph.set(projDir, new Set());
    }
  }

  // Find "app" projects (contain Program.cs or Startup.cs)
  const appProjects = new Set();
  for (const projDir of projectDirs) {
    try {
      const dirPath = (0,external_path_.join)(projectPath, projDir);
      const entries = (0,external_fs_.readdirSync)(dirPath);
      if (entries.some(e => /^(Program|Startup)\.cs$/i.test(e))) {
        appProjects.add(projDir);
      }
    } catch { /* skip */ }
  }

  // If no app projects found, treat ALL project dirs as potentially referenced
  // (library repos where everything is public API)
  if (appProjects.size === 0) {
    for (const projDir of projectDirs) {
      referencedDirs.add(projDir);
    }
    return referencedDirs;
  }

  // BFS from each app project to find all transitively referenced project dirs
  for (const appProj of appProjects) {
    referencedDirs.add(appProj);
    const visited = new Set([appProj]);
    const queue = [appProj];
    let qi = 0;
    while (qi < queue.length) {
      const current = queue[qi++];
      const refs = graph.get(current);
      if (refs) {
        for (const ref of refs) {
          if (!visited.has(ref)) {
            visited.add(ref);
            referencedDirs.add(ref);
            queue.push(ref);
          }
        }
      }
    }
  }

  return referencedDirs;
}

// Package.json fields that contain dynamically loaded file paths
let DYNAMIC_PACKAGE_FIELDS = ['nodes', 'plugins', 'credentials', 'extensions', 'adapters', 'connectors'];

/**
 * Set package.json fields to search for dynamic entry points
 * @param {string[]} fields - Field names to search
 */
function setDynamicPackageFields(fields) {
  DYNAMIC_PACKAGE_FIELDS = fields;
}

/**
 * Extract dynamic file paths from package.json object recursively
 * @param {Object} obj - Object to search (package.json or nested object)
 * @param {number} depth - Current recursion depth (max 3)
 * @returns {string[]} - Array of file paths found
 */
function extractDynamicPaths(obj, depth = 0) {
  if (depth > 3 || !obj || typeof obj !== 'object') return [];
  const paths = [];

  // Check for configured field names at this level
  for (const field of DYNAMIC_PACKAGE_FIELDS) {
    if (Array.isArray(obj[field])) {
      paths.push(...obj[field].filter(p => typeof p === 'string'));
    }
  }

  // Recurse into nested objects (but not arrays)
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...extractDynamicPaths(value, depth + 1));
    }
  }

  return paths;
}

// Config entry points from bundler/CI configs
let CONFIG_ENTRY_DATA = { entries: [], npmScripts: [] };

/**
 * Set config entry data from bundler/CI config parsing
 * @param {Object} data - Result from collectConfigEntryPoints
 */
function setConfigEntryData(data) {
  CONFIG_ENTRY_DATA = data || { entries: [], npmScripts: [] };
}

/**
 * Check if a file is a config-defined entry point
 * @param {string} filePath - Relative file path
 * @returns {{ isConfigEntry: boolean, source: string|null }}
 */
function checkConfigEntry(filePath) {
  const normalizedPath = filePath.replace(/^\.\//, '');

  for (const entry of CONFIG_ENTRY_DATA.entries) {
    // Direct match
    if (normalizedPath === entry || normalizedPath.endsWith('/' + entry) || entry.endsWith('/' + normalizedPath)) {
      return { isConfigEntry: true, source: 'bundler/ci-config' };
    }

    // Match without extension
    const withoutExt = entry.replace(/\.[^.]+$/, '');
    const fileWithoutExt = normalizedPath.replace(/\.[^.]+$/, '');
    if (fileWithoutExt === withoutExt || fileWithoutExt.endsWith('/' + withoutExt) || withoutExt.endsWith('/' + fileWithoutExt)) {
      return { isConfigEntry: true, source: 'bundler/ci-config' };
    }
  }

  return { isConfigEntry: false, source: null };
}

// Detected frameworks cache
let DETECTED_FRAMEWORKS = new Set();

/**
 * Detect frameworks from package.json dependencies
 * @param {Object} packageJson - Parsed package.json
 */
// Internal: add frameworks from a single package.json (accumulates, does not reset)
function _addFrameworks(packageJson) {
  if (!packageJson) return;
  const allDeps = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
    ...(packageJson.peerDependencies || {})
  };

  // CLI frameworks
  if (allDeps['@oclif/core'] || allDeps['oclif']) DETECTED_FRAMEWORKS.add('oclif');
  if (allDeps['commander']) DETECTED_FRAMEWORKS.add('commander');
  if (allDeps['yargs']) DETECTED_FRAMEWORKS.add('yargs');

  // NestJS
  if (allDeps['@nestjs/core'] || allDeps['@nestjs/common']) DETECTED_FRAMEWORKS.add('nestjs');

  // Vue ecosystem
  if (allDeps['vue'] || allDeps['vue-router']) DETECTED_FRAMEWORKS.add('vue');
  if (allDeps['nuxt'] || allDeps['nuxt3'] || allDeps['@nuxt/kit']) DETECTED_FRAMEWORKS.add('nuxt');
  if (allDeps['pinia']) DETECTED_FRAMEWORKS.add('pinia');
  if (allDeps['vuex']) DETECTED_FRAMEWORKS.add('vuex');

  // React ecosystem
  if (allDeps['react'] || allDeps['react-dom']) DETECTED_FRAMEWORKS.add('react');
  if (allDeps['react-router'] || allDeps['react-router-dom']) DETECTED_FRAMEWORKS.add('react-router');
  if (allDeps['redux'] || allDeps['@reduxjs/toolkit']) DETECTED_FRAMEWORKS.add('redux');

  // Angular
  if (allDeps['@angular/core']) DETECTED_FRAMEWORKS.add('angular');

  // Express/Fastify
  if (allDeps['express']) DETECTED_FRAMEWORKS.add('express');
  if (allDeps['fastify']) DETECTED_FRAMEWORKS.add('fastify');

  // ESLint config
  if (packageJson.name?.includes('eslint-config')) DETECTED_FRAMEWORKS.add('eslint-config');
}

function detectFrameworks(packageJson) {
  DETECTED_FRAMEWORKS = new Set();
  _addFrameworks(packageJson);
  return DETECTED_FRAMEWORKS;
}

/**
 * Check if a file is a framework-specific entry point
 * @param {string} filePath - Relative file path
 * @returns {{ isEntry: boolean, reason: string|null }}
 */
function checkFrameworkEntry(filePath) {
  // CLI frameworks - commands directory
  if (DETECTED_FRAMEWORKS.has('oclif') || DETECTED_FRAMEWORKS.has('commander') || DETECTED_FRAMEWORKS.has('yargs')) {
    if (/\/commands\//.test(filePath) || /^commands\//.test(filePath)) {
      return { isEntry: true, reason: 'CLI command file (oclif/commander/yargs)' };
    }
  }

  // NestJS - controllers and handlers (modules are detected via import analysis)
  if (DETECTED_FRAMEWORKS.has('nestjs')) {
    if (/\.controller\.([mc]?[jt]s|tsx)$/.test(filePath)) {
      return { isEntry: true, reason: 'NestJS controller' };
    }
    // Note: .module. files removed - non-root modules need import analysis to be considered live
    if (/\.handler\.([mc]?[jt]s|tsx)$/.test(filePath)) {
      return { isEntry: true, reason: 'NestJS/API handler' };
    }
  }

  // Vue - router, stores
  if (DETECTED_FRAMEWORKS.has('vue')) {
    if (/router\.([mc]?[jt]s|tsx)$/.test(filePath)) {
      return { isEntry: true, reason: 'Vue router file' };
    }
    if (/init\.([mc]?[jt]s|tsx)$/.test(filePath) || /\/app\/init\.([mc]?[jt]s|tsx)$/.test(filePath)) {
      return { isEntry: true, reason: 'Vue app initialization' };
    }
  }

  // Nuxt auto-imports — Nuxt 3 automatically imports from these directories (recursively)
  // Files in these dirs are used without explicit import statements
  if (DETECTED_FRAMEWORKS.has('nuxt')) {
    if (/\/(?:utils|helpers|lib|context)\/.*\.[mc]?[jt]sx?$/.test(filePath)) {
      return { isEntry: true, reason: 'Nuxt auto-imported utility' };
    }
    if (/\/(?:store|stores)\/.*\.[mc]?[jt]sx?$/.test(filePath)) {
      return { isEntry: true, reason: 'Nuxt/Pinia auto-imported store' };
    }
    if (/\/middleware\/[^/]+\.[mc]?[jt]sx?$/.test(filePath)) {
      return { isEntry: true, reason: 'Nuxt route middleware' };
    }
    if (/\/components\/.*\.(vue|[mc]?[jt]sx?)$/.test(filePath)) {
      return { isEntry: true, reason: 'Nuxt auto-imported component' };
    }
    if (/\/error\/.*\.[mc]?[jt]sx?$/.test(filePath)) {
      return { isEntry: true, reason: 'Nuxt error handler' };
    }
  }

  // Pinia stores
  if (DETECTED_FRAMEWORKS.has('pinia')) {
    if (/\.store\.([mc]?[jt]s|tsx)$/.test(filePath) || /use\w+Store\.([mc]?[jt]s|tsx)$/.test(filePath)) {
      return { isEntry: true, reason: 'Pinia store' };
    }
  }

  // Vuex stores
  if (DETECTED_FRAMEWORKS.has('vuex')) {
    if (/\.store\.([mc]?[jt]s|tsx)$/.test(filePath) || /\/stores?\//.test(filePath)) {
      return { isEntry: true, reason: 'Vuex store' };
    }
  }

  // ESLint config packages
  if (DETECTED_FRAMEWORKS.has('eslint-config')) {
    if (/\/configs?\//.test(filePath)) {
      return { isEntry: true, reason: 'ESLint config export' };
    }
  }

  return { isEntry: false, reason: null };
}

/**
 * Convert a glob pattern to a regex for matching file paths
 */
function globToRegex(pattern) {
  const regexStr = pattern
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\./g, '\\.')
    .replace(/\?/g, '.');
  return new RegExp(regexStr);
}

/**
 * Match files against a glob pattern
 */
function matchGlobPattern(pattern, filePaths, baseDir = '') {
  // Resolve relative paths (../ and ./) against baseDir first (before regex conversion)
  let resolved = pattern;
  if (resolved.startsWith('./') || resolved.startsWith('../')) {
    if (baseDir) {
      const parts = baseDir.split('/');
      let rel = resolved;
      while (rel.startsWith('../')) {
        parts.pop();
        rel = rel.slice(3);
      }
      if (rel.startsWith('./')) rel = rel.slice(2);
      resolved = parts.length > 0 ? parts.join('/') + '/' + rel : rel;
    } else {
      resolved = resolved.replace(/^\.\//, '');
    }
  }

  // Escape dots, then convert glob syntax to regex
  let regexStr = resolved
    .replace(/\./g, '\\.')                    // Escape all dots first
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\{([^}]+)\}/g, (_, content) => {   // Expand braces last (dots already escaped)
      const parts = content.split(',').map(p => p.trim());
      return `(?:${parts.join('|')})`;
    });

  try {
    const regex = new RegExp(regexStr);
    return filePaths.filter(fp => regex.test(fp));
  } catch {
    return [];
  }
}

// Entry point patterns - files matching these are NOT dead code even if not imported
// NOTE: These now match ANYWHERE in the path, not just at root
const ENTRY_POINT_PATTERNS = [
  // === CLI Commands (oclif/commander/yargs) ===
  // These are loaded dynamically by CLI frameworks based on directory structure
  /src\/cli\/commands\//,
  /\/commands\//,  // Generic commands directory
  /^commands\//,
  /\/bin\//,
  /^bin\//,

  // Scripts (run directly with node)
  /\/scripts?\//,
  /^scripts?\//,

  // Main entry files - only root or src-level, NOT nested directories
  // This prevents treating all index.ts files in packages/libs as entry points
  /^(index|main|server|app|init|router)\.([mc]?[jt]s|[jt]sx)$/,
  /^src\/(index|main|server|app|init|router)\.([mc]?[jt]s|[jt]sx)$/,
  // Client/server split - flat structure (server/index.ts, api/index.ts, functions/index.ts)
  /^(client|server|api|backend|functions|lambda|worker|workers|services|core|lib|app|web|middleware|source)\/(?:index|main|app|handler)\.([mc]?[jt]s|[jt]sx)$/,
  // Client/server split - with src subdirectory (server/src/index.ts)
  /^(client|server|api|backend|functions|lambda|services|core|lib|app|web|source)\/src\/(index|main|server|app|handler)\.([mc]?[jt]s|[jt]sx)$/,
  // CLI and scripts (bin/cli.ts, cli/index.ts, commands/serve.ts)
  /^(bin|cli|commands|scripts)\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  // Background jobs and tasks (jobs/cleanup.ts, cron/daily.ts, queues/email.ts)
  /^(jobs|tasks|cron|queues)\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  // Serverless platforms (netlify/functions/*.ts, vercel/api/*.ts, supabase/functions/*.ts)
  /^netlify\/functions\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  /^vercel\/api\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  /^supabase\/functions\/[^/]+\/index\.([mc]?[jt]s|[jt]sx)$/,
  /^edge-functions?\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  /^deno\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  // GraphQL (graphql/resolvers.ts, resolvers/user.ts)
  /^(graphql|resolvers|schema)\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  // Monorepo app entry points (apps/*/src/index.tsx or apps/*/src/main.ts)
  /^apps\/[^/]+\/src\/(index|main|server|app)\.([mc]?[jt]s|[jt]sx)$/,
  /^apps\/[^/]+\/(index|main|server|app)\.([mc]?[jt]s|[jt]sx)$/,
  // Nested workspace entry points (apps/api/v2/src/main.ts, apps/api/v1/src/index.ts)
  /^apps\/[^/]+\/[^/]+\/src\/(index|main|server|app)\.([mc]?[jt]s|[jt]sx)$/,
  /^apps\/[^/]+\/[^/]+\/(index|main|server|app)\.([mc]?[jt]s|[jt]sx)$/,
  // Monorepo packages entry points (packages/*/src/main.ts, packages/*/*/src/main.ts)
  /^packages\/[^/]+\/src\/(index|main|server|app|init)\.([mc]?[jt]s|[jt]sx)$/,
  /^packages\/[^/]+\/[^/]+\/src\/(index|main|server|app|init)\.([mc]?[jt]s|[jt]sx)$/,
  /^packages\/[^/]+\/(index|main|server|app)\.([mc]?[jt]s|[jt]sx)$/,
  // Libs directory pattern (libs/*/src/index.ts)
  /^libs\/[^/]+\/src\/(index|main)\.([mc]?[jt]s|[jt]sx)$/,

  // Config files (vite.config.ts, postcss.config.cjs, jest.config.mjs, jest.config.cli.js, karma.conf.js etc.)
  /\.(config|rc|conf)(\.\w+)*\.([mc]?[jt]s|json)$/,
  /^\..*rc\.[mc]?js$/,

  // TypeScript declaration files (.d.ts/.d.cts/.d.mts) - ambient type definitions used by compiler
  /\.d\.ts$/, /\.d\.cts$/, /\.d\.mts$/,
  /shims-.*\.d\.ts$/,    // Vue shims (shims-vue.d.ts, shims-modules.d.ts)
  /env\.d\.ts$/,         // Vite environment declarations
  // Flow type stubs (ambient type definitions for Flow, not imported)
  /flow-typed\//,

  // Template/scaffold directories (copied at runtime, not imported)
  /\/templates?\//,
  /^templates?\//,
  /[-_]template\//,       // app-template/, test-template/ directories

  // CLI bin entry points (src/bin.ts, cli/bin.mjs)
  /\/bin\.([mc]?[jt]s|[jt]sx)$/,

  // Plopfile generators
  /plopfile\.([mc]?[jt]s|[jt]sx)$/,

  // Jest transform files (fileTransformer.js etc.)
  /[Tt]ransformer\.([mc]?[jt]s|[jt]sx)$/,

  // Gulpfile and Gruntfile (task runner entry points)
  /gulpfile\.([mc]?[jt]s|[jt]sx|js)$/,
  /[Gg]runtfile\.([mc]?[jt]s|[jt]sx|js|coffee)$/,

  // === Test Files and Utilities ===
  // Match test/spec files by suffix (actual test files)
  // Also matches multi-part test suffixes like .test.api.ts, .test.cli.js
  /\.(test|spec)(\.\w+)*\.([mc]?[jt]s|[jt]sx)$/,
  // Hyphenated test files: *-test.ts, *-spec.ts (Deno, QUnit, Ember convention)
  /[-_](test|spec)\.([mc]?[jt]s|[jt]sx)$/,
  // Type test files (.test-d.ts, .test-d.tsx) used by tsd/vitest typecheck
  /\.test-d\.([mc]?[jt]s|[jt]sx)$/,
  // Type checking test files (*.type-tests.ts, *.typecheck.ts) used by expect-type/tsd
  /\.type-tests?\.([mc]?[jt]s|[jt]sx)$/,
  /\.typecheck\.([mc]?[jt]s|[jt]sx)$/,
  // Standalone test entry files (tests.ts/tests.js - Prisma functional test pattern)
  /\/tests\.([mc]?[jt]s|[jt]sx)$/,
  // Benchmark files (*.bench.ts, *.benchmark.ts) loaded by vitest bench / benchmark runners
  /\.bench(mark)?\.([mc]?[jt]s|[jt]sx)$/,
  // E2E test files (.e2e.ts, .e2e-spec.ts, .e2e.tsx)
  /\.e2e(-spec)?\.([mc]?[jt]s|[jt]sx)$/,
  // Files in e2e/ directories (loaded by test runner)
  /\/e2e\//,
  // Integration test files (.integration-test.ts, .integration.test.ts)
  /\.integration[.-]test\.([mc]?[jt]s|[jt]sx)$/,
  // Match files directly in __tests__ directories (Jest convention)
  /__tests__\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  // Match files directly in __mocks__ directories (Jest mock convention)
  /__mocks__\//,
  // Match test files in package-level test/ directories (common pattern in monorepos)
  /\/test\/test-[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  /\/tests?\/[^/]+\.test\.([mc]?[jt]s|[jt]sx)$/,
  // All files inside test/tests directories at depth >1 (loaded by test runners)
  // Test runners like Jest/Vitest match all files in these directories
  // Uses depth >1 (test/subdir/file.ts) to avoid over-matching single-level test/ dirs
  /\/tests?\/[^/]+\/.*\.([mc]?[jt]s|[jt]sx)$/,
  /^tests?\/[^/]+\/.*\.([mc]?[jt]s|[jt]sx)$/,
  // All files directly in tests/ directories (with 's' - more likely to be test runner dirs)
  /\/tests\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  /^tests\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  // Root-level test/ (singular) at depth 1 — many libraries (express, ky, etc.)
  // put test files directly in test/ without nesting
  /^test\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,
  // Standalone test.ts/test.js files (Prisma functional test pattern)
  /\/test\.([mc]?[jt]s|[jt]sx)$/,
  // test-utils files (test helper modules loaded by test runners)
  /test-utils\.([mc]?[jt]s|[jt]sx)$/,
  // Root-level vitest/jest setup files (vitest.setup.ts, jest.setup.js)
  /^(vitest|jest)\.setup\.([mc]?[jt]s|[jt]sx)$/,
  // Package-level jest/vitest setup files (any nesting level, various naming conventions)
  /(vitest|jest)[.\-]setup[^/]*\.([mc]?[jt]s|[jt]sx)$/,
  // Vitest setup with custom names (vitest-setup-client.ts, tests-setup.ts)
  /[.\-]setup[.\-](client|server|env|dom|after-env)\.([mc]?[jt]s|[jt]sx)$/,
  // API test utility packages (test helpers loaded by test runners)
  /api-tests?\//,
  // Playwright test directories (loaded by playwright.config.ts)
  /\/playwright\//,
  /^playwright\//,
  // Storybook stories and test storybooks
  /\.stories\.([mc]?[jt]s|[jt]sx)$/,
  /\.story\.([mc]?[jt]s|[jt]sx)$/,    // Alternative .story. extension (mantine, tinymce)
  /^test-storybooks\//,   // Storybook test storybook projects
  // stories/ directories (loaded by .storybook/main.js glob patterns)
  /\/stories\//,
  /^stories\//,
  // Test asset directories (vendor libraries/files served in test pages)
  /\/tests?\/assets\//,
  /^tests?\/assets\//,
  // Test utility directories (monorepo test packages)
  // These contain test helpers, fixtures, and harnesses loaded by test runners
  /^testing\//,           // Root testing/ directory
  /\/testing\//,          // Nested testing/ directories
  /-testing\//,           // Packages like core/nodes-testing/
  /\/fixtures\//,         // Test fixtures directories
  /^fixtures\//,          // Root fixtures directory
  /__fixtures__\//,       // Jest/codemod fixtures convention
  /__testfixtures__\//,   // Storybook/codemod test fixtures
  // Test setup/teardown files (loaded by vitest/jest config, not imported)
  /\/test\/setup\.ts$/,
  /\/test\/teardown\.ts$/,
  /\/test\/extend-expect\.ts$/,
  /\/test\/setup-test-folder\.ts$/,
  /\/test\/setup-mocks\.ts$/,
  /\/test\/globalSetup\.ts$/,
  /\.test\.constants\.([mc]?[jt]s|tsx)$/,
  // Root-level test setup files (setupVitest.ts, jest.setup.ts, etc.)
  /^setup(Vitest|Jest|Tests?)\.([mc]?[jt]s|[jt]sx)$/,
  // Test setup files with underscore prefix (__setupTests.ts convention)
  /\/__?setup\w*\.([mc]?[jt]s|[jt]sx)$/,
  // setupTests.ts in test/ directories (loaded by vitest/jest setupFiles config)
  /\/tests?\/setupTests\.([mc]?[jt]s|[jt]sx)$/,
  // test/setup/ or tests/setup/ directories (jest/vitest setup files)
  /\/tests?\/setup\//,
  /^tests?\/setup\//,
  // Vitest/Jest config packages (loaded by test runner config)
  /vitest-config\/.*\.([mc]?[jt]s|tsx)$/,
  /jest-config\/.*\.([mc]?[jt]s|tsx)$/,
  // Jest preset files (referenced in jest config by name)
  /jest-preset[^/]*\.[mc]?js$/,
  /vitest\.workspace\.([mc]?[jt]s)$/,
  /vitest\.config\.([mc]?[jt]s)$/,
  // Test utilities in monorepo packages
  /\/test-utils\/.*\.([mc]?[jt]s|tsx)$/,
  // Monitoring/synthetic checks (Checkly, Datadog, etc.)
  /__checks__\//,
  /^__checks__\//,

  // Workers (often loaded dynamically via new Worker())
  /workers?\//,
  /\.worker\.([mc]?[jt]s|[jt]sx)$/,
  /-worker\.([mc]?[jt]s|[jt]sx)$/,   // message-event-bus-log-writer-worker.ts pattern

  // Build outputs
  /\/dist\//,
  /^dist\//,
  /\/build\//,
  /^build\//,
  /\/out\//,
  /^out\//,
  /\.min\.js$/,

  // Platform build entry points (Cloudflare Workers, browser builds, etc.)
  // builds/browser.ts, builds/node.ts, builds/worker.ts - compiled separately by build tool
  /\/builds\/[^/]+\.[mc]?[jt]sx?$/,

  // Polyfill/shim directories (loaded via build config, not imports)
  /\/polyfills?\//,
  /^polyfills?\//,
  /\/shims?\//,
  /^shims?\//,
  /__shims__\//,

  // Middleware convention (Next.js middleware.ts at root or app level)
  /^(src\/)?middleware\.[mc]?[jt]sx?$/,
  /^apps\/[^/]+\/(src\/)?middleware\.[mc]?[jt]sx?$/,

  // Protobuf/gRPC generated files
  /\.(pb|pb2|proto)\.(go|py|js|ts)$/,
  /_grpc_pb\.(js|ts|d\.ts)$/,    // gRPC generated JS/TS stubs
  /_pb2_grpc\.py$/,               // gRPC generated Python stubs
  /_pb2\.pyi?$/,                  // protobuf generated Python type stubs
  /\.grpc-server\.(ts|js)$/,     // gRPC generated server stubs (teleport)
  /\.grpc-client\.(ts|js)$/,     // gRPC generated client stubs
  /_pb\.(js|ts|d\.ts)$/,         // protobuf generated JS/TS files

  // Next.js / Remix / etc - file-based routing
  // Match pages/app/routes at project root, under src/, or in monorepo workspace packages
  /^pages\//,
  /^src\/pages\//,
  // Monorepo workspace pages (apps/web/pages/, apps/*/pages/, apps/api/v1/pages/)
  /^apps\/[^/]+\/pages\//,
  /^apps\/[^/]+\/src\/pages\//,
  /^apps\/[^/]+\/[^/]+\/pages\//,  // Nested workspace: apps/api/v1/pages/
  /^packages\/[^/]+\/pages\//,
  // App Router - match all files under app/ directory (they form a routing tree)
  // Includes special files (page, layout, route, loading, error, etc.) and
  // co-located components imported by them
  /^app\//,
  /^src\/app\//,
  // Monorepo workspace App Router (apps/web/app/, apps/*/app/, apps/*/src/app/)
  /^apps\/[^/]+\/app\//,
  /^apps\/[^/]+\/src\/app\//,
  /^packages\/[^/]+\/app\//,
  // Standalone sub-projects with file-based routing (companion/app/, admin/app/, etc.)
  // Any top-level directory with its own app/ or pages/ routing
  /^[^/]+\/app\/.*\.(tsx?|jsx?)$/,
  /^[^/]+\/pages\/.*\.(tsx?|jsx?)$/,
  // Workspace dirs with src/ prefix (www/src/pages/, www/src/app/)
  /^[^/]+\/src\/pages\//,
  /^[^/]+\/src\/app\//,
  // Nested workspace sub-projects (www/og-image/pages/, tools/admin/app/)
  /^[^/]+\/[^/]+\/pages\//,
  /^[^/]+\/[^/]+\/app\//,
  /^[^/]+\/[^/]+\/src\/pages\//,
  /^[^/]+\/[^/]+\/src\/app\//,
  // Remix/SvelteKit/etc routes
  /^routes\//,
  /^src\/routes\//,
  // Monorepo workspace routes
  /^apps\/[^/]+\/routes\//,
  /^apps\/[^/]+\/src\/routes\//,
  // SvelteKit convention files (file-based routing, loaded by framework at runtime)
  /\+(?:page|layout|server|error)(?:\.server)?\.([mc]?[jt]s|[jt]sx|svelte)$/,
  // Framework build entry points (Qwik, Vite, etc. — loaded by build system)
  /entry\.(?:ssr|dev|preview|express|cloudflare|vercel|deno|bun|fastify|node)\.([mc]?[jt]sx?)$/,
  // Next.js instrumentation files (loaded by Next.js at startup)
  /instrumentation(-client)?\.([mc]?[jt]s|[jt]sx)$/,

  // Component registries (shadcn-style, loaded dynamically)
  /\/registry\//,

  // Docusaurus - theme overrides (swizzled components loaded by framework)
  /\/src\/theme\//,
  // Docusaurus config files (sidebars.ts, docusaurus.*.js plugins)
  /sidebars\.([mc]?[jt]s|[jt]sx)$/,
  /docusaurus\.[^/]+\.([mc]?[jt]s|[jt]sx|js)$/,
  // Docusaurus docs/ components (MDX-loaded, not imported via JS)
  /\/docs\/.*\.([jt]sx)$/,
  // Docusaurus versioned docs (version-X.xx.xx/ directories with JSX components)
  /versioned_docs\/.*\.([jt]sx)$/,
  // Docusaurus tutorial TSX/JSX files (loaded by MDX)
  /\/tutorial\/.*\.([jt]sx)$/,
  /^tutorial\/.*\.([jt]sx)$/,

  // Public/static assets (public/ for Node, static/ for Django/Flask/Rails)
  /\/public\//,
  /^public\//,
  /\/static\//,
  /^static\//,

  // Dashboard/UI entry points
  /dashboard\/public\//,

  // === NestJS/Express Controllers ===
  // Controllers are registered in @Module({ controllers: [...] })
  // Only match files with .controller. suffix (actual controllers), not /controllers/ directory
  /\.controller\.([mc]?[jt]s|tsx)$/,
  // API handlers - only match files with .handler. suffix
  // The /handlers/ directory pattern is removed - serverless.yml parsing handles that
  /\.handler\.([mc]?[jt]s|tsx)$/,
  // Note: .module. pattern removed - modules need import analysis (non-root modules are not entry points)

  // === Pinia/Vuex Stores ===
  // Stores are accessed via useStore() pattern, not direct imports
  /\.store\.([mc]?[jt]s|tsx)$/,
  /\/stores\//,
  /use\w+Store\.([mc]?[jt]s|tsx)$/,  // useRootStore.ts pattern

  // === Schema Files (loaded at runtime) ===
  // XML schema files for validation (SAML, SOAP, etc.)
  /\.xsd\.([mc]?[jt]s|tsx)$/,
  /\/schema\//,
  /\/schemas\//,

  // Database migrations (loaded dynamically by ORMs like TypeORM, Prisma)
  /\/migrations\//,
  /\/seeds?\//,
  // Database seed files (named seed-*.ts, *-seed.ts, *.seed.ts)
  /seed[.-][^/]+\.([mc]?[jt]s|[jt]sx)$/,

  // Locale/i18n files (loaded dynamically by locale name)
  /\/locale\//, /^locale\//, /\/locales\//, /^locales\//,
  /\/i18n\//, /^i18n\//, /\/l10n\//, /^l10n\//,

  // Type-checking test files (tsd, vitest typecheck, type-fest test-d/)
  /\/test-d\//, /^test-d\//,

  // ESM build outputs (parallel to src/, compiled by build tool)
  /^esm\//, /\/esm\//,

  // Example/demo/sample/sandbox directories (reference implementations, not imported)
  /\/examples?\//,
  /^examples?\//,
  /^example-apps?\//,
  /\/example-apps?\//,
  /\/sandbox\//,
  /^sandbox\//,
  /\/demos?\//,
  /^demos?\//,
  /\/samples?(-\w+)?\//,
  /^samples?(-\w+)?\//,
  // Starter/template apps (standalone reference implementations)
  /\/starters?\//,
  /^starters?\//,

  // Benchmark scripts (standalone performance tests)
  /\/bench(marks?)?\//,
  /^bench(marks?)?\//,

  // Scanner/CLI utilities (often package bin entries)
  /\/scanner\//,

  // Error classes (often auto-exported or dynamically loaded)
  /\/errors\/.*\.error\.([mc]?[jt]s|tsx)$/,

  // Grammar/parser files (CodeMirror, PEG.js, etc.)
  /\.terms\.([mc]?[jt]s|tsx)$/,
  /grammar\.([mc]?[jt]s|tsx)$/,

  // === RPC/API Router files (tRPC, GraphQL, etc.) ===
  // tRPC router files (_router.ts, _app.ts in routers/ directories)
  /\/routers?\//,

  // === ESLint/Config Packages ===
  // Config packages referenced by string in .eslintrc
  /eslint-config/,
  // Local ESLint rules (loaded dynamically by eslint config)
  /eslint[_-]?(local[_-])?rules?\//,
  /\/configs?\//,

  // === Enterprise/Premium Modules ===
  // Often loaded conditionally at runtime based on license
  /\/ee\//,
  /\/enterprise\//,
  /\/premium\//,

  // === Experiments and Workflows ===
  // Often loaded dynamically at runtime
  /\/experiments?\//,
  /\/workflows\//,

  // === Codemods and Code Generators ===
  // Loaded dynamically by migration/upgrade tools
  /\/codemods?\//,
  /\/plops?\//,

  // === Plugin Systems (dynamically loaded at runtime) ===
  // Common plugin file naming conventions (*.node.ts, *.plugin.ts, etc.)
  /\.node\.([mc]?[jt]s|tsx)$/,
  /\.plugin\.([mc]?[jt]s|tsx)$/,
  /\.credentials\.([mc]?[jt]s|tsx)$/,
  /\.connector\.([mc]?[jt]s|tsx)$/,
  /\.adapter\.([mc]?[jt]s|tsx)$/,
  // Plugin/extension directories (loaded dynamically by runtime)
  /\/plugins?\//,
  /\/extensions?\//,
  /\/addons?\//,
  /^addons?\//,
  /\/integrations?\//,
  /^integrations?\//,
  /\/connectors?\//,
  /\/adapters?\//,
  /\/providers?\//,
  // Nodes directory pattern (common for workflow engines like n8n)
  /\/nodes\//,
  // Vue/Nuxt composables (often auto-imported by framework)
  /\/composables?\//,
  // Note: /hooks/ removed - React hooks should be detected via import analysis
  // Files in hooks/ that are actually used will be reachable from entry points

  // Vue mixins (imported dynamically or via plugin system)
  /\/mixins?\//,

  // Utility barrel exports (commonly re-exported and tree-shaken)
  /\/utils\/index\.([mc]?[jt]s|tsx)$/,

  // === Public API directories ===
  /\/public-api\//,

  // === Browser patches (applied to browser source, not JS modules) ===
  /browser[_-]?patches\//,

  // === Injected/bundled scripts (bundled separately by esbuild/rollup, not via imports) ===
  // Packages named "injected" contain scripts injected into browser contexts
  /\/injected\/src\//,

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-LANGUAGE ENTRY POINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // === Python Entry Points ===
  // Django - Core files that are loaded by convention
  // Note: This may miss dead apps (not in INSTALLED_APPS), but we prefer
  // false negatives over false positives (safer to not flag live code)
  /manage\.py$/,
  /wsgi\.py$/,
  /asgi\.py$/,
  /settings\.py$/,
  /urls\.py$/,
  /admin\.py$/,
  /models\.py$/,      // Django ORM convention
  /views\.py$/,       // Django routing convention
  // Django directory-based organization (views/issue.py, urls/api.py, models/user.py)
  /\/views\/.*\.py$/,
  /\/urls\/.*\.py$/,
  /\/models\/.*\.py$/,
  /\/serializers?\/.*\.py$/,
  // Note: forms.py removed - forms are only used when imported by views
  /serializers\.py$/, // DRF serializers
  /signals\.py$/,     // Django signals
  /apps\.py$/,        // Django AppConfig
  /conftest\.py$/,    // Pytest config
  /test_[^/]+\.py$/,  // Pytest test files (test_something.py)
  /[^/]+_test\.py$/,  // Pytest test files (something_test.py)
  /\/tests\.py$/,     // Django test convention (app/tests.py)
  // Python files in test/tests directories (pytest auto-discovers all .py files in test dirs,
  // not just test_*.py — includes functional tests, regression data, input fixtures)
  /\/tests?\/.*\.py$/,
  /^tests?\/.*\.py$/,
  /__init__\.py$/,    // Package init files
  /\/management\/commands\//,  // Django management commands
  // Django settings directory (loaded dynamically via DJANGO_SETTINGS_MODULE)
  /\/settings\/.*\.py$/,
  // Django middleware directory (loaded dynamically via MIDDLEWARE setting)
  /\/middleware\/.*\.py$/,
  // Django authentication backends (loaded via AUTHENTICATION_BACKENDS setting)
  /\/authentication\/.*\.py$/,
  // Django - dynamically loaded modules
  /\/templatetags\/[^/]+\.py$/,  // Template tags loaded via {% load tag %}
  /\/locale\/[^/]+\/formats\.py$/,  // Locale format files loaded via import_module()
  /\/backends\/.*\.py$/,  // DB/cache/email/auth backends loaded via settings (import_module)
  /\/context_processors\.py$/,  // TEMPLATES setting context processors
  // FastAPI/Flask
  /main\.py$/,
  /app\.py$/,
  /__main__\.py$/,
  /router\.py$/,
  /routes\.py$/,
  /endpoints\.py$/,
  /config\.py$/,
  /conf\.py$/,         // Sphinx/Python config files loaded dynamically
  /deps\.py$/,         // FastAPI dependencies
  /schemas\.py$/,      // Pydantic schemas
  // FastAPI/Python-specific directories (only .py files)
  /\/api\/[^/]+\.py$/,       // FastAPI API endpoints (app/api/users.py)
  /\/routers?\/[^/]+\.py$/,  // FastAPI routers
  /\/services?\/[^/]+\.py$/, // Python service layer
  /\/models?\/[^/]+\.py$/,   // Python database models
  /\/schemas?\/[^/]+\.py$/,  // Pydantic schemas
  /\/core\/[^/]+\.py$/,      // Python core modules
  // Celery tasks
  /tasks\.py$/,
  /celery\.py$/,
  /celeryconfig\.py$/,
  // Python type stubs (.pyi) - declarations consumed by type checkers, not via imports
  /\.pyi$/,
  // Typeshed directory (Python type stubs collection used by mypy, pyright, etc.)
  /typeshed\//,
  // Top-level Python package __init__.py files (e.g., rllib/__init__.py, src/mypackage/__init__.py)
  // These are package roots that may not be imported by anything else in the repo
  /^[^/]+\/__init__\.py$/,            // depth 1: rllib/__init__.py
  /^[^/]+\/[^/]+\/__init__\.py$/,     // depth 2: python/ray/__init__.py, src/mypackage/__init__.py

  // Python package setup (build entry points, not imported)
  /setup\.py$/,
  /setup\.cfg$/,

  // === Java/Kotlin Entry Points ===
  // Java/Kotlin files in test/ directories (test fixtures, resources, transformation tests)
  /\/test\/.*\.(java|kt)$/,
  /^test\/.*\.(java|kt)$/,
  // Spring Boot - only definitive entry points by file name
  /Application\.(java|kt)$/,
  /.*Application\.(java|kt)$/,
  // Test files are entry points
  /.*Test\.(java|kt)$/,
  /.*Tests\.(java|kt)$/,
  /.*Spec\.(java|kt)$/,
  /.*IT\.(java|kt)$/,          // Integration tests
  /.*ITCase\.(java|kt)$/,     // Integration test cases
  // Resource/config files that trigger class loading
  /package-info\.java$/,
  // Java/Kotlin test case input dirs (compiled test inputs, not imported - e.g. spotbugs testCases/)
  /[Tt]est[Cc]ases?\/.*\.(java|kt)$/,
  /[Pp]lugin-test\/.*\.(java|kt)$/,
  // Java integration test resource dirs (Maven/Gradle resources dirs with .java/.kt files)
  /src\/(it|test)\/resources\/.*\.(java|kt)$/,
  // SPI service files (META-INF/services)
  /META-INF\/services\//,
  /META-INF\/.*\.xml$/,
  // GraalVM substitution files (loaded by native-image)
  /Substitutions?\.(java|kt)$/,
  // Note: Controller/Service/Repository/Config files are detected via @annotations
  // in hasDIDecorators, not by file name pattern (to avoid false positives)

  // === C#/.NET Entry Points ===
  /Program\.cs$/,
  /Startup\.cs$/,
  // ASP.NET Controllers
  /.*Controller\.cs$/,
  // Tests (name-based: FooTest.cs, FooTests.cs, FooTest.Platform.cs)
  /.*Tests?\.\w*\.?cs$/,
  // C# files in test directories (loaded by dotnet test runner, not imported)
  /\/tests?\/.*\.cs$/,
  /^tests?\/.*\.cs$/,
  // Extension methods / DI registration
  /.*Extensions?\.cs$/,
  // ASP.NET middleware
  /.*Middleware\.cs$/,
  // DI modules (Autofac, etc.)
  /.*Module\.cs$/,
  // MediatR/CQRS handlers
  /.*Handler\.cs$/,
  // Custom attributes (loaded by reflection)
  /.*Attribute\.cs$/,
  // SignalR hubs
  /.*Hub\.cs$/,
  // ASP.NET action/result filters
  /.*Filter\.cs$/,
  // JSON/XML converters
  /.*Converter\.cs$/,
  // C# 10 global usings
  /GlobalUsings\.cs$/,
  // Assembly metadata
  /AssemblyInfo\.cs$/,

  // === Go Entry Points ===
  // main.go in any package (includes cmd/*/main.go)
  /main\.go$/,
  // Test files
  /_test\.go$/,
  // Wire providers (DI code generation)
  /wire\.go$/,
  /wire_gen\.go$/,
  // Package documentation (always compiled into package)
  /doc\.go$/,
  // Go generate targets and generated code
  /.*_generated?\.go$/,
  // Plugin entry points
  /plugin\.go$/,

  // === Rust Entry Points ===
  /main\.rs$/,
  /lib\.rs$/,
  /mod\.rs$/,
  // Rust build/config files
  /Cargo\.toml$/, /build\.rs$/,
  // Rust bench/example/fuzz targets
  /benches\/.*\.rs$/, /examples\/.*\.rs$/,
  /\/fuzz_targets\/[^/]+\.rs$/, /\/fuzz\/targets\/[^/]+\.rs$/,
  // Rust inline module submodule directories (loaded via mod declarations)
  /\/handlers\/[^/]+\.rs$/,
  /\/imports\/[^/]+\.rs$/,
  /\/syntax_helpers\/[^/]+\.rs$/,
  /\/completions\/[^/]+\.rs$/,
  /\/tracing\/[^/]+\.rs$/,
  /\/toolchain_info\/[^/]+\.rs$/,

  // === PHP Entry Points ===
  /index\.php$/, /artisan$/,
  /composer\.json$/,
  /app\/Http\/Controllers\//, /app\/Models\//, /app\/Providers\//,
  /routes\/web\.php$/, /routes\/api\.php$/,
  /database\/migrations\//, /database\/seeders\//,
  /config\/.*\.php$/, /resources\/views\//,

  // === Ruby Entry Points ===
  /config\.ru$/, /Rakefile$/, /Gemfile$/,
  /\/homebrew\//, /^homebrew\//,
  /config\/initializers\//, /config\/environments\//,
  /db\/post_migrate\//, /db\/migrate\//,
  /app\/controllers\//, /app\/models\//, /app\/helpers\//,
  /app\/jobs\//, /app\/mailers\//, /app\/views\//,
  /config\/routes\.rb$/, /config\/application\.rb$/,
  /db\/seeds\.rb$/,
  /lib\/tasks\/.*\.rake$/,
  /spec\/.*_spec\.rb$/, /test\/.*_test\.rb$/,

  // === Elixir Entry Points ===
  /mix\.exs$/, /config\/.*\.exs$/,

  // === Haskell Entry Points ===
  /\.cabal$/, /stack\.yaml$/, /Setup\.hs$/,

  // === Nim Entry Points ===
  /\.nimble$/,

  // === Zig Entry Points ===
  /build\.zig$/, /\.zig$/,

  // === Build Config Files ===
  /build\.gradle(\.kts)?$/, /settings\.gradle(\.kts)?$/,
  /\/buildSrc\//, /^buildSrc\//,
  /gradle\/.*\.gradle(\.kts)?$/,
  /Jenkinsfile$/,
  /Makefile$/, /makefile$/, /CMakeLists\.txt$/,

  // === C/C++ Native Extension Sources ===
  /\/src\/.*\.(c|cpp|h|hpp)$/, /\/_core\/.*\.(c|cpp|h|hpp)$/,
  /\/code_generators\//, /\/include\/.*\.(h|hpp)$/,

  // === CI Config Files ===
  /dangerfile\.[jt]s$/,

  // === Cypress Component Tests ===
  /\.cy\.[jt]sx?$/,

  // === Unit Test Files ===
  /\.unit\.([mc]?[jt]s|[jt]sx)$/,

  // === Visual Testing ===
  /\/chromatic\//, /^chromatic\//,

  // === Kubernetes/Deployment Patterns ===
  /\/hack\//, /^hack\//,
  /\/cluster\//, /^cluster\//,
  /\/staging\//, /^staging\//,

  // === Performance/Smoke Testing ===
  /smoke-test/, /performance-test/,

  // === Deprecated Packages ===
  /deprecated-packages?\//, /\/deprecated\//,

  // === Additional Test Directories ===
  /e2e-tests?\//, /\/intTest\//, /^intTest\//,
  /\/specs?\//, /^specs?\//,

  // === Broader Serverless Patterns ===
  /\/netlify\//, /^netlify\//,
  /\/vercel\//, /^vercel\//,
  /\/lambda\//, /^lambda\//,
  /\/functions\//, /^functions\//,

  // === Broader Codemod Patterns ===
  /-codemod\//, /codemod/,

  // === Internal Build Directories ===
  /\/cache-dir\//, /\/internal-plugins\//,

  // === Frontend Static/App Directories (Webpack/Vite) ===
  /\/static\/app\//, /^static\/app\//,
  /\/static\/gs/, /^static\/gs/,

  // === Ember.js Frontend Convention ===
  /frontend\/[^/]+\/app\//, /frontend\/discourse/,
  // Ember plugins with assets/javascripts (Discourse plugins, ember-addon plugins)
  /\/plugins\/[^/]+\/assets\/javascripts\//,
  /^plugins\/[^/]+\/assets\/javascripts\//,
  // Ember plugin admin assets (plugins/*/admin/assets/javascripts/)
  /\/plugins\/[^/]+\/admin\/assets\/javascripts\//,
  /^plugins\/[^/]+\/admin\/assets\/javascripts\//,
  // Discourse markdown engine extensions (loaded dynamically by discourse-markdown)
  /\/lib\/discourse-markdown\//,
  /^lib\/discourse-markdown\//,

  // === Icon and Illustration Libraries ===
  /\/icons?\//, /-icons-/, /icons-material/,
  /\/illustrations?\//, /spectrum-illustrations/,

  // === Recipe/Documentation Directories ===
  /\/recipes\//, /^recipes\//,

  // === Scoped Package Entries ===
  /^packages\/@[^/]+\/[^/]+\/src\/(index|main)\.([mc]?[jt]s|[jt]sx)$/,

  // === Dynamic Module Loaders (CodeMirror, Editors, Syntax Highlighters) ===
  /\/mode\/[^/]+\.js$/, /\/modes?\//, /^modes?\//,
  /\/languages?\/[^/]+\.(js|ts)$/, /\/lang\//, /^lang\//,
  /\/themes?\//, /^themes?\//,
  /\/grammars?\//, /^grammars?\//,
  /\/keymaps?\//, /^keymaps?\//,
  // Lunr search language plugins (loaded dynamically by lunr.js)
  /\/lunr-languages?\//, /^lunr-languages?\//,

  // === Documentation/Debug/Tools ===
  /\/docs?\//, /^docs?\//, /-docs\//, /_docs\//,
  /\/docs_src\//, /^docs_src\//,
  /\/documentation\//, /^documentation\//,
  /\/debug\//, /^debug\//,
  /\/tools\//, /^tools\//,

  // === Modules Directory ===
  /\/modules?\//,

  // === Generated Code ===
  /\/@generated\//, /\/_generated\//, /\/generated\//,

  // === Containers (Docker/test infrastructure) ===
  /\/containers\//,

  // === Meteor Package Files ===
  /\/meteor\//, /^meteor\//,

  // === Post-Build Scripts ===
  /^post[a-z]+\.(c|m)?js$/, /\/post[a-z]+\.(c|m)?js$/,

  // === Test Data ===
  /\/test_data\//, /\/test-data\//, /\/testdata\//,

  // === Reporters ===
  /\/reporters\//,

  // === Editor/IDE plugin dirs (snippets, extensions loaded dynamically at runtime) ===
  /\/snippets\/[^/]+\.[mc]?[jt]sx?$/,
  /\/ext\/[^/]+\.[mc]?[jt]sx?$/,

  // === Server-side Rendering ===
  /\/server\//, /^server\//,

  // === E2E test directories with tool-name suffix (e2e_playwright/, e2e_cypress/, etc.) ===
  /^e2e[_-]\w+\//, /\/e2e[_-]\w+\//,

  // === Files directly inside any /test/ directory (catches test files without .test. suffix) ===
  /\/test\/[^/]+\.([mc]?[jt]s|[jt]sx|py|rb|go|rs|java|kt|php)$/,

  // === Scoped package root entry points (packages/@scope/name/index.ts) ===
  /^packages\/@[^/]+\/[^/]+\/(index|main|server|app)\.([mc]?[jt]s|[jt]sx)$/,

  // === Deep nested pages/ for file-based routing (packages/dev/docs/pages/) ===
  /^packages\/[^/]+\/[^/]+\/pages\//,
  /^packages\/@[^/]+\/[^/]+\/pages\//,

  // === Rust integration tests (tests/*.rs auto-compiled by cargo test) ===
  /\/tests\/[^/]+\.rs$/,
  /^tests\/[^/]+\.rs$/,

  // === Rust trybuild/compile-test files ===
  // Includes ui/, trybuild/, compile-fail/, fail/, pass/, and macro test dirs
  /\/tests?\/(ui|ui-fail[^/]*|trybuild|compile-fail|compile-test|fail|pass|macros?|markup)\//, /^tests?\/(ui|ui-fail[^/]*|trybuild|compile-fail|compile-test|fail|pass|macros?|markup)\//,
  /\/tests?\/[^/]+\/(pass|fail)\//, /^tests?\/[^/]+\/(pass|fail)\//,
  // Rust formatting tool fixtures — .rs files used as test input/expected-output data (rustfmt, rustfix)
  /\/tests?\/(source|target)\/.*\.rs$/, /^tests?\/(source|target)\//,
  // Deep test fixture subdirectories — .rs files nested in named subdirs under tests/
  // e.g., tests/generate_migrations/diff_add_table/schema.rs, tests/print_schema/*/expected.rs
  /\/tests?\/.+\/.+\/.*\.rs$/, /^tests?\/.+\/.+\/.*\.rs$/,

  // === Rust crate resource directories (test fixtures, corpus data, benchmark inputs) ===
  // Files loaded via include_str!, include_bytes!, or std::fs at runtime
  // e.g., crates/ruff_python_parser/resources/valid/statement/match.py
  /\/resources\/(valid|invalid|corpus|inline|fixtures?|data|expected|err|ok)\//,
  // Resources/ dir inside crates/ (Rust workspace convention for test data)
  /crates\/[^/]+\/resources\//, /^crates\/[^/]+\/resources\//,

  // === Playground/dev directories (development environments) ===
  /\/playgrounds?\//, /^playgrounds?\//,
  /^[^/]+\/dev\//, /\/dev\/src\//,

  // === Codemod transform files (standalone CLI entry points for jscodeshift) ===
  /\/codemods?\/.*\/(transform|codemod)\.([mc]?[jt]s|[jt]sx)$/,

  // === Parcel plugins (loaded via .parcelrc config, not imports) ===
  /parcel-(transformer|resolver|namer|packager|optimizer|reporter|compressor|validator)\b/,

  // === setupTests files at any depth (loaded by jest/vitest setupFiles config) ===
  /setupTests\.([mc]?[jt]s|[jt]sx)$/,

  // === Root-level ESLint local rules file ===
  /^eslint[_-]?(local[_-])?rules?\.(c|m)?js$/,

  // === Rust tasks directory (build/codegen scripts) ===
  /^tasks\//, /\/tasks\/[^/]+\.(mjs|js|ts)$/,

  // === lib/ directory root (compiled package output consumed externally) ===
  /^lib\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,

  // === modules/ npm sub-packages ===
  /^modules\/[^/]+\/[^/]+\.([mc]?[jt]s|[jt]sx)$/,

  // === Browser extension entry points (loaded via manifest.json) ===
  /(?:^|\/)(?:background|content[_-]?script|popup|options|devtools|sidebar|panel)\.[mc]?[jt]sx?$/,

  // === ESLint test fixtures (compiled but not imported — used as lint rule test cases) ===
  /\.test-lint\./,
  /eslint.*\/tests?\/.*fixtures?\//,

  // === Static assets embedded in packages (not imported, loaded at runtime as data) ===
  // Theme/package static JS assets (Sphinx themes, docs tooling)
  /\/themes?\/[^/]+\/static\//,
  // Minified/non-minified JS asset directories (stemmer JS files etc.)
  /\/(minified|non-minified)-js\//,

  // === E2E test app files (standalone applications used by test runners) ===
  /\/e2e\/.*\/src\//,
  /^e2e\/.*\/src\//,

  // === Vendored runtime patches (injected into node_modules, not imported) ===
  /\/extra\/[^/]+\/gen-[^/]+\.js$/,

  // === React JSX runtime files (loaded by JSX transform, not imported explicitly) ===
  /jsx-runtime\.([mc]?[jt]s|[jt]sx)$/,
  /jsx-dev-runtime\.([mc]?[jt]s|[jt]sx)$/,

  // === Gatsby convention files (loaded by Gatsby framework at build time) ===
  /gatsby-node\.([mc]?[jt]s|[jt]sx)$/,
  /gatsby-config\.([mc]?[jt]s|[jt]sx)$/,
  /gatsby-browser\.([mc]?[jt]s|[jt]sx)$/,
  /gatsby-ssr\.([mc]?[jt]s|[jt]sx)$/,

  // === Ember.js convention files (auto-discovered by Ember CLI at runtime) ===
  /ember-cli-build\.js$/,
  // Ember auto-resolved directories (any depth): controllers, models, routes, components, helpers, etc.
  /\/app\/(services|serializers|initializers|instance-initializers|adapters|transforms)\//,
  /\/app\/(controllers|models|routes|components|helpers|mixins|modifiers|machines|abilities)\//,
  // Mirage test fixtures (loaded by ember-cli-mirage)
  /\/mirage\/(config|scenarios|factories|fixtures|models|serializers|identity-managers)\//,
  /\/mirage\/config\.js$/,

  // === Generated Go mock files (mockery, gomock, etc.) ===
  /\/grpcmocks?\//, /^grpcmocks?\//,
  /\/mock_[^/]+\.go$/,
  /\/mocks?\/[^/]+\.go$/,

  // === Go generated code (detected by go generate convention) ===
  /zz_generated[_.].*\.go$/,

  // === Generated TypeScript/JavaScript (OpenAPI, GraphQL codegen, etc.) ===
  /\.gen\.([mc]?[jt]s|[jt]sx)$/,
  /\/openapi-gen\//, /^openapi-gen\//,
  /\/__generated__\//, /^__generated__\//,

  // === Preconstruct/build-time conditional modules ===
  /\/conditions\/(true|false|browser|worker|node)\.[mc]?[jt]sx?$/,

  // === Website/site directories (documentation sites, not library code) ===
  /\/website\//, /^website\//,
  /\/site\/src\//, /^site\/src\//,
];


/**
 * Extract JS/TS file references from npm scripts
 * @param {Object} packageJson - Package.json object
 * @param {string} packageDir - Directory of the package (for nested packages)
 * @returns {Set<string>} - Set of entry point paths
 */
function extractScriptEntryPoints(packageJson = {}, packageDir = '') {
  const entryPoints = new Set();
  const scripts = packageJson.scripts || {};

  for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
    if (!scriptCmd) continue;

    // Match patterns like: node script.js, tsx script/build.ts, ts-node file.ts
    // Also handles: npx tsx file.ts, npm exec -- node file.js, cm-buildhelper src/html.ts
    const patterns = [
      // Direct node/tsx/ts-node execution: node file.js, tsx file.ts, node postcjs.cjs
      /(?:node|tsx|ts-node|npx\s+tsx|npx\s+ts-node)\s+([^\s&|;]+\.(?:[mc]?[jt]s|[jt]sx))/gi,
      // Build tools that take source file as argument: cm-buildhelper src/html.ts, lezer-generator src/grammar.ts
      /(?:cm-buildhelper|lezer-generator|esbuild|swc|rollup\s+-c|vite\s+build)\s+([^\s&|;]+\.(?:[mc]?[jt]s|[jt]sx))/gi,
      // Script paths without runner: ./scripts/foo.js
      /(?:^|\s)(\.?\.?\/[^\s&|;]+\.(?:[mc]?[jt]s|[jt]sx))/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(scriptCmd)) !== null) {
        let entry = match[1];
        // Normalize path
        entry = entry.replace(/^\.\//, '');
        // Add package directory prefix for nested packages
        if (packageDir) {
          entry = (0,external_path_.join)(packageDir, entry);
        }
        entryPoints.add(entry);
      }
    }
  }

  return entryPoints;
}

/**
 * Extract glob-based entry points from npm scripts.
 * Test runners like tape, mocha, ava, jest, jasmine, and generic node scripts
 * use glob patterns (e.g. tape test/glob.js, mocha src/glob.spec.js).
 * This function extracts those globs and expands them to actual files.
 * @param {Object} packageJson - Parsed package.json
 * @param {string} projectPath - Absolute path to project root
 * @param {string} [packageDir=''] - Relative dir of this package within the monorepo
 * @returns {Set<string>} - Set of matched file paths (relative to projectPath)
 */
function extractScriptGlobEntryPoints(packageJson = {}, projectPath, packageDir = '') {
  const entryPoints = new Set();
  if (!projectPath) return entryPoints;
  const scripts = packageJson.scripts || {};

  // Test runner commands that take glob arguments
  const testRunners = /(?:tape|faucet|mocha|ava|jest|jasmine|nyc\s+(?:mocha|ava|tape)|c8\s+(?:mocha|ava|tape)|node\s+-e\s+.*require|tap)/;

  for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
    if (!scriptCmd) continue;

    // Only look in test/build-related scripts for glob patterns
    if (!testRunners.test(scriptCmd)) continue;

    // Extract glob patterns: quoted or unquoted args that contain * or **
    // e.g. tape 'test/**/*.js'  or  mocha test/**/*.spec.js
    const globPattern = /(?:['"]([^'"]*\*[^'"]*)['"]\s*|(?:\s)((?:[^\s&|;'"]*\*[^\s&|;'"]*))\s*)/g;
    let match;
    while ((match = globPattern.exec(scriptCmd)) !== null) {
      let pattern = match[1] || match[2];
      if (!pattern) continue;
      // Skip patterns that don't look like file paths
      if (pattern.startsWith('-') || pattern.includes('=')) continue;

      // Prefix with package directory for nested packages
      const resolvedPattern = packageDir ? (0,external_path_.join)(packageDir, pattern) : pattern;

      try {
        const matched = (0,esm.globSync)(resolvedPattern, {
          cwd: projectPath,
          nodir: true,
          ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
        });
        for (const f of matched) {
          entryPoints.add(f.replace(/\\/g, '/'));
        }
      } catch { /* skip invalid globs */ }
    }
  }

  return entryPoints;
}

/**
 * Extract script entry points from all nested packages in a monorepo
 * @param {string} projectPath - Project root path
 * @returns {Set<string>} - Set of all script entry point paths
 */
function extractAllScriptEntryPoints(projectPath) {
  const allEntryPoints = new Set();
  const nestedPackages = findNestedPackageJsons(projectPath);

  for (const [pkgDir, pkgJson] of nestedPackages) {
    const entries = extractScriptEntryPoints(pkgJson, pkgDir);
    for (const entry of entries) {
      allEntryPoints.add(entry);
    }
    // Also expand glob patterns from npm scripts
    const globEntries = extractScriptGlobEntryPoints(pkgJson, projectPath, pkgDir);
    for (const entry of globEntries) {
      allEntryPoints.add(entry);
    }
  }

  return allEntryPoints;
}

/**
 * Find entry points referenced by HTML files
 */
function extractHtmlEntryPoints(projectPath) {
  const entryPoints = new Set();

  if (!projectPath) return entryPoints;

  try {
    // Find HTML files in common locations (including deeply nested workspaces)
    const htmlPatterns = [
      'index.html',
      'public/index.html',
      'client/index.html',
      'src/index.html',
      '*/index.html',
      '*/*/index.html',
      '**/index.html'
    ];

    for (const pattern of htmlPatterns) {
      try {
        const htmlFiles = (0,esm.globSync)(pattern, {
          cwd: projectPath,
          nodir: true,
          ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**', 'vendor/**', 'coverage/**', '__fixtures__/**', 'test-fixtures/**']
        });

        for (const htmlFile of htmlFiles) {
          try {
            const htmlPath = (0,external_path_.join)(projectPath, htmlFile);
            const htmlContent = (0,external_fs_.readFileSync)(htmlPath, 'utf-8');
            const htmlDir = (0,external_path_.dirname)(htmlFile);

            // Match <script src="..."> and <script type="module" src="...">
            const scriptPattern = /<script[^>]*\ssrc=["']([^"']+\.(?:[mc]?[jt]s|[jt]sx))["'][^>]*>/gi;
            let match;
            while ((match = scriptPattern.exec(htmlContent)) !== null) {
              let src = match[1];
              // Handle relative paths from HTML file location
              if (src.startsWith('./')) {
                src = (0,external_path_.join)(htmlDir, src.slice(2));
              } else if (src.startsWith('/')) {
                // Absolute paths in Vite are relative to the directory containing index.html
                // (the Vite project root), not the monorepo root
                src = (0,external_path_.join)(htmlDir, src.slice(1));
              } else if (!src.startsWith('http')) {
                src = (0,external_path_.join)(htmlDir, src);
              }
              // Normalize
              src = src.replace(/\\/g, '/').replace(/^\.\//, '');
              entryPoints.add(src);
            }
          } catch {
            // Ignore read errors for individual HTML files
          }
        }
      } catch {
        // Ignore glob errors
      }
    }
  } catch {
    // Ignore errors
  }

  return entryPoints;
}

/**
 * Extract source files from Gruntfile.js/Gulpfile.js concat/uglify tasks.
 * Concatenation-based builds (RxJS v4, older jQuery plugins) stitch files together
 * without import/require, so the scanner can't trace them via the import graph.
 * @param {string} projectPath - Project root path
 * @returns {Set<string>} - Set of source file paths referenced by concat tasks
 */
function extractGruntConcatSources(projectPath) {
  const entryPoints = new Set();
  if (!projectPath) return entryPoints;

  const gruntFiles = ['Gruntfile.js', 'Gruntfile.coffee', 'gruntfile.js'];
  const gulpFiles = ['gulpfile.js', 'gulpfile.mjs', 'Gulpfile.js'];

  for (const file of [...gruntFiles, ...gulpFiles]) {
    try {
      const filePath = (0,external_path_.join)(projectPath, file);
      if (!(0,external_fs_.existsSync)(filePath)) continue;
      const content = (0,external_fs_.readFileSync)(filePath, 'utf-8');

      // Extract glob patterns from concat/uglify src arrays
      // Matches patterns like: src: ['src/**/*.js'], files: { 'dest': ['src/core/*.js'] }
      const srcPatterns = [];

      // Match src array patterns: src: ['pattern1', 'pattern2']
      const srcArrayRe = /src\s*:\s*\[([^\]]+)\]/g;
      let match;
      while ((match = srcArrayRe.exec(content)) !== null) {
        const items = match[1].match(/['"]([^'"]+)['"]/g);
        if (items) {
          for (const item of items) {
            srcPatterns.push(item.replace(/['"]/g, ''));
          }
        }
      }

      // Match files object: files: { 'output.js': ['src/**/*.js'] }
      const filesObjRe = /['"][^'"]+['"]\s*:\s*\[([^\]]+)\]/g;
      while ((match = filesObjRe.exec(content)) !== null) {
        const items = match[1].match(/['"]([^'"]+)['"]/g);
        if (items) {
          for (const item of items) {
            srcPatterns.push(item.replace(/['"]/g, ''));
          }
        }
      }

      // Also match gulp.src('pattern') or gulp.src(['pattern1', 'pattern2'])
      const gulpSrcRe = /\.src\s*\(\s*(?:\[([^\]]+)\]|['"]([^'"]+)['"])/g;
      while ((match = gulpSrcRe.exec(content)) !== null) {
        if (match[1]) {
          const items = match[1].match(/['"]([^'"]+)['"]/g);
          if (items) {
            for (const item of items) {
              srcPatterns.push(item.replace(/['"]/g, ''));
            }
          }
        } else if (match[2]) {
          srcPatterns.push(match[2]);
        }
      }

      // Expand globs to actual files
      for (const pattern of srcPatterns) {
        // Skip non-JS patterns and negation patterns
        if (pattern.startsWith('!')) continue;
        if (!pattern.match(/\.(js|ts|mjs|cjs|jsx|tsx|coffee)$/i) && !pattern.includes('*')) continue;

        try {
          const matched = (0,esm.globSync)(pattern, {
            cwd: projectPath,
            nodir: true,
            ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
          });
          for (const f of matched) {
            entryPoints.add(f.replace(/\\/g, '/'));
          }
        } catch { /* skip invalid globs */ }
      }
    } catch { /* skip read errors */ }
  }

  return entryPoints;
}

/**
 * Extract entry points from tsconfig.json `files` and `include` arrays.
 * TypeScript projects often use `/// <reference>` directives and tsconfig `files` arrays
 * to link files without import/require statements (e.g., RxJS ts/core/).
 * Also handles `include` glob patterns.
 * @param {string} projectPath - Project root path
 * @returns {Set<string>} - Set of file paths declared in tsconfig files/include
 */
function extractTsconfigFileEntries(projectPath) {
  const entryPoints = new Set();
  if (!projectPath) return entryPoints;

  try {
    // Find all tsconfig*.json files (root + packages)
    const tsconfigPatterns = [
      'tsconfig.json', 'tsconfig.*.json',
      '**/tsconfig.json', '**/tsconfig.*.json',
    ];

    const tsconfigFiles = new Set();
    for (const pattern of tsconfigPatterns) {
      try {
        const matches = (0,esm.globSync)(pattern, {
          cwd: projectPath,
          nodir: true,
          ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
        });
        for (const m of matches) tsconfigFiles.add(m);
      } catch { /* skip */ }
    }

    for (const tsconfigFile of tsconfigFiles) {
      try {
        const tsconfigPath = (0,external_path_.join)(projectPath, tsconfigFile);
        const raw = (0,external_fs_.readFileSync)(tsconfigPath, 'utf-8');
        // Strip comments (tsconfig allows // and /* */ comments)
        const cleaned = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const tsconfig = JSON.parse(cleaned);
        const tsconfigDir = (0,external_path_.dirname)(tsconfigFile);

        // Process `files` array — explicit file list
        if (Array.isArray(tsconfig.files)) {
          for (const f of tsconfig.files) {
            if (typeof f !== 'string') continue;
            // Resolve relative to tsconfig's directory
            let resolved = (0,external_path_.join)(tsconfigDir, f).replace(/\\/g, '/');
            resolved = resolved.replace(/^\.\//, '');
            entryPoints.add(resolved);
          }
        }

        // Process `include` array — glob patterns
        if (Array.isArray(tsconfig.include)) {
          for (const pattern of tsconfig.include) {
            if (typeof pattern !== 'string') continue;
            // Resolve the glob relative to tsconfig's directory
            const resolvedPattern = tsconfigDir ? (0,external_path_.join)(tsconfigDir, pattern) : pattern;
            try {
              const matched = (0,esm.globSync)(resolvedPattern, {
                cwd: projectPath,
                nodir: true,
                ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
              });
              for (const f of matched) {
                entryPoints.add(f.replace(/\\/g, '/'));
              }
            } catch { /* skip invalid globs */ }
          }
        }
      } catch { /* skip unreadable/malformed tsconfig */ }
    }
  } catch { /* skip */ }

  return entryPoints;
}

/**
 * Extract Vite alias replacement files as entry points
 * These are files used as module replacements in vite.config resolve.alias
 * Pattern: { find: 'module-name', replacement: resolve(__dirname, 'path/to/replacement') }
 * @param {string} projectPath - Project root path
 * @returns {Set<string>} - Set of replacement file paths
 */
function extractViteReplacementEntryPoints(projectPath) {
  const entryPoints = new Set();
  if (!projectPath) return entryPoints;

  try {
    // Find vite config files in all packages
    const viteConfigPatterns = [
      'vite.config.ts',
      'vite.config.mts',
      'vite.config.js',
      'vite.config.mjs',
      'packages/**/vite.config.ts',
      'packages/**/vite.config.mts',
      'packages/**/vite.config.js',
      'packages/**/vite.config.mjs'
    ];

    for (const pattern of viteConfigPatterns) {
      try {
        const configFiles = (0,esm.globSync)(pattern, {
          cwd: projectPath,
          nodir: true,
          ignore: ['node_modules/**', 'dist/**', 'build/**']
        });

        for (const configFile of configFiles) {
          try {
            const configPath = (0,external_path_.join)(projectPath, configFile);
            const configContent = (0,external_fs_.readFileSync)(configPath, 'utf-8');
            const configDir = (0,external_path_.dirname)(configFile);

            // Match replacement patterns in resolve.alias configurations
            // Pattern 1: replacement: resolve(__dirname, 'path/to/file')
            const replacementPattern1 = /replacement:\s*resolve\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/gi;
            // Pattern 2: replacement: './path/to/file' or replacement: "/path/to/file"
            const replacementPattern2 = /replacement:\s*['"]([^'"]+)['"]/gi;

            const patterns = [replacementPattern1, replacementPattern2];
            for (const pattern of patterns) {
              let match;
              while ((match = pattern.exec(configContent)) !== null) {
                let replacementPath = match[1];
                // Normalize path
                replacementPath = replacementPath.replace(/^\.\//, '');
                // Combine with config directory
                const fullPath = (0,external_path_.join)(configDir, replacementPath);
                // Add common extensions if no extension
                if (!/\.[mc]?[jt]sx?$/.test(fullPath)) {
                  entryPoints.add(fullPath + '.ts');
                  entryPoints.add(fullPath + '.mts');
                  entryPoints.add(fullPath + '.js');
                  entryPoints.add(fullPath + '.mjs');
                } else {
                  entryPoints.add(fullPath);
                }
              }
            }
          } catch {
            // Ignore read errors for individual config files
          }
        }
      } catch {
        // Ignore glob errors
      }
    }
  } catch {
    // Ignore errors
  }

  return entryPoints;
}

/**
 * Check if a file is an entry point (should not be flagged as dead)
 * @param {string} filePath - Relative file path
 * @param {Object} packageJson - Parsed package.json
 * @param {string} projectPath - Project root path
 * @param {Set} htmlEntryPoints - Entry points from HTML files
 * @param {Set} scriptEntryPoints - Entry points from npm scripts
 * @param {Array} fileClasses - Parsed class info with decorators (for DI detection)
 */
function isEntryPoint(filePath, packageJson = {}, projectPath = null, htmlEntryPoints = null, scriptEntryPoints = null, fileClasses = null) {
  // Heuristic: Files in directories with "dead", "deprecated", "legacy", "old", "unused"
  // in the name are likely not active code - don't treat as entry points
  // Also check file names containing these words, or files named exactly "dead.ext"
  const deadDirPatterns = /(^|\/)(dead[-_]|deprecated[-_]|legacy[-_]|old[-_]|unused[-_])/i;
  const deadFilePatterns = /(^|\/)(dead[-_]|deprecated[-_]|legacy[-_]|old[-_]|unused[-_])[^/]*\.[^/]+$/i;
  const deadFileExact = /(^|\/)dead\.[^/]+$/i;  // matches dead.go, dead.py, etc.
  if (deadDirPatterns.test(filePath) || deadFilePatterns.test(filePath) || deadFileExact.test(filePath)) {
    return { isEntry: false, reason: 'In dead/deprecated/legacy directory or file name' };
  }

  // Check if file is main entry for a nested monorepo package
  // This MUST run before ENTRY_POINT_PATTERNS because abandoned workspace packages
  // would otherwise match generic patterns like packages/*/src/index.js
  const nestedPkgCheck = isNestedPackageMain(filePath, projectPath);
  if (nestedPkgCheck.isMain) {
    return { isEntry: true, reason: `Main entry for package ${nestedPkgCheck.packageName || nestedPkgCheck.packageDir}` };
  }
  // If file is in an abandoned workspace package, don't let it match generic patterns
  // EXCEPTION: playground/example/demo directories are inherently test/dev directories
  // and should still be treated as entry points even if they're in abandoned packages
  if (nestedPkgCheck.isAbandoned) {
    const isDevDirectory = /(?:^|\/)(playgrounds?|examples?|demos?|samples?|fixtures?|templates?|starters?|__tests__|tests?)(?:\/|$)/i.test(filePath);
    if (!isDevDirectory) {
      return { isEntry: false, reason: 'In abandoned workspace package' };
    }
  }

  // Check against patterns (using full path relative to project root)
  if (ENTRY_POINT_PATTERNS.some(p => p.test(filePath))) {
    return { isEntry: true, reason: 'Matches entry point pattern' };
  }

  // For files inside nested packages (independent sub-projects), also check patterns
  // against the path relative to the package root. This handles "collection" repos
  // (e.g., vercel/examples) where each sub-dir has its own package.json and conventions.
  // Example: framework-boilerplates/hydrogen/src/routes/page.tsx
  //   → checked as "src/routes/page.tsx" relative to hydrogen package root
  //   → matches ^src/routes/ pattern
  if (nestedPkgCheck.packageDir) {
    const relToPackage = filePath.slice(nestedPkgCheck.packageDir.length + 1);
    if (relToPackage && ENTRY_POINT_PATTERNS.some(p => p.test(relToPackage))) {
      return { isEntry: true, reason: 'Matches entry point pattern (relative to package root)' };
    }
  }

  // Check for DI-decorated classes (@Service, @Injectable, etc.)
  if (fileClasses?.length) {
    for (const cls of fileClasses) {
      const diCheck = hasDIDecorators(cls);
      if (diCheck.hasDI) {
        return {
          isEntry: true,
          reason: `Class ${cls.name} has DI decorator: @${diCheck.decorators[0]}`,
          isDynamic: true
        };
      }
    }
  }

  // Check framework-specific entry points (NestJS, Vue, Pinia, etc.)
  const frameworkCheck = checkFrameworkEntry(filePath);
  if (frameworkCheck.isEntry) {
    return { isEntry: true, reason: frameworkCheck.reason, isDynamic: true };
  }

  // Check package.json main
  if (packageJson.main) {
    const main = packageJson.main.replace(/^\.\//, '');
    if (filePath === main || filePath.endsWith(main)) {
      return { isEntry: true, reason: 'Package main entry' };
    }
  }

  // Check package.json source field (used by some packages to point to source entry)
  if (packageJson.source) {
    const source = packageJson.source.replace(/^\.\//, '');
    if (filePath === source || filePath.endsWith(source)) {
      return { isEntry: true, reason: 'Package source entry' };
    }
  }

  // When main/module/exports points to a build directory (lib/, dist/, build/, out/),
  // map back to source equivalents (src/) since we analyze source, not build output.
  // e.g., main: "lib/framework.js" → check src/framework.ts, src/index.ts, etc.
  const buildDirPattern = /^(lib|dist|build|out)(\/|$)/;
  const sourceExtensions = ['.ts', '.tsx', '.mts', '.js', '.mjs', '.jsx'];
  const buildEntries = [
    packageJson.main,
    packageJson.module,
    ...(packageJson.source ? [] : []) // skip if source field exists (handled above)
  ].filter(Boolean);

  for (const entry of buildEntries) {
    const entryPath = entry.replace(/^\.\//, '');
    if (buildDirPattern.test(entryPath)) {
      // Map lib/framework.js → src/framework, then try extensions
      const sourceStem = entryPath
        .replace(buildDirPattern, 'src/')
        .replace(/\.[mc]?[jt]sx?$/, '');
      for (const ext of sourceExtensions) {
        const sourcePath = sourceStem + ext;
        if (filePath === sourcePath || filePath.endsWith('/' + sourcePath)) {
          return { isEntry: true, reason: 'Package main (source equivalent)' };
        }
      }
      // Also check src/index.ts, src/main.ts as common fallback entry points
      const buildDir = entryPath.match(buildDirPattern)[1];
      const commonEntries = ['src/index', 'src/main', 'src/entry-bundler', 'src/entry'];
      for (const common of commonEntries) {
        for (const ext of sourceExtensions) {
          const candidate = common + ext;
          if (filePath === candidate || filePath.endsWith('/' + candidate)) {
            return { isEntry: true, reason: `Package main (source fallback for ${buildDir}/)` };
          }
        }
      }
      // When main points to a build dir (lib/, dist/), all src/ files are part of
      // the published package. Mark them as entry points — many libraries use dynamic
      // require/import patterns that can't be traced statically.
      if (filePath.startsWith('src/') || filePath.includes('/src/')) {
        return { isEntry: true, reason: `Package source (build dir ${buildDir}/ detected)` };
      }
    }
  }

  // When package has no entry point fields (main, module, exports, source),
  // files directly in src/ are likely entry points (e.g., Swiper's src/swiper.mjs).
  // These packages expose their source directly without a build step.
  if (!packageJson.main && !packageJson.module && !packageJson.exports && !packageJson.source) {
    if (/^src\/[^/]+\.[mc]?[jt]sx?$/.test(filePath)) {
      return { isEntry: true, reason: 'Source root file (no package entry points configured)' };
    }
  }

  // Check package.json bin
  if (packageJson.bin) {
    const bins = typeof packageJson.bin === 'string'
      ? [packageJson.bin]
      : Object.values(packageJson.bin);
    for (const bin of bins) {
      const binPath = bin.replace(/^\.\//, '');
      if (filePath === binPath || filePath.endsWith(binPath)) {
        return { isEntry: true, reason: 'Package bin entry' };
      }
    }
  }

  // Check package.json exports
  if (packageJson.exports) {
    const checkExports = (exp) => {
      if (typeof exp === 'string') {
        const expPath = exp.replace(/^\.\//, '');
        if (filePath === expPath || filePath.endsWith(expPath)) {
          return true;
        }
        // Also check source equivalent when export points to build dir
        if (buildDirPattern.test(expPath)) {
          const sourceStem = expPath.replace(buildDirPattern, 'src/').replace(/\.[mc]?[jt]sx?$/, '');
          for (const ext of sourceExtensions) {
            if (filePath === sourceStem + ext || filePath.endsWith('/' + sourceStem + ext)) {
              return true;
            }
          }
        }
      } else if (typeof exp === 'object') {
        return Object.values(exp).some(v => checkExports(v));
      }
      return false;
    };
    if (checkExports(packageJson.exports)) {
      return { isEntry: true, reason: 'Package exports entry' };
    }
  }

  // Check npm script entry points
  if (scriptEntryPoints) {
    for (const entry of scriptEntryPoints) {
      if (filePath === entry || filePath.endsWith('/' + entry) || entry.endsWith('/' + filePath)) {
        return { isEntry: true, reason: 'Referenced in npm script' };
      }
    }
  }

  // Check HTML entry points (e.g., <script src="main.tsx">)
  if (htmlEntryPoints) {
    for (const entry of htmlEntryPoints) {
      // Match with or without extension, handle src/ prefix variations
      const fileNoExt = filePath.replace(/\.([mc]?[jt]s|[jt]sx)$/, '');
      const entryNoExt = entry.replace(/\.([mc]?[jt]s|[jt]sx)$/, '');
      if (filePath === entry || fileNoExt === entryNoExt ||
          filePath.endsWith('/' + entry) || entry.endsWith('/' + filePath)) {
        return { isEntry: true, reason: 'Referenced in HTML file' };
      }
    }
  }

  // Check bundler/CI config entry points (webpack, vite, GitHub Actions, etc.)
  const configCheck = checkConfigEntry(filePath);
  if (configCheck.isConfigEntry) {
    return { isEntry: true, reason: 'Bundler/CI config entry point', source: configCheck.source };
  }

  // Check for plugin/extension entry points declared in package.json
  // Uses configurable DYNAMIC_PACKAGE_FIELDS and searches recursively
  const dynamicEntryFields = extractDynamicPaths(packageJson);

  for (const entryPath of dynamicEntryFields) {
    // Convert dist path to source: dist/path/file.js -> path/file.ts
    const sourcePath = entryPath
      .replace(/^dist\//, '')
      .replace(/\.js$/, '.ts');
    if (filePath === sourcePath || filePath.endsWith('/' + sourcePath) ||
        filePath === entryPath || filePath.endsWith('/' + entryPath)) {
      return { isEntry: true, reason: 'Plugin entry point (from package.json)', isDynamic: true };
    }
  }

  // Check dynamic loading patterns from config
  for (let i = 0; i < DYNAMIC_PATTERNS.length; i++) {
    if (DYNAMIC_PATTERNS[i].test(filePath)) {
      return {
        isEntry: true,
        reason: `Matches dynamic loading pattern: ${DYNAMIC_PATTERN_SOURCES[i]}`,
        isDynamic: true,
        matchedPattern: DYNAMIC_PATTERN_SOURCES[i]
      };
    }
  }

  return { isEntry: false };
}

/**
 * Parse exports from a file using Babel AST
 */
function parseExports(content, filePath) {
  const exports = [];

  try {
    const ast = (0,lib.parse)(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining'
      ],
      errorRecovery: true
    });

    traverse(ast, {
      ExportNamedDeclaration(path) {
        const decl = path.node.declaration;
        const loc = path.node.loc;

        if (decl) {
          if (decl.type === 'FunctionDeclaration' && decl.id) {
            exports.push({
              name: decl.id.name,
              type: 'function',
              line: decl.loc?.start?.line || loc?.start?.line,
              lineEnd: decl.loc?.end?.line || loc?.end?.line,
              async: decl.async || false
            });
          } else if (decl.type === 'VariableDeclaration') {
            for (const declarator of decl.declarations) {
              if (declarator.id?.name) {
                // Determine the actual type
                let varType = 'const';
                if (declarator.init) {
                  if (declarator.init.type === 'ArrowFunctionExpression' ||
                      declarator.init.type === 'FunctionExpression') {
                    varType = 'function';
                  } else if (declarator.init.type === 'ObjectExpression') {
                    varType = 'object';
                  } else if (declarator.init.type === 'ArrayExpression') {
                    varType = 'array';
                  }
                }
                exports.push({
                  name: declarator.id.name,
                  type: varType,
                  line: declarator.loc?.start?.line || loc?.start?.line,
                  lineEnd: declarator.loc?.end?.line || loc?.end?.line
                });
              }
            }
          } else if (decl.type === 'ClassDeclaration' && decl.id) {
            exports.push({
              name: decl.id.name,
              type: 'class',
              line: decl.loc?.start?.line || loc?.start?.line,
              lineEnd: decl.loc?.end?.line || loc?.end?.line
            });
          } else if (decl.type === 'TSEnumDeclaration' && decl.id) {
            exports.push({
              name: decl.id.name,
              type: 'enum',
              line: decl.loc?.start?.line || loc?.start?.line,
              lineEnd: decl.loc?.end?.line || loc?.end?.line
            });
          } else if (decl.type === 'TSTypeAliasDeclaration' || decl.type === 'TSInterfaceDeclaration') {
            if (decl.id) {
              exports.push({
                name: decl.id.name,
                type: 'type',
                line: decl.loc?.start?.line || loc?.start?.line,
                lineEnd: decl.loc?.end?.line || loc?.end?.line
              });
            }
          }
        }

        // Handle export { foo, bar } and export { foo as bar }
        if (path.node.specifiers) {
          for (const spec of path.node.specifiers) {
            if (spec.exported?.name) {
              exports.push({
                name: spec.exported.name,
                type: 'reexport',
                localName: spec.local?.name,
                line: loc?.start?.line,
                lineEnd: loc?.end?.line
              });
            }
          }
        }
      },

      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration;
        const loc = path.node.loc;

        let type = 'default';
        let name = 'default';

        if (decl) {
          if (decl.type === 'FunctionDeclaration') {
            type = 'function';
            name = decl.id?.name || 'default';
          } else if (decl.type === 'ClassDeclaration') {
            type = 'class';
            name = decl.id?.name || 'default';
          } else if (decl.type === 'Identifier') {
            name = decl.name;
          }
        }

        exports.push({
          name,
          type,
          isDefault: true,
          line: loc?.start?.line,
          lineEnd: decl?.loc?.end?.line || loc?.end?.line
        });
      },

      // Handle module.exports = ... (CommonJS)
      AssignmentExpression(path) {
        const left = path.node.left;
        if (left?.type === 'MemberExpression' &&
            left.object?.name === 'module' &&
            left.property?.name === 'exports') {
          exports.push({
            name: 'default',
            type: 'commonjs',
            isDefault: true,
            line: path.node.loc?.start?.line,
            lineEnd: path.node.loc?.end?.line
          });
        }
        // Handle exports.foo = ...
        if (left?.type === 'MemberExpression' &&
            left.object?.name === 'exports' &&
            left.property?.name) {
          exports.push({
            name: left.property.name,
            type: 'commonjs',
            line: path.node.loc?.start?.line,
            lineEnd: path.node.loc?.end?.line
          });
        }
      }
    });

  } catch (error) {
    // Fallback to regex for unparseable files
    return parseExportsRegex(content);
  }

  return exports;
}

/**
 * Fallback regex-based export parsing
 */
function parseExportsRegex(content) {
  const exports = [];
  const lines = content.split('\n');

  const patterns = [
    { regex: /^export\s+async\s+function\s+(\w+)/, type: 'function' },
    { regex: /^export\s+function\s+(\w+)/, type: 'function' },
    { regex: /^export\s+const\s+(\w+)/, type: 'const' },
    { regex: /^export\s+let\s+(\w+)/, type: 'let' },
    { regex: /^export\s+var\s+(\w+)/, type: 'var' },
    { regex: /^export\s+class\s+(\w+)/, type: 'class' },
    { regex: /^export\s+default\s+function\s+(\w+)?/, type: 'function', isDefault: true },
    { regex: /^export\s+default\s+class\s+(\w+)?/, type: 'class', isDefault: true },
    { regex: /^export\s+default\s+/, type: 'default', isDefault: true }
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const { regex, type, isDefault } of patterns) {
      const match = line.match(regex);
      if (match) {
        exports.push({
          name: match[1] || 'default',
          type,
          isDefault: isDefault || false,
          line: i + 1,
          lineEnd: findEndLine(lines, i)
        });
        break;
      }
    }
  }

  return exports;
}

/**
 * Find the end line of a code block
 */
function findEndLine(lines, startIndex) {
  let braceCount = 0;
  let started = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return i + 1;
        }
      }
    }

    // Single line export (no braces)
    if (i === startIndex && !line.includes('{') && (line.endsWith(';') || line.endsWith(','))) {
      return i + 1;
    }
  }

  return startIndex + 1;
}

/**
 * Calculate byte size of an export based on line range
 */
function calculateExportSize(content, lineStart, lineEnd) {
  const lines = content.split('\n');
  let size = 0;

  for (let i = lineStart - 1; i < Math.min(lineEnd, lines.length); i++) {
    size += (lines[i]?.length || 0) + 1; // +1 for newline
  }

  return size;
}

/**
 * Check if an export is used internally within the same file
 */
function checkInternalUsage(exportName, content, allExports) {
  // Don't count the export declaration itself
  // Look for usage patterns: function calls, variable references

  const usagePatterns = [
    new RegExp(`\\b${exportName}\\s*\\(`, 'g'),           // Function call
    new RegExp(`\\b${exportName}\\s*\\.`, 'g'),           // Property access
    new RegExp(`\\[\\s*${exportName}\\s*\\]`, 'g'),       // Bracket notation
    new RegExp(`:\\s*${exportName}\\b`, 'g'),             // Object shorthand or type
    new RegExp(`=\\s*${exportName}\\b`, 'g'),             // Assignment
    new RegExp(`\\(\\s*${exportName}\\s*[,)]`, 'g'),      // Function argument
  ];

  // Remove the export lines to avoid false positives
  const lines = content.split('\n');
  const contentWithoutExport = lines.filter((_, i) => {
    const lineNum = i + 1;
    return !allExports.some(e => lineNum >= e.line && lineNum <= (e.lineEnd || e.line));
  }).join('\n');

  for (const pattern of usagePatterns) {
    if (pattern.test(contentWithoutExport)) {
      return true;
    }
  }

  return false;
}

/**
 * Find files that import a specific export from a file
 */
function findImportersOfExport(exportName, filePath, importGraph, jsAnalysis) {
  const importers = [];
  const fileBasename = basename(filePath).replace(/\.([mc]?[jt]s|[jt]sx)$/, '');

  for (const file of jsAnalysis) {
    const importerPath = file.file?.relativePath || file.file;
    if (importerPath === filePath) continue;

    const content = file.content || '';

    // Check for named imports: import { exportName } from './file'
    // or import { exportName as alias } from './file'
    // Note: fileBasename does NOT include extension, so we match it followed by optional extension
    const namedImportPattern = new RegExp(
      `import\\s*\\{[^}]*\\b${exportName}\\b[^}]*\\}\\s*from\\s*['"][^'"]*${fileBasename}(?:\\.[^'"]*)?['"]`,
      'g'
    );

    // Check for namespace imports: import * as ns from './file' then ns.exportName
    const namespacePattern = new RegExp(
      `import\\s*\\*\\s*as\\s+(\\w+)\\s*from\\s*['"][^'"]*${fileBasename}(?:\\.[^'"]*)?['"]`,
      'g'
    );

    // Check for default import if this is a default export
    const defaultImportPattern = new RegExp(
      `import\\s+(\\w+)\\s*from\\s*['"][^'"]*${fileBasename}(?:\\.[^'"]*)?['"]`,
      'g'
    );

    // Check for require
    const requirePattern = new RegExp(
      `require\\s*\\(\\s*['"][^'"]*${fileBasename}(?:\\.[^'"]*)?['"]\\s*\\)\\s*\\.\\s*${exportName}`,
      'g'
    );

    let match;

    // Named imports
    if ((match = namedImportPattern.exec(content))) {
      const line = content.substring(0, match.index).split('\n').length;
      importers.push({
        file: importerPath,
        line,
        type: 'named'
      });
      continue;
    }

    // Namespace imports - need to check if ns.exportName is used
    while ((match = namespacePattern.exec(content))) {
      const nsName = match[1];
      const usagePattern = new RegExp(`\\b${nsName}\\.${exportName}\\b`);
      if (usagePattern.test(content)) {
        const line = content.substring(0, match.index).split('\n').length;
        importers.push({
          file: importerPath,
          line,
          type: 'namespace'
        });
        break;
      }
    }

    // Default imports (only for default exports)
    if (exportName === 'default' && defaultImportPattern.test(content)) {
      const match = defaultImportPattern.exec(content);
      if (match) {
        const line = content.substring(0, match.index).split('\n').length;
        importers.push({
          file: importerPath,
          line,
          type: 'default'
        });
      }
    }

    // Require
    if ((match = requirePattern.exec(content))) {
      const line = content.substring(0, match.index).split('\n').length;
      importers.push({
        file: importerPath,
        line,
        type: 'require'
      });
    }
  }

  return importers;
}

/**
 * Get git history for when an export was last imported
 */
function getExportGitHistory(filePath, exportName, projectPath) {
  if (!projectPath) return { available: false, reason: 'No project path' };

  try {
    // Check if we're in a git repo
    try {
      execSync('git rev-parse --git-dir', { cwd: projectPath, stdio: 'pipe', timeout: 5000 });
    } catch {
      return { available: false, reason: 'Not a git repository' };
    }

    const fileBasename = basename(filePath).replace(/\.([mc]?[jt]s|[jt]sx)$/, '');

    // Search for commits that removed imports of this export
    // Use -S to find commits where the string was added or removed
    const searchPattern = `${exportName}.*from.*${fileBasename}`;

    let lastImportCommit;
    try {
      lastImportCommit = execSync(
        `git log -1 --all -p -S "${exportName}" --grep="" --format="%H|%ae|%aI|%s" -- "*.js" "*.jsx" "*.ts" "*.tsx" "*.mjs" 2>/dev/null | head -1`,
        { cwd: projectPath, encoding: 'utf-8', timeout: 15000 }
      ).trim();
    } catch {
      lastImportCommit = '';
    }

    if (!lastImportCommit || !lastImportCommit.includes('|')) {
      // Try finding when the export was created
      let createdCommit;
      try {
        createdCommit = execSync(
          `git log --follow --diff-filter=A --format="%H|%ae|%aI|%s" -- "${filePath}" 2>/dev/null | tail -1`,
          { cwd: projectPath, encoding: 'utf-8', timeout: 10000 }
        ).trim();
      } catch {
        createdCommit = '';
      }

      if (createdCommit && createdCommit.includes('|')) {
        const [commit, author, date, message] = createdCommit.split('|');
        return {
          everImported: false,
          createdIn: { commit, author, date, message },
          note: 'No import history found - may have never been used'
        };
      }

      return { available: false, reason: 'No git history found' };
    }

    const [commit, author, date, message] = lastImportCommit.split('|');
    const daysDead = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));

    // Try to find which file had the import
    let affectedFile = null;
    try {
      affectedFile = execSync(
        `git show ${commit} --name-only --format="" 2>/dev/null | grep -E "\\.(js|jsx|ts|tsx|mjs)$" | head -1`,
        { cwd: projectPath, encoding: 'utf-8', timeout: 5000 }
      ).trim();
    } catch {
      // Ignore
    }

    return {
      everImported: true,
      lastImportedIn: {
        file: affectedFile || 'unknown',
        removedIn: {
          commit: commit.slice(0, 7),
          author,
          date,
          message: message?.slice(0, 60)
        }
      },
      daysDead
    };

  } catch (error) {
    return { available: false, reason: error.message };
  }
}

/**
 * Get git history for an entire file
 */
function getFileGitHistory(filePath, projectPath) {
  if (!projectPath) return { available: false, reason: 'No project path' };

  try {
    // Check if git repo
    try {
      (0,external_child_process_.execSync)('git rev-parse --git-dir', { cwd: projectPath, stdio: 'pipe', timeout: 5000 });
    } catch {
      return { available: false, reason: 'Not a git repository' };
    }

    // Last modification
    let lastModified;
    try {
      lastModified = (0,external_child_process_.execSync)(
        `git log -1 --format="%H|%ae|%aI|%s" -- "${filePath}" 2>/dev/null`,
        { cwd: projectPath, encoding: 'utf-8', timeout: 10000 }
      ).trim();
    } catch {
      lastModified = '';
    }

    // When file was created
    let created;
    try {
      created = (0,external_child_process_.execSync)(
        `git log --follow --diff-filter=A --format="%H|%ae|%aI|%s" -- "${filePath}" 2>/dev/null | tail -1`,
        { cwd: projectPath, encoding: 'utf-8', timeout: 10000 }
      ).trim();
    } catch {
      created = '';
    }

    const result = {
      available: true
    };

    if (lastModified && lastModified.includes('|')) {
      const [commit, author, date, message] = lastModified.split('|');
      result.lastModified = {
        commit: commit.slice(0, 7),
        author,
        date,
        message: message?.slice(0, 60)
      };
      result.daysSinceModified = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    }

    if (created && created.includes('|')) {
      const [commit, author, date, message] = created.split('|');
      result.createdIn = {
        commit: commit.slice(0, 7),
        author,
        date,
        message: message?.slice(0, 60)
      };
    }

    return result;

  } catch (error) {
    return { available: false, reason: error.message };
  }
}

/**
 * Calculate cost impact of dead code
 */
function calculateDeadCodeCost(sizeBytes, config = {}) {
  const {
    monthlyVisitors = 10000,
    avgPagesPerVisit = 3,
    cacheHitRate = 0.8,
    bandwidthCostPerGB = 0.085, // AWS CloudFront pricing
    co2PerGB = 0.5, // kg CO2 per GB transferred
    inBundle = true
  } = config;

  if (!inBundle || sizeBytes === 0) {
    return {
      bundleContribution: sizeBytes,
      monthlyCostGBP: '0.00',
      annualCostGBP: '0.00',
      monthlyCO2Kg: '0.000',
      note: inBundle ? 'No size impact' : 'Not included in bundle'
    };
  }

  const monthlyPageviews = monthlyVisitors * avgPagesPerVisit;
  const uncachedPageviews = monthlyPageviews * (1 - cacheHitRate);

  const bytesPerMonth = sizeBytes * uncachedPageviews;
  const gbPerMonth = bytesPerMonth / (1024 * 1024 * 1024);

  const monthlyCost = gbPerMonth * bandwidthCostPerGB;
  const annualCost = monthlyCost * 12;
  const co2PerMonth = gbPerMonth * co2PerGB;

  return {
    bundleContribution: sizeBytes,
    monthlyCostGBP: monthlyCost.toFixed(4),
    annualCostGBP: annualCost.toFixed(2),
    monthlyCO2Kg: co2PerMonth.toFixed(6)
  };
}

/**
 * Build recommendation with rich reasoning
 */
function buildRecommendation(filePath, deadExports, liveExports, totalFilesSearched) {
  const canDelete = liveExports.length === 0;
  const deadNames = deadExports.map(e => e.name);
  const liveNames = liveExports.map(e => e.name);

  const parts = [];
  parts.push(`Searched ${totalFilesSearched} files.`);

  if (deadExports.length === 0) {
    return {
      action: 'keep',
      confidence: 'safe-to-remove',
      safeToRemove: [],
      keep: liveNames,
      reasoning: `${parts[0]} All exports are in use.`
    };
  }

  if (canDelete) {
    parts.push(`All ${deadExports.length} export(s) are dead - entire file can be removed.`);
  } else {
    parts.push(`${deadExports.length} of ${deadExports.length + liveExports.length} exports are dead.`);
  }

  // Add git history context for the first dead export
  const firstDead = deadExports[0];
  if (firstDead?.gitHistory?.everImported) {
    const gh = firstDead.gitHistory;
    parts.push(
      `${firstDead.name} last used ${gh.daysDead} days ago` +
      (gh.lastImportedIn?.file ? ` in ${gh.lastImportedIn.file}` : '') +
      (gh.lastImportedIn?.removedIn?.author ? `, removed by ${gh.lastImportedIn.removedIn.author.split('@')[0]}` : '') +
      (gh.lastImportedIn?.removedIn?.message ? ` (${gh.lastImportedIn.removedIn.message})` : '') +
      '.'
    );
  } else if (firstDead?.gitHistory?.note) {
    parts.push(firstDead.gitHistory.note);
  }

  // Live exports warning
  if (liveNames.length > 0) {
    parts.push(`Keep: ${liveNames.join(', ')} - still in use.`);
  }

  // Final recommendation
  if (canDelete) {
    parts.push('Safe to delete entire file.');
    return {
      action: 'delete-file',
      confidence: 'safe-to-remove',
      safeToRemove: deadNames,
      keep: [],
      command: `rm ${filePath}`,
      reasoning: parts.join(' ')
    };
  }

  // Build line ranges for removal
  const lineRanges = deadExports
    .map(e => e.lineEnd ? `${e.line}-${e.lineEnd}` : `${e.line}`)
    .join(', ');

  const partialConfidence = 'safe-to-remove';

  return {
    action: 'partial-cleanup',
    confidence: partialConfidence,
    safeToRemove: deadNames,
    keep: liveNames,
    linesToRemove: lineRanges,
    reasoning: parts.join(' ')
  };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Check if a file is JavaScript/TypeScript
 */
function isJavaScript(path) {
  return /\.([mc]?[jt]s|[jt]sx)$/.test(path);
}

/**
 * Check if file is a code file (any supported language)
 */
function isCodeFile(path) {
  return /\.([mc]?[jt]s|[jt]sx|py|pyi|java|kt|kts|cs|go|rs)$/.test(path);
}

/**
 * Build the set of files reachable from entry points by walking the import graph
 * This is the correct approach: start from entry points and find what's reachable,
 * rather than checking if each file is imported somewhere.
 * @param {Set<string>} entryPointFiles - Set of entry point file paths
 * @param {Array} jsAnalysis - Parsed file analysis results
 * @param {string} projectPath - Project root path
 * @param {Map<string, Set<string>>} additionalRefs - Optional map of additional file->files references (e.g., C# class refs)
 */
function buildReachableFiles(entryPointFiles, jsAnalysis, projectPath = null, additionalRefs = null) {
  const reachable = new Set();
  const visited = new Set();
  const _sortedAliasCache = new WeakMap();  // Cache sorted alias arrays per alias Map

  // Extract path aliases from tsconfig.json / vite.config.ts
  // Returns global aliases, per-package aliases, baseUrls, and workspace package mapping for monorepo support
  const { aliases: pathAliases, packageAliases, packageBaseUrls, workspacePackages, goModulePath, javaSourceRoots } = extractPathAliases(projectPath);

  // Build Java/Kotlin fully-qualified class name → file path mapping
  // e.g. "com.example.service.UserService" → "module/src/main/java/com/example/service/UserService.java"
  const javaFqnMap = new Map();  // FQN → file path
  const javaPackageDirMap = new Map();  // package dir (com/example/service) → [file paths]

  /**
   * Get the appropriate alias map for a file
   * In monorepos, use package-specific aliases first, then fall back to global
   */
  function getAliasesForFile(filePath) {
    // Check if file is in a package directory
    // Find the MOST SPECIFIC (longest) matching package directory
    let bestMatch = null;
    let bestMatchLen = 0;
    for (const [pkgDir, pkgAliases] of packageAliases) {
      if ((filePath.startsWith(pkgDir + '/') || filePath.startsWith(pkgDir + '\\')) && pkgDir.length > bestMatchLen) {
        bestMatch = pkgAliases;
        bestMatchLen = pkgDir.length;
      }
    }

    if (bestMatch) {
      // Merge package aliases with global (package takes precedence)
      const merged = new Map(pathAliases);
      for (const [alias, target] of bestMatch) {
        merged.set(alias, target);
      }
      return merged;
    }
    return pathAliases;
  }

  /**
   * Get the baseUrl prefix for a file (for resolving bare imports via tsconfig baseUrl)
   * Returns the project-relative prefix or null if no baseUrl configured
   */
  function getBaseUrlForFile(filePath) {
    let bestMatch = null;
    let bestMatchLen = -1;
    for (const [pkgDir, baseUrlPrefix] of packageBaseUrls) {
      if (pkgDir === '') {
        // Root-level baseUrl applies to all files (lowest priority)
        if (bestMatchLen < 0) {
          bestMatch = baseUrlPrefix;
          bestMatchLen = 0;
        }
      } else if ((filePath.startsWith(pkgDir + '/') || filePath.startsWith(pkgDir + '\\')) && pkgDir.length > bestMatchLen) {
        bestMatch = baseUrlPrefix;
        bestMatchLen = pkgDir.length;
      }
    }
    return bestMatch;
  }

  // Build a map from file path to its imports
  const fileImports = new Map();
  // Build a map from file path to its metadata (for Java package lookups)
  const fileMetadata = new Map();
  for (const file of jsAnalysis) {
    const filePath = file.file?.relativePath || file.file;
    fileImports.set(filePath, file.imports || []);
    if (file.metadata) {
      fileMetadata.set(filePath, file.metadata);
    }
  }

  // Build a map from file path to its exports (for re-export chain following)
  const fileExports = new Map();
  for (const file of jsAnalysis) {
    const filePath = file.file?.relativePath || file.file;
    fileExports.set(filePath, file.exports || []);
  }

  // Track per-export usage: Map<filePath, Map<exportName, [{importerFile, importType}]>>
  const exportUsageMap = new Map();

  /**
   * Record that an importer consumed specific exports from a target file.
   */
  function recordExportUsage(targetFile, importerFile, specifiers, importType) {
    if (!targetFile || !importerFile) return;

    let fileUsage = exportUsageMap.get(targetFile);
    if (!fileUsage) {
      fileUsage = new Map();
      exportUsageMap.set(targetFile, fileUsage);
    }

    // Determine what symbols are consumed
    if (!specifiers || specifiers.length === 0) {
      if (importType === 'esm') {
        // Side-effect import: import './module' — file reached but no named exports consumed
        const key = '__SIDE_EFFECT__';
        let usages = fileUsage.get(key);
        if (!usages) { usages = []; fileUsage.set(key, usages); }
        usages.push({ importerFile, importType });
      } else {
        // CJS/dynamic — assume all exports consumed (conservative)
        const key = '__ALL__';
        let usages = fileUsage.get(key);
        if (!usages) { usages = []; fileUsage.set(key, usages); }
        usages.push({ importerFile, importType });
      }
      return;
    }

    for (const spec of specifiers) {
      let key;
      if (spec.type === 'namespace') {
        key = '*'; // import * as ns — all exports consumed
      } else if (spec.type === 'default') {
        key = 'default';
      } else {
        key = spec.name || spec;
      }
      let usages = fileUsage.get(key);
      if (!usages) { usages = []; fileUsage.set(key, usages); }
      usages.push({ importerFile, importType });
    }
  }

  // Build a map from file path to its Rust mod declarations
  const fileMods = new Map();
  for (const file of jsAnalysis) {
    const filePath = file.file?.relativePath || file.file;
    if (file.mods?.length > 0) {
      fileMods.set(filePath, file.mods);
    }
  }

  // Build Java/Kotlin FQN → file path mapping
  // Strategy 1: Use parser-extracted package name + class name (most reliable)
  // Strategy 2: Infer from detected source roots (fallback)
  // Also auto-detect source roots from file paths (handles arbitrarily deep module nesting)
  const detectedSourceRoots = new Set(javaSourceRoots);
  const srcRootPatterns = ['src/main/java/', 'src/test/java/', 'src/main/kotlin/', 'src/test/kotlin/'];
  for (const file of jsAnalysis) {
    const filePath = file.file?.relativePath || file.file;
    if (!filePath.endsWith('.java') && !filePath.endsWith('.kt')) continue;
    for (const pattern of srcRootPatterns) {
      const idx = filePath.indexOf(pattern);
      if (idx >= 0) {
        const root = filePath.substring(0, idx + pattern.length - 1); // strip trailing /
        detectedSourceRoots.add(root);
        break;
      }
    }
  }
  const allJavaSourceRoots = [...detectedSourceRoots];

  for (const file of jsAnalysis) {
    const filePath = file.file?.relativePath || file.file;
    if (!filePath.endsWith('.java') && !filePath.endsWith('.kt')) continue;

    // Strategy 1: Use parser-extracted package name + class name from file path
    const packageName = file.metadata?.packageName;
    if (packageName) {
      // Extract class name from file name (e.g., UserService.java → UserService)
      const fileName = (0,external_path_.basename)(filePath).replace(/\.(java|kt)$/, '');
      const fqn = packageName + '.' + fileName;
      javaFqnMap.set(fqn, filePath);

      // Also populate package dir map for wildcard imports
      const packageDir = packageName.replace(/\./g, '/');
      if (!javaPackageDirMap.has(packageDir)) {
        javaPackageDirMap.set(packageDir, []);
      }
      javaPackageDirMap.get(packageDir).push(filePath);
    } else {
      // Strategy 2: Infer FQN from source root + file path
      for (const root of allJavaSourceRoots) {
        if (filePath.startsWith(root + '/')) {
          const relativePart = filePath.slice(root.length + 1); // e.g. com/example/service/UserService.java
          const fqn = relativePart.replace(/\.(java|kt)$/, '').replace(/\//g, '.');
          javaFqnMap.set(fqn, filePath);

          // Package dir map
          const packageDir = (0,external_path_.dirname)(relativePart);
          if (packageDir !== '.') {
            if (!javaPackageDirMap.has(packageDir)) {
              javaPackageDirMap.set(packageDir, []);
            }
            javaPackageDirMap.get(packageDir).push(filePath);
          }
          break;
        }
      }
    }
  }

  // Also create a map for extension-less lookups
  const filePathsNoExt = new Map();
  for (const file of jsAnalysis) {
    const filePath = file.file?.relativePath || file.file;
    // Support all code file extensions
    const noExt = filePath.replace(/\.([mc]?[jt]s|[jt]sx|py|pyi|java|kt|kts|cs|go|rs)$/, '');
    if (!filePathsNoExt.has(noExt)) {
      filePathsNoExt.set(noExt, []);
    }
    filePathsNoExt.get(noExt).push(filePath);
  }

  // Build indexes for O(1) lookups (replaces O(n) scans)

  // A2: Go same-package linking index: Map<dir, string[]> of .go files per directory
  const goFilesByDir = new Map();
  // A3: Suffix index for findMatchingFiles: Map<suffix, string[]> for partial path matching
  const suffixIndex = new Map();
  // A5: Directory index for sibling detection: Map<dir, string[]>
  const dirIndex = new Map();

  const allFilePaths = [...fileImports.keys()];
  for (const fp of allFilePaths) {
    // goFilesByDir: only Go files
    if (fp.endsWith('.go')) {
      const dir = (0,external_path_.dirname)(fp);
      let arr = goFilesByDir.get(dir);
      if (!arr) { arr = []; goFilesByDir.set(dir, arr); }
      arr.push(fp);
    }

    // suffixIndex: keyed by everything after the last '/'
    const lastSlash = fp.lastIndexOf('/');
    const suffix = lastSlash >= 0 ? fp.slice(lastSlash + 1) : fp;
    let sarr = suffixIndex.get(suffix);
    if (!sarr) { sarr = []; suffixIndex.set(suffix, sarr); }
    sarr.push(fp);

    // dirIndex: group files by their directory
    const dir = (0,external_path_.dirname)(fp);
    let darr = dirIndex.get(dir);
    if (!darr) { darr = []; dirIndex.set(dir, darr); }
    darr.push(fp);
  }

  // Mark files matching glob patterns from source as reachable
  // (e.g., glob.sync('**/*.node.ts'), import.meta.glob('**/*.ts'))
  for (const file of jsAnalysis) {
    const fileDir = (0,external_path_.dirname)(file.file?.relativePath || '');
    for (const imp of file.imports || []) {
      if (imp.isGlob && imp.module) {
        const matches = matchGlobPattern(imp.module, allFilePaths, fileDir);
        for (const match of matches) {
          reachable.add(match);
        }
      }
    }
  }

  // Detect directory-scanning auto-loaders (requireDirectory, readdirSync, glob.sync)
  // When an index file dynamically loads all siblings, mark those siblings as reachable
  // Common patterns: Outline's requireDirectory(__dirname), NestJS module scanning, plugin loaders
  if (projectPath) {
    const dirScanPatterns = /requireDirectory\s*[(<]|readdirSync\s*\(\s*__dirname|readdir\s*\(\s*__dirname|glob\.sync\s*\(|globSync\s*\(/;
    for (const file of jsAnalysis) {
      const filePath = file.file?.relativePath || file.file;
      const fileName = (0,external_path_.basename)(filePath).replace(/\.[^.]+$/, '');
      // Only check index files (index.ts, index.js, etc.) - these are the typical auto-loader hubs
      if (fileName !== 'index') continue;

      const fileDir = (0,external_path_.dirname)(filePath);
      // Read the actual source to detect directory-scanning patterns
      try {
        const fullPath = (0,external_path_.join)(projectPath, filePath);
        const source = (0,external_fs_.readFileSync)(fullPath, 'utf-8');
        if (dirScanPatterns.test(source)) {
          // Mark all sibling files in the same directory as reachable (using dirIndex for O(1))
          const siblings = dirIndex.get(fileDir) || [];
          for (const otherFile of siblings) {
            if (otherFile !== filePath) {
              reachable.add(otherFile);
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Helper to find matching files for a module path with possible extensions
  function findMatchingFiles(modulePath, extensions) {
    const matches = [];
    for (const ext of extensions) {
      const fullPath = modulePath + ext;
      // Check if exact path exists
      if (fileImports.has(fullPath)) {
        matches.push(fullPath);
      }
      // Check with various prefixes (src/, app/, etc.)
      for (const prefix of ['', 'src/', 'app/', 'lib/', 'pkg/', 'internal/', 'crates/', 'packages/']) {
        const prefixedPath = prefix + fullPath;
        if (fileImports.has(prefixedPath)) {
          matches.push(prefixedPath);
        }
        // Also check with lowercase module path
        const lowerPath = prefix + fullPath.toLowerCase();
        if (fileImports.has(lowerPath)) {
          matches.push(lowerPath);
        }
      }
      // Use suffix index for O(1) partial match lookup (instead of O(n) scan)
      // Look up by the filename portion of fullPath (after last /)
      const fullPathBasename = fullPath.includes('/') ? fullPath.slice(fullPath.lastIndexOf('/') + 1) : fullPath;
      const candidates = suffixIndex.get(fullPathBasename) || [];
      for (const filePath of candidates) {
        // Only match if fullPath is at a path boundary (after / or at start)
        // Avoid matching 'dead_tasks.py' when looking for 'tasks.py'
        if (filePath.endsWith('/' + fullPath) || filePath === fullPath) {
          if (!matches.includes(filePath)) {
            matches.push(filePath);
          }
        }
      }
    }
    return matches;
  }

  // Resolve an import path to actual file path(s)
  function resolveImport(fromFile, importPath) {
    const fromDir = (0,external_path_.dirname)(fromFile);
    let resolved = importPath;

    // Detect language from importing file
    const isPython = fromFile.endsWith('.py') || fromFile.endsWith('.pyi');
    const isJava = fromFile.endsWith('.java');
    const isKotlin = fromFile.endsWith('.kt') || fromFile.endsWith('.kts');
    const isGo = fromFile.endsWith('.go');
    const isRust = fromFile.endsWith('.rs');
    const isCSharp = fromFile.endsWith('.cs');

    // Handle Python-style absolute imports (module.submodule -> module/submodule.py)
    if (isPython && importPath.includes('.') && !importPath.startsWith('.')) {
      // Convert dots to slashes: users.models -> users/models
      const modulePath = importPath.replace(/\./g, '/');
      // Try both with and without .py extension
      let matches = findMatchingFiles(modulePath, ['.py', '/__init__.py']);

      // For 'from lib.utils import capitalize' the importPath is 'lib.utils.capitalize'
      // We need to also try without the last component (which is the imported symbol)
      if (matches.length === 0) {
        const parts = importPath.split('.');
        if (parts.length > 1) {
          // Try progressively shorter paths to find the module
          for (let i = parts.length - 1; i >= 1; i--) {
            const shorterPath = parts.slice(0, i).join('/');
            const shorterMatches = findMatchingFiles(shorterPath, ['.py', '/__init__.py']);
            if (shorterMatches.length > 0) {
              matches = shorterMatches;
              break;
            }
          }
        }
      }
      return matches;
    }

    // Handle Python relative imports (.module, ..module, ...module)
    // e.g. from .applications import FastAPI -> ".applications"
    // e.g. from ..utils import helper -> "..utils"
    if (isPython && /^\.+/.test(importPath)) {
      const dotMatch = importPath.match(/^(\.+)(.*)/);
      const dots = dotMatch[1].length;  // number of dots
      const moduleName = dotMatch[2];   // module name after dots (may be empty for "from . import X")

      // Resolve the base directory: 1 dot = current dir, 2 dots = parent, etc.
      let baseDir = fromDir;
      for (let i = 1; i < dots; i++) {
        baseDir = (0,external_path_.dirname)(baseDir);
      }

      if (moduleName) {
        // Convert remaining dots to slashes for nested modules
        const modulePath = moduleName.replace(/\./g, '/');
        const fullPath = baseDir ? (0,external_path_.join)(baseDir, modulePath) : modulePath;
        return findMatchingFiles(fullPath, ['.py', '/__init__.py']);
      } else {
        // Bare dots: "from . import X" - X is already resolved as module name by parser
        // This case shouldn't happen with the fixed parser since it stores ".X"
        return findMatchingFiles(baseDir, ['/__init__.py']);
      }
    }

    // Handle Java/Kotlin package imports (com.example.Service -> com/example/Service.java)
    if ((isJava || isKotlin) && importPath.includes('.') && !importPath.startsWith('.')) {
      const matches = [];
      const ext = isJava ? '.java' : '.kt';

      // Strategy 1: FQN map lookup (most precise - uses parser-extracted package names)
      // Direct lookup: import com.example.service.UserService → exact match
      // This runs BEFORE framework filtering because in framework repos (e.g. spring-boot)
      // internal imports look like framework imports (org.springframework.*)
      if (javaFqnMap.has(importPath)) {
        matches.push(javaFqnMap.get(importPath));
        return matches;
      }

      // Strategy 2: Wildcard import (import com.example.service.*)
      // Must check before framework filter since in framework repos wildcard imports are local
      if (importPath.endsWith('.*')) {
        const packageFqn = importPath.slice(0, -2); // strip .*
        const packageDir = packageFqn.replace(/\./g, '/');
        const pkgFiles = javaPackageDirMap.get(packageDir);
        if (pkgFiles && pkgFiles.length > 0) {
          return [...pkgFiles];
        }
        // Fallback: scan all files for matching package directory
        for (const filePath of fileImports.keys()) {
          if ((filePath.endsWith('.java') || filePath.endsWith('.kt')) && filePath.includes(packageDir + '/')) {
            const afterPkg = filePath.slice(filePath.indexOf(packageDir + '/') + packageDir.length + 1);
            if (!afterPkg.includes('/')) { // Only direct children, not sub-packages
              matches.push(filePath);
            }
          }
        }
        if (matches.length > 0) return matches;
        // If no local matches found, it's truly an external wildcard import
        return [];
      }

      // Strategy 3: Static imports (import static com.example.Utils.method → resolve to Utils)
      // Must check before framework filter since static imports in framework repos are local
      const parts = importPath.split('.');
      if (parts.length > 2) {
        const classCandidate = parts.slice(0, -1).join('.');
        if (javaFqnMap.has(classCandidate)) {
          matches.push(javaFqnMap.get(classCandidate));
          return matches;
        }
      }

      // Skip framework package imports - these are annotations/base classes, not project files
      // Only skip if NOT found in the FQN map or wildcard/static import maps (checked above)
      const frameworkPackages = ['org.springframework', 'javax.', 'jakarta.', 'java.', 'kotlin.', 'android.', 'com.google.', 'org.junit', 'org.mockito', 'io.ktor', 'org.apache.', 'io.netty.', 'org.slf4j', 'org.jboss.', 'io.quarkus.', 'io.smallrye.', 'org.eclipse.', 'com.fasterxml.', 'org.hibernate.', 'org.reactivestreams.', 'io.vertx.'];
      const isFrameworkImport = frameworkPackages.some(pkg => importPath.startsWith(pkg));
      if (isFrameworkImport) return [];

      // Strategy 5: Source-root-relative path resolution
      // Convert dots to slashes and try finding under known source roots
      const packagePath = importPath.replace(/\./g, '/');
      for (const root of allJavaSourceRoots) {
        const candidate = root + '/' + packagePath + ext;
        if (fileImports.has(candidate)) {
          matches.push(candidate);
        }
      }
      if (matches.length > 0) return matches;

      // Strategy 5: Path suffix matching (for projects without detected source roots)
      // Find files whose path ends with the expected package path
      const expectedSuffix = '/' + packagePath + ext;
      for (const filePath of fileImports.keys()) {
        if (filePath.endsWith(expectedSuffix)) {
          if (!matches.includes(filePath)) {
            matches.push(filePath);
          }
        }
      }
      if (matches.length > 0) return matches;

      // Strategy 6: Class-name-only fallback (least precise)
      // Only for project imports that didn't match above
      const className = parts[parts.length - 1];
      if (className && className[0] === className[0].toUpperCase()) {
        const deadFilePattern = /(^|\/)(dead[-_]?|deprecated[-_]?|legacy[-_]?|old[-_]?|unused[-_]?)/i;
        for (const filePath of fileImports.keys()) {
          if (filePath.endsWith('/' + className + ext) || filePath.endsWith(className + ext)) {
            if (!deadFilePattern.test(filePath) && !matches.includes(filePath)) {
              matches.push(filePath);
            }
          }
        }
      }
      return matches;
    }

    // Handle Go imports (package paths)
    if (isGo && !importPath.startsWith('.') && !importPath.startsWith('/')) {
      const deadFilePatternGo = /(^|\/)(dead[-_]?|deprecated[-_]?|legacy[-_]?|old[-_]?|unused[-_]?)[^/]*\.go$|\/dead\.go$/i;
      const matches = [];

      // Strategy 1: Module-path-aware resolution (most precise)
      // If import starts with go.mod module path, strip prefix to get local package dir
      // e.g. "github.com/gin-gonic/gin/internal/bytesconv" → "internal/bytesconv"
      if (goModulePath && importPath.startsWith(goModulePath)) {
        let localPath = importPath.slice(goModulePath.length);
        if (localPath.startsWith('/')) localPath = localPath.slice(1);
        // localPath is now a relative directory like "internal/bytesconv" or "" (root package)
        const pkgDir = localPath ? localPath + '/' : '';
        for (const filePath of fileImports.keys()) {
          if (!filePath.endsWith('.go')) continue;
          if (!filePath.endsWith('_test.go') && (filePath.startsWith(pkgDir) || (!localPath && !filePath.includes('/')))) {
            // File is in the target package directory (not in a subdirectory unless pkgDir matches)
            const afterPrefix = localPath ? filePath.slice(pkgDir.length) : filePath;
            // Only match files directly in this directory (not subdirectories)
            if (!afterPrefix.includes('/') && !deadFilePatternGo.test(filePath)) {
              matches.push(filePath);
            }
          }
        }
        if (matches.length > 0) return matches;
      }

      // Strategy 2: Direct local path matching
      // The import path's suffix after the module path might also just be a direct directory
      const segments = importPath.split('/');
      const lastSegment = segments[segments.length - 1];

      // Try to match by the full remaining path segments as a directory
      // For internal packages or sub-packages, try matching from the end
      for (let i = 0; i < segments.length; i++) {
        const candidateDir = segments.slice(i).join('/') + '/';
        for (const filePath of fileImports.keys()) {
          if (!filePath.endsWith('.go') || filePath.endsWith('_test.go')) continue;
          if (filePath.startsWith(candidateDir)) {
            const afterDir = filePath.slice(candidateDir.length);
            if (!afterDir.includes('/') && !deadFilePatternGo.test(filePath)) {
              if (!matches.includes(filePath)) matches.push(filePath);
            }
          }
        }
        if (matches.length > 0) return matches;
      }

      // Strategy 3: Last-segment fallback (least precise, for external packages)
      for (const filePath of fileImports.keys()) {
        if (filePath.endsWith('.go') && !filePath.endsWith('_test.go') && filePath.includes(lastSegment + '/')) {
          if (!deadFilePatternGo.test(filePath) && !matches.includes(filePath)) {
            matches.push(filePath);
          }
        }
      }
      if (matches.length > 0) return matches;
    }

    // Handle Rust mod imports
    if (isRust && !importPath.startsWith('.')) {
      const modulePath = importPath.replace(/::/g, '/');
      return findMatchingFiles(modulePath, ['.rs', '/mod.rs']);
    }

    // Handle C# using statements
    if (isCSharp && importPath.includes('.') && !importPath.startsWith('.')) {
      const namespacePath = importPath.replace(/\./g, '/');
      return findMatchingFiles(namespacePath, ['.cs']);
    }

    // Standard JS/TS import resolution
    // Handle bare "." import (import from ".") which resolves to ./index in current directory
    if (importPath === '.') {
      resolved = fromDir || '.';
    } else if (importPath.startsWith('./')) {
      resolved = fromDir ? (0,external_path_.join)(fromDir, importPath.slice(2)) : importPath.slice(2);
    } else if (importPath.startsWith('../')) {
      resolved = (0,external_path_.join)(fromDir, importPath);
    } else if (importPath.startsWith('/')) {
      resolved = importPath.slice(1);
    } else {
      // Check if it matches a path alias (e.g., @/components/ui/sidebar)
      // Use context-aware aliases for monorepo support
      const fileAliases = getAliasesForFile(fromFile);
      let aliasResolved = false;
      // Sort aliases by length (longest first) so '@site/' matches before '@/'
      // Use cached sorted array to avoid re-sorting on every resolveImport call
      let sortedAliases = _sortedAliasCache.get(fileAliases);
      if (!sortedAliases) {
        sortedAliases = [...fileAliases.entries()].sort((a, b) => b[0].length - a[0].length);
        _sortedAliasCache.set(fileAliases, sortedAliases);
      }
      for (const [alias, target] of sortedAliases) {
        if (importPath.startsWith(alias)) {
          // Replace alias with target path and normalize double slashes
          resolved = importPath.replace(alias, target).replace(/\/+/g, '/');
          aliasResolved = true;
          break;
        }
        // Also handle alias without trailing slash (e.g., @ -> src)
        const aliasNoSlash = alias.replace(/\/$/, '');
        if (importPath === aliasNoSlash || importPath.startsWith(aliasNoSlash + '/')) {
          resolved = importPath.replace(aliasNoSlash, target.replace(/\/$/, '')).replace(/\/+/g, '/');
          aliasResolved = true;
          break;
        }
      }

      if (!aliasResolved) {
        // Check if it's a workspace package (e.g., '@n8n/rest-api-client')
        // Extract the package name - for scoped packages like @scope/name or @scope/name/subpath
        let packageName = importPath;
        let subPath = '';

        if (importPath.startsWith('@')) {
          // Scoped package: @scope/name or @scope/name/subpath
          const parts = importPath.split('/');
          if (parts.length >= 2) {
            packageName = parts.slice(0, 2).join('/');
            subPath = parts.slice(2).join('/');
          }
        } else {
          // Non-scoped package: name or name/subpath
          const slashIndex = importPath.indexOf('/');
          if (slashIndex > 0) {
            packageName = importPath.slice(0, slashIndex);
            subPath = importPath.slice(slashIndex + 1);
          }
        }

        const workspacePkg = workspacePackages.get(packageName);
        if (workspacePkg) {
          // Resolve to local workspace package
          if (subPath) {
            // First, check package.json exports field for explicit subpath mapping
            // e.g., @strapi/admin/strapi-server -> exports["./strapi-server"] -> "./dist/server/index.mjs"
            const exportRaw = workspacePkg.exportsMap?.get(subPath);
            let exportMatched = false;
            if (exportRaw) {
              // Try multiple resolution strategies for dist -> source mapping
              // Handles both leading dist/ and nested dist/ (e.g., store/dist/store)
              const candidates = [exportRaw];
              if (/^dist\//.test(exportRaw)) {
                candidates.push(exportRaw.replace(/^dist\//, 'src/'));
                candidates.push(exportRaw.replace(/^dist\//, ''));
                candidates.push(exportRaw.replace(/^dist\/([^/]+)\//, '$1/src/'));
              }
              if (/\/dist\//.test(exportRaw)) {
                candidates.push(exportRaw.replace(/\/dist\//, '/src/'));
                candidates.push(exportRaw.replace(/\/dist\//, '/'));
              }
              if (/\/(lib|build|out)\//.test(exportRaw)) {
                candidates.push(exportRaw.replace(/\/(lib|build|out)\//, '/src/'));
                candidates.push(exportRaw.replace(/\/(lib|build|out)\//, '/'));
              }
              for (const candidate of candidates) {
                const fullCandidate = `${workspacePkg.dir}/${candidate}`;
                const candidateNoExt = fullCandidate.replace(/\.([mc]?[jt]s|[jt]sx)$/, '');
                if (fileImports.has(fullCandidate) || filePathsNoExt.has(candidateNoExt) || filePathsNoExt.has(fullCandidate + '/index') || filePathsNoExt.has(candidateNoExt + '/index')) {
                  resolved = fullCandidate;
                  exportMatched = true;
                  break;
                }
              }
              if (!exportMatched) {
                // Use the dist->src conversion as default
                resolved = `${workspacePkg.dir}/${exportRaw.replace(/^dist\//, 'src/')}`;
                exportMatched = true;
              }
            }
            if (!exportMatched) {
              // Fallback: try direct path with and without src/ prefix
              // Import like '@calcom/web/modules/foo' -> apps/web/modules/foo
              const withSrc = `${workspacePkg.dir}/src/${subPath}`;
              const withoutSrc = `${workspacePkg.dir}/${subPath}`;
              // Prefer the path that exists in the file index
              const withSrcNoExt = withSrc.replace(/\.([mc]?[jt]s|[jt]sx)$/, '');
              const withoutSrcNoExt = withoutSrc.replace(/\.([mc]?[jt]s|[jt]sx)$/, '');
              if (fileImports.has(withoutSrc) || filePathsNoExt.has(withoutSrcNoExt) || filePathsNoExt.has(withoutSrc + '/index')) {
                resolved = withoutSrc;
              } else {
                resolved = withSrc;
              }
            }
          } else {
            // Import like '@n8n/rest-api-client' -> packages/.../src/index
            resolved = `${workspacePkg.dir}/${workspacePkg.entryPoint}`;
          }
        } else {
          // Before treating as external, check if baseUrl can resolve it
          // e.g., import 'components/Foo' with baseUrl: "." in apps/studio/tsconfig.json
          // resolves to apps/studio/components/Foo
          const baseUrlPrefix = getBaseUrlForFile(fromFile);
          if (baseUrlPrefix) {
            const baseUrlResolved = baseUrlPrefix + importPath;
            const baseUrlNoExt = baseUrlResolved.replace(/\.([mc]?[jt]s|[jt]sx)$/, '');
            if (fileImports.has(baseUrlResolved) || filePathsNoExt.has(baseUrlNoExt) ||
                filePathsNoExt.has(baseUrlResolved + '/index') || filePathsNoExt.has(baseUrlNoExt + '/index')) {
              resolved = baseUrlResolved;
            } else {
              // External npm package - not a local file
              return [];
            }
          } else {
            // External npm package - not a local file
            return [];
          }
        }
      }
    }

    // Normalize
    resolved = resolved.replace(/\\/g, '/').replace(/^\.\//, '');

    // Handle directory imports (paths ending with /) by looking for index files
    const isDirectoryImport = resolved.endsWith('/');
    if (isDirectoryImport) {
      resolved = resolved.slice(0, -1); // Remove trailing slash
    }

    const resolvedNoExt = resolved.replace(/\.([mc]?[jt]s|[jt]sx|py|pyi|java|kt|kts|cs|go|rs)$/, '');

    // Find matching files
    const matches = [];
    if (fileImports.has(resolved)) {
      matches.push(resolved);
    }
    // Check extension variants
    const variants = filePathsNoExt.get(resolvedNoExt) || [];
    for (const variant of variants) {
      if (!matches.includes(variant)) {
        matches.push(variant);
      }
    }
    // Also check index files (for directory imports or bare module imports)
    const indexVariants = filePathsNoExt.get(resolved + '/index') || [];
    for (const variant of indexVariants) {
      if (!matches.includes(variant)) {
        matches.push(variant);
      }
    }
    // Check platform-specific extensions (React Native convention)
    // import './Screen' should also match Screen.ios.tsx, Screen.android.tsx, Screen.web.tsx
    const platformSuffixes = ['.ios', '.android', '.web', '.native', '.macos', '.windows'];
    for (const suffix of platformSuffixes) {
      const platformVariants = filePathsNoExt.get(resolvedNoExt + suffix) || [];
      for (const variant of platformVariants) {
        if (!matches.includes(variant)) {
          matches.push(variant);
        }
      }
    }
    // For directory imports, index is the primary match
    if (isDirectoryImport && matches.length === 0) {
      const dirIndexVariants = filePathsNoExt.get(resolvedNoExt + '/index') || [];
      for (const variant of dirIndexVariants) {
        if (!matches.includes(variant)) {
          matches.push(variant);
        }
      }
    }

    return matches;
  }

  // BFS to find all reachable files
  function walkFromFile(startFile) {
    const queue = [startFile];
    let qi = 0;

    while (qi < queue.length) {
      const current = queue[qi++];

      if (visited.has(current)) continue;
      visited.add(current);
      reachable.add(current);

      // Go same-package linking: all .go files in the same directory are compiled together
      // When any Go file is reachable, all non-test files in the same package (directory) are reachable
      // But exclude files with dead/deprecated patterns - these should only be reachable via explicit import
      if (current.endsWith('.go')) {
        const currentDir = (0,external_path_.dirname)(current);
        const deadGoPattern = /(^|\/)(dead[-_]?|deprecated[-_]?|legacy[-_]?|old[-_]?|unused[-_]?)[^/]*\.go$|\/dead\.go$/i;
        const sameDir = goFilesByDir.get(currentDir);
        if (sameDir) {
          for (const filePath of sameDir) {
            if (!visited.has(filePath) && !deadGoPattern.test(filePath)) {
              queue.push(filePath);
            }
          }
        }
      }

      // Java/Kotlin same-package linking: classes in the same package can reference each other
      // without import statements. When a Java file is reachable, all files in the same
      // Java package (by packageName, not directory) are also reachable.
      // But exclude files with dead/deprecated/legacy patterns - these should only be reachable via explicit import.
      if (current.endsWith('.java') || current.endsWith('.kt')) {
        const currentPkg = fileMetadata.get(current)?.packageName;
        if (currentPkg) {
          const pkgDir = currentPkg.replace(/\./g, '/');
          const pkgFiles = javaPackageDirMap.get(pkgDir);
          if (pkgFiles) {
            const deadJavaPattern = /(^|\/)(dead[-_]?|deprecated[-_]?|legacy[-_]?|old[-_]?|unused[-_]?)[^/]*\.(java|kt)$|\/(Dead|Deprecated|Legacy|Old|Unused)[A-Z][^/]*\.(java|kt)$/;
            for (const filePath of pkgFiles) {
              if (!visited.has(filePath) && !deadJavaPattern.test(filePath)) {
                queue.push(filePath);
              }
            }
          }
        }
      }

      // Get imports for this file
      const isPythonFile = current.endsWith('.py') || current.endsWith('.pyi');
      const imports = fileImports.get(current) || [];
      for (const imp of imports) {
        const module = imp.module || imp;
        if (typeof module !== 'string') continue;

        // Let resolveImport handle all imports - it knows about path aliases
        // and returns empty array for npm packages
        const resolvedFiles = resolveImport(current, module);
        for (const resolved of resolvedFiles) {
          if (!visited.has(resolved)) {
            queue.push(resolved);
          }
          // Record per-export usage
          if (imp.type === 'esm' && imp.specifiers) {
            recordExportUsage(resolved, current, imp.specifiers, 'esm');
          } else if (isPythonFile && imp.type === 'from' && imp.name) {
            // Python: from X import name — synthesize specifier
            // For __init__.py files: mark ALL exports as used (conservative).
            // __init__.py defines the package's public API — its sibling modules'
            // exports are importable via the package (e.g., from openai.types.X import Y).
            // Marking only the named import would falsely flag other exports as dead.
            const isInitFile = current.endsWith('__init__.py') || current.endsWith('__init__.pyi');
            if (isInitFile || imp.name === '*') {
              recordExportUsage(resolved, current, null, 'from');
            } else {
              const pySpec = [{ name: imp.name, type: 'named' }];
              recordExportUsage(resolved, current, pySpec, 'from');
            }
          } else if (imp.type === 'commonjs' || imp.type === 'dynamic-import' || imp.type === 'require-context') {
            recordExportUsage(resolved, current, null, imp.type || 'commonjs');
          } else if (!imp.specifiers || imp.specifiers.length === 0) {
            // Unknown type with no specifiers — conservative: all consumed
            recordExportUsage(resolved, current, null, imp.type || 'unknown');
          }
        }

        // For Python "from package import X" statements, X could be a submodule (file)
        // not just a symbol. Try resolving module.name as a module path too.
        // e.g. "from airflow.routes import task_instances" -> try airflow/routes/task_instances.py
        if (isPythonFile && imp.name && imp.type === 'from') {
          const submodulePath = module + '.' + imp.name;
          const subResolved = resolveImport(current, submodulePath);
          for (const resolved of subResolved) {
            if (!visited.has(resolved)) {
              queue.push(resolved);
            }
            // Python submodule resolution: the import resolved to a file, mark all exports used
            recordExportUsage(resolved, current, null, 'from-submodule');
          }
        }
      }

      // Follow re-export chains (barrel files: export * from './module')
      // Also record export usage so re-exported symbols are marked as consumed.
      const exports = fileExports.get(current) || [];
      for (const exp of exports) {
        if (exp.sourceModule) {
          // This is a re-export - follow the source module
          const resolvedSources = resolveImport(current, exp.sourceModule);
          for (const source of resolvedSources) {
            if (!visited.has(source)) {
              queue.push(source);
            }
            // Record export usage for re-exported symbols.
            // export * from './module' → all exports consumed
            // export { X } from './module' → specific export consumed
            if (exp.type === 'reexport-all' || exp.name === '*') {
              recordExportUsage(source, current, null, 'reexport-all');
            } else if (exp.name) {
              recordExportUsage(source, current, [{ name: exp.name, type: 'named' }], 'reexport');
            }
          }
        }
      }

      // Follow Rust mod declarations (mod utils; makes utils.rs or utils/mod.rs reachable)
      // Skip mod declarations that have "dead" patterns in the name (they're likely unused)
      const mods = fileMods.get(current) || [];
      const deadModPattern = /^(dead[-_]|deprecated[-_]|legacy[-_]|old[-_]|unused[-_])/i;
      for (const mod of mods) {
        // Skip mods with dead patterns in the name
        if (deadModPattern.test(mod.name)) {
          continue;
        }

        // Resolve mod name to file path
        const currentDir = (0,external_path_.dirname)(current);

        // If mod has #[path = "..."] override, use that path directly
        if (mod.pathOverride) {
          const overridePath = (0,external_path_.join)(currentDir, mod.pathOverride);
          const normalizedOverride = overridePath.replace(/\\/g, '/');
          if (fileImports.has(normalizedOverride) && !visited.has(normalizedOverride)) {
            queue.push(normalizedOverride);
          }
          // Also try relative to Rust 2018 parent module dir
          const currentBase = (0,external_path_.basename)(current);
          if (currentBase.endsWith('.rs') && currentBase !== 'mod.rs' && currentBase !== 'lib.rs' && currentBase !== 'main.rs') {
            const parentModDir = (0,external_path_.join)(currentDir, currentBase.replace(/\.rs$/, ''));
            const altPath = (0,external_path_.join)(parentModDir, mod.pathOverride).replace(/\\/g, '/');
            if (fileImports.has(altPath) && !visited.has(altPath)) {
              queue.push(altPath);
            }
          }
          continue;
        }

        // mod foo; -> look for foo.rs or foo/mod.rs in same directory
        const modFileName = mod.name + '.rs';
        const modDirFile = mod.name + '/mod.rs';

        // Build candidates list
        const modCandidates = [
          (0,external_path_.join)(currentDir, modFileName),
          (0,external_path_.join)(currentDir, modDirFile)
        ];

        // Rust 2018 module path: if current file is "rules.rs" (not mod.rs/lib.rs/main.rs),
        // then it manages a sibling "rules/" directory. Child mods resolve to rules/child.rs.
        const currentBase = (0,external_path_.basename)(current);
        if (currentBase.endsWith('.rs') && currentBase !== 'mod.rs' && currentBase !== 'lib.rs' && currentBase !== 'main.rs') {
          const parentModDir = (0,external_path_.join)(currentDir, currentBase.replace(/\.rs$/, ''));
          modCandidates.push(
            (0,external_path_.join)(parentModDir, modFileName),    // e.g., rules/import.rs
            (0,external_path_.join)(parentModDir, modDirFile)      // e.g., rules/import/mod.rs
          );
        }

        for (const candidate of modCandidates) {
          const normalizedCandidate = candidate.replace(/\\/g, '/');
          if (fileImports.has(normalizedCandidate) && !visited.has(normalizedCandidate)) {
            queue.push(normalizedCandidate);
          }
        }
      }

      // Follow Rust proc macros that scan directories for .rs files at compile time
      // Handles: automod::dir!("path"), declare_group_from_fs!, declare_lint_group!, etc.
      // Also handles r#keyword raw identifier syntax: mod r#if → if.rs
      if (current.endsWith('.rs') && projectPath) {
        try {
          const rsContent = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, current), 'utf-8');

          // Resolve nested inline module declarations:
          // pub(crate) mod eslint { pub mod accessor_pairs; }
          // → accessor_pairs resolves to rules/eslint/accessor_pairs.rs (not rules/accessor_pairs.rs)
          // Strategy: Parse content for inline mod blocks (ending with {), track brace depth,
          // and resolve nested external mods (ending with ;) with parent inline mod as prefix dir.
          {
            const currentDir = (0,external_path_.dirname)(current);
            const currentBase = (0,external_path_.basename)(current);
            const baseDir = (currentBase.endsWith('.rs') && currentBase !== 'mod.rs' && currentBase !== 'lib.rs' && currentBase !== 'main.rs')
              ? (0,external_path_.join)(currentDir, currentBase.replace(/\.rs$/, ''))
              : currentDir;

            // Track brace depth and inline mod stack
            const modStack = []; // [{name, startDepth}]
            let braceDepth = 0;
            // Tokenize: find mod declarations, open braces, close braces
            const tokenRe = /(?:(?:pub(?:\([^)]+\))?\s+)?mod\s+(\w+)\s*([;{]))|([{}])/g;
            let tok;
            while ((tok = tokenRe.exec(rsContent)) !== null) {
              if (tok[3] === '{') {
                braceDepth++;
              } else if (tok[3] === '}') {
                braceDepth--;
                // Pop any inline mods that ended at this depth
                while (modStack.length > 0 && modStack[modStack.length - 1].startDepth >= braceDepth) {
                  modStack.pop();
                }
              } else if (tok[1]) {
                // mod declaration
                const modName = tok[1];
                const ending = tok[2];
                if (ending === '{') {
                  // Inline module — push to stack and count its opening brace
                  braceDepth++;
                  modStack.push({ name: modName, startDepth: braceDepth });
                } else if (ending === ';' && modStack.length > 0) {
                  // External mod inside an inline block — resolve with prefix
                  const prefix = modStack.map(m => m.name).join('/');
                  const nestedCandidates = [
                    (0,external_path_.join)(baseDir, prefix, modName + '.rs'),
                    (0,external_path_.join)(baseDir, prefix, modName, 'mod.rs')
                  ];
                  for (const c of nestedCandidates) {
                    const nc = c.replace(/\\/g, '/');
                    if (fileImports.has(nc) && !visited.has(nc)) {
                      queue.push(nc);
                    }
                  }
                }
              }
            }
          }

          // Match automod::dir!("subdir") or automod::dir!(".")
          const automodRe = /automod::dir!\s*\(\s*"([^"]+)"\s*\)/g;
          let automodMatch;
          while ((automodMatch = automodRe.exec(rsContent)) !== null) {
            const automodDir = automodMatch[1];
            const currentDir = (0,external_path_.dirname)(current);
            // automod::dir! resolves relative to Cargo.toml manifest dir (project root),
            // NOT relative to the current file. Try project-root-relative first, then file-relative as fallback.
            const rootRelativeDir = automodDir === '.' ? currentDir : automodDir.replace(/\\/g, '/');
            const fileRelativeDir = automodDir === '.' ? currentDir : (0,external_path_.join)(currentDir, automodDir).replace(/\\/g, '/');
            // Check which directory has files — prefer root-relative
            const rootDirFiles = dirIndex ? dirIndex.get(rootRelativeDir) : null;
            const fileDirFiles = dirIndex ? dirIndex.get(fileRelativeDir) : null;
            const targetDir = (rootDirFiles && rootDirFiles.size > 0) ? rootRelativeDir
              : (fileDirFiles && fileDirFiles.size > 0) ? fileRelativeDir
              : rootRelativeDir;
            // Use dirIndex if available, otherwise scan fileImports keys
            const dirFiles = dirIndex ? dirIndex.get(targetDir) : null;
            if (dirFiles) {
              for (const f of dirFiles) {
                if (f.endsWith('.rs') && !visited.has(f)) {
                  queue.push(f);
                }
              }
            } else {
              // Fallback: scan all known file paths in that directory
              for (const filePath of fileImports.keys()) {
                if (filePath.endsWith('.rs') && (0,external_path_.dirname)(filePath) === targetDir && !visited.has(filePath)) {
                  queue.push(filePath);
                }
              }
            }
          }

          // Detect Rust proc macros that scan directories at compile time (e.g., biome's declare_group_from_fs!)
          // Pattern: macro invocation in a file means "all .rs files in my sibling directory are modules"
          // e.g., crates/biome_js_analyze/src/lint/correctness.rs contains declare_group_from_fs!
          // which scans correctness/ directory for .rs files
          if (/declare_(?:group_from_fs|lint_group)|include_dir!\s*\(|auto_mod!\s*\(/.test(rsContent)) {
            const currentDir = (0,external_path_.dirname)(current);
            const moduleName = current.replace(/\.rs$/, '').split('/').pop();
            // The macro typically scans a subdirectory named after the module
            const targetDir = `${currentDir}/${moduleName}`;
            const dirFiles = dirIndex ? dirIndex.get(targetDir) : null;
            if (dirFiles) {
              for (const f of dirFiles) {
                if (f.endsWith('.rs') && !visited.has(f)) {
                  queue.push(f);
                }
              }
            }
          }

          // Handle Rust raw identifier mod declarations: mod r#if; → if.rs
          const rawIdentRe = /\bmod\s+r#(\w+)\s*;/g;
          let rawMatch;
          while ((rawMatch = rawIdentRe.exec(rsContent)) !== null) {
            const modName = rawMatch[1];
            const currentDir = (0,external_path_.dirname)(current);
            const candidates = [
              `${currentDir}/${modName}.rs`,
              `${currentDir}/${modName}/mod.rs`
            ];
            for (const c of candidates) {
              if (!visited.has(c) && (dirIndex?.get((0,external_path_.dirname)(c))?.has(c) || fileImports.has(c))) {
                queue.push(c);
              }
            }
          }

          // Handle Rust include!() macro: include!("../doctest_setup.rs") → resolve path
          const includeRe = /include!\s*\(\s*["']([^"']+\.rs)["']\s*\)/g;
          let inclMatch;
          while ((inclMatch = includeRe.exec(rsContent)) !== null) {
            const inclPath = inclMatch[1];
            const currentDir = (0,external_path_.dirname)(current);
            // Try relative to current file
            const resolved = (0,external_path_.join)(currentDir, inclPath).replace(/\\/g, '/');
            const normalised = resolved.replace(/\/\.\.\//g, () => {
              // Simple parent dir resolution
              return '/../';
            });
            // Normalise path — use a simple approach
            const parts = resolved.split('/');
            const normalParts = [];
            for (const p of parts) {
              if (p === '..') normalParts.pop();
              else if (p !== '.') normalParts.push(p);
            }
            const finalPath = normalParts.join('/');
            if (!visited.has(finalPath) && (dirIndex?.get((0,external_path_.dirname)(finalPath))?.has(finalPath) || fileImports.has(finalPath))) {
              queue.push(finalPath);
            }
          }
        } catch { /* skip read errors */ }
      }

      // Follow Python __getattr__ + lazy import dict patterns (e.g., langchain's create_importer)
      // Pattern: __init__.py files define __getattr__ + a dict mapping names to dotted module paths
      // The dict values are dynamically imported at runtime via importlib.import_module()
      if (isPythonFile && current.endsWith('__init__.py') && projectPath) {
        try {
          const pyContent = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, current), 'utf-8');
          if (pyContent.includes('__getattr__')) {
            // Extract dotted module paths from dict-like structures
            // Matches: "module.path.name" in dict values, list items, or _module_lookup patterns
            const dottedModuleRe = /["'](\w+(?:\.\w+){1,})["']/g;
            let pyMatch;
            while ((pyMatch = dottedModuleRe.exec(pyContent)) !== null) {
              const dottedPath = pyMatch[1];
              const resolved = resolveImport(current, dottedPath);
              for (const r of resolved) {
                if (!visited.has(r)) {
                  queue.push(r);
                }
              }
            }
            // When __init__.py has __getattr__, ALL sibling .py modules are reachable
            // Python allows `from package.submodule import X` which bypasses __init__.py
            // and loads the submodule directly (e.g., langchain deprecation shims)
            const pkgDir = (0,external_path_.dirname)(current);
            const siblingFiles = dirIndex ? dirIndex.get(pkgDir) : null;
            if (siblingFiles) {
              for (const f of siblingFiles) {
                if (f.endsWith('.py') && !f.endsWith('__init__.py') && !visited.has(f)) {
                  queue.push(f);
                }
              }
            }
            // Also recurse into sub-packages: when __init__.py has __getattr__,
            // sub-packages are also importable (from package.sub.module import X)
            if (dirIndex) {
              for (const [dir, files] of dirIndex) {
                if (dir.startsWith(pkgDir + '/') && dir !== pkgDir) {
                  for (const f of files) {
                    if (f.endsWith('__init__.py') && !visited.has(f)) {
                      queue.push(f);
                    }
                  }
                }
              }
            }
          }
        } catch { /* skip read errors */ }
      }

      // Follow Python import_module() / importlib.import_module() patterns
      // Sphinx uses import_module('sphinx.search.da.SearchDanish') and import_module('sphinx.directives.other')
      if (isPythonFile && projectPath) {
        try {
          const pyContent = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, current), 'utf-8');
          if (pyContent.includes('import_module')) {
            const dottedModuleRe = /["'](\w+(?:\.\w+){1,})["']/g;
            let pyMatch;
            while ((pyMatch = dottedModuleRe.exec(pyContent)) !== null) {
              const dottedPath = pyMatch[1];
              const resolved = resolveImport(current, dottedPath);
              for (const r of resolved) {
                if (!visited.has(r)) {
                  queue.push(r);
                }
              }
            }
          }
        } catch { /* skip read errors */ }
      }

      // Follow Svelte component imports: parse <script> blocks for import statements
      // This handles .svelte files that import .ts/.js modules (e.g., gradio imageeditor)
      if (current.endsWith('.svelte') && projectPath) {
        try {
          const svelteContent = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, current), 'utf-8');
          // Extract <script> block content
          const scriptBlockRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
          let scriptMatch;
          while ((scriptMatch = scriptBlockRe.exec(svelteContent)) !== null) {
            const scriptContent = scriptMatch[1];
            // Extract import paths from script content
            const importRe = /(?:import|from)\s+['"]([^'"]+)['"]/g;
            let importMatch;
            while ((importMatch = importRe.exec(scriptContent)) !== null) {
              const importPath = importMatch[1];
              if (importPath.startsWith('.')) {
                const resolved = resolveImport(current, importPath);
                for (const r of resolved) {
                  if (!visited.has(r)) {
                    queue.push(r);
                  }
                }
              }
            }
          }
        } catch { /* skip read errors */ }
      }

      // Follow Vue SFC imports: parse <script> blocks for import statements
      if (current.endsWith('.vue') && projectPath) {
        try {
          const vueContent = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, current), 'utf-8');
          const scriptBlockRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
          let scriptMatch;
          while ((scriptMatch = scriptBlockRe.exec(vueContent)) !== null) {
            const scriptContent = scriptMatch[1];
            const importRe = /(?:import|from)\s+['"]([^'"]+)['"]/g;
            let importMatch;
            while ((importMatch = importRe.exec(scriptContent)) !== null) {
              const importPath = importMatch[1];
              if (importPath.startsWith('.')) {
                const resolved = resolveImport(current, importPath);
                for (const r of resolved) {
                  if (!visited.has(r)) {
                    queue.push(r);
                  }
                }
              }
            }
          }
        } catch { /* skip read errors */ }
      }

      // Follow additional references (e.g., C# class instantiation, extension methods)
      if (additionalRefs) {
        const refs = additionalRefs.get(current);
        if (refs) {
          for (const refFile of refs) {
            if (!visited.has(refFile)) {
              queue.push(refFile);
            }
          }
        }
      }
    }
  }

  // Start from each entry point using lookup maps instead of O(entryPoints × files)
  // Build a Set of all known file paths for exact matching
  const allFilePathSet = new Set(allFilePaths);
  for (const entryPoint of entryPointFiles) {
    // 1. Exact path match
    if (allFilePathSet.has(entryPoint)) {
      walkFromFile(entryPoint);
      continue;
    }

    // 2. Extension-less match via filePathsNoExt
    const entryNoExt = entryPoint.replace(/\.([mc]?[jt]s|[jt]sx|py|pyi|java|kt|kts|cs|go|rs)$/, '');
    const noExtMatches = filePathsNoExt.get(entryNoExt);
    if (noExtMatches) {
      for (const fp of noExtMatches) walkFromFile(fp);
      continue;
    }

    // 3. Suffix-based fallback for entries like "src/index.ts" matching "packages/foo/src/index.ts"
    const entryBasename = entryPoint.includes('/') ? entryPoint.slice(entryPoint.lastIndexOf('/') + 1) : entryPoint;
    const entryNoExtBasename = entryNoExt.includes('/') ? entryNoExt.slice(entryNoExt.lastIndexOf('/') + 1) : entryNoExt;
    let found = false;
    // Try exact suffix match
    const suffixCandidates = suffixIndex.get(entryBasename) || [];
    for (const fp of suffixCandidates) {
      if (fp.endsWith('/' + entryPoint) || fp === entryPoint) {
        walkFromFile(fp);
        found = true;
      }
    }
    if (found) continue;
    // Try extension variants via suffix index
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      const variantBasename = entryNoExtBasename + ext;
      const variants = suffixIndex.get(variantBasename) || [];
      for (const fp of variants) {
        if (fp.endsWith('/' + entryNoExt + ext)) {
          walkFromFile(fp);
          found = true;
        }
      }
      if (found) break;
    }
  }

  // Walk imports from files discovered via glob patterns and directory-scanning
  // These were added to reachable but not walked (their transitive imports need following)
  for (const file of reachable) {
    if (!visited.has(file)) {
      walkFromFile(file);
    }
  }

  // Propagate export usage through re-export chains
  // e.g., if barrel.ts re-exports { foo } from './source.ts' and foo is consumed from barrel,
  // then foo should be marked as consumed in source.ts too
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const [filePath, exports] of fileExports) {
      const barrelUsage = exportUsageMap.get(filePath);
      if (!barrelUsage) continue;

      for (const exp of exports) {
        if (!exp.sourceModule) continue; // Only process re-exports

        const resolvedSources = resolveImport(filePath, exp.sourceModule);
        for (const sourceFile of resolvedSources) {
          let sourceUsage = exportUsageMap.get(sourceFile);

          if (exp.name === '*' && exp.type === 'reexport-all') {
            // export * from './source' — propagate all named usages that aren't
            // direct exports of the barrel file itself
            const barrelDirectExports = new Set();
            for (const e of exports) {
              if (!e.sourceModule && e.name !== '*') barrelDirectExports.add(e.name);
            }

            for (const [symbolName, usages] of barrelUsage) {
              if (symbolName === '__SIDE_EFFECT__') continue;
              if (symbolName === '__ALL__' || symbolName === '*') {
                // All exports consumed from barrel — propagate to source
                if (!sourceUsage) { sourceUsage = new Map(); exportUsageMap.set(sourceFile, sourceUsage); }
                if (!sourceUsage.has('__ALL__')) {
                  sourceUsage.set('__ALL__', [...usages]);
                  changed = true;
                }
                continue;
              }
              // Named symbol: propagate if not a direct export of the barrel
              if (barrelDirectExports.has(symbolName)) continue;
              if (!sourceUsage) { sourceUsage = new Map(); exportUsageMap.set(sourceFile, sourceUsage); }
              if (!sourceUsage.has(symbolName)) {
                sourceUsage.set(symbolName, [...usages]);
                changed = true;
              }
            }
          } else {
            // export { foo } from './source' — propagate if foo is consumed from barrel
            const consumed = barrelUsage.get(exp.name);
            const allConsumed = barrelUsage.has('__ALL__') || barrelUsage.has('*');
            if (consumed || allConsumed) {
              if (!sourceUsage) { sourceUsage = new Map(); exportUsageMap.set(sourceFile, sourceUsage); }
              if (!sourceUsage.has(exp.name)) {
                sourceUsage.set(exp.name, consumed ? [...consumed] : (barrelUsage.get('__ALL__') || barrelUsage.get('*') || []).map(u => ({ ...u })));
                changed = true;
              }
            }
          }
        }
      }
    }
    if (!changed) break;
  }

  return { reachable, exportUsageMap };
}

/**
 * Main dead code analysis function
 * @param {Array} jsAnalysis - Parsed JavaScript files
 * @param {Object} importGraph - Import graph from analyseImports
 * @param {string} projectPath - Path to project root
 * @param {Object} packageJson - Parsed package.json
 * @param {Object} config - Configuration options (including deadCode.dynamicPatterns)
 * @param {Function} onProgress - Progress callback
 */
async function findDeadCode(jsAnalysis, importGraph, projectPath = null, packageJson = {}, config = {}, onProgress = () => {}) {
  // Handle backwards compatibility: if config is a function, it's the old onProgress param
  if (typeof config === 'function') {
    onProgress = config;
    config = {};
  }

  // Set up dynamic patterns from config
  const dynamicPatterns = config.dynamicPatterns || config.deadCode?.dynamicPatterns || [];
  setDynamicPatterns(dynamicPatterns);

  // Set up DI patterns from config
  // Includes NestJS, TypeORM, Angular, InversifyJS, Spring, and common DI frameworks
  const diDecorators = config.diDecorators || config.deadCode?.diDecorators || [
    // NestJS and common DI frameworks - decorated classes are container-managed
    // @Controller marks HTTP endpoints, @Module defines DI containers,
    // @Resolver for GraphQL endpoints
    'Controller', 'Module', 'Resolver',
    // @Service and @Injectable are commonly used for auto-registered services
    // Used by: NestJS, Angular, InversifyJS, n8n's @n8n/di, etc.
    'Service', 'Injectable',
    // @RestController used by n8n and other frameworks for HTTP endpoints
    'RestController',
    // n8n-specific module decorator for dynamic module loading
    'BackendModule',
    // HTTP method decorators indicate routes (these imply the class IS used)
    'Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head', 'All',
    // TypeORM entities are loaded by reflection
    'Entity',
    // Vue Class Component
    'Options',
    // === Java/Kotlin Spring Framework ===
    // Spring stereotype annotations - classes are loaded by component scan
    'RestController', 'Repository', 'Configuration',
    'SpringBootApplication', 'Bean', 'Aspect',
    // Spring request mappings
    'RequestMapping', 'GetMapping', 'PostMapping', 'PutMapping', 'DeleteMapping', 'PatchMapping',
    // === C#/.NET ===
    // ASP.NET Core controller attribute
    'ApiController',
    // === Python Decorators (captured as annotations) ===
    // FastAPI decorators
    'router', 'app',
    // Celery
    'task', 'shared_task'
  ];
  const diContainerPatterns = config.diContainerPatterns || config.deadCode?.diContainerPatterns || [
    'Container\\.get\\s*[<(]', 'Container\\.resolve\\s*[<(]',
    'container\\.resolve\\s*[<(]', 'moduleRef\\.get\\s*[<(]',
    'injector\\.get\\s*[<(]',
    // C#/.NET DI registration patterns
    'AddScoped\\s*<', 'AddSingleton\\s*<', 'AddTransient\\s*<',
    'Services\\.Add\\s*<', 'Services\\.AddScoped\\s*<',
    'Services\\.AddSingleton\\s*<', 'Services\\.AddTransient\\s*<',
    // C#/.NET middleware and generic type references
    'UseMiddleware\\s*<', 'AddDbContext\\s*<',
    'DbSet\\s*<',
    // Interface implementations in DI
    'AddScoped\\s*<\\s*[A-Z]\\w*\\s*,\\s*',
    'AddSingleton\\s*<\\s*[A-Z]\\w*\\s*,\\s*',
    'AddTransient\\s*<\\s*[A-Z]\\w*\\s*,\\s*'
  ];
  setDIPatterns(diDecorators, diContainerPatterns);

  // Detect frameworks from package.json for framework-specific entry points
  detectFrameworks(packageJson);

  // Also detect frameworks from workspace sub-packages (monorepo support)
  // e.g., nocodb has nuxt in packages/nc-gui/package.json, not the root
  // Use _addFrameworks to accumulate rather than replace
  if (projectPath) {
    const { workspacePackages: wpkgs } = extractPathAliases(projectPath);
    for (const [, pkg] of wpkgs) {
      const subPkgPath = (0,external_path_.join)(projectPath, pkg.dir, 'package.json');
      try {
        const subPkg = JSON.parse((0,external_fs_.readFileSync)(subPkgPath, 'utf-8'));
        _addFrameworks(subPkg);
      } catch { /* ignore */ }
    }
    // Also detect Nuxt by nuxt.config.ts presence (covers cases where nuxt isn't a direct dep)
    try {
      const topEntries = (0,external_fs_.readdirSync)(projectPath, { withFileTypes: true });
      for (const entry of topEntries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          if ((0,external_fs_.existsSync)((0,external_path_.join)(projectPath, entry.name, 'nuxt.config.ts')) ||
              (0,external_fs_.existsSync)((0,external_path_.join)(projectPath, entry.name, 'nuxt.config.js'))) {
            DETECTED_FRAMEWORKS.add('nuxt');
            DETECTED_FRAMEWORKS.add('vue');
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Parse .csproj ProjectReferences for C#/.NET projects
  // This builds a transitive dependency graph so all files in referenced projects are entry points
  const csprojReferencedDirs = parseCsprojReferences(projectPath);

  // Detect Deno workspaces (deno.json with "workspace" array)
  // Each workspace member's mod.ts/main.ts is an entry point
  const denoWorkspaceDirs = new Set();
  if (projectPath) {
    try {
      const denoConfigPath = (0,external_path_.join)(projectPath, 'deno.json');
      if ((0,external_fs_.existsSync)(denoConfigPath)) {
        const denoConfig = JSON.parse((0,external_fs_.readFileSync)(denoConfigPath, 'utf-8'));
        if (Array.isArray(denoConfig.workspace)) {
          for (const member of denoConfig.workspace) {
            const dir = member.replace(/^\.\//, '').replace(/\/$/, '');
            denoWorkspaceDirs.add(dir);
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Set up dynamic package.json fields from config
  const dynamicPackageFields = config.dynamicPackageFields || config.deadCode?.dynamicPackageFields ||
    ['nodes', 'plugins', 'credentials', 'extensions', 'adapters', 'connectors'];
  setDynamicPackageFields(dynamicPackageFields);

  // Filter out generated code files
  const excludeGenerated = config.excludeGenerated ?? config.deadCode?.excludeGenerated ?? true;
  const customGeneratedPatterns = (config.generatedPatterns || config.deadCode?.generatedPatterns || [])
    .map(p => typeof p === 'string' ? new RegExp(p) : p);

  let analysisFiles = jsAnalysis;
  const excludedGeneratedFiles = [];

  if (excludeGenerated) {
    const { included, excluded } = filterGeneratedFiles(jsAnalysis, {
      customPatterns: customGeneratedPatterns,
      checkContent: true
    });
    analysisFiles = included;
    excludedGeneratedFiles.push(...excluded);
  }

  // Filter out entries with no file path (can happen with parse failures)
  analysisFiles = analysisFiles.filter(f => f.file?.relativePath || f.file);

  // Create unified entry point detector (optional - can be enabled via config)
  const useUnifiedDetector = config.useUnifiedEntryDetector ?? config.deadCode?.useUnifiedEntryDetector ?? false;
  const entryPointDetector = useUnifiedDetector ? createEntryPointDetector(projectPath, packageJson, {
    diDecorators,
    customPatterns: dynamicPatterns
  }) : null;

  const dynamicFiles = [];  // Track files skipped due to dynamic patterns

  const results = {
    fullyDeadFiles: [],
    partiallyDeadFiles: [],
    skippedDynamic: [],  // Files skipped due to dynamic loading patterns
    excludedGenerated: excludedGeneratedFiles,  // Files excluded as generated code
    entryPoints: [],
    summary: {
      totalDeadBytes: 0,
      totalDeadExports: 0,
      totalLiveExports: 0,
      filesAnalysed: 0,
      filesWithDeadCode: 0,
      dynamicPatternCount: dynamicPatterns.length,
      skippedDynamicCount: 0,
      excludedGeneratedCount: excludedGeneratedFiles.length
    }
  };

  // Extract entry points from various sources
  const scriptEntryPoints = extractScriptEntryPoints(packageJson);
  const scriptGlobEntryPoints = projectPath ? extractScriptGlobEntryPoints(packageJson, projectPath) : new Set();
  const nestedScriptEntryPoints = projectPath ? extractAllScriptEntryPoints(projectPath) : new Set();
  const htmlEntryPoints = extractHtmlEntryPoints(projectPath);
  const viteReplacementEntryPoints = extractViteReplacementEntryPoints(projectPath);

  // Collect entry points from bundler and CI/CD configs
  const configEntryData = projectPath ? collectConfigEntryPoints(projectPath) : { entries: [], npmScripts: [] };
  const configEntryPoints = configEntryData.entries;
  setConfigEntryData(configEntryData);  // Make available to isEntryPoint()

  // Extract entry points from Gruntfile/Gulpfile concat tasks
  const gruntConcatEntries = projectPath ? extractGruntConcatSources(projectPath) : new Set();

  // Extract entry points from tsconfig.json files/include arrays
  const tsconfigFileEntries = projectPath ? extractTsconfigFileEntries(projectPath) : new Set();

  // Collect all entry point file paths for reachability analysis
  const entryPointFiles = new Set([...scriptEntryPoints, ...scriptGlobEntryPoints, ...nestedScriptEntryPoints, ...htmlEntryPoints, ...viteReplacementEntryPoints, ...configEntryPoints, ...gruntConcatEntries, ...tsconfigFileEntries]);

  // Build map of class names to files (for DI container reference detection)
  const classToFile = new Map();
  for (const file of analysisFiles) {
    const filePath = file.file?.relativePath || file.file;
    for (const cls of file.classes || []) {
      if (cls.name) {
        classToFile.set(cls.name, filePath);
      }
    }
  }

  // B2: Helper to get file content — re-reads from disk if content was stripped by worker
  function _getContent(file) {
    if (file.content) return file.content;
    if (!projectPath) return '';
    const filePath = file.file?.relativePath || file.file;
    try { return (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, filePath), 'utf-8'); } catch { return ''; }
  }

  // Collect all class names referenced via DI container patterns (Container.get, etc.)
  // Only files with classes need DI scanning (skip the majority)
  const diReferencedClasses = new Set();
  for (const file of analysisFiles) {
    if (!file.classes?.length) continue;  // Only scan files that have classes
    const content = _getContent(file);
    const refs = extractDIContainerReferences(content);
    for (const className of refs) {
      diReferencedClasses.add(className);
    }
  }

  // Build map of C# extension method names to files
  const extensionMethodToFile = new Map();
  for (const file of analysisFiles) {
    const filePath = file.file?.relativePath || file.file;
    if (filePath.endsWith('.cs')) {
      const methods = extractCSharpExtensionMethods(file);
      for (const methodName of methods) {
        extensionMethodToFile.set(methodName, filePath);
      }
    }
  }

  // Build C# namespace-to-files map for same-namespace grouping
  // In C#, all files in the same namespace can reference each other implicitly
  const namespaceToFiles = new Map();
  for (const file of analysisFiles) {
    const filePath = file.file?.relativePath || file.file;
    if (filePath.endsWith('.cs') && file.metadata?.namespace) {
      const ns = file.metadata.namespace;
      if (!namespaceToFiles.has(ns)) namespaceToFiles.set(ns, []);
      namespaceToFiles.get(ns).push(filePath);
    }
  }

  // Set of all known class names (for C# class reference detection)
  const knownClassNames = new Set(classToFile.keys());

  // Collect C# class references (new ClassName, typeof, etc.) and extension method calls
  // Build a map of file -> Set<referenced files> for the reachability graph
  const csharpFileRefs = new Map();
  for (const file of analysisFiles) {
    const filePath = file.file?.relativePath || file.file;
    // B2: Only re-read content for .cs files (C# analysis), not all files
    const content = filePath.endsWith('.cs') ? _getContent(file) : '';

    // Detect C# class references
    if (filePath.endsWith('.cs')) {
      const refs = new Set();

      const classRefs = extractCSharpClassReferences(content, knownClassNames);
      for (const className of classRefs) {
        const classFile = classToFile.get(className);
        if (classFile && classFile !== filePath) {
          refs.add(classFile);
        }
        // Also add to DI-referenced for entry point detection
        diReferencedClasses.add(className);
      }

      // Detect extension method calls
      const calledExtensionFiles = findCalledExtensionMethods(content, extensionMethodToFile);
      for (const extFile of calledExtensionFiles) {
        if (extFile !== filePath) {
          refs.add(extFile);
        }
      }

      if (refs.size > 0) {
        csharpFileRefs.set(filePath, refs);
      }
    }
  }

  // Add same-namespace links: all .cs files in the same namespace connect to each other
  // This ensures that when one file in a namespace is reachable, all siblings are too
  for (const [, files] of namespaceToFiles) {
    if (files.length < 2 || files.length > 200) continue; // skip trivial or huge namespaces
    for (const file of files) {
      const existing = csharpFileRefs.get(file) || new Set();
      for (const sibling of files) {
        if (sibling !== file) existing.add(sibling);
      }
      if (existing.size > 0) csharpFileRefs.set(file, existing);
    }
  }

  // A10: Free content strings from parsed files — DI/C# analysis above is the last consumer.
  // Content will be re-read from disk only for dead files (small subset) below.
  // This frees ~250MB (50K × 5KB) from the heap mid-pipeline.
  for (const file of analysisFiles) {
    file.content = null;
  }

  // First pass: identify all entry points
  // Use full jsAnalysis (not filtered analysisFiles) because entry points in generated files
  // still import non-generated files that need to be walked for reachability
  for (const file of jsAnalysis) {
    const filePath = file.file?.relativePath || file.file;
    if (!isCodeFile(filePath)) continue;

    // Heuristic: Files in directories/names with "dead", "deprecated", "legacy", etc.
    // are likely not active code - skip treating as entry points
    // Also catch files named exactly "dead.ext" (common in Go: dead.go)
    const deadPatterns = /(^|\/)(dead[-_]|deprecated[-_]|legacy[-_]|old[-_]|unused[-_])/i;
    const deadFileExact = /(^|\/)dead\.[^/]+$/i;  // matches dead.go, dead.py, etc.
    if (deadPatterns.test(filePath) || deadFileExact.test(filePath)) {
      // Don't mark as entry point, let it be analyzed for dead code
      continue;
    }
    if (false) {}

    // C#/.NET: Mark all .cs files in transitively-referenced project directories as entry points
    if (filePath.endsWith('.cs') && csprojReferencedDirs.size > 0) {
      const fileDir = (0,external_path_.dirname)(filePath);
      let inReferencedProject = false;
      for (const refDir of csprojReferencedDirs) {
        if (fileDir === refDir || fileDir.startsWith(refDir + '/')) {
          inReferencedProject = true;
          break;
        }
      }
      if (inReferencedProject) {
        entryPointFiles.add(filePath);
        results.entryPoints.push({
          file: filePath,
          reason: 'In .csproj-referenced project directory',
          isDynamic: false
        });
        continue;
      }
    }

    // Deno workspace: treat mod.ts/main.ts in each workspace member as entry point
    // Also treat all exported files from member deno.json as entry points
    if (denoWorkspaceDirs.size > 0 && /\.[mc]?[jt]sx?$/.test(filePath)) {
      const fileDir = (0,external_path_.dirname)(filePath);
      for (const wsDir of denoWorkspaceDirs) {
        if (fileDir === wsDir || fileDir.startsWith(wsDir + '/')) {
          const fileName = (0,external_path_.basename)(filePath);
          // mod.ts and main.ts are explicit entry points
          if (fileName === 'mod.ts' || fileName === 'main.ts' || fileName === 'mod.js' || fileName === 'main.js') {
            entryPointFiles.add(filePath);
            results.entryPoints.push({
              file: filePath,
              reason: `Deno workspace entry: ${wsDir}`,
              isDynamic: false
            });
          }
          // Also check if this file is referenced in the member's deno.json exports
          if (!entryPointFiles.has(filePath) && projectPath) {
            try {
              const memberDenoJson = (0,external_path_.join)(projectPath, wsDir, 'deno.json');
              if ((0,external_fs_.existsSync)(memberDenoJson)) {
                const memberConfig = JSON.parse((0,external_fs_.readFileSync)(memberDenoJson, 'utf-8'));
                if (memberConfig.exports) {
                  const exportPaths = typeof memberConfig.exports === 'string'
                    ? [memberConfig.exports]
                    : Object.values(memberConfig.exports);
                  for (const ep of exportPaths) {
                    const resolvedExport = (0,external_path_.join)(wsDir, ep.replace(/^\.\//, '')).replace(/\\/g, '/');
                    if (filePath === resolvedExport) {
                      entryPointFiles.add(filePath);
                      results.entryPoints.push({
                        file: filePath,
                        reason: `Deno workspace export: ${wsDir}`,
                        isDynamic: false
                      });
                      break;
                    }
                  }
                }
              }
            } catch {}
          }
          break;
        }
      }
    }

    // Check multi-language metadata for entry point indicators
    if (file.metadata) {
      // Python entry points
      if (file.metadata.hasMainBlock || file.metadata.isCelery) {
        entryPointFiles.add(filePath);
        results.entryPoints.push({
          file: filePath,
          reason: file.metadata.hasMainBlock ? 'Has __main__ block' : 'Has Celery task decorators',
          isDynamic: false
        });
        continue;
      }
      // Java/Kotlin entry points
      if (file.metadata.hasMainMethod || file.metadata.isSpringComponent) {
        entryPointFiles.add(filePath);
        results.entryPoints.push({
          file: filePath,
          reason: file.metadata.hasMainMethod ? 'Has main() method' : 'Has Spring component annotation',
          isDynamic: false
        });
        continue;
      }
      // Extended Java/Kotlin entry points: CDI, Quarkus, JPA, and test annotations
      if (file.annotations && file.annotations.length > 0) {
        const entryAnnotations = new Set([
          // Quarkus CDI & Build System
          'QuarkusMain', 'ApplicationScoped', 'RequestScoped', 'SessionScoped', 'Dependent',
          'Singleton', 'QuarkusTest', 'QuarkusIntegrationTest',
          'BuildStep', 'BuildSteps', 'Recorder',
          // GraalVM native-image substitutions
          'TargetClass', 'Substitute',
          // Jakarta CDI / Java EE
          'Stateless', 'Stateful', 'MessageDriven', 'Entity', 'MappedSuperclass',
          'Embeddable', 'Converter', 'Named', 'Startup',
          // JAX-RS / REST
          'Path', 'Provider', 'ApplicationPath',
          // Spring additional
          'Bean', 'Aspect', 'ControllerAdvice', 'RestControllerAdvice',
          'EnableAutoConfiguration', 'Import', 'ComponentScan',
          // JUnit / Testing
          'Test', 'ParameterizedTest', 'TestMethodOrder', 'TestInstance',
          'ExtendWith', 'SpringBootTest', 'WebMvcTest', 'DataJpaTest',
          // Servlet
          'WebServlet', 'WebFilter', 'WebListener',
        ]);
        const hasEntryAnnotation = file.annotations.some(a => entryAnnotations.has(a.name));
        if (hasEntryAnnotation) {
          const matchedAnnotation = file.annotations.find(a => entryAnnotations.has(a.name));
          entryPointFiles.add(filePath);
          results.entryPoints.push({
            file: filePath,
            reason: `Has @${matchedAnnotation.name} annotation`,
            isDynamic: false
          });
          continue;
        }
      }
      // Go entry points
      if (file.metadata.isMainPackage && file.metadata.hasMainFunction) {
        entryPointFiles.add(filePath);
        results.entryPoints.push({
          file: filePath,
          reason: 'Is Go main package with main()',
          isDynamic: false
        });
        continue;
      }
      if (file.metadata.hasInitFunction) {
        entryPointFiles.add(filePath);
        results.entryPoints.push({
          file: filePath,
          reason: 'Has Go init() function',
          isDynamic: false
        });
        continue;
      }
      if (file.metadata.isTestFile) {
        entryPointFiles.add(filePath);
        results.entryPoints.push({
          file: filePath,
          reason: 'Is Go test file',
          isDynamic: false
        });
        continue;
      }
      // Rust entry points
      if (file.metadata.isBinaryCrate || file.metadata.isLibraryCrate) {
        entryPointFiles.add(filePath);
        results.entryPoints.push({
          file: filePath,
          reason: file.metadata.isBinaryCrate ? 'Is Rust binary crate' : 'Is Rust library crate',
          isDynamic: false
        });
        continue;
      }
    }

    // Pass classes for DI decorator detection
    const fileClasses = file.classes || [];

    // Use unified detector if enabled, otherwise use legacy detection
    const entryCheck = entryPointDetector
      ? entryPointDetector.isEntryPoint(filePath, { classes: fileClasses, metadata: file.metadata })
      : isEntryPoint(filePath, packageJson, projectPath, htmlEntryPoints, scriptEntryPoints, fileClasses);

    if (entryCheck.isEntry) {
      entryPointFiles.add(filePath);
      results.entryPoints.push({
        file: filePath,
        reason: entryCheck.reason,
        isDynamic: entryCheck.isDynamic || false
      });

      // Track files skipped due to dynamic loading patterns
      if (entryCheck.isDynamic) {
        results.skippedDynamic.push({
          file: filePath,
          pattern: entryCheck.matchedPattern || entryCheck.reason,
          reason: entryCheck.reason
        });
      }
    } else {
      // Check if any class in this file is referenced via DI container (Container.get, etc.)
      for (const cls of fileClasses) {
        if (cls.name && diReferencedClasses.has(cls.name)) {
          entryPointFiles.add(filePath);
          results.entryPoints.push({
            file: filePath,
            reason: `Class ${cls.name} accessed via DI container (Container.get, etc.)`,
            isDynamic: true
          });
          results.skippedDynamic.push({
            file: filePath,
            pattern: 'DI container access',
            reason: `Class ${cls.name} accessed via DI container`
          });
          break;  // Only need to add once per file
        }
      }
    }
  }

  // Update skipped dynamic count
  results.summary.skippedDynamicCount = results.skippedDynamic.length;

  // Mark workspace package exports subpaths as entry points
  // These are published API surfaces consumed by external packages
  {
    const { workspacePackages: wpkgs } = extractPathAliases(projectPath);
    const allFilePaths = new Set(jsAnalysis.map(f => f.file?.relativePath || f.file));
    const allFileNoExt = new Map();
    for (const fp of allFilePaths) {
      const noExt = fp.replace(/\.([mc]?[jt]s|[jt]sx)$/, '');
      if (!allFileNoExt.has(noExt)) allFileNoExt.set(noExt, []);
      allFileNoExt.get(noExt).push(fp);
    }

    // Helper: generate dist→src candidates for a raw export path
    // Handles both leading dist/ (e.g., dist/server/index) and nested dist/
    // (e.g., store/dist/store, compat/dist/compat)
    function _distToSrcCandidates(rawPath) {
      const candidates = [rawPath];
      // Always try src/ prefix as a fallback (many libraries compile src/ → root)
      // e.g., lit-html.js → src/lit-html.ts, reactive-element.js → src/reactive-element.ts
      if (!/^(src|dist|lib|build|out)[\/-]/.test(rawPath) && !rawPath.includes('/src/')) {
        candidates.push('src/' + rawPath);
      }
      // Leading dist-cjs/, dist-es/, dist-types/ etc. (AWS SDK v3 pattern)
      if (/^dist-\w+\//.test(rawPath)) {
        candidates.push(rawPath.replace(/^dist-\w+\//, 'src/'));
        candidates.push(rawPath.replace(/^dist-\w+\//, ''));
      }
      // Leading dist/ with format subdir (tshy pattern): dist/commonjs/index → src/index
      if (/^dist\/(commonjs|cjs|esm|browser|react-native|workerd|node|default|types)\//.test(rawPath)) {
        candidates.push(rawPath.replace(/^dist\/(commonjs|cjs|esm|browser|react-native|workerd|node|default|types)\//, 'src/'));
      }
      // Leading dist/
      if (/^dist\//.test(rawPath)) {
        candidates.push(rawPath.replace(/^dist\//, 'src/'));
        candidates.push(rawPath.replace(/^dist\//, ''));
        candidates.push(rawPath.replace(/^dist\/([^/]+)\//, '$1/src/'));
      }
      // Nested dist-*/ (e.g., packages/foo/dist-cjs/index → packages/foo/src/index)
      if (/\/dist-\w+\//.test(rawPath)) {
        candidates.push(rawPath.replace(/\/dist-\w+\//, '/src/'));
        candidates.push(rawPath.replace(/\/dist-\w+\//, '/'));
      }
      // Nested dist/ (e.g., store/dist/store → store/src/store)
      if (/\/dist\//.test(rawPath)) {
        candidates.push(rawPath.replace(/\/dist\//, '/src/'));
        candidates.push(rawPath.replace(/\/dist\//, '/'));
      }
      // Nested lib/ or build/ or out/
      if (/\/(lib|build|out)\//.test(rawPath)) {
        candidates.push(rawPath.replace(/\/(lib|build|out)\//, '/src/'));
        candidates.push(rawPath.replace(/\/(lib|build|out)\//, '/'));
      }
      return candidates;
    }

    function _tryMatchExportPath(rawPath, pkgDir, pkgName, subpath) {
      const candidates = _distToSrcCandidates(rawPath);
      // Also try src/index fallback when the filename doesn't match
      // e.g., web/storage/dist/storage → web/storage/src/storage (miss) → web/storage/src/index (hit)
      const srcDirs = new Set();
      for (const candidate of candidates) {
        const fullPath = pkgDir ? `${pkgDir}/${candidate}` : candidate;
        const noExt = fullPath.replace(/\.([mc]?[jt]s|[jt]sx)$/, '');
        const matches = allFileNoExt.get(noExt) || allFileNoExt.get(fullPath + '/index') || allFileNoExt.get(noExt + '/index') || [];
        for (const fp of matches) {
          if (!entryPointFiles.has(fp)) {
            entryPointFiles.add(fp);
            results.entryPoints.push({
              file: fp,
              reason: `Package export: ${pkgName}/${subpath}`,
              isDynamic: false
            });
          }
        }
        if (matches.length > 0) return true;
        // Track parent src directories for fallback
        if (candidate.includes('/src/')) {
          const srcDir = candidate.replace(/\/[^/]+$/, '');
          srcDirs.add(srcDir);
        }
      }
      // Fallback: try src/index in the mapped directory
      for (const srcDir of srcDirs) {
        const indexPath = pkgDir ? `${pkgDir}/${srcDir}/index` : `${srcDir}/index`;
        const matches = allFileNoExt.get(indexPath) || [];
        for (const fp of matches) {
          if (!entryPointFiles.has(fp)) {
            entryPointFiles.add(fp);
            results.entryPoints.push({
              file: fp,
              reason: `Package export: ${pkgName}/${subpath}`,
              isDynamic: false
            });
          }
        }
        if (matches.length > 0) return true;
      }
      return false;
    }

    for (const [pkgName, pkg] of wpkgs) {
      // Process primary exports from exportsMap
      if (pkg.exportsMap?.size > 0) {
        for (const [subpath, rawPath] of pkg.exportsMap) {
          _tryMatchExportPath(rawPath, pkg.dir, pkgName, subpath);
        }
      }

      // Also collect ALL conditional export paths (different conditions may point to different files)
      // e.g., Solid: { browser: { import: "./dist/solid.js" }, node: { import: "./dist/server.js" } }
      const pkgJsonPath = (0,external_path_.join)(projectPath, pkg.dir, 'package.json');
      try {
        const pkgJson = JSON.parse((0,external_fs_.readFileSync)(pkgJsonPath, 'utf-8'));
        if (pkgJson.exports && typeof pkgJson.exports === 'object') {
          for (const [subpath, target] of Object.entries(pkgJson.exports)) {
            if (typeof target !== 'object' || target === null) continue;
            const allPaths = _collectAllExportPaths(target);
            for (const exportPath of allPaths) {
              if (typeof exportPath === 'string' && !exportPath.endsWith('.d.ts') && !exportPath.endsWith('.d.mts') && !exportPath.endsWith('.d.cts')) {
                const rawPath = exportPath.replace(/^\.\//, '').replace(/\.(c|m)?js$/, '').replace(/\.d\.(c|m)?ts$/, '');
                _tryMatchExportPath(rawPath, pkg.dir, pkgName, subpath.replace(/^\.\//, '') || '.');
              }
            }
          }
        }
      } catch { /* ignore */ }
    }
    // Also process root package.json subpath exports (non-workspace single packages like hono)
    // e.g., hono's package.json has exports: { "./jsx/dom": { import: "./dist/jsx/dom/index.js" } }
    // which should map to src/jsx/dom/index.ts as an entry point
    const rootPkgJsonPath = (0,external_path_.join)(projectPath, 'package.json');
    try {
      const rootPkgJson = JSON.parse((0,external_fs_.readFileSync)(rootPkgJsonPath, 'utf-8'));
      if (rootPkgJson.exports && typeof rootPkgJson.exports === 'object') {
        for (const [subpath, target] of Object.entries(rootPkgJson.exports)) {
          if (subpath === '.' || subpath === './package.json') continue;
          const allPaths = _collectAllExportPaths(target);
          for (const exportPath of allPaths) {
            if (typeof exportPath === 'string' && !exportPath.endsWith('.d.ts') && !exportPath.endsWith('.d.mts') && !exportPath.endsWith('.d.cts')) {
              const rawPath = exportPath.replace(/^\.\//, '').replace(/\.(c|m)?js$/, '').replace(/\.d\.(c|m)?ts$/, '');
              _tryMatchExportPath(rawPath, '', rootPkgJson.name || '<root>', subpath.replace(/^\.\//, '') || '.');
            }
          }
        }
      }
    } catch { /* ignore — no root package.json or parse error */ }

    // end exports marking
  }

  // Build the reachability graph from entry points
  // This is the key fix: we walk FROM entry points to find what's actually used
  // Pass projectPath to resolve path aliases like @/ -> src/
  // Note: Use the full analysis (jsAnalysis) for reachability - we need full import graph
  // Also pass C# file references (class instantiation, extension methods) for .NET projects
  const { reachable: reachableFiles, exportUsageMap } = buildReachableFiles(entryPointFiles, jsAnalysis, projectPath, csharpFileRefs);

  // Build importer count map: for each file, how many unique files import it
  const importerCountMap = new Map();
  for (const [targetFile, usageMap] of exportUsageMap) {
    const importers = new Set();
    for (const [, importerList] of usageMap) {
      if (Array.isArray(importerList)) {
        for (const u of importerList) {
          if (u.importerFile) importers.add(u.importerFile);
        }
      }
    }
    importerCountMap.set(targetFile, importers.size);
  }

  // Use analysisFiles for dead code analysis (excludes generated files)
  const total = analysisFiles.length;

  for (let i = 0; i < analysisFiles.length; i++) {
    const file = analysisFiles[i];
    const filePath = file.file?.relativePath || file.file;

    // Report progress every 2 files and yield to event loop
    if (i % 2 === 0 || i === total - 1) {
      onProgress({ current: i + 1, total, file: filePath });
      await new Promise(resolve => setImmediate(resolve));
    }

    if (!isCodeFile(filePath)) continue;

    results.summary.filesAnalysed++;

    // Skip entry points (already added above)
    if (entryPointFiles.has(filePath)) {
      continue;
    }

    // Check if file is reachable from any entry point
    // This is the correct check - not "is it imported?" but "is it reachable?"
    if (reachableFiles.has(filePath)) {
      // File is reachable - it's live, skip dead file detection
      // (We could still check for unused exports within reachable files,
      // but that's a separate concern from dead FILE detection)
      continue;
    }

    // File is NOT reachable from any entry point - it's a dead file
    // Content was freed (A10) so re-read from disk for the small subset of dead files
    let content = file.content || '';
    if (!content && projectPath) {
      try { content = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, filePath), 'utf-8'); } catch { /* skip */ }
    }
    if (!content) continue;

    // Developer-override: skip files with explicit "keep" comments in the first ~50 lines
    // Matches: DO NOT DELETE, DO NOT REMOVE, KEEP THIS FILE, @preserve
    const head = content.slice(0, 2000);
    if (/\b(DO\s+NOT\s+(DELETE|REMOVE)|KEEP\s+THIS\s+FILE|@preserve)\b/i.test(head)) {
      continue;
    }

    // A8: Skip git history when there are many dead files (>200) to avoid thousands of subprocess forks
    // Only fetch git history for the first 200 dead files (sorted by size later)
    const gitHistory = results.fullyDeadFiles.length < 200
      ? getFileGitHistory(filePath, projectPath)
      : { available: false, reason: 'Skipped for performance (>200 dead files)' };
    const sizeBytes = file.size || content.length;
    const cost = calculateDeadCodeCost(sizeBytes);
    const exports = parseExports(content, filePath);

    // Determine confidence based on available signals
    const dynamicRiskRe = /\b(plugin|middleware|handler|command|hook|loader|strategy|adapter|migration)s?\b/i;
    const hasDynamicRisk = dynamicRiskRe.test(filePath);
    const entryPointCount = results.entryPoints.length;
    const fullyDeadConfidence = 'safe-to-remove';

    // Extract source lines for each export
    const contentLines = content.split('\n');
    const exportsWithSource = exports.map(e => ({
      name: e.name,
      type: e.type,
      line: e.line,
      lineEnd: e.lineEnd,
      status: 'dead',
      sourceLine: e.line && contentLines[e.line - 1] ? contentLines[e.line - 1].trimEnd() : undefined
    }));

    results.fullyDeadFiles.push({
      file: filePath,
      relativePath: filePath,
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      lineCount: contentLines.length,
      status: 'fully-dead',
      reason: 'not-reachable-from-entry-points',
      exports: exportsWithSource,
      gitHistory,
      costImpact: cost,
      summary: {
        totalExports: exports.length,
        deadExports: exports.length,
        liveExports: 0,
        deadBytes: sizeBytes,
        percentDead: 100,
        canDeleteFile: true
      },
      recommendation: {
        action: 'review-for-removal',
        confidence: fullyDeadConfidence,
        safeToRemove: exports.map(e => e.name),
        keep: [],
        verifyFirst: `grep -r "${(0,external_path_.basename)(filePath).replace(/\.[^.]+$/, '')}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.mjs" --include="*.vue" --include="*.html" --include="*.json" --include="*.yaml" --include="*.yml"`,
        reasoning: `File is not reachable from any detected entry point (${entryPointCount} entry points found). ` +
                   `Verify it's not loaded dynamically or referenced in config files before removing.`
      }
    });
    results.summary.totalDeadBytes += sizeBytes;
    results.summary.totalDeadExports += exports.length;
    results.summary.filesWithDeadCode++;
  }

  // Per-export dead export detection for reachable JS/TS/Python files
  const jstspyRegex = /\.([mc]?[jt]s|[jt]sx|py|pyi)$/;
  // Build a quick lookup from jsAnalysis for exports by file path
  const analysisByPath = new Map();
  for (const file of jsAnalysis) {
    const fp = file.file?.relativePath || file.file;
    analysisByPath.set(fp, file);
  }

  for (const file of analysisFiles) {
    const filePath = file.file?.relativePath || file.file;

    // Only JS/TS/Python (other languages don't have per-specifier imports yet)
    if (!jstspyRegex.test(filePath)) continue;
    // Skip unreachable files (already in fullyDeadFiles)
    if (!reachableFiles.has(filePath)) continue;
    // Skip entry points — their exports are the public API
    if (entryPointFiles.has(filePath)) continue;

    const fileExportsList = file.exports || [];
    // Skip files with no exports
    if (fileExportsList.length === 0) continue;

    // Get usage data for this file
    const usage = exportUsageMap.get(filePath);

    // If no usage data at all, the file was reached via a non-tracked path (e.g., Rust mod, glob)
    // Conservative: skip rather than report all as dead
    if (!usage) continue;

    // If file has __ALL__ or * usage, all exports are consumed
    if (usage.has('__ALL__') || usage.has('*')) continue;

    // Check each export
    const liveExports = [];
    const deadExports = [];
    const onlySideEffects = usage.size === 1 && usage.has('__SIDE_EFFECT__');

    // If only side-effect imports, skip — likely CSS/polyfill/setup file
    if (onlySideEffects) continue;

    for (const exp of fileExportsList) {
      // Skip re-exports (they're pass-throughs, not owned by this file)
      if (exp.sourceModule) continue;

      const exportName = exp.name || 'default';
      const importers = usage.get(exportName);

      if (importers && importers.length > 0) {
        liveExports.push({
          name: exportName,
          type: exp.type || 'unknown',
          line: exp.line || 0,
          lineEnd: exp.lineEnd,
          status: 'live',
          importedBy: importers.map(u => u.importerFile)
        });
      } else {
        deadExports.push({
          name: exportName,
          type: exp.type || 'unknown',
          line: exp.line || 0,
          lineEnd: exp.lineEnd,
          status: 'dead',
          importedBy: []
        });
      }
    }

    // Only report files with BOTH live and dead exports
    // If all exports appear dead, it's suspicious (likely FP — framework magic, reflection, etc.)
    if (deadExports.length === 0 || liveExports.length === 0) continue;

    // Read source lines for exports (content was freed at A10, re-read from disk)
    let fileLines = null;
    if (projectPath) {
      try {
        fileLines = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, filePath), 'utf-8').split('\n');
      } catch { /* skip — file may have moved */ }
    }
    if (fileLines) {
      for (const exp of [...liveExports, ...deadExports]) {
        if (exp.line && fileLines[exp.line - 1]) {
          exp.sourceLine = fileLines[exp.line - 1].trimEnd();
        }
      }
    }

    const totalExports = liveExports.length + deadExports.length;
    const sizeBytes = file.size || 0;

    // Confidence: high when live exports have confirmed importers (proves tracking works for this file)
    const liveHaveImporters = liveExports.some(e => e.importedBy?.length > 0);
    const partialConfidence = 'safe-to-remove';

    results.partiallyDeadFiles.push({
      file: filePath,
      relativePath: filePath,
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      lineCount: file.lineCount || file.lines || 0,
      status: 'partially-dead',
      exports: [...liveExports, ...deadExports],
      deadExports: deadExports.map(e => e.name),
      summary: {
        totalExports,
        deadExports: deadExports.length,
        liveExports: liveExports.length,
        percentDead: Math.round((deadExports.length / totalExports) * 100),
        canDeleteFile: false
      },
      recommendation: {
        action: 'remove-dead-exports',
        confidence: partialConfidence,
        safeToRemove: deadExports.map(e => e.name),
        keep: liveExports.map(e => e.name),
        reasoning: `File has ${deadExports.length} unused export(s) out of ${totalExports} total. ` +
                   `Live exports are imported by other files; dead exports have no detected importers.`,
        command: deadExports.map(e => `Remove \`${e.name}\` (line ${e.line})`).join('\n')
      }
    });
    results.summary.totalDeadExports += deadExports.length;
    results.summary.totalLiveExports += liveExports.length;
  }

  // Sort fully dead by impact (size)
  results.fullyDeadFiles.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
  // Sort partially dead by number of dead exports (most first)
  results.partiallyDeadFiles.sort((a, b) => (b.deadExports?.length || 0) - (a.deadExports?.length || 0));

  // Attach importer count map for file history (consumed by scanner/index.mjs, not serialised)
  results.importerCountMap = importerCountMap;

  return results;
}

/**
 * Calculate total dead code size (for backwards compatibility)
 */
function calculateDeadCodeSize(deadCode, jsAnalysis) {
  return deadCode.summary?.totalDeadBytes || 0;
}

/**
 * Enrich a dead code file (for backwards compatibility)
 */
function enrichDeadCodeFile(file, projectPath, jsAnalysis) {
  // Already enriched in findDeadCode
  return file;
}


/* harmony default export */ const deadcode = ({ findDeadCode, calculateDeadCodeSize, enrichDeadCodeFile, findNestedPackageJsons });

;// CONCATENATED MODULE: ./shared/scanner/scan-dead-code.mjs
// src/scanner/scan-dead-code.mjs
// Standalone dead code scanning function — the unified entry point for dead code analysis.
// Replaces both scanner-legacy/index.mjs and the inline scanDeadCodeOnly() in scan-repo-worker.mjs.












const scan_dead_code_filename = (0,external_url_.fileURLToPath)(import.meta.url);
const scan_dead_code_dirname = (0,external_path_.dirname)(scan_dead_code_filename);
const WORKER_PATH = __webpack_require__.ab + "parse-worker.mjs";
const DEFAULT_WORKER_COUNT = parseInt(process.env.SWYNX_WORKERS || '0') || Math.min((0,external_os_.availableParallelism)(), 8);

const CHUNK_THRESHOLD = 10000;  // B3: chunk parsing when file count exceeds this
const CHUNK_SIZE = 5000;        // B3: files per parse chunk

function parallelParse(files, parserType) {
  const maxWorkers = DEFAULT_WORKER_COUNT;
  const workerCount = Math.min(maxWorkers, Math.ceil(files.length / 50));
  if (workerCount <= 1 || files.length < 100) return null;

  return new Promise((resolve) => {
    const chunkSize = Math.ceil(files.length / workerCount);
    let completed = 0;
    const allResults = [];
    let activeWorkers = 0;

    for (let i = 0; i < workerCount; i++) {
      const chunk = files.slice(i * chunkSize, (i + 1) * chunkSize);
      if (chunk.length === 0) continue;
      activeWorkers++;

      const worker = new external_worker_threads_.Worker(__webpack_require__.ab + "parse-worker.mjs", {
        workerData: { files: chunk, parserType }
      });

      worker.on('message', (msg) => {
        if (msg.type === 'batch') {
          // B1: Handle batch messages from worker (intermediate results)
          allResults.push(...msg.results);
        } else if (msg.type === 'done') {
          allResults.push(...msg.results);
          completed++;
          if (completed === activeWorkers) resolve(allResults);
        } else if (msg.type === 'error') {
          completed++;
          if (completed === activeWorkers) resolve(allResults);
        }
      });

      worker.on('error', () => {
        completed++;
        if (completed === activeWorkers) resolve(allResults);
      });
    }
  });
}

/**
 * B3: Chunked parse pipeline — processes files in chunks to cap peak memory.
 * Each chunk goes through parallelParse, results accumulated (without content),
 * then next chunk starts. Previous chunk's worker memory is freed.
 */
async function chunkedParse(files, parserType, onProgress) {
  const allResults = [];
  const totalChunks = Math.ceil(files.length / CHUNK_SIZE);

  for (let c = 0; c < totalChunks; c++) {
    const start = c * CHUNK_SIZE;
    const chunk = files.slice(start, start + CHUNK_SIZE);
    onProgress({ phase: 'parse', message: `Parsing chunk ${c + 1}/${totalChunks} (${chunk.length} files)...` });

    const chunkResults = parallelParse(chunk, parserType);
    if (chunkResults) {
      allResults.push(...await chunkResults);
    } else {
      // Fallback to sequential for small chunks
      const parseFn = parserType === 'javascript' ? javascript.parseJavaScript : parseFile;
      for (const file of chunk) {
        try {
          const result = await parseFn(file);
          if (result) {
            // Strip content like workers do (B2)
            result.content = null;
            allResults.push(result);
          }
        } catch { /* skip */ }
      }
    }
  }
  return allResults;
}

/**
 * Detect language from file extension (for legacy-compatible summary)
 */
function detectLanguage(filePath) {
  if (/\.[mc]?[jt]sx?$/.test(filePath)) return 'javascript';
  if (/\.py$/.test(filePath)) return 'python';
  if (/\.go$/.test(filePath)) return 'go';
  if (/\.(java|kt)$/.test(filePath)) return 'java';
  if (/\.php$/.test(filePath)) return 'php';
  if (/\.rb$/.test(filePath)) return 'ruby';
  if (/\.rs$/.test(filePath)) return 'rust';
  if (/\.cs$/.test(filePath)) return 'csharp';
  if (/\.dart$/.test(filePath)) return 'dart';
  if (/\.swift$/.test(filePath)) return 'swift';
  if (/\.scala$/.test(filePath)) return 'scala';
  if (/\.ex$|\.exs$/.test(filePath)) return 'elixir';
  return 'other';
}

const scan_dead_code_DEFAULT_EXCLUDE = [
  '**/node_modules/**', '**/bower_components/**', '**/.git/**', '**/dist/**', '**/build/**',
  '**/.swynx-quarantine/**', '**/coverage/**', '**/*.min.js', '**/*.min.css',
  '**/logs/**', '**/log/**', '**/*.log',
  '**/tmp/**', '**/temp/**', '**/.cache/**', '**/cache/**',
  '**/__pycache__/**', '**/*.pyc', '**/*.pyo',
  '**/.pytest_cache/**', '**/.mypy_cache/**',
  '**/*.sql', '**/*.sqlite', '**/*.sqlite3', '**/*.db',
  '**/tests/baselines/**', '**/test/baselines/**',
  '**/__snapshots__/**', '**/snapshots/**',
  '**/test-fixtures/**', '**/test_fixtures/**', '**/__fixtures__/**',
  '**/fixtures/**', '**/fixture/**',
  '**/testdata/**', '**/test-data/**',
  '**/vendor/**',
  '**/__mockdata__/**', '**/__mock__/**', '**/__for-testing__/**',
  '**/pkg-tests-fixtures/**', '**/pkg-tests-specs/**',
  '**/type-tests/**', '**/type-test/**',
  // Test fixture / baseline directories (huge in compiler repos)
  '**/TestData/**', '**/testData/**',
  '**/test-cases/**', '**/test_cases/**',
  '**/conformance/**',
  '**/testcases/**',
  // Compiler test input directories
  '**/cases/**/*.ts',
  '**/test/cases/**',
  // IDE/editor test fixtures
  '**/test-fixture/**',
  // C# intermediate / compiled output
  '**/obj/**',
  '**/bin/Debug/**', '**/bin/Release/**',
  // C# scaffolding baselines (test-generated output)
  '**/Scaffolding/Baselines/**',
  // Rust compiler test inputs (standalone files compiled by test harness, not source code)
  '**/tests/ui/**', '**/tests/derive_ui/**', '**/tests/compile-fail/**',
  '**/tests/run-pass/**', '**/tests/run-fail/**', '**/tests/ui-fulldeps/**',
  '**/tests/pretty/**', '**/tests/mir-opt/**', '**/tests/assembly/**',
  '**/tests/codegen/**', '**/tests/debuginfo/**', '**/tests/incremental/**',
  '**/tests/codegen-llvm/**', '**/tests/rustdoc-html/**', '**/tests/crashes/**',
  '**/tests/assembly-llvm/**', '**/tests/rustdoc-ui/**', '**/tests/rustdoc-js/**',
  '**/tests/rustdoc-json/**', '**/tests/codegen-units/**', '**/tests/coverage-run-rustdoc/**',
  // Cypress/E2E system test fixture projects (standalone apps used as test targets)
  '**/system-tests/projects/**', '**/system-tests/project-fixtures/**',
  // RustPython test snippet inputs
  '**/extra_tests/snippets/**',
  // Python stdlib copies (RustPython, cpython)
  '**/Lib/encodings/**',
  // Python vendored third-party code
  '**/_vendor/**', '**/_distutils/**',
  // Compiled/bundled static assets (Phoenix/Elixir)
  '**/static/assets/**',
  // Generated protobuf/gRPC output directories
  '**/gen/proto/**',
];

/**
 * Standalone dead code scan.
 *
 * @param {string} projectPath - Absolute path to the project root
 * @param {Object} [options]
 * @param {string[]} [options.exclude] - Glob patterns to exclude
 * @param {number}  [options.workers] - Max parallel parse workers
 * @param {Function} [options.onProgress] - Progress callback ({ phase, message })
 * @returns {Promise<Object>} Result with both legacy-compatible and full-scanner fields
 */
async function scanDeadCode(projectPath, options = {}) {
  const { exclude = scan_dead_code_DEFAULT_EXCLUDE, onProgress = () => {} } = options;
  const t0 = Date.now();

  // Phase 1: Discover files
  onProgress({ phase: 'discovery', message: 'Discovering files...' });
  const files = await discoverFiles(projectPath, { exclude });
  const categorised = categoriseFiles(files);
  const totalFiles = files.length;
  onProgress({ phase: 'discovery', message: `${totalFiles} files discovered` });

  // Phase 2: Parse JS/TS — use chunked pipeline for large repos
  onProgress({ phase: 'parse', message: `Parsing ${categorised.javascript.length} JS/TS files...` });
  const jsFiles = categorised.javascript;
  let jsAnalysis;
  if (jsFiles.length > CHUNK_THRESHOLD) {
    // B3: Chunked parse for truly massive repos
    jsAnalysis = await chunkedParse(jsFiles, 'javascript', onProgress);
  } else {
    const jsParallel = parallelParse(jsFiles, 'javascript');
    if (jsParallel) {
      jsAnalysis = await jsParallel;
    } else {
      jsAnalysis = [];
      for (const file of jsFiles) {
        jsAnalysis.push(await (0,javascript.parseJavaScript)(file));
      }
    }
  }
  onProgress({ phase: 'parse', message: `Parsed ${jsAnalysis.length} JS/TS files` });

  // Phase 3: Parse other languages
  const otherLangFiles = [
    ...categorised.python || [],
    ...categorised.java || [],
    ...categorised.kotlin || [],
    ...categorised.csharp || [],
    ...categorised.go || [],
    ...categorised.rust || []
  ];
  const otherLangAnalysis = [];
  if (otherLangFiles.length > 0) {
    onProgress({ phase: 'parse', message: `Parsing ${otherLangFiles.length} other-language files...` });
    if (otherLangFiles.length > CHUNK_THRESHOLD) {
      // B3: Chunked parse for large non-JS repos
      otherLangAnalysis.push(...await chunkedParse(otherLangFiles, 'other', onProgress));
    } else {
      const otherParallel = parallelParse(otherLangFiles, 'other');
      if (otherParallel) {
        otherLangAnalysis.push(...await otherParallel);
      } else {
        for (const file of otherLangFiles) {
          try {
            const parsed = await parseFile(file);
            if (parsed) otherLangAnalysis.push(parsed);
          } catch { /* skip */ }
        }
      }
    }
    onProgress({ phase: 'parse', message: `Parsed ${otherLangAnalysis.length} other-language files` });
  }

  // Phase 4: Build import graph
  onProgress({ phase: 'graph', message: 'Building import graph...' });
  const importGraph = await analyseImports(jsAnalysis);

  // Phase 5: Find dead code
  onProgress({ phase: 'detection', message: 'Detecting dead code...' });
  let packageJson = {};
  try {
    packageJson = JSON.parse((0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, 'package.json'), 'utf-8'));
  } catch { /* no package.json */ }

  const allCodeAnalysis = [...jsAnalysis, ...otherLangAnalysis];
  const deadCode = await findDeadCode(allCodeAnalysis, importGraph, projectPath, packageJson, {});

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  onProgress({ phase: 'done', message: `Done in ${elapsed}s` });

  // Build deadFiles array — ONLY fully dead files (safe to delete)
  const deadFiles = (deadCode.fullyDeadFiles || []).map(f => ({
    file: f.file,
    size: f.sizeBytes || f.size || 0,
    lines: f.lineCount || f.lines || 0,
    language: f.language || detectLanguage(f.file),
    exports: (f.exports || []).map(e => typeof e === 'string' ? { name: e, type: 'unknown' } : e),
    partial: false,
  }));

  // Build partiallyDeadFiles array — files with some unused exports (NOT safe to delete)
  const partialFiles = (deadCode.partiallyDeadFiles || []).map(f => ({
    file: f.file,
    size: f.sizeBytes || f.size || 0,
    lines: f.lineCount || f.lines || 0,
    language: f.language || detectLanguage(f.file),
    exports: (f.exports || []).map(e => typeof e === 'string' ? { name: e, type: 'unknown' } : e),
    deadExports: f.deadExports || [],
    partial: true,
  }));

  // Sort by size descending
  deadFiles.sort((a, b) => b.size - a.size);
  partialFiles.sort((a, b) => b.size - a.size);

  // Build language counts from all discovered files
  const languages = {};
  for (const file of files) {
    const rel = typeof file === 'string' ? file : file.relativePath || file;
    const lang = detectLanguage(rel);
    if (lang !== 'other') {
      languages[lang] = (languages[lang] || 0) + 1;
    }
  }

  const deadCount = deadFiles.length;
  const deadRate = totalFiles > 0 ? ((deadCount / totalFiles) * 100).toFixed(2) : '0.00';
  const totalDeadBytes = deadFiles.reduce((sum, f) => sum + f.size, 0);

  return {
    // Dead files (fully dead — safe to delete)
    deadFiles,
    // Partially dead files (have unused exports — NOT safe to delete)
    partialFiles,
    entryPoints: deadCode.entryPoints || [],
    summary: {
      totalFiles,
      entryPoints: (deadCode.entryPoints || []).length,
      reachableFiles: totalFiles - deadCount - (deadCode.entryPoints || []).length,
      deadFiles: deadCount,
      partialFiles: partialFiles.length,
      deadRate: `${deadRate}%`,
      totalDeadBytes,
      languages
    },

    // Full scanner fields (richer detail)
    fullyDeadFiles: deadCode.fullyDeadFiles || [],
    partiallyDeadFiles: deadCode.partiallyDeadFiles || [],
    skippedDynamic: deadCode.skippedDynamic || [],
    excludedGenerated: deadCode.excludedGenerated || [],

    // Metadata
    elapsed,
    totalFiles
  };
}


/***/ })

};
