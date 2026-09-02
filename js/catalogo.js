function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (s) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

function mostrarError(msg) {
  document.getElementById('pantalla-cargando').classList.add('hidden');
  document.getElementById('pantalla-error').classList.remove('hidden');
  document.getElementById('mensaje-error').textContent = msg;
}

let productosGlobal = [];
let perfilGlobal = null;
let slugGlobal = '';
let carrito = {}; // { producto_id: cantidad }

function claveCarrito() { return 'carrito_' + slugGlobal; }
function cargarCarritoStorage() {
  try { return JSON.parse(localStorage.getItem(claveCarrito())) || {}; }
  catch { return {}; }
}
function guardarCarritoStorage() {
  try { localStorage.setItem(claveCarrito(), JSON.stringify(carrito)); } catch {}
}

async function cargarCatalogo() {
  if (!SUPABASE_CONFIGURADO) {
    mostrarError('Esta tienda todavía no terminó de configurarse.');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('tienda');
  if (!slug) { mostrarError('Falta indicar qué catálogo mostrar.'); return; }
  slugGlobal = slug;

  try {
    const { data: perfil, error: e1 } = await db.from('profiles').select('*').eq('slug', slug).single();
    if (e1 || !perfil) { mostrarError('No encontramos este catálogo.'); return; }
    perfilGlobal = perfil;

    const { data: productos, error: e2 } = await db
      .from('productos')
      .select('*')
      .eq('user_id', perfil.id)
      .eq('publico', true)
      .order('created_at', { ascending: false });
    if (e2) { mostrarError('No se pudo cargar el catálogo. Probá de nuevo en un momento.'); return; }

    productosGlobal = productos || [];
    carrito = cargarCarritoStorage();
    Object.keys(carrito).forEach((id) => { if (!productosGlobal.find((p) => p.id === id)) delete carrito[id]; });
    guardarCarritoStorage();

    document.getElementById('cat-nombre-negocio').textContent = perfil.nombre_negocio;
    renderGrid();
    actualizarCarritoFlotante();

    document.getElementById('pantalla-cargando').classList.add('hidden');
    document.getElementById('catalogo').classList.remove('hidden');
  } catch (err) {
    mostrarError('No se pudo conectar. Probá de nuevo en un momento.');
  }
}

function renderGrid() {
  const grid = document.getElementById('cat-grid');
  if (!productosGlobal.length) {
    grid.innerHTML = `<p style="color:rgba(255,255,255,.7);text-align:center;grid-column:1/-1">
      Todavía no hay productos publicados.</p>`;
    return;
  }

  grid.innerHTML = productosGlobal.map((p, prodIdx) => {
    const fotos = (p.imagenes && p.imagenes.length) ? p.imagenes : [];
    const imgPrincipal = fotos.length
      ? `<img class="kraft-img" id="img-principal-${prodIdx}" src="${escapeHtml(fotos[0])}" alt="${escapeHtml(p.nombre)}">`
      : `<div class="kraft-img"></div>`;
    const miniaturas = fotos.length > 1
      ? `<div class="kraft-thumbs">${fotos.map((url, i) => `<img src="${escapeHtml(url)}" class="kraft-thumb${i === 0 ? ' activa' : ''}" data-prod="${prodIdx}" data-idx="${i}">`).join('')}</div>`
      : '';
    const disponible = Number(p.unidades_disponibles) || 0;
    const sinStock = disponible <= 0;
    const stockTxt = sinStock
      ? `<span class="tag" style="background:#fde0e4;color:#c4485f;margin-bottom:8px">Sin stock</span>`
      : `<span class="tag tag-listo" style="margin-bottom:8px">Quedan ${disponible}</span>`;
    const enCarrito = carrito[p.id] || 0;

    return `
      <div class="kraft-tag">
        ${imgPrincipal}
        ${miniaturas}
        <div class="kraft-body">
          ${p.codigo ? `<p class="kraft-desc" style="padding-left:20px;margin-bottom:4px">Cód. ${escapeHtml(p.codigo)}</p>` : ''}
          <h3>${escapeHtml(p.nombre)}</h3>
          ${p.descripcion ? `<p class="kraft-desc">${escapeHtml(p.descripcion)}</p>` : ''}
          <div style="padding-left:20px">${stockTxt}</div>
          <div class="kraft-price">$${Number(p.precio).toFixed(2)}</div>
        </div>
        ${sinStock ? '' : `
          <div class="carrito-stepper" data-prod-id="${p.id}">
            <button type="button" class="qty-btn btn-menos" ${enCarrito <= 0 ? 'disabled' : ''}>−</button>
            <span class="qty-valor">${enCarrito}</span>
            <button type="button" class="qty-btn btn-mas" ${enCarrito >= disponible ? 'disabled' : ''}>+</button>
          </div>
          <button type="button" class="btn-agregar-carrito" data-prod-id="${p.id}" ${enCarrito <= 0 ? 'disabled' : ''}>
            ${enCarrito > 0 ? 'Actualizar pedido' : 'Elegí una cantidad'}
          </button>`}
      </div>`;
  }).join('');

  grid.querySelectorAll('.kraft-thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const prodIdx = thumb.dataset.prod;
      document.getElementById('img-principal-' + prodIdx).src = thumb.getAttribute('src');
      thumb.parentElement.querySelectorAll('.kraft-thumb').forEach((t) => t.classList.remove('activa'));
      thumb.classList.add('activa');
    });
  });

  grid.querySelectorAll('.carrito-stepper').forEach((stepper) => {
    const prodId = stepper.dataset.prodId;
    const producto = productosGlobal.find((p) => p.id === prodId);
    const disponible = Number(producto.unidades_disponibles) || 0;
    const valorEl = stepper.querySelector('.qty-valor');
    const btnMenos = stepper.querySelector('.btn-menos');
    const btnMas = stepper.querySelector('.btn-mas');
    const btnAgregar = stepper.closest('.kraft-tag').querySelector('.btn-agregar-carrito');
    let cantidadLocal = carrito[prodId] || 0;

    function actualizarUI() {
      valorEl.textContent = cantidadLocal;
      btnMenos.disabled = cantidadLocal <= 0;
      btnMas.disabled = cantidadLocal >= disponible;
      btnAgregar.disabled = cantidadLocal <= 0;
      btnAgregar.textContent = cantidadLocal > 0 ? 'Actualizar pedido' : 'Elegí una cantidad';
    }
    btnMenos.addEventListener('click', () => { if (cantidadLocal > 0) { cantidadLocal--; actualizarUI(); } });
    btnMas.addEventListener('click', () => { if (cantidadLocal < disponible) { cantidadLocal++; actualizarUI(); } });
    btnAgregar.addEventListener('click', () => {
      if (cantidadLocal > 0) carrito[prodId] = cantidadLocal;
      else delete carrito[prodId];
      guardarCarritoStorage();
      actualizarCarritoFlotante();
      btnAgregar.textContent = '¡Agregado! ✓';
      setTimeout(() => { btnAgregar.textContent = 'Actualizar pedido'; }, 1200);
    });
  });
}

function totalCarrito() {
  let total = 0, cantidad = 0;
  Object.entries(carrito).forEach(([id, qty]) => {
    const p = productosGlobal.find((pr) => pr.id === id);
    if (p) { total += Number(p.precio) * qty; cantidad += qty; }
  });
  return { total, cantidad };
}

function actualizarCarritoFlotante() {
  const { total, cantidad } = totalCarrito();
  const flotante = document.getElementById('carrito-flotante');
  flotante.classList.toggle('hidden', cantidad === 0);
  document.getElementById('carrito-cantidad').textContent = cantidad + (cantidad === 1 ? ' producto' : ' productos');
  document.getElementById('carrito-total').textContent = '$' + total.toFixed(2);
}

function abrirCarritoModal() {
  const items = Object.entries(carrito).map(([id, qty]) => {
    const p = productosGlobal.find((pr) => pr.id === id);
    return p ? { p, qty } : null;
  }).filter(Boolean);

  const { total } = totalCarrito();

  const filasHtml = items.length
    ? items.map(({ p, qty }) => `
        <div class="carrito-item">
          <div>
            <div class="carrito-item-nombre">${escapeHtml(p.nombre)}</div>
            <div class="carrito-item-precio">${qty} × $${Number(p.precio).toFixed(2)} = $${(Number(p.precio) * qty).toFixed(2)}</div>
          </div>
          <button type="button" class="icon-btn btn-quitar-carrito" data-prod-id="${p.id}">Quitar</button>
        </div>`).join('')
    : `<div class="carrito-vacio">Todavía no agregaste productos.</div>`;

  const sinWhatsapp = !perfilGlobal.whatsapp;

  document.getElementById('carrito-modal-root').innerHTML = `
    <div class="modal-bg" id="carrito-modal-bg">
      <div class="modal">
        <h3>Tu pedido</h3>
        ${filasHtml}
        ${items.length ? `<div class="carrito-total-row"><span>Total</span><span>$${total.toFixed(2)}</span></div>` : ''}
        ${sinWhatsapp ? `<p style="font-size:13px;color:var(--danger);margin-top:14px">Esta tienda todavía no configuró un WhatsApp para recibir pedidos.</p>` : ''}
        <div class="modal-actions" style="margin-top:20px">
          ${items.length ? `<button type="button" class="btn btn-primary" id="btn-enviar-pedido" ${sinWhatsapp ? 'disabled' : ''}>Enviar pedido por WhatsApp</button>` : ''}
          <button type="button" class="btn btn-outline" id="btn-cerrar-carrito">Cerrar</button>
        </div>
      </div>
    </div>`;

  document.getElementById('carrito-modal-bg').addEventListener('click', (e) => {
    if (e.target.id === 'carrito-modal-bg') cerrarCarritoModal();
  });
  document.getElementById('btn-cerrar-carrito').addEventListener('click', cerrarCarritoModal);
  document.querySelectorAll('.btn-quitar-carrito').forEach((btn) => {
    btn.addEventListener('click', () => {
      delete carrito[btn.dataset.prodId];
      guardarCarritoStorage();
      actualizarCarritoFlotante();
      renderGrid();
      abrirCarritoModal();
    });
  });
  const btnEnviar = document.getElementById('btn-enviar-pedido');
  if (btnEnviar) btnEnviar.addEventListener('click', enviarPedidoWhatsApp);
}
function cerrarCarritoModal() { document.getElementById('carrito-modal-root').innerHTML = ''; }

function enviarPedidoWhatsApp() {
  const items = Object.entries(carrito).map(([id, qty]) => {
    const p = productosGlobal.find((pr) => pr.id === id);
    return p ? { p, qty } : null;
  }).filter(Boolean);
  if (!items.length || !perfilGlobal.whatsapp) return;

  const { total } = totalCarrito();
  let mensaje = `Hola! Quiero hacer este pedido:\n\n`;
  items.forEach(({ p, qty }) => {
    mensaje += `• ${p.nombre}${p.codigo ? ' (cod. ' + p.codigo + ')' : ''} — ${qty} x $${Number(p.precio).toFixed(2)} = $${(Number(p.precio) * qty).toFixed(2)}\n`;
  });
  mensaje += `\nTotal: $${total.toFixed(2)}`;

  window.open(`https://wa.me/${perfilGlobal.whatsapp}?text=${encodeURIComponent(mensaje)}`, '_blank');

  carrito = {};
  guardarCarritoStorage();
  actualizarCarritoFlotante();
  renderGrid();
  cerrarCarritoModal();
}

document.getElementById('btn-abrir-carrito').addEventListener('click', abrirCarritoModal);

cargarCatalogo();
