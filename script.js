/* ---------- Storage ---------- */
const KEY = 'bagstore-v1';
let db = { store: null, inventory: [], receiptNo: 0 };
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) db = s; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

let cart = [];        // {id, name, price, qty}
let editingId = null; // inventory item being edited
let lastReceipt = null;

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const money = n => 'Rs ' + (Math.round(n * 100) / 100).toLocaleString('en-PK');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => s.trim().toLowerCase();
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
const findExact = name => db.inventory.find(i => norm(i.name) === norm(name));
const inCart = id => cart.filter(c => c.id === id).reduce((s, c) => s + c.qty, 0);

/* ---------- Setup / header ---------- */
function showApp() {
  $('setup').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('hName').textContent = db.store.name;
  $('hInfo').textContent = db.store.phone + '  |  ' + db.store.address;
  renderAll();
}
$('setupForm').addEventListener('submit', e => {
  e.preventDefault();
  db.store = { name: $('sName').value.trim(), phone: $('sPhone').value.trim(), address: $('sAddress').value.trim() };
  save(); showApp();
});
$('editStore').addEventListener('click', () => {
  $('sName').value = db.store.name; $('sPhone').value = db.store.phone; $('sAddress').value = db.store.address;
  $('app').classList.add('hidden'); $('setup').classList.remove('hidden');
});

/* ---------- Tabs ---------- */
function openTab(name) {
  document.querySelectorAll('.tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  ['sale', 'inventory', 'receipt'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== name));
}
document.querySelectorAll('.tab[data-tab]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));

/* ---------- Inventory ---------- */
$('invForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('iName').value.trim(), price = parseFloat($('iPrice').value), qty = parseInt($('iQty').value, 10);
  if (!name || isNaN(price) || isNaN(qty)) return;
  if (editingId) {
    const it = db.inventory.find(i => i.id === editingId);
    Object.assign(it, { name, price, qty });
    toast('Bag updated');
  } else {
    const ex = findExact(name);
    if (ex) { ex.price = price; ex.qty += qty; toast('Stock added to existing bag'); }
    else { db.inventory.push({ id: Date.now() + Math.random(), name, price, qty }); toast('Bag added'); }
  }
  save(); resetInvForm(); renderAll();
});
function resetInvForm() {
  editingId = null; $('invForm').reset();
  $('invTitle').textContent = 'Add a bag'; $('invSave').textContent = 'Save bag'; $('invCancel').hidden = true;
}
$('invCancel').addEventListener('click', resetInvForm);

function renderInventory() {
  const body = $('invTable').querySelector('tbody');
  if (!db.inventory.length) { body.innerHTML = '<tr><td colspan="4" class="empty">No bags yet. Add your first bag on the left.</td></tr>'; return; }
  body.innerHTML = db.inventory.map(i => `
    <tr><td>${esc(i.name)}</td><td class="num">${money(i.price)}</td>
    <td class="num ${i.qty <= 3 ? 'low' : ''}">${i.qty}</td>
    <td class="actions"><button class="btn sm" data-edit="${i.id}">Edit</button>
    <button class="btn sm danger" data-del="${i.id}">Delete</button></td></tr>`).join('');
}
$('invTable').addEventListener('click', e => {
  const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) {
    const it = db.inventory.find(i => String(i.id) === ed);
    editingId = it.id; $('iName').value = it.name; $('iPrice').value = it.price; $('iQty').value = it.qty;
    $('invTitle').textContent = 'Edit bag'; $('invSave').textContent = 'Update bag'; $('invCancel').hidden = false;
    $('iName').focus();
  }
  if (del && confirm('Delete this bag from inventory?')) {
    db.inventory = db.inventory.filter(i => String(i.id) !== del);
    cart = cart.filter(c => String(c.id) !== del);
    save(); renderAll();
  }
});

/* ---------- Availability check ---------- */
function checkAvailability() {
  const box = $('availability'), btn = $('addBtn');
  const q = $('wItem').value, qty = parseInt($('wQty').value, 10) || 0;
  btn.disabled = true;
  if (!q.trim()) { box.className = 'avail idle'; box.textContent = 'Type a bag name to check stock.'; return; }
  let item = findExact(q);
  if (!item) {
    const m = db.inventory.filter(i => norm(i.name).includes(norm(q)));
    if (m.length === 1) item = m[0];
    else if (m.length > 1) { box.className = 'avail warn'; box.textContent = m.length + ' bags match. Pick one from the suggestions list.'; return; }
  }
  if (!item) { box.className = 'avail bad'; box.textContent = 'Not available. This bag is not in your inventory.'; return; }
  const left = item.qty - inCart(item.id);
  if (left <= 0) { box.className = 'avail bad'; box.textContent = `Not available. ${item.name} is out of stock${inCart(item.id) ? ' (all added to the bill)' : ''}.`; return; }
  if (qty < 1) { box.className = 'avail warn'; box.textContent = 'Enter a quantity of 1 or more.'; return; }
  if (qty > left) { box.className = 'avail warn'; box.textContent = `Only ${left} available. Customer wants ${qty}.`; return; }
  box.className = 'avail ok';
  box.textContent = `Available. ${left} in stock at ${money(item.price)} each.`;
  btn.disabled = false; btn.dataset.id = item.id;
}
['wItem', 'wQty'].forEach(id => $(id).addEventListener('input', checkAvailability));

$('addBtn').addEventListener('click', () => {
  const item = db.inventory.find(i => String(i.id) === $('addBtn').dataset.id);
  const qty = parseInt($('wQty').value, 10);
  if (!item) return;
  const line = cart.find(c => c.id === item.id);
  if (line) line.qty += qty; else cart.push({ id: item.id, name: item.name, price: item.price, qty });
  $('wItem').value = ''; $('wQty').value = 1; $('wItem').focus();
  renderCart(); checkAvailability();
});

/* ---------- Cart ---------- */
const subTotal = () => cart.reduce((s, c) => s + c.price * c.qty, 0);
const expenses = () => Math.max(0, parseFloat($('exp').value) || 0);
const grandTotal = () => subTotal() + expenses();
function renderCart() {
  const body = $('cartTable').querySelector('tbody');
  body.innerHTML = cart.length ? cart.map((c, i) => `
    <tr><td>${esc(c.name)}</td><td class="num">${c.qty}</td><td class="num">${money(c.price)}</td>
    <td class="num">${money(c.price * c.qty)}</td>
    <td class="actions"><button class="btn sm danger" data-rm="${i}" aria-label="Remove">✕</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">No bags on the bill yet.</td></tr>';
  $('sub').textContent = money(subTotal());
  $('grand').textContent = money(grandTotal());
  updateChange();
}
$('cartTable').addEventListener('click', e => {
  if (e.target.dataset.rm !== undefined) { cart.splice(+e.target.dataset.rm, 1); renderCart(); checkAvailability(); }
});
function updateChange() {
  const total = grandTotal(), paid = parseFloat($('paid').value) || 0, diff = paid - total;
  const row = $('changeRow');
  row.classList.toggle('due', diff < 0);
  $('changeLabel').textContent = diff < 0 ? 'Still to receive' : 'Change to return';
  $('change').textContent = money(Math.abs(diff));
  $('issueBtn').disabled = !cart.length;
}
$('paid').addEventListener('input', updateChange);
$('exp').addEventListener('input', renderCart);

/* ---------- Receipt ---------- */
$('issueBtn').addEventListener('click', () => {
  const total = grandTotal(), paid = parseFloat($('paid').value) || 0;
  if (paid < total && !confirm(`Customer has paid ${money(paid)} of ${money(total)}. Make receipt with ${money(total - paid)} still due?`)) return;
  // reduce stock
  cart.forEach(c => { const it = db.inventory.find(i => i.id === c.id); if (it) it.qty = Math.max(0, it.qty - c.qty); });
  db.receiptNo += 1;
  lastReceipt = { no: db.receiptNo, date: new Date(), customer: $('cName').value.trim() || 'Walk-in customer',
    phone: $('cPhone').value.trim(), items: cart.map(c => ({ ...c })), sub: subTotal(), expenses: expenses(), total, paid };
  db.lastReceipt = lastReceipt; save();
  renderReceipt(); $('tabReceipt').disabled = false; openTab('receipt'); renderAll();
});

function renderReceipt() {
  const r = lastReceipt, diff = r.paid - r.total;
  const date = r.date instanceof Date ? r.date : new Date(r.date);
  $('receipt').innerHTML = `
    <div class="r-store">${esc(db.store.name)}</div>
    <div class="r-info">${esc(db.store.address)}<br>Ph: ${esc(db.store.phone)}</div>
    <hr class="r-rule">
    <div class="r-meta">
      <b>Receipt no.</b><span>#${String(r.no).padStart(4, '0')}</span>
      <b>Date</b><span>${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      <b>Customer</b><span>${esc(r.customer)}</span>
      ${r.phone ? `<b>Mobile</b><span>${esc(r.phone)}</span>` : ''}
    </div>
    <hr class="r-rule">
    <table>
      <thead><tr><th>Bag</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
      <tbody>${r.items.map(i => `<tr><td>${esc(i.name)}</td><td class="num">${i.qty}</td><td class="num">${money(i.price)}</td><td class="num">${money(i.price * i.qty)}</td></tr>`).join('')}</tbody>
    </table>
    <hr class="r-rule">
    <div class="r-sum">
      ${r.expenses > 0 ? `<div><span>Bags total</span><span>${money(r.sub)}</span></div><div><span>Bilty / delivery expenses</span><span>${money(r.expenses)}</span></div>` : ''}
      <div class="r-grand"><span>Grand total</span><span>${money(r.total)}</span></div>
      <div><span>Money received</span><span>${money(r.paid)}</span></div>
      <div><strong>${diff < 0 ? 'Balance due' : 'Change returned'}</strong><strong>${money(Math.abs(diff))}</strong></div>
    </div>
    <div class="r-thanks">Thank you for shopping with us!</div>`;
}
$('printBtn').addEventListener('click', () => window.print());

/* ---------- Save / share ---------- */
async function receiptBlob() {
  if (typeof html2canvas === 'undefined') throw new Error('offline');
  const canvas = await html2canvas($('receipt'), { scale: 2, backgroundColor: '#ffffff' });
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}
const fileName = () => `receipt-${String(lastReceipt.no).padStart(4, '0')}.png`;
$('imgBtn').addEventListener('click', async () => {
  try {
    const blob = await receiptBlob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName(); a.click();
    toast('Receipt image saved');
  } catch (e) { toast('Image needs internet once. Use Print / Save PDF instead.'); }
});
function receiptText() {
  const r = lastReceipt, diff = r.paid - r.total;
  return [`*${db.store.name}*`, db.store.address, 'Ph: ' + db.store.phone, '',
    `Receipt #${String(r.no).padStart(4, '0')}  ${new Date(r.date).toLocaleDateString('en-GB')}`, `Customer: ${r.customer}`, '',
    ...r.items.map(i => `${i.name} x ${i.qty} = ${money(i.price * i.qty)}`),
    ...(r.expenses > 0 ? [`Bilty / delivery: ${money(r.expenses)}`] : []), '',
    `*Grand total: ${money(r.total)}*`, `Received: ${money(r.paid)}`,
    `${diff < 0 ? 'Balance due' : 'Change returned'}: ${money(Math.abs(diff))}`, '', 'Thank you for shopping with us!'].join('\n');
}
function waNumber(p) {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '92' + d.slice(1);
  return d;
}
$('shareBtn').addEventListener('click', async () => {
  try {
    const blob = await receiptBlob();
    const file = new File([blob], fileName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: db.store.name + ' receipt', text: receiptText() });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  // fallback: WhatsApp message to the customer's number
  window.open(`https://wa.me/${waNumber(lastReceipt.phone)}?text=${encodeURIComponent(receiptText())}`, '_blank');
});
$('newSaleBtn').addEventListener('click', () => {
  cart = []; $('cName').value = ''; $('cPhone').value = ''; $('exp').value = ''; $('paid').value = '';
  renderCart(); checkAvailability(); openTab('sale'); $('cName').focus();
});

$('waBtn').addEventListener('click', () => {
  if (!waNumber(lastReceipt.phone)) toast('No customer number. Choose the contact in WhatsApp.');
  window.open(`https://wa.me/${waNumber(lastReceipt.phone)}?text=${encodeURIComponent(receiptText())}`, '_blank');
});
$('smsBtn').addEventListener('click', () => {
  location.href = `sms:${waNumber(lastReceipt.phone) ? '+' + waNumber(lastReceipt.phone) : ''}?body=${encodeURIComponent(receiptText())}`;
});
$('copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(receiptText()); toast('Receipt text copied'); }
  catch (e) {
    const t = document.createElement('textarea'); t.value = receiptText(); document.body.appendChild(t);
    t.select(); document.execCommand('copy'); t.remove(); toast('Receipt text copied');
  }
});

/* ---------- Render all ---------- */
function renderAll() {
  $('itemList').innerHTML = db.inventory.map(i => `<option value="${esc(i.name)}">`).join('');
  renderInventory(); renderCart(); checkAvailability();
}

/* ---------- Start ---------- */
if (db.lastReceipt) { lastReceipt = db.lastReceipt; $('tabReceipt').disabled = false; }
if (db.store) { showApp(); if (lastReceipt) renderReceipt(); } else $('setup').classList.remove('hidden');

/* ---------- Install as app (works offline) ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
