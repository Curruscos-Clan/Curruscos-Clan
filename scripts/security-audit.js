#!/usr/bin/env node
/**
 * Static pre-deploy audit for Curruscos Clan.
 *
 * This is a heuristic guardrail, not a substitute for reviewing effective
 * Supabase policies, testing with real roles, or a full WCAG/security audit.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next']);
const findings = { errors: 0, warnings: 0 };

function walk(dir, accept) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) files.push(...walk(path.join(dir, entry.name), accept));
    } else if (entry.isFile() && accept(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function report(level, message) {
  findings[level]++;
  const prefix = level === 'errors' ? 'ERROR' : 'WARN';
  console.log(`[${prefix}] ${message}`);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function getAttr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function auditHtml() {
  const htmlFiles = walk(ROOT, name => name.toLowerCase().endsWith('.html'));
  let imagesChecked = 0;
  let buttonsChecked = 0;

  for (const file of htmlFiles) {
    const relative = path.relative(ROOT, file);
    const source = read(file).replace(/<!--[\s\S]*?-->/g, '');

    for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
      imagesChecked++;
      const tag = match[0];
      // Empty alt is valid for decorative images; a non-empty alt is required
      // for informative images. We can detect missing alt, not judge its quality.
      if (getAttr(tag, 'alt') === null) {
        report('warnings', `${relative}: <img> sin atributo alt.`);
      }
    }

    const idsWithLabels = new Set();
    const namedControlsInsideLabels = new Set();
    for (const labelMatch of source.matchAll(/<label\\b([^>]*)>([\\s\\S]*?)<\\/label\\s*>/gi)) {
      const labelTag = '<label' + labelMatch[1] + '>';
      const forId = getAttr(labelTag, 'for');
      if (forId) idsWithLabels.add(forId);
      for (const nested of labelMatch[2].matchAll(/<(input|select|textarea)\\b([^>]*)>/gi)) {
        const nestedTag = '<' + nested[1] + nested[2] + '>';
        const nestedId = getAttr(nestedTag, 'id');
        const nestedName = getAttr(nestedTag, 'name');
        if (nestedId) idsWithLabels.add(nestedId);
        else if (nestedName) namedControlsInsideLabels.add(nested[1].toLowerCase() + ':' + nestedName);
      }
    }

    for (const match of source.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
      const tagName = match[1].toLowerCase();
      const openingTag = '<' + match[1] + match[2] + '>';
      const type = (getAttr(openingTag, 'type') || '').toLowerCase();
      if (tagName === 'input' && ['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
      const id = getAttr(openingTag, 'id');
      const name = getAttr(openingTag, 'name');
      const ariaLabel = getAttr(openingTag, 'aria-label');
      const labelledBy = getAttr(openingTag, 'aria-labelledby');
      if (!(ariaLabel && ariaLabel.trim()) && !(labelledBy && labelledBy.trim()) && !(id && idsWithLabels.has(id)) &&
          !(name && namedControlsInsideLabels.has(tagName + ':' + name))) {
        report('warnings', relative + ': <' + tagName + '> sin etiqueta asociada detectable (placeholder por sí solo no cuenta).');
      }
    }

    for (const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
      const openingTag = '<a' + match[1] + '>';
      const inner = match[2];
      const innerText = inner.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').trim();
      const hasImageAlt = [...inner.matchAll(/<img\b[^>]*>/gi)].some(imageMatch => {
        const alt = getAttr(imageMatch[0], 'alt');
        return alt !== null && alt.trim() !== '';
      });
      const ariaLabel = getAttr(openingTag, 'aria-label');
      const labelledBy = getAttr(openingTag, 'aria-labelledby');
      const title = getAttr(openingTag, 'title');
      if (!(innerText || hasImageAlt || (ariaLabel && ariaLabel.trim()) ||
            (labelledBy && labelledBy.trim()) || (title && title.trim()))) {
        report('warnings', relative + ': enlace <a> sin nombre accesible detectable.');
      }
    }

    for (const match of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button\s*>/gi)) {
      buttonsChecked++;
      const openingTag = '<button' + match[1] + '>';
      const innerText = match[2]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&(?:amp|lt|gt|quot|apos);/gi, ' ')
        .trim();
      const ariaLabel = getAttr(openingTag, 'aria-label');
      const labelledBy = getAttr(openingTag, 'aria-labelledby');
      const title = getAttr(openingTag, 'title');
      const hasAccessibleName = Boolean(innerText || (ariaLabel && ariaLabel.trim()) ||
        (labelledBy && labelledBy.trim()) || (title && title.trim()));

      if (!hasAccessibleName) {
        report('warnings', `${relative}: botón sin nombre accesible visible o programático.`);
      }
    }
  }

  console.log(`\n[HTML] ${htmlFiles.length} archivos; ${imagesChecked} imágenes y ${buttonsChecked} botones revisados.`);
}

function normalizeTableName(raw) {
  return raw.replace(/"/g, '').toLowerCase();
}

function auditMigrations() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const sqlFiles = walk(migrationDir, name => name.toLowerCase().endsWith('.sql'));
  if (sqlFiles.length === 0) {
    report('warnings', 'No se encontraron migraciones SQL en supabase/migrations/.');
    return;
  }

  const tablesCreated = new Map();
  const rlsEnabled = new Set();
  const policiesCreated = new Set();
  const directAccessRevoked = new Set();

  for (const file of sqlFiles) {
    // Remove SQL comments before scanning to avoid passing due to commented-out SQL.
    const sql = read(file)
      .replace(/--[^\n\r]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    for (const match of sql.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?public\s*\.\s*("[^"]+"|[a-z_][\w$]*)/gi)) {
      const table = normalizeTableName(match[1]);
      if (!tablesCreated.has(table)) tablesCreated.set(table, path.relative(ROOT, file));
    }

    for (const match of sql.matchAll(/\balter\s+table\s+(?:only\s+)?public\s*\.\s*("[^"]+"|[a-z_][\w$]*)\s+enable\s+row\s+level\s+security\b/gi)) {
      rlsEnabled.add(normalizeTableName(match[1]));
    }

    for (const match of sql.matchAll(/\bcreate\s+policy\s+(?:"[^"]+"|[a-z_][\w$]*)\s+on\s+(?:only\s+)?public\s*\.\s*("[^"]+"|[a-z_][\w$]*)/gi)) {
      policiesCreated.add(normalizeTableName(match[1]));
    }

    for (const match of sql.matchAll(/\brevoke\s+all\s+(?:privileges\s+)?on\s+(?:table\s+)?public\s*\.\s*("[^"]+"|[a-z_][\w$]*)\s+from\s+([^;]+);/gi)) {
      const roles = match[2].toLowerCase().replace(/[\s"']/g, '').split(',');
      if (roles.includes('anon') && roles.includes('authenticated')) directAccessRevoked.add(normalizeTableName(match[1]));
    }
  }

  for (const [table, origin] of tablesCreated) {
    if (!rlsEnabled.has(table)) {
      report('errors', `${origin}: public.${table} se crea en migraciones pero no se encontró ENABLE ROW LEVEL SECURITY en ninguna migración.`);
    } else if (!policiesCreated.has(table) && !directAccessRevoked.has(table)) {
      report('warnings', `public.${table}: RLS está activado, pero no se detectaron políticas ni revocación explícita del acceso directo; confirmar el acceso previsto.`);
    }
  }

  console.log(`[SQL] ${sqlFiles.length} migraciones; ${tablesCreated.size} tablas public detectadas, ${rlsEnabled.size} tablas con RLS y ${policiesCreated.size} tablas con políticas detectadas.`);
}

function auditSecurityDefinerSearchPaths() {
  const migrationDir = path.join(ROOT, 'supabase', 'migrations');
  const sqlFiles = walk(migrationDir, name => name.toLowerCase().endsWith('.sql')).sort();
  let checked = 0;
  const hardenedNames = new Set();

  // Historical migrations may create a function first and harden it in a later
  // ALTER FUNCTION migration. Track those later hardenings to avoid stale alerts.
  for (const file of sqlFiles) {
    const sql = read(file)
      .replace(/--[^\n\r]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of sql.matchAll(/\balter\s+function\s+(?:public\s*\.\s*)?("?[a-z_][\w$]*"?)\s*\([\s\S]*?\)\s*set\s+search_path\b/gi)) {
      hardenedNames.add(match[1].replace(/"/g, '').toLowerCase());
    }
  }

  for (const file of sqlFiles) {
    const sql = read(file)
      .replace(/--[^\n\r]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const headers = sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\s*\.\s*)?("?[a-z_][\w$]*"?)\s*\([\s\S]*?\bas\s+(?:\$[a-z_]*\$|')/gi);
    for (const match of headers) {
      const header = match[0];
      if (!/\bsecurity\s+definer\b/i.test(header)) continue;
      checked++;
      const relative = path.relative(ROOT, file);
      const functionName = match[1].replace(/"/g, '').toLowerCase();
      const searchPath = header.match(/\bset\s+search_path\s*(?:to|=)\s*([\s\S]*?)(?=\bas\s+(?:\$[a-z_]*\$|'))/i);
      if (!searchPath) {
        if (!hardenedNames.has(functionName)) {
          report('warnings', relative + ': función SECURITY DEFINER sin SET search_path detectable ni ALTER posterior conocido; revisar manualmente.');
        }
        continue;
      }
      const configured = searchPath[1]
        .split(',')
        .map(part => part.trim().replace(/[()'"]/g, '').toLowerCase())
        .filter(Boolean);
      // An empty path is also defensive if all referenced objects are qualified.
      if (configured.length > 0 && (configured[0] !== 'pg_catalog' || configured[configured.length - 1] !== 'pg_temp')) {
        if (!hardenedNames.has(functionName)) {
          report('warnings', relative + ': función SECURITY DEFINER con search_path=' + searchPath[1].trim() + '; comprobar que el orden es seguro.');
        }
      }
    }
  }
  console.log('[SQL] ' + checked + ' cabeceras SECURITY DEFINER revisadas para search_path.');
}

function auditLegalReadiness() {
  for (const name of ['privacidad.html', 'condiciones.html']) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) {
      report('warnings', name + ': falta la página legal; completar antes de abrir el servicio al público.');
      continue;
    }
    const source = read(file);
    if (/\[[^\]]{2,}\]/.test(source)) {
      report('warnings', name + ': contiene campos entre corchetes pendientes de completar antes de publicar.');
    }
  }

  const loginFile = path.join(ROOT, 'login.html');
  if (fs.existsSync(loginFile)) {
    const login = read(loginFile);
    if (!/href=["']condiciones\.html["']/i.test(login) || !/href=["']privacidad\.html["']/i.test(login)) {
      report('warnings', 'login.html: el consentimiento de registro debe enlazar condiciones y política de privacidad.');
    }
  }
}

console.log('[SECURITY AUDIT] Auditoría estática pre-deploy de Curruscos Clan.\n');
auditHtml();
auditMigrations();
auditSecurityDefinerSearchPaths();
auditLegalReadiness();

console.log(`\n[RESULTADO] ${findings.errors} errores de RLS; ${findings.warnings} advertencias de accesibilidad/configuración.`);
if (findings.errors > 0) {
  console.error('La auditoría detectó posibles fallos de RLS. No desplegar hasta revisarlos.');
  process.exitCode = 1;
} else {
  console.log('No se detectaron omisiones evidentes de RLS. Las advertencias requieren revisión manual.');
}
