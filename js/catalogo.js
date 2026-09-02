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

async function cargarCatalogo() {
  if (!SUPABASE_CONFIGURADO) {
    mostrarError('Esta tienda todavía no terminó de configurarse.');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('tienda');
  if (!slug) { mostrarError('Falta indicar qué catálogo mostrar.'); return; }

  try {
    const { data: perfil, error: e1 } = await db.from('profiles').select('*').eq('slug', slug).single();
    if (e1 || !perfil) { mostrarError('No encontramos este catálogo.'); return; }

    const { data: productos, error: e2 } = await db
      .from('productos')
      .select('*')
      .eq('user_id', perfil.id)
      .eq('publico', true)
      .order('created_at', { ascending: false });
    if (e2) { mostrarError('No se pudo cargar el catálogo. Probá de nuevo en un momento.'); return; }

    document.getElementById('cat-nombre-negocio').textContent = perfil.nombre_negocio;
    const grid = document.getElementById('cat-grid');

    if (!productos || productos.length === 0) {
      grid.innerHTML = `<p style="color:rgba(247,241,228,.7);text-align:center;grid-column:1/-1">
        Todavía no hay productos publicados.</p>`;
    } else {
      grid.innerHTML = productos.map((p, prodIdx) => {
        const fotos = (p.imagenes && p.imagenes.length) ? p.imagenes : [];
        const imgPrincipal = fotos.length
          ? `<img class="kraft-img" id="img-principal-${prodIdx}" src="${escapeHtml(fotos[0])}" alt="${escapeHtml(p.nombre)}">`
          : `<div class="kraft-img"></div>`;
        const miniaturas = fotos.length > 1
          ? `<div class="kraft-thumbs">${fotos.map((url, i) => `<img src="${escapeHtml(url)}" class="kraft-thumb${i === 0 ? ' activa' : ''}" data-prod="${prodIdx}" data-idx="${i}">`).join('')}</div>`
          : '';
        const sinStock = Number(p.unidades_disponibles) <= 0;
        const stockTxt = sinStock
          ? `<span class="tag" style="background:#fde0e4;color:#c4485f;margin-bottom:8px">Sin stock</span>`
          : `<span class="tag tag-listo" style="margin-bottom:8px">Quedan ${Number(p.unidades_disponibles)}</span>`;
        const waBtn = perfil.whatsapp
          ? `<a class="kraft-wa" target="_blank" href="https://wa.me/${escapeHtml(perfil.whatsapp)}?text=${encodeURIComponent('Hola! Quiero consultar por: ' + p.nombre + (p.codigo ? ' (cod. ' + p.codigo + ')' : ''))}">Pedir por WhatsApp</a>`
          : '';
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
              ${waBtn}
            </div>
          </div>`;
      }).join('');

      grid.querySelectorAll('.kraft-thumb').forEach((thumb) => {
        thumb.addEventListener('click', () => {
          const prodIdx = thumb.dataset.prod;
          const url = thumb.getAttribute('src');
          document.getElementById('img-principal-' + prodIdx).src = url;
          thumb.parentElement.querySelectorAll('.kraft-thumb').forEach((t) => t.classList.remove('activa'));
          thumb.classList.add('activa');
        });
      });
    }

    document.getElementById('pantalla-cargando').classList.add('hidden');
    document.getElementById('catalogo').classList.remove('hidden');
  } catch (err) {
    mostrarError('No se pudo conectar. Probá de nuevo en un momento.');
  }
}

cargarCatalogo();
