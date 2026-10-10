import React, { useState, useEffect } from 'react';
import { Product } from './domain/model/Product';
import { Cart } from './domain/model/Cart';
import { UserSession } from './application/ports/ISessionRepository';
import { sessionRepo, productRepo, salesRepo, apiLogin, apiRegisterSeller } from './infrastructure/providers';

export function App() {
  const [session, setSession] = useState<UserSession | null>(sessionRepo.getSession());
  const [view, setView] = useState<'catalog' | 'cart' | 'sales' | 'report' | 'users'>('catalog');

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

  // Admin New Product Modal (E-05)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number | ''>('');
  const [newProdStock, setNewProdStock] = useState<number | ''>('');
  const [newProdCat, setNewProdCat] = useState('');
  const [isSubmittingProd, setIsSubmittingProd] = useState(false);

  // Admin Edit Product Modal (E-06)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editCat, setEditCat] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Admin User Registration State (E-02)
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Sales state
  const [sales, setSales] = useState<any[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);

  // Report state (Admin only)
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

  // Si un vendedor intenta entrar a vistas exclusivas de administrador, redirigir al catálogo
  useEffect(() => {
    if (session && session.role !== 'admin' && (view === 'report' || view === 'users')) {
      setView('catalog');
    }
  }, [session, view]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 4500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const s = await apiLogin(username, password);
      setSession(s);
      setView('catalog');
      showToast(`¡Bienvenido de nuevo, ${s.username}! (${s.role === 'admin' ? 'Administrador' : 'Vendedor'})`, 'success');
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

  // Cálculo de stock disponible dinámico considerando lo que ya se agregó al carrito
  const getInCartQty = (productId: string): number => {
    const item = cart.items.find(i => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  const getAvailableStock = (product: Product): number => {
    const inCart = getInCartQty(product.id);
    return Math.max(0, product.stock - inCart);
  };

  const getItemQty = (prodId: string) => quantities[prodId] || 1;

  const setItemQty = (prodId: string, val: number) => {
    if (val < 1) return;
    setQuantities(prev => ({ ...prev, [prodId]: val }));
  };

  // Agregar al carrito y decrementar stock disponible de inmediato
  const addToCart = (product: Product) => {
    const available = getAvailableStock(product);
    const qty = getItemQty(product.id);

    if (available <= 0) {
      showToast(`No quedan existencias disponibles de "${product.name}"`, 'error');
      return;
    }

    if (qty > available) {
      showToast(`Solo puedes agregar hasta ${available} unidad(es) de "${product.name}"`, 'error');
      return;
    }

    try {
      const updated = cart.addItem(product, qty);
      setCart(updated);
      const remainingAfterAdd = available - qty;
      showToast(
        `+${qty} "${product.name}" agregado al carrito (Stock restante en mostrador: ${remainingAfterAdd})`,
        'success'
      );
      // Reset selector a 1 o al nuevo remanente
      setQuantities(prev => ({ ...prev, [product.id]: 1 }));
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Modificar cantidad directamente desde el carrito
  const handleCartQtyChange = (productId: string, delta: number) => {
    const item = cart.items.find(i => i.product.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.removeItem(productId));
      showToast(`"${item.product.name}" removido del carrito. Stock liberado.`, 'success');
      return;
    }

    // Verificar contra el stock total real en inventario
    if (delta > 0 && newQty > item.product.stock) {
      showToast(`No puedes superar el stock físico total disponible (${item.product.stock})`, 'error');
      return;
    }

    const updatedItems = cart.items.map(i => {
      if (i.product.id === productId) {
        return {
          ...i,
          quantity: newQty,
          subtotal: i.product.price.multiply(newQty)
        };
      }
      return i;
    });

    setCart(new Cart(updatedItems));
  };

  // Confirmar y registrar la venta (descuenta permanente en BD)
  const handleCheckout = async () => {
    if (cart.items.length === 0) return;
    try {
      await salesRepo.placeSale(cart.items.map(i => ({ productId: i.product.id, quantity: i.quantity })));
      setCart(new Cart());
      showToast('¡Venta confirmada e inventario sincronizado en base de datos!', 'success');
      await loadCatalog();
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

  // Acción Admin: Crear Producto (E-05)
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

  // Acción Admin: Abrir Modal Editar Producto (E-06)
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditPrice(p.price.amount);
    setEditCat(p.categoryId);
  };

  // Acción Admin: Guardar Edición Producto (E-06)
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editName || !editPrice || !editCat) return;
    setIsSubmittingEdit(true);
    try {
      await productRepo.update(editingProduct.id, editName, Number(editPrice), editCat);
      showToast(`Producto "${editName}" actualizado correctamente`, 'success');
      setEditingProduct(null);
      loadCatalog();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Acción Admin: Dar de Baja Producto (E-07 / Soft Delete)
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de dar de baja el producto "${name}"? El catálogo ya no lo mostrará pero sus ventas históricas se mantendrán intactas.`)) {
      return;
    }
    try {
      await productRepo.delete(id);
      showToast(`Producto "${name}" dado de baja correctamente`, 'success');
      loadCatalog();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Acción Admin: Registrar Nuevo Vendedor (E-02)
  const handleRegisterSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regPassword) {
      showToast('Ingresa usuario y contraseña para el nuevo vendedor', 'error');
      return;
    }
    setIsSubmittingReg(true);
    try {
      const res = await apiRegisterSeller(regUsername.trim().toLowerCase(), regPassword);
      showToast(`Vendedor "${res.username}" registrado exitosamente con rol seller`, 'success');
      setRegUsername('');
      setRegPassword('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingReg(false);
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
                placeholder="Ej. admin o vendedor1"
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
                padding: '12px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: 15,
                border: 'none',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
            >
              {isLoggingIn ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
            </button>
          </form>

          {/* Botones de Acceso Rápido para Demostración */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Credenciales de Demostración:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => fillQuickAuth('admin', 'Admin12345!')}
                style={{
                  padding: '10px 12px',
                  background: '#f8fafc',
                  border: '1.5px solid #c7d2fe',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#4338ca',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                👑 <strong>Admin Demo</strong><br />
                <span style={{ color: '#6366f1', fontSize: 11, fontFamily: 'monospace' }}>admin / Admin12345!</span>
              </button>
              <button
                type="button"
                onClick={() => fillQuickAuth('vendedor1', 'Seller12345!')}
                style={{
                  padding: '10px 12px',
                  background: '#f8fafc',
                  border: '1.5px solid #99f6e4',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0f766e',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                🛒 <strong>Vendedor Demo</strong><br />
                <span style={{ color: '#0d9488', fontSize: 11, fontFamily: 'monospace' }}>vendedor1 / Seller12345!</span>
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
              * También se aceptan <code>admin1234</code> y <code>seller1234</code>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Número total de ítems en carrito
  const totalCartCount = cart.items.reduce((acc, curr) => acc + curr.quantity, 0);
  const isAdmin = session.role === 'admin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* NAVBAR MODERNO CON DISTINCIÓN RADICAL DE ROLES */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
      }}>
        <div style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Logo y Enlaces */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setView('catalog')}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: isAdmin ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <div>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px', display: 'block', lineHeight: 1.2 }}>
                  Simple Stock Flow
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: isAdmin ? '#6366f1' : '#0d9488', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  {isAdmin ? '👑 Administración y Catálogo' : '🛒 Terminal Punto de Venta'}
                </span>
              </div>
            </div>

            {/* BARRA DE NAVEGACIÓN SEGÚN EL ROL */}
            <nav style={{ display: 'flex', gap: 6 }}>
              {/* Botón Catálogo (Ambos roles) */}
              <button
                onClick={() => setView('catalog')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: view === 'catalog' ? (isAdmin ? '#eef2ff' : '#f0fdfa') : 'transparent',
                  color: view === 'catalog' ? (isAdmin ? '#4f46e5' : '#0f766e') : '#475569',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  transition: 'all 0.15s'
                }}
              >
                <span>📦</span> {isAdmin ? 'Gestión de Catálogo' : 'Catálogo de Ventas'}
              </button>

              {/* Botón Carrito / POS (Ambos roles) */}
              <button
                onClick={() => setView('cart')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: view === 'cart' ? (isAdmin ? '#eef2ff' : '#f0fdfa') : 'transparent',
                  color: view === 'cart' ? (isAdmin ? '#4f46e5' : '#0f766e') : '#475569',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  transition: 'all 0.15s'
                }}
              >
                <span>🛒</span> {isAdmin ? 'Venta Rápida' : 'Carrito / Cobro'}
                {totalCartCount > 0 && (
                  <span style={{
                    background: isAdmin ? '#4f46e5' : '#0d9488',
                    color: '#fff',
                    borderRadius: 12,
                    padding: '2px 7px',
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    {totalCartCount}
                  </span>
                )}
              </button>

              {/* Botón Ventas (Ambos roles) */}
              <button
                onClick={() => { setView('sales'); loadSales(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: view === 'sales' ? (isAdmin ? '#eef2ff' : '#f0fdfa') : 'transparent',
                  color: view === 'sales' ? (isAdmin ? '#4f46e5' : '#0f766e') : '#475569',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  transition: 'all 0.15s'
                }}
              >
                <span>📜</span> {isAdmin ? 'Auditoría Global' : 'Mis Ventas'}
              </button>

              {/* FUNCIONES EXCLUSIVAS DEL ROL ADMINISTRADOR */}
              {isAdmin && (
                <>
                  <button
                    onClick={() => { setView('report'); loadReport(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: view === 'report' ? '#eef2ff' : 'transparent',
                      color: view === 'report' ? '#4f46e5' : '#475569',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>📊</span> Reporte Financiero
                  </button>

                  <button
                    onClick={() => setView('users')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: view === 'users' ? '#eef2ff' : 'transparent',
                      color: view === 'users' ? '#4f46e5' : '#475569',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>👥</span> Registrar Vendedor
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Info de Usuario y Salir */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 20,
              background: isAdmin ? '#eef2ff' : '#f0fdfa',
              border: `1px solid ${isAdmin ? '#c7d2fe' : '#99f6e4'}`
            }}>
              <span style={{ fontSize: 14 }}>{isAdmin ? '👑' : '🛒'}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: isAdmin ? '#3730a3' : '#115e59' }}>
                {session.username}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                background: isAdmin ? '#4f46e5' : '#0d9488',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 4
              }}>
                {session.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.15s'
              }}
            >
              <span>🚪</span> Salir
            </button>
          </div>
        </div>
      </header>

      {/* BANNER INFORMATIVO DEL ROL */}
      <div style={{
        background: isAdmin ? 'linear-gradient(90deg, #312e81 0%, #4338ca 100%)' : 'linear-gradient(90deg, #134e4a 0%, #0f766e 100%)',
        color: '#fff',
        padding: '8px 24px',
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {isAdmin 
              ? '👑 Sesión de Administrador: Tienes permisos para crear, editar y dar de baja productos, ver balances financieros y registrar vendedores.'
              : '🛒 Sesión de Vendedor: Terminal de mostrador. Puedes consultar catálogo, descontar inventario en carrito y registrar ventas.'}
          </span>
          <span style={{ opacity: 0.85, fontFamily: 'monospace' }}>
            Ficha ADSO 3413974 · SENA
          </span>
        </div>
      </div>

      {/* TOAST FLOTANTE DE NOTIFICACIONES */}
      {message && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 100,
          background: message.type === 'success' ? '#065f46' : '#991b1b',
          color: '#ffffff',
          padding: '14px 20px',
          borderRadius: 12,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          fontWeight: 600,
          maxWidth: 420
        }}>
          <span>{message.type === 'success' ? '✅' : '❌'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ flex: 1, maxWidth: 1320, width: '100%', margin: '0 auto', padding: '28px 24px' }}>
        
        {/* ==================================================== */}
        {/* VISTA 1: CATÁLOGO DE PRODUCTOS (CON STOCK DINÁMICO)  */}
        {/* ==================================================== */}
        {view === 'catalog' && (
          <div>
            {/* Barra de Filtros y Acciones */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 20,
              border: '1px solid #e2e8f0',
              marginBottom: 24,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                  {isAdmin ? 'Gestión de Productos e Inventario' : 'Catálogo para Venta en Mostrador'}
                </h2>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                  {isAdmin 
                    ? 'Supervisa existencias, edita precios y registra nuevos artículos en el catálogo.' 
                    : 'Selecciona las cantidades deseadas para descontarlas en el carrito y generar la venta.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Buscador */}
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

                {/* Botón Admin Nuevo Producto (E-05) */}
                {isAdmin && (
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 24 }}>
                {products.map(p => {
                  const inCartQty = getInCartQty(p.id);
                  const availableStock = getAvailableStock(p);
                  const currentQty = getItemQty(p.id);
                  const hasStock = availableStock > 0;

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
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        position: 'relative'
                      }}
                    >
                      {/* Portada / Header de tarjeta */}
                      <div style={{
                        height: 120,
                        background: isAdmin 
                          ? 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)' 
                          : 'linear-gradient(135deg, #ccfbf1 0%, #e0f2fe 100%)',
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
                          background: 'rgba(255, 255, 255, 0.95)',
                          color: isAdmin ? '#4338ca' : '#0f766e',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 8,
                          backdropFilter: 'blur(4px)'
                        }}>
                          {p.categoryName}
                        </span>

                        {/* Tag de stock en carrito si ya se agregaron unidades */}
                        {inCartQty > 0 && (
                          <span style={{
                            position: 'absolute',
                            bottom: 8,
                            left: 10,
                            background: '#047857',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6
                          }}>
                            🛒 {inCartQty} en carrito
                          </span>
                        )}
                      </div>

                      {/* Cuerpo de la tarjeta */}
                      <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{p.name}</h3>
                          
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#4f46e5', marginBottom: 10 }}>
                            {p.price.format()}
                          </div>

                          {/* Pill de Estado de Stock con Actualización Inmediata */}
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: hasStock ? (availableStock <= 5 ? '#fffbeb' : '#ecfdf5') : '#fef2f2',
                            color: hasStock ? (availableStock <= 5 ? '#b45309' : '#047857') : '#b91c1c',
                            marginBottom: 16
                          }}>
                            <span style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: hasStock ? (availableStock <= 5 ? '#f59e0b' : '#10b981') : '#ef4444'
                            }}></span>
                            <span>
                              {hasStock 
                                ? `${availableStock} disponibles ${inCartQty > 0 ? `(restan de ${p.stock})` : 'en inventario'}`
                                : (inCartQty > 0 ? `Todo en tu carrito (${inCartQty} u.)` : 'Agotado')}
                            </span>
                          </div>
                        </div>

                        {/* ACCIONES DEL PRODUCTO */}
                        <div>
                          {/* Controles de Venta: Selector y botón Agregar */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: isAdmin ? 10 : 0 }}>
                            {hasStock ? (
                              <>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  border: '1.5px solid #e2e8f0',
                                  borderRadius: 8,
                                  background: '#f8fafc'
                                }}>
                                  <button
                                    onClick={() => setItemQty(p.id, Math.max(1, currentQty - 1))}
                                    style={{ background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>
                                    {Math.min(availableStock, currentQty)}
                                  </span>
                                  <button
                                    onClick={() => setItemQty(p.id, Math.min(availableStock, currentQty + 1))}
                                    style={{ background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  onClick={() => addToCart(p)}
                                  style={{
                                    flex: 1,
                                    background: isAdmin ? '#4f46e5' : '#0d9488',
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
                                    gap: 6
                                  }}
                                >
                                  <span>🛒</span> Agregar
                                </button>
                              </>
                            ) : (
                              <button
                                disabled
                                style={{
                                  width: '100%',
                                  background: inCartQty > 0 ? '#ecfdf5' : '#f1f5f9',
                                  color: inCartQty > 0 ? '#047857' : '#94a3b8',
                                  border: inCartQty > 0 ? '1px solid #a7f3d0' : 'none',
                                  padding: '9px 12px',
                                  borderRadius: 8,
                                  fontWeight: 600,
                                  fontSize: 13,
                                  cursor: 'not-allowed'
                                }}
                              >
                                {inCartQty > 0 ? '✓ Agregado en Carrito' : 'Sin Stock Disponible'}
                              </button>
                            )}
                          </div>

                          {/* ACCIONES EXCLUSIVAS DEL ROL ADMINISTRADOR (E-06, E-07) */}
                          {isAdmin && (
                            <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                              <button
                                onClick={() => openEditModal(p)}
                                style={{
                                  flex: 1,
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  padding: '6px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                style={{
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                🗑️ Baja
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* VISTA 2: CARRITO DE VENTA / PUNTO DE VENTA (POS)     */}
        {/* ==================================================== */}
        {view === 'cart' && (
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
                  {isAdmin ? 'Punto de Venta Rápida' : 'Facturación de Venta Mostrador'}
                </h2>
                <p style={{ color: '#64748b', fontSize: 14 }}>
                  Los productos agregados reservan stock temporalmente; al confirmar se descuenta de forma permanente en base de datos.
                </p>
              </div>
              {cart.items.length > 0 && (
                <button
                  onClick={() => {
                    setCart(new Cart());
                    showToast('Carrito vaciado. El stock ha sido liberado de nuevo al catálogo.', 'success');
                  }}
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Vaciar Carrito
                </button>
              )}
            </div>

            {cart.items.length === 0 ? (
              <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: 56 }}>🛒</span>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginTop: 16 }}>El carrito está vacío</h3>
                <p style={{ color: '#64748b', fontSize: 14, margin: '8px 0 20px' }}>
                  Agrega artículos desde el catálogo para iniciar una transacción.
                </p>
                <button
                  onClick={() => setView('catalog')}
                  style={{
                    background: isAdmin ? '#4f46e5' : '#0d9488',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Ir al Catálogo
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
                {/* Tabla de Artículos con Controles + y - */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
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
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              Stock en almacén: {item.product.stock}
                            </div>
                          </td>
                          <td style={{ padding: '16px 0', fontSize: 14 }}>{item.product.price.format()}</td>
                          
                          {/* Modificador de Cantidad en Vivo */}
                          <td style={{ padding: '16px 0', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              overflow: 'hidden'
                            }}>
                              <button
                                onClick={() => handleCartQtyChange(item.product.id, -1)}
                                style={{ background: '#f8fafc', border: 'none', padding: '4px 8px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                -
                              </button>
                              <span style={{ padding: '0 8px', fontWeight: 700, fontSize: 13 }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleCartQtyChange(item.product.id, 1)}
                                style={{ background: '#f8fafc', border: 'none', padding: '4px 8px', cursor: 'pointer', fontWeight: 700 }}
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 800, color: '#4f46e5' }}>
                            {item.subtotal.format()}
                          </td>
                          
                          <td style={{ padding: '16px 0', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setCart(cart.removeItem(item.product.id));
                                showToast(`"${item.product.name}" eliminado del carrito.`, 'success');
                              }}
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
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 18, color: '#0f172a' }}>Comprobante de Venta</h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#64748b' }}>
                    <span>Líneas de producto</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{cart.items.length}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#64748b' }}>
                    <span>Unidades totales</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{totalCartCount}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14, color: '#64748b' }}>
                    <span>Vendedor a cargo</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{session.username}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 14, color: '#64748b' }}>
                    <span>Moneda de transacción</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>COP</span>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Total a Cobrar</span>
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
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                  {isAdmin ? 'Auditoría Global de Ventas' : 'Mis Ventas Registradas'}
                </h2>
                <p style={{ color: '#64748b', fontSize: 14 }}>
                  Trazabilidad inmutable: los importes y nombres quedan congelados en el momento de la venta (RN-06, RN-07)
                </p>
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
                <p style={{ color: '#64748b', marginTop: 12 }}>No hay registros de ventas en el sistema.</p>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: 13 }}>
                      <th style={{ padding: '14px 20px' }}>ID Transacción</th>
                      <th style={{ padding: '14px 20px' }}>Vendedor</th>
                      <th style={{ padding: '14px 20px' }}>Fecha y Hora</th>
                      <th style={{ padding: '14px 20px' }}>Líneas de Venta</th>
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
        {/* VISTA 4: REPORTE FINANCIERO (ADMIN ONLY)             */}
        {/* ==================================================== */}
        {view === 'report' && isAdmin && (
          <div>
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #e2e8f0',
              marginBottom: 24
            }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Reporte Ejecutivo de Ventas (Admin)</h2>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
                Afirmación 3: Reporte inalterable generado exclusivamente sobre líneas congeladas agrupadas en base de datos (DP-01, DP-02)
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
                {/* Tarjetas KPI */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 20,
                  marginBottom: 24
                }}>
                  <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Ingresos Totales</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981', marginTop: 6 }}>
                      ${Number(report.totalAmount).toLocaleString('es-CO')} <span style={{ fontSize: 16 }}>{report.currency}</span>
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Unidades Despachadas</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#4f46e5', marginTop: 6 }}>
                      {report.items.reduce((s: number, i: any) => s + i.unitsSold, 0)} <span style={{ fontSize: 16 }}>unidades</span>
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Referencias Vendidas</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginTop: 6 }}>
                      {report.items.length} <span style={{ fontSize: 16 }}>productos</span>
                    </div>
                  </div>
                </div>

                {/* Tabla de Desglose */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: 13 }}>
                        <th style={{ padding: '14px 20px' }}>Producto (Nombre Congelado en Venta)</th>
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

        {/* ==================================================== */}
        {/* VISTA 5: REGISTRO DE VENDEDORES (ADMIN ONLY - E-02)  */}
        {/* ==================================================== */}
        {view === 'users' && isAdmin && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 32,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}>
              <div style={{ marginBottom: 24 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: '#eef2ff',
                  color: '#4f46e5',
                  padding: '4px 10px',
                  borderRadius: 6
                }}>
                  Función Exclusiva de Administrador (E-02, DP-04)
                </span>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 10 }}>
                  Registrar Nuevo Vendedor
                </h2>
                <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                  Por política de seguridad cerrada (DP-04), los administradores solo pueden crear usuarios con rol vendedor (<code>seller</code>).
                </p>
              </div>

              <form onSubmit={handleRegisterSeller}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Nombre de Usuario (se normaliza en minúsculas)
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    placeholder="Ej. maria_ventas"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 14,
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Contraseña Inicial
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 14,
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 15,
                    border: 'none',
                    cursor: isSubmittingReg ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  {isSubmittingReg ? 'Registrando usuario...' : 'Crear Cuenta de Vendedor'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================== */}
      {/* MODAL ADMIN: NUEVO PRODUCTO (E-05)                   */}
      {/* ==================================================== */}
      {showAddModal && isAdmin && (
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
                  placeholder="Ej. Croissant de Almendras"
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
                    placeholder="Ej. 6500"
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
                    placeholder="Ej. 20"
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

      {/* ==================================================== */}
      {/* MODAL ADMIN: EDITAR PRODUCTO (E-06)                  */}
      {/* ==================================================== */}
      {editingProduct && isAdmin && (
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
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Editar Producto (E-06)</h3>
              <button
                onClick={() => setEditingProduct(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProduct}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Nombre del Producto
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Precio (COP)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Categoría
                </label>
                <select
                  required
                  value={editCat}
                  onChange={e => setEditCat(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', background: '#fff' }}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
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
                  disabled={isSubmittingEdit}
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
                  {isSubmittingEdit ? 'Actualizando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}