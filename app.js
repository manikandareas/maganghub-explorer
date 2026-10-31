'use strict';
// Row: [id, pos, org, type(0=perusahaan,1=pemerintah), cityIdx, provIdx, quota, appl, eduMask, prodiCsv, intMask, days, dis, desc, addr, score]
const MH = window.MH;
const EDU = [[1, 'Diploma'], [2, 'Sarjana'], [4, 'Profesi']];
const CATS = [
  ['ai', 'AI & Machine Learning', /\b(ai engineer|machine learning|artificial intelligence|deep learning|data scientist|computer vision|nlp|programmer ai|ai\/ml|ml engineer)\b/],
  ['data', 'Data', /\b(data analyst|data engineer|analis data|data analis|business intelligence|data support|pengolah data|data entry|data science)\b/],
  ['dev', 'Software & Development', /\b(software|developer|programmer|frontend|front[ -]?end|backend|back[ -]?end|fullstack|full[ -]?stack|web|mobile|android|devops|quality assurance|tester|system analyst|sistem analis|aplikasi|perangkat lunak|database|cloud|game|ui\/ux|ux|programer)\b/],
  ['it', 'IT Support & Jaringan', /\b(it support|technical support|helpdesk|network|jaringan|staff it|it staff|teknisi komputer|sysadmin|system administrator|teknologi informasi|informatika|sistem informasi|it officer|it admin|support it)\b/],
];
function catOf(pos) {
  const t = ' ' + pos.toLowerCase() + ' ';
  for (const [k, , re] of CATS) if (re.test(t)) return k;
  return 'lain';
}
const state = { q: '', prov: -1, city: -1, cat: '', org: -1, edu: 0, int: 0, dis: 0, minQ: 0, sort: 'portal', shown: 60 };
const PAGE = 60;

// precompute per-row helpers
const cityProv = {};
MH.rows.forEach(r => { cityProv[r[4]] = r[5]; r.push(catOf(r[1])); }); // idx 16 = category

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

function buildOptions() {
  const provCount = {}, cityCount = {};
  MH.rows.forEach(r => { provCount[r[5]] = (provCount[r[5]] || 0) + 1; cityCount[r[4]] = (cityCount[r[4]] || 0) + 1; });
  const provSel = document.getElementById('f-prov');
  MH.provs.map((p, i) => [p, i, provCount[i] || 0]).sort((a, b) => b[2] - a[2]).forEach(([p, i, c]) => {
    provSel.insertAdjacentHTML('beforeend', `<option value="${i}">${esc(p)} (${c.toLocaleString('id-ID')})</option>`);
  });
  fillCities(cityCount);
  const catCount = {};
  MH.rows.forEach(r => { catCount[r[16]] = (catCount[r[16]] || 0) + 1; });
  const catSel = document.getElementById('f-cat');
  CATS.forEach(([k, label]) => catSel.insertAdjacentHTML('beforeend', `<option value="${k}">${label} (${(catCount[k] || 0).toLocaleString('id-ID')})</option>`));
  catSel.insertAdjacentHTML('beforeend', `<option value="lain">Lainnya (${(catCount['lain'] || 0).toLocaleString('id-ID')})</option>`);
}
function fillCities(cityCount) {
  const citySel = document.getElementById('f-city');
  const cur = citySel.value;
  citySel.innerHTML = '<option value="-1">Semua kota/kabupaten</option>';
  MH.cities.map((c, i) => [c, i]).filter(([, i]) => state.prov < 0 || cityProv[i] === state.prov)
    .sort((a, b) => a[0].localeCompare(b[0])).forEach(([c, i]) => {
      citySel.insertAdjacentHTML('beforeend', `<option value="${i}">${esc(c)}${cityCount ? ' (' + (cityCount[i] || 0) + ')' : ''}</option>`);
    });
  citySel.value = [...citySel.options].some(o => o.value === cur) ? cur : '-1';
  state.city = parseInt(citySel.value, 10);
}

function haystack(r) {
  const prodi = r[9] ? r[9].split(',').map(i => MH.prodis[+i]).join(' ') : '';
  return (r[1] + ' ' + r[2] + ' ' + MH.cities[r[4]] + ' ' + MH.provs[r[5]] + ' ' + prodi + ' ' + r[13]).toLowerCase();
}
function matches(r) {
  if (state.prov >= 0 && r[5] !== state.prov) return false;
  if (state.city >= 0 && r[4] !== state.city) return false;
  if (state.cat && r[16] !== state.cat) return false;
  if (state.org >= 0 && r[3] !== state.org) return false;
  if (state.edu && !(r[8] & state.edu)) return false;
  if (state.int && !(r[10] & state.int)) return false;
  if (state.dis && !r[12]) return false;
  if (state.minQ && r[6] < state.minQ) return false;
  if (state.q) {
    const h = haystack(r);
    for (const w of state.q.toLowerCase().split(/\s+/)) if (w && !h.includes(w)) return false;
  }
  return true;
}
function applySort(rows) {
  const s = state.sort;
  if (s === 'quota') rows.sort((a, b) => b[6] - a[6]);
  else if (s === 'appl') rows.sort((a, b) => a[7] - b[7]);
  else if (s === 'score') rows.sort((a, b) => b[15] - a[15]);
  else if (s === 'az') rows.sort((a, b) => a[1].localeCompare(b[1]));
  return rows;
}
function badges(r) {
  const b = [];
  if (r[10] & 1) b.push('<span class="bd bd-on">Wawancara daring</span>');
  if (r[10] & 2) b.push('<span class="bd">Wawancara tatap muka</span>');
  EDU.forEach(([bit, label]) => { if (r[8] & bit) b.push(`<span class="bd">${label}</span>`); });
  if (r[11]) b.push(`<span class="bd">${r[11]} hari/minggu</span>`);
  if (r[12]) b.push('<span class="bd bd-dis">Ramah disabilitas</span>');
  return b.join(' ');
}
function card(r) {
  const prodi = r[9] ? r[9].split(',').map(i => MH.prodis[+i]) : [];
  const prodiHtml = prodi.slice(0, 3).map(p => `<span class="chip">${esc(p)}</span>`).join(' ') + (prodi.length > 3 ? ` <span class="chip">+${prodi.length - 3} prodi</span>` : '');
  const url = `https://maganghub.kemnaker.go.id/magang-nasional/lowongan/${slug(r[1])}-${r[0]}`;
  return `<article class="card">
    <h3>${esc(r[1])}</h3>
    <p class="org">${esc(r[2])} <span class="otype">${r[3] ? '· Instansi pemerintah' : '· Perusahaan'}</span></p>
    <p class="loc">📍 ${esc(MH.cities[r[4]])}, ${esc(MH.provs[r[5]])}</p>
    <p class="meta"><b>Kuota ${r[6]}</b> · Pelamar ${r[7]}</p>
    <div class="badges">${badges(r)}</div>
    ${prodiHtml ? `<div class="prodi">${prodiHtml}</div>` : ''}
    <details><summary>Deskripsi tugas</summary><p>${esc(r[13])}</p>${r[14] ? `<p class="addr">Alamat: ${esc(r[14])}</p>` : ''}</details>
    <a class="apply" href="${url}" target="_blank" rel="noopener">Lamar di situs resmi ↗</a>
  </article>`;
}
let filtered = [];
function render() {
  filtered = applySort(MH.rows.filter(matches));
  const total = filtered.length;
  document.getElementById('count').textContent = `${total.toLocaleString('id-ID')} lowongan ditemukan (dari ${MH.rows.length.toLocaleString('id-ID')} total snapshot)`;
  const slice = filtered.slice(0, state.shown);
  document.getElementById('results').innerHTML = slice.map(card).join('') || '<p class="none">Tidak ada lowongan yang cocok. Coba longgarkan filter.</p>';
  document.getElementById('more').style.display = total > state.shown ? '' : 'none';
}
function refilter() { state.shown = PAGE; render(); }

document.getElementById('f-q').addEventListener('input', e => { state.q = e.target.value.trim(); refilter(); });
document.getElementById('f-prov').addEventListener('change', e => { state.prov = parseInt(e.target.value, 10); fillCities(null); refilter(); });
document.getElementById('f-city').addEventListener('change', e => { state.city = parseInt(e.target.value, 10); refilter(); });
document.getElementById('f-cat').addEventListener('change', e => { state.cat = e.target.value; refilter(); });
document.getElementById('f-org').addEventListener('change', e => { state.org = parseInt(e.target.value, 10); refilter(); });
document.getElementById('f-edu').addEventListener('change', e => { state.edu = parseInt(e.target.value, 10); refilter(); });
document.getElementById('f-int').addEventListener('change', e => { state.int = parseInt(e.target.value, 10); refilter(); });
document.getElementById('f-dis').addEventListener('change', e => { state.dis = e.target.checked ? 1 : 0; refilter(); });
document.getElementById('f-minq').addEventListener('input', e => { state.minQ = parseInt(e.target.value, 10) || 0; refilter(); });
document.getElementById('f-sort').addEventListener('change', e => { state.sort = e.target.value; refilter(); });
document.getElementById('more').addEventListener('click', () => { state.shown += PAGE * 2; render(); });
document.getElementById('reset').addEventListener('click', () => location.reload());

buildOptions();
render();
