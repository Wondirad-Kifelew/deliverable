import { useState, useEffect, useCallback } from "react";

// const API = "http://localhost:3000";
const API = import.meta.env.VITE_API_URL;

// Persisted reservations in localStorage
const STORAGE_KEY = "pd_reservations";
function loadReservations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveReservations(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// design tokens
const C = {
  bg: "#0f0f0f",
  surface: "#1a1a1a",
  border: "#2a2a2a",
  accent: "#215aa5",
  text: "#f0f0f0",
  muted: "#888",
  danger: "#ff4747",
  success: "#47ff8a",
};

// shared styles
const shared = {
  app: {
    minHeight: "100vh",
    background: C.bg,
    color: C.text,
    fontFamily: "'Inter','Helvetica Neue',sans-serif",
  },
  nav: {
    borderBottom: `1px solid ${C.border}`,
    padding: "0 32px",
    display: "flex",
    alignItems: "center",
    gap: "0",
    height: "56px",
  },
  navBrand: {
    fontSize: "16px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
    marginRight: "32px",
    color: C.text,
    cursor: "pointer",
  },
  navLink: (active) => ({
    fontSize: "13px",
    fontWeight: active ? "600" : "400",
    color: active ? C.text : C.muted,
    padding: "0 16px",
    height: "56px",
    display: "flex",
    alignItems: "center",
    borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
    cursor: "pointer",
    transition: "color 0.15s",
    userSelect: "none",
  }),
  main: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "40px 32px",
  },
  pageTitle: {
    fontSize: "22px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
    margin: "0 0 8px 0",
  },
  pageSubtitle: {
    fontSize: "13px",
    color: C.muted,
    margin: "0 0 32px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "16px",
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "10px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  btn: (disabled, variant = "primary") => ({
    padding: "10px 16px",
    borderRadius: "6px",
    border: "none",
    fontSize: "13px",
    fontWeight: "600",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    background:
      variant === "primary" ? C.accent
      : variant === "danger"  ? C.danger
      : variant === "success" ? C.success
      : "#2a2a2a",
    color: variant === "primary" ? "#0f0f0f" : variant === "ghost" ? C.text : "#fff",
    width: "100%",
    transition: "opacity 0.15s",
  }),
  badge: (status) => ({
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.06em",
    padding: "3px 8px",
    borderRadius: "4px",
    background:
      status === "COMPLETED" ? "rgba(71,255,138,0.15)"
      : status === "EXPIRED" ? "rgba(255,71,71,0.15)"
      : "rgba(232,255,71,0.1)",
    color:
      status === "COMPLETED" ? C.success
      : status === "EXPIRED"  ? C.danger
      : C.accent,
  }),
  toast: (type) => ({
    position: "fixed",
    bottom: "24px",
    right: "24px",
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    background: type === "error" ? C.danger : C.surface,
    color: type === "error" ? "#fff" : C.text,
    border: `1px solid ${type === "error" ? C.danger : C.border}`,
    zIndex: 999,
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
  }),
  empty: {
    color: C.muted,
    fontSize: "14px",
    padding: "60px 0",
    textAlign: "center",
  },
};

// countdown hook
function useCountdown(expiresAt) {
  const [ms, setMs] = useState(() => Math.max(0, new Date(expiresAt) - Date.now()));
  useEffect(() => {
    const tick = () => setMs(Math.max(0, new Date(expiresAt) - Date.now()));
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expiresAt]);
  return ms;
}

//toast
function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 3500);
    return () => clearTimeout(id);
  }, []);
  return <div style={shared.toast(type)}>{message}</div>;
}

// nav
function Nav({ page, setPage, reservationCount }) {
  return (
    <nav style={shared.nav}>
      <span style={shared.navBrand} onClick={() => setPage("products")}>
        Product Drop
      </span>
      {[
        { key: "products", label: "Products" },
        { key: "reservations", label: `Reservations${reservationCount > 0 ? ` (${reservationCount})` : ""}` },
      ].map(({ key, label }) => (
        <span key={key} style={shared.navLink(page === key)} onClick={() => setPage(key)}>
          {label}
        </span>
      ))}
    </nav>
  );
}

// products page
function ProductsPage({ onReserved, toast }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(null);

  useEffect(() => {
    fetch(`${API}/products`)
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => toast({ type: "error", message: "Could not connect to backend" }))
      .finally(() => setLoading(false));
  }, []);

  const handleReserve = async (product) => {
    setReserving(product.id);
    try {
      const res = await fetch(`${API}/products/${product.id}/reserve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reserve");
      // Decrement local qty
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, available_quantity: p.available_quantity - 1 } : p
        )
      );
      onReserved(data, product.name);
    } catch (err) {
      toast({ type: "error", message: err.message });
    } finally {
      setReserving(null);
    }
  };

  if (loading) return <div style={shared.empty}>Loading…</div>;
        

  return (
    <div style={shared.main}>
      <h1 style={shared.pageTitle}>Available Products</h1>
      <p style={shared.pageSubtitle}>Reserve a product to hold it for 60 seconds.</p>

      {products.length === 0 ? (
        <div style={shared.empty}>No products found in database.</div>
      ) : (
        <div style={shared.grid}>
          {products.map((p) => {
            const soldOut = p.available_quantity <= 0;
            const isReserving = reserving === p.id;
            return (
              <div key={p.id} style={shared.card}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "600" }}>{p.name}</div>
                  <div
                    style={{
                      fontSize: "13px",
                      marginTop: "6px",
                      color: soldOut ? C.danger : C.muted,
                    }}
                  >
                    {soldOut ? "Sold out" : `${p.available_quantity} in stock`}
                  </div>
                </div>
                <button
                  style={shared.btn(soldOut || isReserving)}
                  disabled={soldOut || isReserving}
                  onClick={() => handleReserve(p)}
                >
                  {isReserving ? "Reserving…" : soldOut ? "Sold Out" : "Reserve"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// reservations page
function ReservationRow({ reservation, onCheckout, onExpire }) {
  const ms = useCountdown(reservation.expires_at);
  const secs = Math.ceil(ms / 1000);
  const isDanger = secs <= 10;

  // Trigger expire when countdown hits 0
  useEffect(() => {
    if (ms === 0 && reservation.status === "PENDING") {
      onExpire(reservation.id);
    }
  }, [ms]);

  const status = ms === 0 && reservation.status === "PENDING" ? "EXPIRED" : reservation.status;

  return (
    <div
      style={{
        ...shared.card,
        flexDirection: "row",
        alignItems: "center",
        gap: "20px",
      }}
    >
      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "14px", fontWeight: "600" }}>{reservation.productName}</div>
        <div style={{ fontSize: "12px", color: C.muted, marginTop: "4px" }}>
          ID #{reservation.id}
        </div>
      </div>

      {/* Status / countdown */}
      <div style={{ minWidth: "100px", textAlign: "center" }}>
        {status === "PENDING" ? (
          <>
            <div
              style={{
                fontSize: "26px",
                fontWeight: "700",
                fontVariantNumeric: "tabular-nums",
                color: isDanger ? C.danger : C.accent,
                letterSpacing: "-0.02em",
              }}
            >
              {secs}s
            </div>
            <div style={{ fontSize: "11px", color: C.muted }}>remaining</div>
          </>
        ) : (
          <span style={shared.badge(status)}>{status}</span>
        )}
      </div>

      {/* Action */}
      <div style={{ minWidth: "140px" }}>
        {status === "PENDING" ? (
          <button
            style={shared.btn(false)}
            onClick={() => onCheckout(reservation.id)}
          >
            Checkout
          </button>
        ) : status === "COMPLETED" ? (
          <div style={{ fontSize: "12px", color: C.success, textAlign: "center" }}>
            ✓ Order complete
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: C.danger, textAlign: "center" }}>
            Hold expired
          </div>
        )}
      </div>
    </div>
  );
}

function ReservationsPage({ reservations, onCheckout, onExpire, setPage }) {
  const pending = reservations.filter((r) => r.status === "PENDING");
  const past = reservations.filter((r) => r.status !== "PENDING");
  return (
    <div style={shared.main}>
      <h1 style={shared.pageTitle}>Reservations</h1>
      <p style={shared.pageSubtitle}>
        Complete checkout before your hold expires.
      </p>

      {reservations.length === 0 ? (
        <div style={shared.empty}>
          No reservations yet.{" "}
          <span
            style={{ color: C.accent, cursor: "pointer" }}
            onClick={() => setPage("products")}
          >
            Browse products →
          </span>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase", marginBottom: "12px" }}>
                Active Holds
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
                {pending.map((r) => (
                  <ReservationRow
                    key={r.id}
                    reservation={r}
                    onCheckout={onCheckout}
                    onExpire={onExpire}
                  />
                ))}
              </div>
            </>
          )}

          {past.length > 0 && (
            <>
              <div style={{ fontSize: "11px", fontWeight: "600", letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase", marginBottom: "12px" }}>
                History
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {past.map((r) => (
                  <ReservationRow
                    key={r.id}
                    reservation={r}
                    onCheckout={onCheckout}
                    onExpire={onExpire}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// main app
export default function App() {
  const [page, setPage] = useState("products");
  const [reservations, setReservations] = useState(loadReservations);
  const [toast, setToast] = useState(null);

  // Sync to localStorage whenever reservations change
  useEffect(() => {
    saveReservations(reservations);
  }, [reservations]);

  const showToast = useCallback((t) => setToast(t), []);

  // Called when a new reservation is created on products page
  const handleReserved = useCallback((data, productName) => {
    setReservations((prev) => [
      { ...data, productName, status: "PENDING" },
      ...prev,
    ]);
    showToast({ type: "success", message: `${productName} reserved! You have 60s to checkout.` });
    setPage("reservations");
  }, []);

  // Checkout a reservation
  const handleCheckout = useCallback(async (reservationId) => {
    try {
      const res = await fetch(`${API}/reservations/${reservationId}/checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, status: "COMPLETED" } : r))
      );
      showToast({ type: "success", message: "Checkout complete!" });
    } catch (err) {
      showToast({ type: "error", message: err.message });
    }
  }, []);

  // Mark a reservation as expired locally
  const handleExpire = useCallback((reservationId) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: "EXPIRED" } : r))
    );
  }, []);

  const pendingCount = reservations.filter((r) => r.status === "PENDING").length;

  return (
    <div style={shared.app}>
      <Nav page={page} setPage={setPage} reservationCount={pendingCount} />

      {page === "products" && (
        <ProductsPage onReserved={handleReserved} toast={showToast} />
      )}
      {page === "reservations" && (
        <ReservationsPage
          reservations={reservations}
          onCheckout={handleCheckout}
          onExpire={handleExpire}
          setPage={setPage}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
