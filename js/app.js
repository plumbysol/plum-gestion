```javascript
// ============================================================
// Plum Gestión — lógica de la aplicación
// ============================================================
let currentUser = null;
let profile = null;
let insumos = [];
let productos = [];
let pedidos = [];
let authMode = 'login';

const $ = (sel) => document.querySelector(sel);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (s) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

function showScreen(id) {
  ['pantalla-cargando', 'pantalla-config', 'pantalla-auth', 'app-shell'].forEach((s) => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

// ============================================================
// INIT
// ============================================================
async function init() {
  if (!SUPABASE_CONFIGURADO) { showScreen('pantalla-config'); return; }

  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      currentUser = session.user;
      await cargarTodo();
      showScreen('app-shell');
    } else {
      showScreen('pantalla-auth');
    }
  } catch (err) {
    showScreen('pantalla-auth');
    mostrarErrorAuth(traducirErrorAuth(err));
  }
}

// ============================================================
// AUTH
// ============================================================
function mostrarErrorAuth(msg) {
  const box = $('#auth-error');
  box.textContent = msg;
  box.classList.remove('hidden');
}
function ocultarErrorAuth() { $('#auth-error').classList.add('hidden'); }

function traducirErrorAuth(err) {
  const m = (err && err.message) || '';
  if (m.includes('Failed to fetch')) return 'No se pudo conectar. Revisá tu conexión a internet, o que la URL/clave de Supabase en config.js sean correctas.';
  if (m.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('User already registered')) return 'Ese email ya tiene una cuenta. Iniciá sesión.';
  if (m.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  return m || 'Ocurrió un error. Intentá de nuevo.';
}

function actualizarAuthUI() {
  $('#form-login').classList.toggle('hidden', authMode !== 'login');
  $('#form-registro').classList.toggle('hidden', authMode !== 'registro');
  if (authMode === 'login') {
    $('#auth-sub').textContent = 'Iniciá sesión para entrar a tu taller';
    $('#auth-switch-text').textContent = '¿No tenés cuenta?';
    $('#btn-auth-switch').textContent = 'Creá una gratis';
  } else {
    $('#auth-sub').textContent = 'Creá tu cuenta gratis';
    $('#auth-switch-text').textContent = '¿Ya tenés cuenta?';
    $('#btn-auth-switch').textContent = 'Iniciá sesión';
  }
  ocultarErrorAuth();
}

$('#btn-auth-switch').addEventListener('click', () => {
  authMode = authMode === 'login' ? 'registro' : 'login';
  actualizarAuthUI();
});

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarErrorAuth();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Ingresando…';
  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    await cargarTodo();
    showScreen('app-shell');
  } catch (err) {
    mostrarErrorAuth(traducirErrorAuth(err));
  } finally {
    btn.disabled = false; btn.textContent = 'Iniciar sesión';
  }
});

$('#form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarErrorAuth();
  const negocio = $('#reg-negocio').value.trim();
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Creando…';
  try {
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) {
      mostrarErrorAuth('Cuenta creada. Revisá tu email para confirmar la cuenta y después iniciá sesión.');
      authMode = 'login'; actualizarAuthUI();
      return;
    }
    currentUser = data.user;
    await new Promise((r) => setTimeout(r, 700)); // deja tiempo al trigger que crea el perfil
    if (negocio) await db.from('profiles').update({ nombre_negocio: negocio }).eq('id', currentUser.id);
    await cargarTodo();
    showScreen('app-shell');
  } catch (err) {
    mostrarErrorAuth(traducirErrorAuth(err));
  } finally {
    btn.disabled = false; btn.textContent = 'Crear cuenta';
  }
});

$('#btn-logout').addEventListener('click', async () => {
  await db.auth.signOut();
  currentUser = null; profile = null; insumos = []; productos = []; pedidos = [];
  authMode = 'login'; actualizarAuthUI();
  showScreen('pantalla-auth');
});

// ============================================================
// NAV
// ============================================================
document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    document.querySelectorAll('.page').forEach((p) => p.classList.add('hidden'));
    $(`#page-${page}`).classList.remove('hidden');
  });
});

// ============================================================
// CARGA DE DATOS
// ============================================================
async function cargarTodo() {
  $('#user-email-label').textContent = currentUser.email;
  const [pRes, iRes, prRes, peRes] = await Promise.all([
    db.from('profiles').select('*').eq('id', currentUser.id).single(),
    db.from('insumos').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
    db.from('productos').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
    db.from('pedidos').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
  ]);
  profile = pRes.data;
  insumos = iRes.data || [];
  productos = prRes.data || [];
  pedidos = peRes.data || [];
  renderInsumos(); renderProductos(); renderPedidos(); renderTienda();
}

function abrirModal(html) {
  $('#modal-root').innerHTML = `<div class="modal-bg" id="modal-bg"><div class="modal">${html}</div></div>`;
  $('#modal-bg').addEventListener('click', (e) => { if (e.target.id === 'modal-bg') cerrarModal(); });
}
function cerrarModal() { $('#modal-root').innerHTML = ''; }

// ============================================================
// INSUMOS
// ============================================================
function renderInsumos() {
  const tbody = $('#tabla-insumos tbody');
  tbody.innerHTML = '';
  $('#insumos-vacio').classList.toggle('hidden', insumos.length > 0);
  $('#tabla-insumos').classList.toggle('hidden', insumos.length === 0);
  insumos.forEach((i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(i.nombre)}</td>
      <td>${escapeHtml(i.unidad)}</td>
      <td class="num">$${Number(i.costo_unitario).toFixed(2)}</td>
      <td class="num">${Number(i.stock)}</td>
      <td class="toolbar">
        <button class="icon-btn btn-editar" data-id="${i.id}">Editar</button>
        <button class="icon-btn btn-eliminar" data-id="${i.id}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-editar').forEach((b) => b.addEventListener('click', () => abrirModalInsumo(insumos.find((x) => x.id === b.dataset.id))));
  tbody.querySelectorAll('.btn-eliminar').forEach((b) => b.addEventListener('click', () => eliminarInsumo(b.dataset.id)));
}

function abrirModalInsumo(insumo) {
  const editando = !!insumo;
  abrirModal(`
    <h3>${editando ? 'Editar' : 'Nuevo'} insumo</h3>
    <form id="form-insumo">
      <div class="field"><label>Nombre</label><input type="text" id="ins-nombre" required value="${editando ? escapeHtml(insumo.nombre) : ''}"></div>
      <div class="row2">
        <div class="field"><label>Unidad</label><input type="text" id="ins-unidad" placeholder="gr, ml, unidad..." required value="${editando ? escapeHtml(insumo.unidad) : ''}"></div>
        <div class="field"><label>Costo por unidad</label><input type="number" step="0.01" min="0" id="ins-costo" required value="${editando ? insumo.costo_unitario : ''}"></div>
      </div>
      <div class="field"><label>Stock actual</label><input type="number" step="0.01" min="0" id="ins-stock" required value="${editando ? insumo.stock : 0}"></div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">${editando ? 'Guardar cambios' : 'Crear insumo'}</button>
        <button type="button" class="btn btn-outline" id="btn-cancelar-modal">Cancelar</button>
      </div>
    </form>
  `);
  $('#btn-cancelar-modal').addEventListener('click', cerrarModal);
  $('#form-insumo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nombre: $('#ins-nombre').value.trim(),
      unidad: $('#ins-unidad').value.trim(),
      costo_unitario: parseFloat($('#ins-costo').value) || 0,
      stock: parseFloat($('#ins-stock').value) || 0,
    };
    if (editando) await db.from('insumos').update(payload).eq('id', insumo.id);
    else { payload.user_id = currentUser.id; await db.from('insumos').insert(payload); }
    cerrarModal();
    await recargarInsumos();
  });
}
async function recargarInsumos() {
  const { data } = await db.from('insumos').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  insumos = data || []; renderInsumos();
}
async function eliminarInsumo(id) {
  if (!confirm('¿Eliminar este insumo?')) return;
  await db.from('insumos').delete().eq('id', id);
  await recargarInsumos();
}
$('#btn-nuevo-insumo').addEventListener('click', () => abrirModalInsumo(null));

// ============================================================
// PRODUCTOS
// ============================================================
const CATEGORIAS_ARTESANAL = ['Packs', 'Amigurumis', 'Accesorios y Decoración', 'Impresos'];
const CATEGORIAS_DIGITAL = ['Stickers', 'Ilustraciones', 'Plantillas', 'Recursos'];

function calcularCostoInsumos(insumosUsados) {
  return (insumosUsados || []).reduce((acc, u) => {
    const ins = insumos.find((i) => i.id === u.insumo_id);
    return acc + (ins ? Number(ins.costo_unitario) * Number(u.cantidad) : 0);
  }, 0);
}
function calcularCostoProducto(insumosUsados, horas) {
  const costoInsumos = calcularCostoInsumos(insumosUsados);
  const costoHoras = (Number(horas) || 0) * (Number(profile?.valor_hora) || 0);
  return costoInsumos + costoHoras;
}

function filaInsumoUsadoHtml(item = { insumo_id: '', cantidad: 1 }) {
  const options = insumos.map((i) => `<option value="${i.id}" ${i.id === item.insumo_id ? 'selected' : ''}>${escapeHtml(i.nombre)}</option>`).join('');
  return `
    <div class="fila-insumo-usado" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <select class="select-insumo" style="flex:2;padding:9px;border:1px solid var(--line);border-radius:8px">
        ${options || '<option value="">— cargá insumos primero —</option>'}
      </select>
      <input type="number" step="0.01" min="0" class="input-cantidad" value="${item.cantidad}" style="flex:1;padding:9px;border:1px solid var(--line);border-radius:8px">
      <button type="button" class="icon-btn btn-quitar-fila">✕</button>
    </div>`;
}

function renderProductos() {
  const tbody = $('#tabla-productos tbody');
  tbody.innerHTML = '';
  $('#productos-vacio').classList.toggle('hidden', productos.length > 0);
  $('#tabla-productos').classList.toggle('hidden', productos.length === 0);
  productos.forEach((p) => {
    const costo = calcularCostoProducto(p.insumos_usados, p.horas);
    const ganancia = Number(p.precio) - costo;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(p.nombre)}<br><span style="font-size:11.5px;color:var(--ink-soft)">${p.tipo === 'digital' ? 'Digital' : 'Artesanal'}${p.categoria ? ' · ' + escapeHtml(p.categoria) : ''}</span></td>
      <td class="num">$${costo.toFixed(2)}</td>
      <td class="num">$${Number(p.precio).toFixed(2)}</td>
      <td class="num" style="color:${ganancia >= 0 ? 'var(--sage)' : 'var(--danger)'}">$${ganancia.toFixed(2)}</td>
      <td>${p.publico ? '<span class="tag tag-listo">Sí</span>' : '<span class="tag" style="background:#eee;color:#888">No</span>'}</td>
      <td class="toolbar">
        <button class="icon-btn btn-editar" data-id="${p.id}">Editar</button>
        <button class="icon-btn btn-eliminar" data-id="${p.id}">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-editar').forEach((b) => b.addEventListener('click', () => abrirModalProducto(productos.find((x) => x.id === b.dataset.id))));
  tbody.querySelectorAll('.btn-eliminar').forEach((b) => b.addEventListener('click', () => eliminarProducto(b.dataset.id)));
}

async function subirImagenesProducto(files) {
  const urls = [];
  for (const file of files) {
    const path = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error } = await db.storage.from('productos-imagenes').upload(path, file);
    if (!error) {
      const { data } = db.storage.from('productos-imagenes').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
  }
  return urls;
}

function abrirModalProducto(producto) {
  const editando = !!producto;
  let imagenesExistentes = editando && producto.imagenes ? [...producto.imagenes] : [];
  let imagenesNuevas = []; // File objects pendientes de subir
  const tipoActual = editando ? (producto.tipo || 'artesanal') : 'artesanal';

  const opcionesCategoria = (tipo) => (tipo === 'digital' ? CATEGORIAS_DIGITAL : CATEGORIAS_ARTESANAL)
    .map((c) => `<option value="${c}">${c}</option>`).join('');

  abrirModal(`
    <h3>${editando ? 'Editar' : 'Nuevo'} producto</h3>
    <form id="form-producto">
      <div class="field"><label>Nombre</label><input type="text" id="prod-nombre" required value="${editando ? escapeHtml(producto.nombre) : ''}"></div>
      <div class="field"><label>Descripción</label><textarea id="prod-desc">${editando ? escapeHtml(producto.descripcion || '') : ''}</textarea></div>
      <div class="row2">
        <div class="field"><label>Tipo de producto</label>
          <select id="prod-tipo">
            <option value="artesanal" ${tipoActual === 'artesanal' ? 'selected' : ''}>Producto Artesanal</option>
            <option value="digital" ${tipoActual === 'digital' ? 'selected' : ''}>Imprimible Digital</option>
          </select>
        </div>
        <div class="field"><label>Categoría</label>
          <select id="prod-categoria">${opcionesCategoria(tipoActual)}</select>
        </div>
      </div>
      <div class="row2">
        <div class="field"><label>Código (opcional)</label><input type="text" id="prod-codigo" value="${editando ? escapeHtml(producto.codigo || '') : ''}"></div>
        <div class="field"><label>Unidades disponibles</label><input type="number" step="1" min="0" id="prod-unidades" value="${editando ? producto.unidades_disponibles : 0}"></div>
      </div>

      <label style="display:block;font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin-bottom:8px">Insumos utilizados</label>
      <div id="filas-insumos"></div>
      <button type="button" class="btn btn-outline btn-sm" id="btn-agregar-fila" style="margin-bottom:16px">+ Agregar insumo</button>

      <div class="row2">
        <div class="field"><label>Horas de trabajo</label><input type="number" step="0.1" min="0" id="prod-horas" value="${editando ? producto.horas : 0}"></div>
        <div class="field"><label>Margen de ganancia %</label><input type="number" step="1" min="0" id="prod-margen" value="${editando ? producto.margen_ganancia : 80}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Costo total (insumos + horas)</label><input type="text" id="prod-costo-calc" class="num" disabled value="$0.00"></div>
        <div class="field"><label>Precio sugerido</label><input type="text" id="prod-sugerido-calc" class="num" disabled value="$0.00"></div>
      </div>
      <div class="field"><label>Precio de venta (el que se muestra en el catálogo)</label><input type="number" step="0.01" min="0" id="prod-precio" required value="${editando ? producto.precio : ''}"></div>

      <label style="display:block;font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin-bottom:8px">Fotos (hasta 5)</label>
      <div id="imagenes-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px"></div>
      <input type="file" id="prod-imagenes-input" accept="image/*" multiple style="margin-bottom:16px">

      <div class="field" style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="prod-publico" style="width:auto" ${editando && producto.publico ? 'checked' : ''}>
        <label style="margin:0;text-transform:none;font-weight:500;font-size:14px;letter-spacing:0">Mostrar en mi catálogo público</label>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary" id="btn-guardar-producto">${editando ? 'Guardar cambios' : 'Crear producto'}</button>
        <button type="button" class="btn btn-outline" id="btn-cancelar-modal">Cancelar</button>
      </div>
    </form>
  `);

  if (editando && producto.categoria) $('#prod-categoria').value = producto.categoria;
  $('#prod-tipo').addEventListener('change', () => {
    $('#prod-categoria').innerHTML = opcionesCategoria($('#prod-tipo').value);
  });

  const filasCont = $('#filas-insumos');
  function agregarFila(item) {
    const div = document.createElement('div');
    div.innerHTML = filaInsumoUsadoHtml(item);
    const fila = div.firstElementChild;
    filasCont.appendChild(fila);
    fila.querySelector('.btn-quitar-fila').addEventListener('click', () => { fila.remove(); actualizarCostoCalc(); });
    fila.querySelector('.select-insumo').addEventListener('change', actualizarCostoCalc);
    fila.querySelector('.input-cantidad').addEventListener('input', actualizarCostoCalc);
  }
  function actualizarCostoCalc() {
    const filas = [...filasCont.querySelectorAll('.fila-insumo-usado')];
    const usados = filas.map((f) => ({
      insumo_id: f.querySelector('.select-insumo').value,
      cantidad: parseFloat(f.querySelector('.input-cantidad').value) || 0,
    })).filter((u) => u.insumo_id);
    const horas = parseFloat($('#prod-horas').value) || 0;
    const margen = parseFloat($('#prod-margen').value) || 0;
    const costo = calcularCostoProducto(usados, horas);
    $('#prod-costo-calc').value = '$' + costo.toFixed(2);
    $('#prod-sugerido-calc').value = '$' + (costo * (1 + margen / 100)).toFixed(2);
  }

  (editando && producto.insumos_usados ? producto.insumos_usados : []).forEach(agregarFila);
  $('#btn-agregar-fila').addEventListener('click', () => agregarFila());
  $('#prod-horas').addEventListener('input', actualizarCostoCalc);
  $('#prod-margen').addEventListener('input', actualizarCostoCalc);
  actualizarCostoCalc();

  // ---- Manejo de fotos ----
  function renderPreviews() {
    const cont = $('#imagenes-preview');
    cont.innerHTML = '';
    const totalActual = imagenesExistentes.length + imagenesNuevas.length;
    imagenesExistentes.forEach((url, idx) => {
      const div = document.createElement(
