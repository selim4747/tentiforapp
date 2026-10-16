import fs from 'node:fs';
import path from 'node:path';

// Legacy paketler ayrı kaynak dosyalarını birleştirir. Terminal entegrasyonunda
// yalnızca bu iki canonical router fonksiyonunu eşitle; diğer paket koduna dokunma.
export function syncTerminalRoutes(root) {
  const source = fs.readFileSync(path.join(root, 'js/arayuz/18-gezinme.js'), 'utf8');
  const pairs = [['sayfaYonlendir', 'sayfayaGit'], ['hataSayfasiAc', 'hataSayfasiKapat']];
  for (const [name, next] of pairs) {
    const start = `function ${name}(`;
    const end = `function ${next}(`;
    if (source.split(start).length !== 2) throw new Error(`Canonical router fonksiyonu tekil değil: ${name}`);
    const a = source.indexOf(start);
    const b = source.indexOf(end, a);
    if (b < a) throw new Error(`Canonical router sınırı bulunamadı: ${name}`);
    const body = source.slice(a, b);
    let matched = 0;
    for (let i = 1; i <= 4; i++) {
      const file = path.join(root, `js/paket-${i}.js`);
      const bundle = fs.readFileSync(file, 'utf8');
      if (!bundle.includes(start)) continue;
      if (bundle.split(start).length !== 2) throw new Error(`Paket router fonksiyonu tekil değil: ${name}`);
      const from = bundle.indexOf(start);
      const to = bundle.indexOf(end, from);
      if (to < from) throw new Error(`Paket router sınırı bulunamadı: ${name}`);
      const updated = bundle.slice(0, from) + body + bundle.slice(to);
      if (updated !== bundle) fs.writeFileSync(file, updated);
      matched++;
    }
    if (matched !== 1) throw new Error(`Router eşitleme hedefi beklenen sayıda değil: ${name} (${matched})`);
  }
}
