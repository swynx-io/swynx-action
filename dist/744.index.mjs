export const id = 744;
export const ids = [744];
export const modules = {

/***/ 4744:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  scanCodePatterns: () => (/* binding */ scanCodePatterns)
});

// UNUSED EXPORTS: enrichDeadFileWithPatterns, scanDeadCodePatterns

// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(6928);
// EXTERNAL MODULE: external "fs"
var external_fs_ = __webpack_require__(9896);
;// CONCATENATED MODULE: ./shared/security/patterns.mjs
// src/security/patterns.mjs
// CWE pattern definitions for security analysis across all code

/**
 * CWE patterns for detecting dangerous code patterns.
 * Each pattern has: id, cwe, cweName, severity, pattern (RegExp), description, risk, languages (empty = all)
 */
const CWE_PATTERNS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-78: OS Command Injection
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-78-exec',
    cwe: 'CWE-78',
    cweName: 'OS Command Injection',
    severity: 'CRITICAL',
    pattern: /child_process\.(exec|execSync)\s*\(/,
    description: 'child_process.exec() with potential command injection',
    risk: 'Dead code with command execution could be revived without security review',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-78-spawn-shell',
    cwe: 'CWE-78',
    cweName: 'OS Command Injection',
    severity: 'CRITICAL',
    pattern: /child_process\.spawn\s*\([^)]*shell\s*:\s*true/,
    description: 'child_process.spawn() with shell: true',
    risk: 'Shell mode spawn in dead code enables injection if revived',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-78-os-system',
    cwe: 'CWE-78',
    cweName: 'OS Command Injection',
    severity: 'CRITICAL',
    pattern: /os\.system\s*\(|subprocess\.(Popen|call|run)\s*\(/,
    description: 'Python OS command execution',
    risk: 'Dead code with system calls could be revived without security review',
    languages: ['py']
  },
  {
    id: 'CWE-78-go-exec',
    cwe: 'CWE-78',
    cweName: 'OS Command Injection',
    severity: 'CRITICAL',
    pattern: /exec\.Command\s*\(/,
    description: 'Go exec.Command() call',
    risk: 'Dead code with command execution could be revived without security review',
    languages: ['go']
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-94: Code Injection
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-94-eval',
    cwe: 'CWE-94',
    cweName: 'Code Injection',
    severity: 'CRITICAL',
    pattern: /\beval\s*\(/,
    description: 'eval() with dynamic code execution',
    risk: 'Dead eval() could be exploited if code is revived or imported',
    languages: ['js', 'ts', 'py']
  },
  {
    id: 'CWE-94-new-function',
    cwe: 'CWE-94',
    cweName: 'Code Injection',
    severity: 'CRITICAL',
    pattern: /new\s+Function\s*\(/,
    description: 'new Function() constructor for dynamic code',
    risk: 'Dynamic function creation in dead code increases attack surface',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-94-vm-run',
    cwe: 'CWE-94',
    cweName: 'Code Injection',
    severity: 'CRITICAL',
    pattern: /vm\.(runInNewContext|runInThisContext|runInContext|compileFunction)\s*\(/,
    description: 'Node.js vm module execution',
    risk: 'VM context execution in dead code is a sandbox escape risk',
    languages: ['js', 'ts']
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-798: Hardcoded Credentials
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-798-password',
    cwe: 'CWE-798',
    cweName: 'Hardcoded Credentials',
    severity: 'CRITICAL',
    pattern: /(password|passwd|secret|api_key|apikey|api_secret)\s*[:=]\s*["'][^"']{4,}/i,
    description: 'Hardcoded password or secret',
    risk: 'Credentials in dead code are often forgotten and exposed in version control',
    languages: []
  },
  {
    id: 'CWE-798-aws-key',
    cwe: 'CWE-798',
    cweName: 'Hardcoded Credentials',
    severity: 'CRITICAL',
    pattern: /AKIA[0-9A-Z]{16}/,
    description: 'AWS Access Key ID',
    risk: 'AWS credentials in dead code may still be active',
    languages: []
  },
  {
    id: 'CWE-798-private-key',
    cwe: 'CWE-798',
    cweName: 'Hardcoded Credentials',
    severity: 'CRITICAL',
    pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/,
    description: 'Embedded private key',
    risk: 'Private keys in dead code are often overlooked during rotation',
    languages: []
  },
  {
    id: 'CWE-798-openai-key',
    cwe: 'CWE-798',
    cweName: 'Hardcoded Credentials',
    severity: 'HIGH',
    pattern: /sk-[a-zA-Z0-9]{20,}/,
    description: 'Potential API key (sk-... pattern)',
    risk: 'API keys in dead code may remain active and billable',
    languages: []
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-22: Path Traversal
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-22-path-join-params',
    cwe: 'CWE-22',
    cweName: 'Path Traversal',
    severity: 'HIGH',
    pattern: /path\.join\s*\([^)]*req\.(params|query|body)/,
    description: 'path.join with user input from request',
    risk: 'Path traversal in dead code could be revived as a file access vulnerability',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-22-readfile-params',
    cwe: 'CWE-22',
    cweName: 'Path Traversal',
    severity: 'HIGH',
    pattern: /(readFile|readFileSync|createReadStream)\s*\([^)]*req\.(params|query|body)/,
    description: 'File read with user-controlled path',
    risk: 'Unvalidated file read in dead code is a path traversal risk if revived',
    languages: ['js', 'ts']
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-502: Unsafe Deserialization
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-502-pickle',
    cwe: 'CWE-502',
    cweName: 'Unsafe Deserialization',
    severity: 'HIGH',
    pattern: /pickle\.(load|loads)\s*\(/,
    description: 'Python pickle deserialization',
    risk: 'pickle.load() in dead code can execute arbitrary code if revived',
    languages: ['py']
  },
  {
    id: 'CWE-502-yaml-load',
    cwe: 'CWE-502',
    cweName: 'Unsafe Deserialization',
    severity: 'HIGH',
    pattern: /yaml\.load\s*\([^)]*(?!Loader\s*=\s*yaml\.SafeLoader)/,
    description: 'yaml.load() without SafeLoader',
    risk: 'Unsafe YAML loading in dead code can execute arbitrary code',
    languages: ['py']
  },
  {
    id: 'CWE-502-unserialize',
    cwe: 'CWE-502',
    cweName: 'Unsafe Deserialization',
    severity: 'HIGH',
    pattern: /\bunserialize\s*\(/,
    description: 'PHP unserialize() call',
    risk: 'Unsafe deserialization in dead code enables object injection if revived',
    languages: ['php']
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-79: Cross-Site Scripting (XSS)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-79-innerhtml',
    cwe: 'CWE-79',
    cweName: 'Cross-Site Scripting',
    severity: 'HIGH',
    pattern: /\.innerHTML\s*=/,
    description: 'Direct innerHTML assignment',
    risk: 'innerHTML in dead code could introduce XSS if component is re-enabled',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-79-dangerously',
    cwe: 'CWE-79',
    cweName: 'Cross-Site Scripting',
    severity: 'HIGH',
    pattern: /dangerouslySetInnerHTML/,
    description: 'React dangerouslySetInnerHTML',
    risk: 'Dangerous React prop in dead component could introduce XSS if revived',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-79-document-write',
    cwe: 'CWE-79',
    cweName: 'Cross-Site Scripting',
    severity: 'HIGH',
    pattern: /document\.write\s*\(/,
    description: 'document.write() call',
    risk: 'document.write in dead code bypasses CSP if revived',
    languages: ['js', 'ts']
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-327: Broken Cryptography
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-327-md5',
    cwe: 'CWE-327',
    cweName: 'Broken Cryptography',
    severity: 'MEDIUM',
    pattern: /createHash\s*\(\s*['"]md5['"]\s*\)/,
    description: 'MD5 hash usage',
    risk: 'Weak hash in dead code may be copied to new code without upgrading',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-327-sha1',
    cwe: 'CWE-327',
    cweName: 'Broken Cryptography',
    severity: 'MEDIUM',
    pattern: /hashlib\.(md5|sha1)\s*\(/,
    description: 'Python weak hash algorithm',
    risk: 'Weak hash in dead code may be copied to new code without upgrading',
    languages: ['py']
  },
  {
    id: 'CWE-327-des-rc4',
    cwe: 'CWE-327',
    cweName: 'Broken Cryptography',
    severity: 'MEDIUM',
    pattern: /createCipher(iv)?\s*\(\s*['"](des|rc4|des-ede|des-ede3)['"]/i,
    description: 'Weak cipher algorithm (DES/RC4)',
    risk: 'Broken cipher in dead code sets bad precedent if used as reference',
    languages: ['js', 'ts']
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-918: Server-Side Request Forgery (SSRF)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-918-fetch-params',
    cwe: 'CWE-918',
    cweName: 'Server-Side Request Forgery',
    severity: 'HIGH',
    pattern: /fetch\s*\(\s*req\.(params|query|body)/,
    description: 'fetch() with user-controlled URL',
    risk: 'SSRF in dead code could be revived to access internal services',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-918-requests-dynamic',
    cwe: 'CWE-918',
    cweName: 'Server-Side Request Forgery',
    severity: 'MEDIUM',
    pattern: /requests\.(get|post|put|delete)\s*\(\s*f?["']/,
    description: 'Python requests with potentially dynamic URL',
    risk: 'Outbound requests in dead code may target internal services if revived',
    languages: ['py']
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CWE-200: Information Exposure
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'CWE-200-console-sensitive',
    cwe: 'CWE-200',
    cweName: 'Information Exposure',
    severity: 'LOW',
    pattern: /console\.(log|debug|info)\s*\([^)]*\b(password|secret|token|key|credential)/i,
    description: 'Logging potentially sensitive data',
    risk: 'Sensitive data logging in dead code may leak if code is re-enabled',
    languages: ['js', 'ts']
  },
  {
    id: 'CWE-200-stack-trace',
    cwe: 'CWE-200',
    cweName: 'Information Exposure',
    severity: 'LOW',
    pattern: /res\.(send|json)\s*\(\s*(err|error)\.(stack|message)/,
    description: 'Stack trace exposure in response',
    risk: 'Error detail exposure in dead endpoint leaks info if route is re-enabled',
    languages: ['js', 'ts']
  }
];

/**
 * Extension to language mapping
 */
const EXT_TO_LANG = {
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.jsx': 'js',
  '.ts': 'ts',
  '.tsx': 'ts',
  '.mts': 'ts',
  '.cts': 'ts',
  '.py': 'py',
  '.go': 'go',
  '.php': 'php',
  '.rb': 'rb',
  '.java': 'java',
  '.kt': 'kt',
  '.kts': 'kt',
  '.cs': 'cs',
  '.rs': 'rs',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp'
};

/**
 * Get CWE patterns applicable to a file extension.
 * Returns all language-agnostic patterns plus language-specific ones.
 */
function getPatternsForLanguage(ext) {
  const lang = EXT_TO_LANG[ext];

  return CWE_PATTERNS.filter(p => {
    // Language-agnostic patterns apply to all files
    if (p.languages.length === 0) return true;
    // No mapping for this extension — only return language-agnostic
    if (!lang) return false;
    // JS and TS share patterns
    if ((lang === 'js' || lang === 'ts') && (p.languages.includes('js') || p.languages.includes('ts'))) return true;
    return p.languages.includes(lang);
  });
}

;// CONCATENATED MODULE: ./shared/security/proximity.mjs
// src/security/proximity.mjs
// Path proximity detection for security-critical directories

const PROXIMITY_PATTERNS = [
  // Authentication
  { pattern: /[/\\]auth[/\\]/i, category: 'authentication', boost: 'CRITICAL' },
  { pattern: /[/\\]login[/\\]/i, category: 'authentication', boost: 'CRITICAL' },
  { pattern: /[/\\]oauth[/\\]/i, category: 'authentication', boost: 'CRITICAL' },
  { pattern: /[/\\]sso[/\\]/i, category: 'authentication', boost: 'CRITICAL' },

  // Cryptography
  { pattern: /[/\\]crypto[/\\]/i, category: 'cryptography', boost: 'CRITICAL' },
  { pattern: /[/\\]encryption[/\\]/i, category: 'cryptography', boost: 'CRITICAL' },

  // Sandbox / isolation
  { pattern: /[/\\]sandbox[/\\]/i, category: 'sandbox', boost: 'CRITICAL' },
  { pattern: /[/\\]task-runner[/\\]/i, category: 'sandbox', boost: 'CRITICAL' },

  // Webhooks
  { pattern: /[/\\]webhook[s]?[/\\]/i, category: 'webhooks', boost: 'HIGH' },

  // API
  { pattern: /[/\\]api[/\\]/i, category: 'api', boost: 'MEDIUM' },
  { pattern: /[/\\]graphql[/\\]/i, category: 'api', boost: 'MEDIUM' },

  // Admin
  { pattern: /[/\\]admin[/\\]/i, category: 'admin', boost: 'HIGH' },

  // Payment / billing
  { pattern: /[/\\]payment[s]?[/\\]/i, category: 'payment', boost: 'CRITICAL' },
  { pattern: /[/\\]billing[/\\]/i, category: 'payment', boost: 'HIGH' },
  { pattern: /[/\\]checkout[/\\]/i, category: 'payment', boost: 'HIGH' },

  // Middleware
  { pattern: /[/\\]middleware[/\\]/i, category: 'middleware', boost: 'MEDIUM' },

  // Access control
  { pattern: /[/\\]rbac[/\\]/i, category: 'access-control', boost: 'CRITICAL' },
  { pattern: /[/\\]acl[/\\]/i, category: 'access-control', boost: 'HIGH' },
  { pattern: /[/\\]permissions?[/\\]/i, category: 'access-control', boost: 'HIGH' },

  // Tokens / JWT
  { pattern: /[/\\]jwt[/\\]/i, category: 'tokens', boost: 'CRITICAL' },
  { pattern: /[/\\]tokens?[/\\]/i, category: 'tokens', boost: 'HIGH' },

  // File upload
  { pattern: /[/\\]upload[s]?[/\\]/i, category: 'file-upload', boost: 'HIGH' },

  // Secrets
  { pattern: /[/\\]secrets?[/\\]/i, category: 'secrets', boost: 'CRITICAL' }
];

const BOOST_RANK = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };

/**
 * Check if a file path is in a security-critical directory.
 * Returns { isCritical, matches: [{category, boost}], highestBoost }
 */
function proximity_checkProximity(filePath) {
  const matches = [];

  for (const { pattern, category, boost } of PROXIMITY_PATTERNS) {
    if (pattern.test(filePath)) {
      matches.push({ category, boost });
    }
  }

  if (matches.length === 0) {
    return { isCritical: false, matches: [], highestBoost: null };
  }

  let highestBoost = matches[0].boost;
  for (let i = 1; i < matches.length; i++) {
    if (BOOST_RANK[matches[i].boost] > BOOST_RANK[highestBoost]) {
      highestBoost = matches[i].boost;
    }
  }

  return {
    isCritical: highestBoost === 'CRITICAL',
    matches,
    highestBoost
  };
}

;// CONCATENATED MODULE: ./shared/security/scanner.mjs
// src/security/scanner.mjs
// Full-codebase security pattern scanner
// Scans ALL files for dangerous code patterns (CWE) and proximity to security-critical paths
// Flags each finding with whether it's in dead code or live code







const SEVERITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Check if a line is a comment (basic heuristic)
 */
function isCommentLine(line) {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('"""') ||
    trimmed.startsWith("'''")
  );
}

/**
 * Check if a line contains example/documentation content rather than real code.
 * Prevents false positives in marketing pages, docs, and code examples rendered as UI text.
 */
function isExampleContent(line, prevLine) {
  // Well-known example AWS credentials (explicitly not real secrets)
  if (/AKIAIOSFODNN7EXAMPLE/.test(line)) return true;
  // Lines with JSX className= are UI markup, not executable code
  if (/className\s*=/.test(line)) return true;
  // Text content on the line immediately after an opening JSX/HTML tag
  // e.g. <div className="...">  followed by  eval(userInput) at handler.ts:42
  if (prevLine && /^\s*<[A-Za-z][A-Za-z0-9.]*\b.*[^/]>\s*$/.test(prevLine)) return true;
  // JSON-LD structured data — standard React SEO pattern, not an XSS risk
  if (prevLine && /application\/ld\+json/.test(prevLine)) return true;
  return false;
}

/**
 * Boost severity when file is in a security-critical directory
 */
function boostSeverity(severity, proximityBoost) {
  if (!proximityBoost) return severity;
  const rank = SEVERITY_RANK[severity] || 1;
  const boostRank = SEVERITY_RANK[proximityBoost] || 1;
  // If proximity boost is higher, escalate one level (up to CRITICAL)
  if (boostRank >= rank && severity !== 'CRITICAL') {
    const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const idx = levels.indexOf(severity);
    return levels[Math.min(idx + 1, 3)];
  }
  return severity;
}

/**
 * Scan a single file's content for CWE patterns.
 * Returns array of findings for this file.
 */
function scanFileContent(filePath, content, proximity) {
  const ext = (0,external_path_.extname)(filePath);
  const patterns = getPatternsForLanguage(ext);
  if (patterns.length === 0) return [];

  const lines = content.split('\n');
  const fileFindings = [];

  let inTemplateLiteral = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (isCommentLine(line)) continue;

    // Track multi-line template literal state — content inside
    // multi-line backtick strings is string data, not executable code
    const backticks = (line.match(/(?<!\\)`/g) || []).length;
    if (backticks % 2 === 1) inTemplateLiteral = !inTemplateLiteral;

    // Skip lines inside multi-line template literals (code examples, UI text)
    if (inTemplateLiteral && backticks === 0) continue;

    // Skip known example/documentation content
    if (isExampleContent(line, lineIdx > 0 ? lines[lineIdx - 1] : '')) continue;

    for (const pattern of patterns) {
      if (pattern.pattern.test(line)) {
        const severity = boostSeverity(pattern.severity, proximity.highestBoost);

        fileFindings.push({
          id: pattern.id,
          cwe: pattern.cwe,
          cweName: pattern.cweName,
          severity,
          originalSeverity: pattern.severity,
          boosted: severity !== pattern.severity,
          file: filePath,
          line: lineIdx + 1,
          lineContent: line.trim().substring(0, 120),
          description: pattern.description,
          risk: pattern.risk,
          proximity: proximity.matches.length > 0 ? proximity : null
        });

        // Only match each pattern once per line
        break;
      }
    }
  }

  return fileFindings;
}

/**
 * Scan ALL code files for dangerous CWE patterns and proximity alerts.
 * Each finding is flagged with isDead (true = dead code, false = live code).
 *
 * @param {Array} allCodeAnalysis - Combined JS + other language analysis
 * @param {Set<string>} deadFileSet - Set of relative paths that are dead code
 * @param {string} [projectPath] - Project root for re-reading content from disk
 * @param {Function} [onProgress] - Optional progress callback
 * @returns {{ summary, findings, byCWE, byFile, proximityAlerts }}
 */
function scanCodePatterns(allCodeAnalysis, deadFileSet, projectPath, onProgress) {
  const findings = [];
  const byCWE = {};
  const byFile = {};
  const proximityAlerts = [];

  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let inDeadCode = 0;
  let inLiveCode = 0;

  for (let i = 0; i < allCodeAnalysis.length; i++) {
    const file = allCodeAnalysis[i];
    const filePath = file.file?.relativePath || file.file || file.relativePath || file.path || '';
    if (!filePath) continue;

    if (onProgress && i % 200 === 0) {
      onProgress({
        phase: 'Scanning security patterns',
        detail: filePath.split('/').pop(),
        current: i,
        total: allCodeAnalysis.length
      });
    }

    // Check proximity
    const proximity = proximity_checkProximity(filePath);
    if (proximity.isCritical || proximity.matches.length > 0) {
      proximityAlerts.push({
        file: filePath,
        isDead: deadFileSet.has(filePath),
        ...proximity
      });
    }

    // Get content — try from analysis object first, then re-read from disk
    let content = file.content || '';
    if (!content && projectPath) {
      try { content = (0,external_fs_.readFileSync)((0,external_path_.join)(projectPath, filePath), 'utf-8'); } catch { /* skip */ }
    }
    if (!content) continue;

    const isDead = deadFileSet.has(filePath);
    const fileFindings = scanFileContent(filePath, content, proximity);

    for (const finding of fileFindings) {
      finding.isDead = isDead;
      finding.recommendation = isDead
        ? 'File is dead code — safe to remove'
        : 'Review and remediate';

      findings.push(finding);
      severityCounts[finding.severity]++;

      if (isDead) inDeadCode++;
      else inLiveCode++;

      // Track by CWE
      if (!byCWE[finding.cwe]) {
        byCWE[finding.cwe] = { cwe: finding.cwe, name: finding.cweName, findings: [] };
      }
      byCWE[finding.cwe].findings.push(finding);
    }

    if (fileFindings.length > 0) {
      byFile[filePath] = fileFindings;
    }
  }

  // Sort findings by severity (CRITICAL first), then dead code last (live findings more urgent)
  findings.sort((a, b) => {
    const sevDiff = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    // Live code findings first (more urgent)
    return (a.isDead ? 1 : 0) - (b.isDead ? 1 : 0);
  });

  return {
    summary: {
      total: findings.length,
      inDeadCode,
      inLiveCode,
      critical: severityCounts.CRITICAL,
      high: severityCounts.HIGH,
      medium: severityCounts.MEDIUM,
      low: severityCounts.LOW,
      filesWithPatterns: Object.keys(byFile).length,
      proximityAlerts: proximityAlerts.length,
      cweCategories: Object.keys(byCWE).length,
      // Backwards compat
      totalFindings: findings.length
    },
    findings,
    byCWE,
    byFile,
    proximityAlerts
  };
}

/**
 * Backwards-compatible wrapper — scans only dead code files.
 * Used when deadFileSet isn't available (e.g., from older callers).
 */
function scanDeadCodePatterns(deadCode, allCodeAnalysis, onProgress) {
  const deadFiles = [
    ...(deadCode.fullyDeadFiles || []),
    ...(deadCode.partiallyDeadFiles || [])
  ];
  const deadFileSet = new Set(deadFiles.map(f => f.relativePath || f.file || f.path || ''));

  // Scan only dead files for backwards compatibility
  const deadAnalysis = allCodeAnalysis.filter(f => {
    const fp = f.file?.relativePath || f.file || f.relativePath || f.path || '';
    return deadFileSet.has(fp);
  });

  return scanCodePatterns(deadAnalysis, deadFileSet, null, onProgress);
}

/**
 * Enrich a dead file object with its security pattern findings.
 * Adds `securityPatterns` field for per-file drill-down.
 */
function enrichDeadFileWithPatterns(deadFile, byFile) {
  const filePath = deadFile.relativePath || deadFile.file || deadFile.path || '';
  const fileFindings = byFile[filePath];

  if (!fileFindings || fileFindings.length === 0) {
    return deadFile;
  }

  const proximity = checkProximity(filePath);

  return {
    ...deadFile,
    securityPatterns: {
      count: fileFindings.length,
      findings: fileFindings,
      proximity: proximity.matches.length > 0 ? proximity : null
    }
  };
}


/***/ })

};
