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
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [cart, setCart] = useState<Cart>(new Cart());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Admin New Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number | ''>('');
  const [newProdStock, setNewProdStock] = useState<number | ''>('');
  const [newProdCat, setNewProdCat] = useState('');
  const [isSubmittingProd, setIsSubmittingProd] = useState(false);

  // Sales state
  const [sales, setSales] = useState<any[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);

  // Report state
  const [report, setReport] = useState<any | null>(null);
  const [dateFrom, setDateFrom] = useState('2026-01-01T00:00:00Z');
  const [dateTo, setDateTo] = useState('2026-12-31T23:59:59Z');
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Load products & categories
  const loadCatalog = async () => {
    try {
      const res = await productRepo.list(search || undefined, selectedCat || undefined);
      setProducts(res.items);
      const cats = await productRepo.listCategories();
      setCategories(cats);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (session) {
      loadCatalog();
    }
  }, [session, selectedCat, search]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 4000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const s = await apiLogin(username, password);
      setSession(s);
      showToast(`¡Bienvenido de nuevo, ${s.username}!`, 'success');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fillQuickAuth = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  const handleLogout = () => {
    sessionRepo.clearSession();
    setSession(null);
    setCart(new Cart());
    showToast('Sesión cerrada correctamente', 'success');
  };

  const getItemQty = (prodId: string) => quantities[prodId] || 1;

  const setItemQty = (prodId: string, val: number) => {
    if (val < 1) return;
    setQuantities(prev => ({ ...prev, [prodId]: val }));
  };

  const addToCart = (product: Product) => {
    const qty = getItemQty(product.id);
    try {
      const updated = cart.addItem(product, qty);
      setCart(updated);
      showToast(`+${qty} "${product.name}" agregado al carrito`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCheckout = async () => {
    if (cart.items.length === 0) return;
    try {
      await salesRepo.placeSale(cart.items.map(i => ({ productId: i.product.id, quantity: i.quantity })));
      setCart(new Cart());
      showToast('¡Venta confirmada y registrada con éxito!', 'success');
      loadCatalog();
      setView('sales');
      loadSales();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const loadSales = async () => {
    setIsLoadingSales(true);
    try {
      const data = await salesRepo.listSales();
      setSales(data.items);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoadingSales(false);
    }
  };

  const loadReport = async () => {
    setIsLoadingReport(true);
    try {
      const data = await salesRepo.getReport(dateFrom, dateTo);
      setReport(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice || !newProdStock || !newProdCat) {
      showToast('Por favor completa todos los campos del producto', 'error');
      return;
    }
    setIsSubmittingProd(true);
    try {
      await productRepo.create(
        newProdName,
        Number(newProdPrice),
        Number(newProdStock),
        newProdCat
      );
      showToast(`Producto "${newProdName}" creado con éxito`, 'success');
      setShowAddModal(false);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdStock('');
      setNewProdCat('');
      loadCatalog();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingProd(false);
    }
  };

  // ----------------------------------------------------
  // VISTA: LOGIN ELEGANTE
  // ----------------------------------------------------
  if (!session) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        padding: 20,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow decorativo de fondo */}
        <div style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, rgba(0,0,0,0) 70%)',
          top: '-10%',
          right: '-10%',
          pointerEvents: 'none'
        }} />

        <div style={{
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          width: '100%',
          maxWidth: 440,
          padding: 40,
          position: 'relative',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {/* Logo y Encabezado */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 56,
              height: 56,
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              borderRadius: 16,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)',
              marginBottom: 16
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Simple Stock Flow</h1>
            <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Control de Stock y Ventas con Arquitectura Onion</p>
          </div>

          {/* Banner de Error */}
          {authError && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: 10,
              marginBottom: 20,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ej. admin"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #e2e8f0',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: '#f8fafc'
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #e2e8f0',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: '#f8fafc'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#fff',
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                fontWeight: 700,
                fontSize: 15,
                cursor: isLoggingIn ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                transition: 'transform 0.1s'
              }}
            >
              {isLoggingIn ? 'Autenticando...' : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Autocompletar rápido de demostración */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Accesos Rápidos de Prueba
            </span>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => fillQuickAuth('admin', 'Admin12345!')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                👑 Admin Demo
              </button>
              <button
                type="button"
                onClick={() => fillQuickAuth('vendedor_demo', 'Password123!')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                🛒 Vendedor Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VISTA PRINCIPAL (AUTENTICADO)
  // ----------------------------------------------------
  const totalCartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* NAVBAR MODERNO */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
      }}>
        <div style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Logo y Enlaces */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setView('catalog')}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                </svg>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>Simple Stock Flow</span>
            </div>

            <nav style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setView('catalog')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: view === 'catalog' ? '#eef2ff' : 'transparent',
                  color: view === 'catalog' ? '#4f46e5' : '#475569',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  transition: 'all 0.15s'
                }}
              >
                <span>📦</span> Catálogo
              </button>

              <button
                onClick={() => setView('cart')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: view === 'cart' ? '#eef2ff' : 'transparent',
                  color: view === 'cart' ? '#4f46e5' : '#475569',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  transition: 'all 0.15s'
                }}
              >
                <span>🛒</span> Carrito
                {totalCartCount > 0 && (
                  <span style={{
                    background: '#4f46e5',
                    color: '#fff',
                    borderRadius: 12,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    {totalCartCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setView('sales'); loadSales(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: view === 'sales' ? '#eef2ff' : 'transparent',
                  color: view === 'sales' ? '#4f46e5' : '#475569',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  transition: 'all 0.15s'
                }}
              >
                <span>📜</span> Ventas
              </button>

              <button
                onClick={() => { setView('report'); loadReport(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: view === 'report' ? '#eef2ff' : 'transparent',
                  color: view === 'report' ? '#4f46e5' : '#475569',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  transition: 'all 0.15s'
                }}
              >
                <span>📊</span> Reporte
              </button>
            </nav>
          </div>

          {/* Info de Usuario y Salir */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#f1f5f9',
              padding: '6px 12px',
              borderRadius: 30,
              fontSize: 13
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{session.username}</span>
              <span style={{
                background: session.role === 'admin' ? '#e0e7ff' : '#ccfbf1',
                color: session.role === 'admin' ? '#4338ca' : '#0f766e',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
                textTransform: 'uppercase'
              }}>
                {session.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* TOAST FLOTANTE DE NOTIFICACIONES */}
      {message && (
        <div style={{
          position: 'fixed',
          top: 70,
          right: 24,
          zIndex: 50,
          background: message.type === 'success' ? '#065f46' : '#991b1b',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: 10,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          fontSize: 14,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL SEGÚN VISTA */}
      <main style={{ maxWidth: 1280, margin: '0 auto', width: '100%', padding: '28px 24px', flex: 1 }}>

        {/* ==================================================== */}
        {/* VISTA 1: CATÁLOGO DE PRODUCTOS                       */}
        {/* ==================================================== */}
        {view === 'catalog' && (
          <div>
            {/* Header de la sección y barra de búsqueda */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              marginBottom: 28,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16
            }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Catálogo de Existencias</h2>
                <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>
                  Control en tiempo real · {products.length} productos disponibles
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Input Búsqueda */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      padding: '10px 14px 10px 34px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 14,
                      outline: 'none',
                      width: 220
                    }}
                  />
                  <span style={{ position: 'absolute', left: 10, top: 11, color: '#94a3b8' }}>🔍</span>
                </div>

                {/* Filtro Categoría */}
                <select
                  value={selectedCat}
                  onChange={e => setSelectedCat(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 14,
                    outline: 'none',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Todas las Categorías</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* Botón Admin Nuevo Producto */}
                {session.role === 'admin' && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: 10,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
                    }}
                  >
                    <span>+</span> Nuevo Producto
                  </button>
                )}
              </div>
            </div>

            {/* Grid de Productos */}
            {products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 48 }}>📦</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>No se encontraron productos</h3>
                <p style={{ color: '#64748b', fontSize: 14 }}>Intenta ajustar tu búsqueda o filtro de categorías.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 24 }}>
                {products.map(p => {
                  const currentQty = getItemQty(p.id);
                  const isAvailable = p.stock > 0;
                  return (
                    <div
                      key={p.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 16,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                        transition: 'transform 0.15s, box-shadow 0.15s'
                      }}
                    >
                      {/* Portada / Header de tarjeta */}
                      <div style={{
                        height: 120,
                        background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 42, opacity: 0.85 }}>
                            {p.categoryName?.includes('Bebida') ? '☕' : p.categoryName?.includes('Snack') ? '🥨' : p.categoryName?.includes('Pan') ? '🥖' : '📦'}
                          </span>
                        )}
                        <span style={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          background: 'rgba(255, 255, 255, 0.9)',
                          color: '#4338ca',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 8,
                          backdropFilter: 'blur(4px)'
                        }}>
                          {p.categoryName}
                        </span>
                      </div>

                      {/* Cuerpo de la tarjeta */}
                      <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{p.name}</h3>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#4f46e5', marginBottom: 10 }}>
                            {p.price.format()}
                          </div>

                          {/* Pill de Estado de Stock */}
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: isAvailable ? (p.stock <= 5 ? '#fffbeb' : '#ecfdf5') : '#fef2f2',
                            color: isAvailable ? (p.stock <= 5 ? '#b45309' : '#047857') : '#b91c1c',
                            marginBottom: 16
                          }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isAvailable ? (p.stock <= 5 ? '#f59e0b' : '#10b981') : '#ef4444'
                            }}></span>
                            <span>
                              {isAvailable ? `${p.stock} unidades en stock` : 'Agotado'}
                            </span>
                          </div>
                        </div>

                        {/* Selector de cantidad y botón */}
                        {isAvailable ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              border: '1.5px solid #e2e8f0',
                              borderRadius: 8,
                              background: '#f8fafc'
                            }}>
                              <button
                                onClick={() => setItemQty(p.id, currentQty - 1)}
                                style={{ background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                -
                              </button>
                              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>
                                {currentQty}
                              </span>
                              <button
                                onClick={() => setItemQty(p.id, Math.min(p.stock, currentQty + 1))}
                                style={{ background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                +
                              </button>
                            </div>

                            <button
                              onClick={() => addToCart(p)}
                              style={{
                                flex: 1,
                                background: '#4f46e5',
                                color: '#fff',
                                border: 'none',
                                padding: '9px 12px',
                                borderRadius: 8,
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                transition: 'background 0.15s'
                              }}
                            >
                              <span>🛒</span> Agregar
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled
                            style={{
                              width: '100%',
                              background: '#e2e8f0',
                              color: '#94a3b8',
                              border: 'none',
                              padding: '9px 12px',
                              borderRadius: 8,
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: 'not-allowed'
                            }}
                          >
                            No disponible
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* VISTA 2: CARRITO DE VENTA                            */}
        {/* ==================================================== */}
        {view === 'cart' && (
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>
              Carrito de Ventas ({totalCartCount} artículos)
            </h2>

            {cart.items.length === 0 ? (
              <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: 56 }}>🛒</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 16 }}>Tu carrito está actualmente vacío</h3>
                <p style={{ color: '#64748b', fontSize: 14, margin: '8px 0 20px' }}>
                  Selecciona productos desde el catálogo para iniciar una venta.
                </p>
                <button
                  onClick={() => setView('catalog')}
                  style={{
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Explorar Catálogo
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
                {/* Tabla de Artículos */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: 13 }}>
                        <th style={{ paddingBottom: 12 }}>Producto</th>
                        <th style={{ paddingBottom: 12 }}>Precio Unitario</th>
                        <th style={{ paddingBottom: 12, textAlign: 'center' }}>Cantidad</th>
                        <th style={{ paddingBottom: 12, textAlign: 'right' }}>Subtotal</th>
                        <th style={{ paddingBottom: 12 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.items.map(item => (
                        <tr key={item.product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px 0' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.product.name}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{item.product.categoryName}</div>
                          </td>
                          <td style={{ padding: '16px 0', fontSize: 14 }}>{item.product.price.format()}</td>
                          <td style={{ padding: '16px 0', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                          <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 800, color: '#4f46e5' }}>
                            {item.subtotal.format()}
                          </td>
                          <td style={{ padding: '16px 0', textAlign: 'right' }}>
                            <button
                              onClick={() => setCart(cart.removeItem(item.product.id))}
                              title="Quitar producto"
                              style={{
                                background: '#fee2e2',
                                color: '#dc2626',
                                border: 'none',
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontWeight: 700
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen de la Venta */}
                <div style={{
                  background: '#fff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  padding: 24,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 18, color: '#0f172a' }}>Resumen de Orden</h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#64748b' }}>
                    <span>Líneas de producto</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{cart.items.length}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#64748b' }}>
                    <span>Unidades totales</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalCartCount}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 14, color: '#64748b' }}>
                    <span>Moneda de transacción</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>COP</span>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Total a Pagar</span>
                      <span style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>
                        {cart.getTotal().format()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '14px',
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      transition: 'transform 0.1s'
                    }}
                  >
                    Confirmar y Registrar Venta
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* VISTA 3: HISTORIAL DE VENTAS                         */}
        {/* ==================================================== */}
        {view === 'sales' && (
          <div>
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #e2e8f0',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Historial de Ventas Inmutables</h2>
                <p style={{ color: '#64748b', fontSize: 14 }}>Trazabilidad registrada permanentemente sin modificaciones posteriores (RN-07)</p>
              </div>
              <button
                onClick={loadSales}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                🔄 Actualizar
              </button>
            </div>

            {isLoadingSales ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Cargando ventas...</div>
            ) : sales.length === 0 ? (
              <div style={{ background: '#fff', padding: 40, borderRadius: 16, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 40 }}>📜</span>
                <p style={{ color: '#64748b', marginTop: 12 }}>No hay registros de ventas históricas en el sistema.</p>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: 13 }}>
                      <th style={{ padding: '14px 20px' }}>ID Transacción</th>
                      <th style={{ padding: '14px 20px' }}>Vendedor</th>
                      <th style={{ padding: '14px 20px' }}>Fecha y Hora (UTC)</th>
                      <th style={{ padding: '14px 20px' }}>Ítems</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right' }}>Total Facturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 20px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#4f46e5', fontWeight: 600 }}>
                          #{s.id.substring(0, 8)}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            background: '#f1f5f9',
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#334155'
                          }}>
                            👤 {s.sellerUsername}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: '#64748b' }}>
                          {new Date(s.createdAt).toLocaleString('es-CO')}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13 }}>
                          <strong>{s.itemsCount}</strong> productos
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 15 }}>
                          ${Number(s.total).toLocaleString('es-CO')} {s.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* VISTA 4: REPORTE FINANCIERO CONSOLIDADO              */}
        {/* ==================================================== */}
        {view === 'report' && (
          <div>
            {/* Controles de Filtro de Fechas */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #e2e8f0',
              marginBottom: 24
            }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Reporte Consolidado de Ventas</h2>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
                Afirmación 3: Reporte inalterable generado exclusivamente sobre líneas congeladas (DP-01)
              </p>

              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Fecha Inicial (ISO UTC)
                  </label>
                  <input
                    type="text"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, width: 220 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Fecha Final (ISO UTC)
                  </label>
                  <input
                    type="text"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: 13, width: 220 }}
                  />
                </div>

                <button
                  onClick={loadReport}
                  disabled={isLoadingReport}
                  style={{
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    padding: '11px 20px',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  {isLoadingReport ? 'Calculando...' : '📊 Generar Reporte'}
                </button>
              </div>
            </div>

            {/* Resultados del Reporte */}
            {report && (
              <div>
                {/* KPI Card */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 20,
                  marginBottom: 24
                }}>
                  <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Facturado</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981', marginTop: 6 }}>
                      ${Number(report.totalAmount).toLocaleString('es-CO')} <span style={{ fontSize: 16 }}>{report.currency}</span>
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Líneas Vendidas</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#4f46e5', marginTop: 6 }}>
                      {report.items.reduce((s: number, i: any) => s + i.unitsSold, 0)} <span style={{ fontSize: 16 }}>unidades</span>
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Productos Distintos</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginTop: 6 }}>
                      {report.items.length} <span style={{ fontSize: 16 }}>referencias</span>
                    </div>
                  </div>
                </div>

                {/* Tabla de Desglose */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: 13 }}>
                        <th style={{ padding: '14px 20px' }}>Producto (Nombre Congelado)</th>
                        <th style={{ padding: '14px 20px', textAlign: 'center' }}>Unidades Vendidas</th>
                        <th style={{ padding: '14px 20px', textAlign: 'right' }}>Monto Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.items.map((r: any) => (
                        <tr key={r.productId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>
                            {r.productName}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 700 }}>
                            {r.unitsSold}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: '#4f46e5', fontSize: 15 }}>
                            ${Number(r.totalAmount).toLocaleString('es-CO')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ==================================================== */}
      {/* MODAL ADMIN: NUEVO PRODUCTO (E-05)                   */}
      {/* ==================================================== */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 20
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 20,
            maxWidth: 480,
            width: '100%',
            padding: 32,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Registrar Nuevo Producto</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  placeholder="Ej. Chocolate Amargo 70%"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    Precio (COP)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newProdPrice}
                    onChange={e => setNewProdPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej. 18000"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newProdStock}
                    onChange={e => setNewProdStock(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej. 25"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Categoría
                </label>
                <select
                  required
                  value={newProdCat}
                  onChange={e => setNewProdCat(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="">Selecciona una categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '10px',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProd}
                  style={{
                    flex: 1,
                    background: '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    padding: '10px',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isSubmittingProd ? 'Guardando...' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}