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
    for (const labelMatch of source.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label\s*>/gi)) {
      const labelTag = '<label' + labelMatch[1] + '>';
      const forId = getAttr(labelTag, 'for');
      if (forId) idsWithLabels.add(forId);
      const nestedControl = labelMatch[2].match(/<(?:input|select|textarea)\b[^>]*\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
      if (nestedControl) idsWithLabels.add(nestedControl[1] ?? nestedControl[2] ?? nestedControl[3]);
    }

    for (const match of source.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
      const tagName = match[1].toLowerCase();
      const openingTag = '<' + match[1] + match[2] + '>';
      const type = (getAttr(openingTag, 'type') || '').toLowerCase();
      if (tagName === 'input' && ['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
      const id = getAttr(openingTag, 'id');
      const ariaLabel = getAttr(openingTag, 'aria-label');
      const labelledBy = getAttr(openingTag, 'aria-labelledby');
      if (!(ariaLabel && ariaLabel.trim()) && !(labelledBy && labelledBy.trim()) && !(id && idsWithLabels.has(id))) {
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

console.log('[SECURITY AUDIT] Auditoría estática pre-deploy de Curruscos Clan.\n');
auditHtml();
auditMigrations();

console.log(`\n[RESULTADO] ${findings.errors} errores de RLS; ${findings.warnings} advertencias de accesibilidad/configuración.`);
if (findings.errors > 0) {
  console.error('La auditoría detectó posibles fallos de RLS. No desplegar hasta revisarlos.');
  process.exitCode = 1;
} else {
  console.log('No se detectaron omisiones evidentes de RLS. Las advertencias requieren revisión manual.');
}
