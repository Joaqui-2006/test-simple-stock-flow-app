import React, { useState, useEffect } from 'react';
import { Product } from './domain/model/Product';
import { Cart } from './domain/model/Cart';
import { UserSession } from './application/ports/ISessionRepository';
import { sessionRepo, productRepo, salesRepo, apiLogin } from './infrastructure/providers';

export function App() {
  const [session, setSession] = useState<UserSession | null>(sessionRepo.getSession());
  const [view, setView] = useState<'catalog' | 'cart' | 'sales' | 'report'>('catalog');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [cart, setCart] = useState<Cart>(new Cart());
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sales state
  const [sales, setSales] = useState<any[]>([]);

  // Report state
  const [report, setReport] = useState<any | null>(null);
  const [dateFrom, setDateFrom] = useState('2026-10-01T00:00:00Z');
  const [dateTo, setDateTo] = useState('2026-10-31T23:59:59Z');

  // Load products & categories
  const loadCatalog = async () => {
    try {
      const res = await productRepo.list(search || undefined, selectedCat || undefined);
      setProducts(res.items);
      const cats = await productRepo.listCategories();
      setCategories(cats);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  useEffect(() => {
    if (session) {
      loadCatalog();
    }
  }, [session, selectedCat, search]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const s = await apiLogin(username, password);
      setSession(s);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    sessionRepo.clearSession();
    setSession(null);
    setCart(new Cart());
  };

  const addToCart = (product: Product) => {
    try {
      const updated = cart.addItem(product, 1);
      setCart(updated);
      setMessage({ text: `${product.name} agregado al carrito`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleCheckout = async () => {
    if (cart.items.length === 0) return;
    try {
      await salesRepo.placeSale(cart.items.map(i => ({ productId: i.product.id, quantity: i.quantity })));
      setCart(new Cart());
      setMessage({ text: '¡Venta registrada con éxito!', type: 'success' });
      loadCatalog();
      setView('catalog');
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const loadSales = async () => {
    try {
      const data = await salesRepo.listSales();
      setSales(data.items);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const loadReport = async () => {
    try {
      const data = await salesRepo.getReport(dateFrom, dateTo);
      setReport(data);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  if (!session) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ background: '#fff', padding: 32, borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: 360 }}>
          <h2 style={{ marginBottom: 8, fontSize: 22, fontWeight: 700 }}>Simple Stock Flow</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>Inicia sesión para operar el sistema</p>

          {authError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
              {authError}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>

          <button type="submit" style={{ width: '100%', background: 'var(--primary)', color: '#fff', padding: '10px', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
            Ingresar al Sistema
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Barra de navegación */}
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>Simple Stock Flow</h1>
          <nav style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setView('catalog')} style={{ background: view === 'catalog' ? '#eff6ff' : 'none', color: view === 'catalog' ? 'var(--primary)' : 'inherit', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
              Catálogo
            </button>
            <button onClick={() => setView('cart')} style={{ background: view === 'cart' ? '#eff6ff' : 'none', color: view === 'cart' ? 'var(--primary)' : 'inherit', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
              Carrito ({cart.items.reduce((s, i) => s + i.quantity, 0)})
            </button>
            <button onClick={() => { setView('sales'); loadSales(); }} style={{ background: view === 'sales' ? '#eff6ff' : 'none', color: view === 'sales' ? 'var(--primary)' : 'inherit', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
              Ventas
            </button>
            <button onClick={() => { setView('report'); loadReport(); }} style={{ background: view === 'report' ? '#eff6ff' : 'none', color: view === 'report' ? 'var(--primary)' : 'inherit', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
              Reporte
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14 }}>
            Usuario: <strong>{session.username}</strong> ({session.role})
          </span>
          <button onClick={handleLogout} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Salir
          </button>
        </div>
      </header>

      {/* Mensajes de notificación */}
      {message && (
        <div style={{ background: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#991b1b', padding: '12px 24px', textAlign: 'center', fontSize: 14, fontWeight: 500 }}>
          {message.text}
        </div>
      )}

      {/* Contenido según vista */}
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%', flex: 1 }}>
        {view === 'catalog' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}
              />
              <select
                value={selectedCat}
                onChange={e => setSelectedCat(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}
              >
                <option value="">Todas las Categorías</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
              {products.map(p => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 4, marginBottom: 12 }} />
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{p.categoryName}</span>
                    <h3 style={{ fontSize: 16, margin: '4px 0 8px' }}>{p.name}</h3>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{p.price.format()}</p>
                    <p style={{ fontSize: 13, color: p.stock > 0 ? 'var(--text-muted)' : 'var(--danger)', marginTop: 4 }}>
                      Stock disponible: <strong>{p.stock}</strong>
                    </p>
                  </div>
                  <button
                    disabled={p.stock <= 0}
                    onClick={() => addToCart(p)}
                    style={{ marginTop: 16, background: p.stock > 0 ? 'var(--primary)' : '#cbd5e1', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, fontWeight: 600, cursor: p.stock > 0 ? 'pointer' : 'not-allowed' }}
                  >
                    {p.stock > 0 ? 'Agregar al Carrito' : 'Agotado'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'cart' && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Carrito de Venta</h2>
            {cart.items.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>El carrito está vacío.</p>
            ) : (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 0' }}>Producto</th>
                      <th style={{ padding: '8px 0' }}>Precio Unitario</th>
                      <th style={{ padding: '8px 0' }}>Cantidad</th>
                      <th style={{ padding: '8px 0' }}>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map(item => (
                      <tr key={item.product.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 0' }}>{item.product.name}</td>
                        <td style={{ padding: '12px 0' }}>{item.product.price.format()}</td>
                        <td style={{ padding: '12px 0' }}>{item.quantity}</td>
                        <td style={{ padding: '12px 0' }}>{item.subtotal.format()}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => setCart(cart.removeItem(item.product.id))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 500 }}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 20 }}>Total: {cart.getTotal().format()}</h3>
                  <button onClick={handleCheckout} style={{ background: 'var(--success)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 16 }}>
                    Confirmar y Registrar Venta
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'sales' && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Historial de Ventas</h2>
            {sales.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No hay ventas registradas.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>ID Venta</th>
                    <th style={{ padding: 8 }}>Vendedor</th>
                    <th style={{ padding: 8 }}>Fecha y Hora</th>
                    <th style={{ padding: 8 }}>Líneas</th>
                    <th style={{ padding: 8 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 8, fontSize: 13, fontFamily: 'monospace' }}>{s.id.substring(0, 8)}...</td>
                      <td style={{ padding: 8 }}>{s.sellerUsername}</td>
                      <td style={{ padding: 8 }}>{new Date(s.createdAt).toLocaleString('es-CO')}</td>
                      <td style={{ padding: 8 }}>{s.itemsCount} productos</td>
                      <td style={{ padding: 8, fontWeight: 600 }}>${Number(s.total).toLocaleString('es-CO')} {s.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === 'report' && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Reporte Consolidado de Ventas</h2>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Desde (ISO UTC)</label>
                <input type="text" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Hasta (ISO UTC)</label>
                <input type="text" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 6 }} />
              </div>
              <button onClick={loadReport} style={{ alignSelf: 'flex-end', background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                Consultar
              </button>
            </div>

            {report && (
              <div>
                <h3 style={{ fontSize: 18, marginBottom: 12 }}>Total Facturado: ${Number(report.totalAmount).toLocaleString('es-CO')} {report.currency}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>Producto (Congelado)</th>
                      <th style={{ padding: 8 }}>Unidades Vendidas</th>
                      <th style={{ padding: 8 }}>Monto Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((r: any) => (
                      <tr key={r.productId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 8 }}>{r.productName}</td>
                        <td style={{ padding: 8 }}>{r.unitsSold}</td>
                        <td style={{ padding: 8, fontWeight: 600 }}>${Number(r.totalAmount).toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}