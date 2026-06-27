import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Order, OrderStatus } from '../types';
import { Play, Check, Flame, ShoppingBag, Clock, AlertTriangle, User, Phone, CheckCircle2, Volume2, Search, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_ACTIONS: Record<OrderStatus, { label: string; nextStatus: OrderStatus | null; color: string; icon: any }> = {
  vastaanotettu: { label: "Aloita valmistus", nextStatus: 'valmistetaan', color: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold", icon: Play },
  valmistetaan: { label: "Valmis noudettavaksi", nextStatus: 'valmis', color: "bg-orange-500 hover:bg-orange-600 text-white font-bold animate-pulse", icon: Flame },
  valmis: { label: "Kuitattu noudetuksi", nextStatus: 'nouto_ok', color: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold", icon: Check },
  nouto_ok: { label: "Valmis tilaus", nextStatus: null, color: "bg-slate-100 text-slate-400 cursor-not-allowed font-bold", icon: CheckCircle2 },
  peruutettu: { label: "Peruutettu", nextStatus: null, color: "bg-red-100 text-red-500 cursor-not-allowed font-bold", icon: AlertTriangle }
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Keep track of order IDs to detect brand new ones
  const orderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef<boolean>(true);

  // Synthesize notification bell via Web Audio API
  const playNotificationSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.4);

      // Tone 2 (a bit later, higher)
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain2.gain.setValueAtTime(0.12, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.5);
      }, 120);

      // Tone 3 (even higher, bright)
      setTimeout(() => {
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        gain3.gain.setValueAtTime(0.15, ctx.currentTime);
        gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start();
        osc3.stop(ctx.currentTime + 0.6);
      }, 240);
    } catch (e) {
      console.warn("Audio contextual beep failed: ", e);
    }
  };

  useEffect(() => {
    // Realtime subscription to ALL orders
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      let hasNewOrder = false;

      snapshot.forEach((doc) => {
        const orderData = { id: doc.id, ...doc.data() } as Order;
        fetchedOrders.push(orderData);

        // Detect if this is a newly added order
        if (!initialLoadRef.current && !orderIdsRef.current.has(doc.id)) {
          // Verify it's indeed fresh (created within last 1 minute)
          if (Date.now() - orderData.createdAt < 60000 && orderData.status === 'vastaanotettu') {
            hasNewOrder = true;
          }
        }
      });

      // Update stored IDs
      orderIdsRef.current = new Set(fetchedOrders.map(o => o.id));
      initialLoadRef.current = false;

      setOrders(fetchedOrders);
      setLoading(false);

      if (hasNewOrder) {
        playNotificationSound();
      }
    }, (err) => {
      console.error("Kitchen order listen error: ", err);
      setError("Tilauksia ei voitu ladata.");
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, [soundEnabled]);

  const handleUpdateStatus = async (orderId: string, currentStatus: OrderStatus) => {
    const action = STATUS_ACTIONS[currentStatus];
    if (!action || !action.nextStatus) return;

    try {
      const orderDocRef = doc(db, 'orders', orderId);
      try {
        await updateDoc(orderDocRef, {
          status: action.nextStatus
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    } catch (err) {
      console.error("Error updating order status: ", err);
      alert("Tilan päivitys epäonnistui.");
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Haluatko varmasti peruuttaa tämän tilauksen?")) return;
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      try {
        await updateDoc(orderDocRef, {
          status: 'peruutettu'
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    } catch (err) {
      console.error("Error cancelling order: ", err);
      alert("Peruutustilan asettaminen epäonnistui.");
    }
  };

  // Filter orders based on kitchen view searches
  const filteredOrders = orders.filter(order => {
    const matchSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        order.id.slice(-5).toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  // Categorize active kitchen queues
  const receivedOrders = filteredOrders.filter(o => o.status === 'vastaanotettu');
  const preppingOrders = filteredOrders.filter(o => o.status === 'valmistetaan');
  const readyOrders = filteredOrders.filter(o => o.status === 'valmis');
  const historyOrders = filteredOrders.filter(o => o.status === 'nouto_ok' || o.status === 'peruutettu');

  return (
    <div className="space-y-6" id="kitchen-dashboard">
      {/* Top Controller Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4" id="kitchen-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Keittiön Tilausseinä (Live Orders)</h1>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Hallitse ja valmista reaaliaikaisia tilauksia helposti.</p>
        </div>

        {/* Audio and Search Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="kitchen-search-input"
              placeholder="Etsi nimellä tai numerolla..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          <button
            id="toggle-chime-sound"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playNotificationSound();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              soundEnabled
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>{soundEnabled ? "Äänet käytössä" : "Äänet mykistetty"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500" id="kitchen-loading">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-sm">Ladataan tilauksia...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-sm border border-red-100" id="kitchen-error">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="kitchen-board-queues">
          
          {/* Column 1: Saapuneet / Vastaanotetut */}
          <div className="space-y-4" id="received-queue">
            <div className="bg-slate-900 text-white p-3 rounded-xl flex justify-between items-center shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider">1. Uudet Tilaukset</span>
              <span className="bg-indigo-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                {receivedOrders.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1" id="received-queue-cards">
              {receivedOrders.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs">
                  Ei uusia tilauksia tällä hetkellä
                </div>
              ) : (
                receivedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onUpdate={handleUpdateStatus} onCancel={handleCancelOrder} />
                ))
              )}
            </div>
          </div>

          {/* Column 2: Valmistuksessa */}
          <div className="space-y-4" id="prepping-queue">
            <div className="bg-orange-600 text-white p-3 rounded-xl flex justify-between items-center shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider">2. Valmistetaan</span>
              <span className="bg-white text-orange-700 font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                {preppingOrders.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1" id="prepping-queue-cards">
              {preppingOrders.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs">
                  Ei tilauksia työn alla
                </div>
              ) : (
                preppingOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onUpdate={handleUpdateStatus} onCancel={handleCancelOrder} />
                ))
              )}
            </div>
          </div>

          {/* Column 3: Valmiit noudettavaksi */}
          <div className="space-y-4" id="ready-queue">
            <div className="bg-emerald-700 text-white p-3 rounded-xl flex justify-between items-center shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider">3. Valmiit (Nouda)</span>
              <span className="bg-white text-emerald-800 font-bold text-xs px-2.5 py-0.5 rounded-full">
                {readyOrders.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1" id="ready-queue-cards">
              {readyOrders.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs">
                  Ei odottavia noutoja
                </div>
              ) : (
                readyOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onUpdate={handleUpdateStatus} onCancel={handleCancelOrder} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* History log block at bottom */}
      {!loading && historyOrders.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mt-8" id="kitchen-history">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tilaushistoria & Arkisto (Tänään)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Nro</th>
                  <th className="py-2.5 px-3">Asiakas</th>
                  <th className="py-2.5 px-3">Ruoat</th>
                  <th className="py-2.5 px-3">Noutoaika</th>
                  <th className="py-2.5 px-3">Hinta</th>
                  <th className="py-2.5 px-3">Tila</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyOrders.slice(0, 20).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-500">#{order.id.slice(-5).toUpperCase()}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{order.customerName}</div>
                      <div className="text-[10px] text-slate-400">{order.customerEmail}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-semibold">
                      {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {order.pickupTimeType === 'heti' ? 'Heti' : `klo ${order.pickupTimeValue}`}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{order.totalPrice.toFixed(2)} €</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                        order.status === 'nouto_ok' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {order.status === 'nouto_ok' ? 'Noudettu' : 'Peruutettu'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* Internal Card Component for Clean Layout */
interface OrderCardProps {
  key?: string;
  order: Order;
  onUpdate: (id: string, current: OrderStatus) => void;
  onCancel: (id: string) => void;
}

function OrderCard({ order, onUpdate, onCancel }: OrderCardProps) {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    // Refresh elapsed time counters every 30 seconds
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - order.createdAt) / 60000));
    }, 10000);
    
    setElapsed(Math.floor((Date.now() - order.createdAt) / 60000));

    return () => clearInterval(interval);
  }, [order.createdAt]);

  const action = STATUS_ACTIONS[order.status];
  const ActionIcon = action?.icon;

  // Visual cues for long waiting items
  const isDelayed = order.status === 'vastaanotettu' && elapsed >= 10;
  const isPreppingDelayed = order.status === 'valmistetaan' && elapsed >= 15;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
        isDelayed ? 'border-indigo-400 ring-2 ring-indigo-500/10' :
        isPreppingDelayed ? 'border-orange-300 ring-2 ring-orange-500/10' : 'border-slate-200'
      }`}
    >
      {/* Card Header */}
      <div className={`p-4 border-b border-slate-100 flex justify-between items-center ${
        isDelayed ? 'bg-indigo-50' : isPreppingDelayed ? 'bg-orange-50' : 'bg-slate-50/50'
      }`}>
        <div>
          <span className="text-xs font-mono font-black text-slate-900">#{order.id.slice(-5).toUpperCase()}</span>
          <span className="text-[10px] text-slate-500 ml-1.5 font-bold">
            {new Date(order.createdAt).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {elapsed > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isDelayed || isPreppingDelayed ? 'bg-red-500 text-white font-extrabold animate-pulse' : 'bg-slate-200 text-slate-600'
            }`}>
              {elapsed} min sitten
            </span>
          )}
          <span className="text-xs font-bold text-slate-600">
            {order.pickupTimeType === 'heti' ? (
              <span className="bg-slate-900 text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Heti</span>
            ) : (
              <span className="bg-indigo-600 text-white text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded">klo {order.pickupTimeValue}</span>
            )}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-3">
        {/* Customer contact banner */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1 font-bold text-slate-700">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{order.customerName}</span>
          </div>
          {order.customerPhone && (
            <div className="flex items-center gap-1 text-slate-600 font-mono font-bold">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{order.customerPhone}</span>
            </div>
          )}
        </div>

        {/* Ordered items list */}
        <div className="space-y-1.5" id="card-items-list">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between items-start text-xs border-b border-slate-50 pb-1 last:border-0 last:pb-0">
              <span className="text-slate-900 font-black shrink-0 mr-2">{item.quantity}x</span>
              <span className="text-slate-800 font-bold flex-grow">{item.name}</span>
            </div>
          ))}
        </div>

        {/* Additional instructions */}
        {order.additionalNotes && (
          <div className="bg-indigo-50/50 border border-indigo-200/40 p-2.5 rounded-lg text-xs mt-2 text-indigo-900">
            <div className="font-extrabold text-[10px] uppercase tracking-wider text-indigo-700">Keittiöhuomio / Allergiat:</div>
            <p className="mt-0.5 font-bold italic">"{order.additionalNotes}"</p>
          </div>
        )}

        {/* Status Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-3">
          <span className="text-xs font-bold text-slate-900 font-mono">{order.totalPrice.toFixed(2)} €</span>
          
          <div className="flex gap-2">
            {/* Cancel Button */}
            {(order.status === 'vastaanotettu' || order.status === 'valmistetaan') && (
              <button
                id={`cancel-order-${order.id}`}
                onClick={() => onCancel(order.id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors"
                title="Peruuta tilaus"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Main Action Button */}
            {action && action.nextStatus && (
              <button
                id={`action-order-${order.id}`}
                onClick={() => onUpdate(order.id, order.status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${action.color}`}
              >
                {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
                <span>{action.label}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
