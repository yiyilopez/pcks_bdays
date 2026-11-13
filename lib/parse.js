// Lee el HTML publico de Google Sheets (vista /htmlview) y saca
// nombre, dia y foto de cada persona.
//
// Formato esperado en cada pestana (igual al Sheet "Birthday"):
//   - una celda con el nombre y, en la celda de la derecha, el dia (1-31)
//   - la foto pegada debajo del nombre (flotante sobre las celdas o dentro de una celda)

const ROW_HEIGHT = 21;

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function cellText(html) {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

// Pestanas del documento: [{ name, gid }]
function parseTabs(topHtml) {
  const tabs = [];
  const re = /items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(-?\d+)"/g;
  let m;
  while ((m = re.exec(topHtml))) {
    let name = m[1];
    try {
      name = JSON.parse('"' + name.replace(/\\x([0-9a-f]{2})/gi, '\\u00$1') + '"');
    } catch (e) {
      /* se deja el nombre tal cual */
    }
    tabs.push({ name, gid: m[2] });
  }
  return tabs;
}

function parseSheet(html) {
  // Anchos de columna
  const colWidths = [];
  const thRe = /<th[^>]*id=["']\d+C(\d+)["'][^>]*style=["'][^"']*width:\s*(\d+)px/g;
  let m;
  while ((m = thRe.exec(html))) colWidths[Number(m[1])] = Number(m[2]);
  const colLeft = (c) => {
    let x = 0;
    for (let i = 0; i < c; i++) x += colWidths[i] || 100;
    return x;
  };
  const colWidth = (c) => colWidths[c] || 100;

  // Celdas con contenido
  const cells = [];
  const images = [];
  const tbodyStart = html.indexOf('<tbody');
  const tbodyEnd = html.indexOf('</tbody>');
  const body = tbodyStart >= 0 ? html.slice(tbodyStart, tbodyEnd > 0 ? tbodyEnd : undefined) : html;
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowIdx = -1;
  while ((m = trRe.exec(body))) {
    rowIdx++;
    const rowHtml = m[1];
    const idMatch = /<th[^>]*id=["']\d+R(\d+)["']/.exec(rowHtml);
    const row = idMatch ? Number(idMatch[1]) : rowIdx;
    const tdRe = /<td([^>]*)>([\s\S]*?)<\/td>/g;
    let col = 0;
    let c;
    while ((c = tdRe.exec(rowHtml))) {
      const span = /colspan=["']?(\d+)/.exec(c[1]);
      const text = cellText(c[2]);
      if (text) cells.push({ row, col, text });
      const img = /<img[^>]*src=["']([^"']+)["']/.exec(c[2]);
      if (img) {
        images.push({
          id: 'cell_' + row + '_' + col,
          src: decodeEntities(img[1]),
          cx: colLeft(col) + colWidth(col) / 2,
          top: row * ROW_HEIGHT,
        });
      }
      col += span ? Number(span[1]) : 1;
    }
  }

  // Fotos flotantes: <div id='embed_X' ... style='width: Wpx; height: Hpx'><img src='...'>
  const embeds = {};
  const embRe = /<div id=["'](embed_\d+)["'][^>]*style=["']width:\s*(\d+)px;\s*height:\s*(\d+)px[^>]*>\s*<img[^>]*src=["']([^"']+)["']/g;
  while ((m = embRe.exec(html))) {
    embeds[m[1]] = { w: Number(m[2]), h: Number(m[3]), src: decodeEntities(m[4]) };
  }
  const posRe = /posObj\('[^']*',\s*'(embed_\d+)',\s*(\d+),\s*(\d+),\s*(-?\d+),\s*(-?\d+)\)/g;
  while ((m = posRe.exec(html))) {
    const e = embeds[m[1]];
    if (!e) continue;
    const row = Number(m[2]);
    const col = Number(m[3]);
    images.push({
      id: m[1],
      src: e.src,
      cx: colLeft(col) + Number(m[4]) + e.w / 2,
      top: row * ROW_HEIGHT + Number(m[5]),
    });
  }

  // Personas: celda de texto con un dia (1-31) en la celda de la derecha
  const byPos = new Map(cells.map((c) => [c.row + ':' + c.col, c]));
  const people = [];
  for (const c of cells) {
    if (/^\d+$/.test(c.text)) continue;
    const right = byPos.get(c.row + ':' + (c.col + 1));
    if (!right || !/^\d{1,2}$/.test(right.text)) continue;
    const day = Number(right.text);
    if (day < 1 || day > 31) continue;
    people.push({
      name: c.text,
      day,
      cx: colLeft(c.col) + (colWidth(c.col) + colWidth(c.col + 1)) / 2,
      top: c.row * ROW_HEIGHT,
      photo: null,
      _cost: Infinity,
    });
  }

  // Cada foto se asigna a la persona cuyo nombre queda justo encima
  for (const img of images) {
    let best = null;
    let bestCost = Infinity;
    for (const p of people) {
      const dx = Math.abs(img.cx - p.cx);
      const dy = img.top - p.top;
      if (dx > 260) continue;
      if (dy < -3 * ROW_HEIGHT) continue; // la foto esta muy por encima del nombre
      const cost = dx + Math.abs(dy);
      if (cost < bestCost) {
        bestCost = cost;
        best = p;
      }
    }
    if (best && bestCost < best._cost) {
      best._cost = bestCost;
      best.photo = { id: img.id, src: img.src };
    }
  }

  return people
    .map(({ name, day, photo }) => ({ name, day, photo }))
    .sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

module.exports = { parseTabs, parseSheet };
