import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Order, OrderStatus } from '../types';
import { Clock, CheckCircle, Flame, Gift, ArrowRight, RefreshCcw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerOrdersProps {
  user: {
    uid: string;
  };
}

const STATUS_LABELS: Record<OrderStatus, { text: string; color: string; bg: string; icon: any }> = {
  vastaanotettu: { text: "Vastaanotettu", color: "text-indigo-700", bg: "bg-indigo-50", icon: Clock },
  valmistetaan: { text: "Valmistetaan keittiössä", color: "text-orange-700", bg: "bg-orange-50", icon: Flame },
  valmis: { text: "Valmis noudettavaksi!", color: "text-emerald-700", bg: "bg-emerald-50", icon: Gift },
  nouto_ok: { text: "Noudettu", color: "text-slate-600", bg: "bg-slate-100", icon: CheckCircle },
  peruutettu: { text: "Peruutettu", color: "text-red-700", bg: "bg-red-50", icon: AlertCircle }
};

export default function CustomerOrders({ user }: CustomerOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Realtime listener for customer's orders
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(fetchedOrders);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to orders: ", err);
      setError("Tilausten reaaliaikainen seuranta epäonnistui.");
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, [user.uid]);

  const activeOrders = orders.filter(o => o.status !== 'nouto_ok' && o.status !== 'peruutettu');
  const pastOrders = orders.filter(o => o.status === 'nouto_ok' || o.status === 'peruutettu');

  const getStatusStep = (status: OrderStatus): number => {
    switch (status) {
      case 'vastaanotettu': return 1;
      case 'valmistetaan': return 2;
      case 'valmis': return 3;
      case 'nouto_ok': return 4;
      default: return 0;
    }
  };

  return (
    <div className="space-y-8" id="customer-orders-section">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Omat tilaukset</h1>
        <p className="text-xs text-slate-500 mt-1">Seuraa tilauksiasi reaaliajassa keittiöstä noutopöytään.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500" id="orders-loading-spinner">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
          <p className="text-xs">Ladataan tilauksia...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-sm border border-red-100" id="orders-error-banner">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm" id="orders-empty-state">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Ei tilauksia vielä</h3>
          <p className="text-xs text-slate-500 mt-1">Tee ensimmäinen tilauksesi ruokalista-välilehdeltä.</p>
        </div>
      ) : (
        <div className="space-y-8" id="orders-container">
          {/* Active Orders Trackers */}
          {activeOrders.length > 0 && (
            <div className="space-y-6" id="active-orders-section">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aktiiviset tilaukset ({activeOrders.length})</h2>
              
              <div className="grid grid-cols-1 gap-6" id="active-orders-grid">
                {activeOrders.map((order) => {
                  const currentStep = getStatusStep(order.status);
                  const StatusIcon = STATUS_LABELS[order.status]?.icon || Clock;
                  const statusInfo = STATUS_LABELS[order.status] || { text: order.status, color: "text-slate-700", bg: "bg-slate-50" };

                  return (
                    <motion.div
                      layout
                      key={order.id}
                      id={`active-order-card-${order.id}`}
                      className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
                    >
                      {/* Top Header */}
                      <div className="p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-slate-400">TILAUS ID: #{order.id.slice(-5).toUpperCase()}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-slate-600">
                              {new Date(order.createdAt).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                              Nouto: {order.pickupTimeType === 'heti' ? 'Heti' : `klo ${order.pickupTimeValue}`}
                            </span>
                          </div>
                        </div>

                        {/* Status Label */}
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusInfo.bg} ${statusInfo.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span>{statusInfo.text}</span>
                        </div>
                      </div>

                      {/* Content & Stepper */}
                      <div className="p-6 space-y-6">
                        {/* Stepper Visualization */}
                        <div className="relative" id={`stepper-${order.id}`}>
                          {/* Progress Line */}
                          <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-100 -z-0">
                            <div 
                              className="h-full bg-indigo-600 transition-all duration-500" 
                              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                            />
                          </div>

                          {/* Steps */}
                          <div className="relative z-10 flex justify-between text-center" id="stepper-nodes">
                            {/* Step 1 */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                currentStep >= 1 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                              }`}>
                                1
                              </div>
                              <span className="text-[10px] font-bold text-slate-600 mt-2">Vastaanotettu</span>
                            </div>

                            {/* Step 2 */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                currentStep >= 2 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                              }`}>
                                2
                              </div>
                              <span className="text-[10px] font-bold text-slate-600 mt-2">Valmistetaan</span>
                            </div>

                            {/* Step 3 */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                currentStep >= 3 ? 'bg-emerald-500 text-white animate-pulse shadow-sm' : 'bg-slate-100 text-slate-400'
                              }`}>
                                3
                              </div>
                              <span className="text-[10px] font-extrabold text-emerald-600 mt-2">Valmis!</span>
                            </div>
                          </div>
                        </div>

                        {/* Order Items Summary */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Annosvalikoima</h4>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <span className="text-slate-700 font-semibold">
                                  {item.quantity}x <span className="text-slate-900">{item.name}</span>
                                </span>
                                <span className="text-slate-600 font-mono font-bold">{(item.price * item.quantity).toFixed(2)} €</span>
                              </div>
                            ))}
                          </div>
                          {order.additionalNotes && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lisätiedot & Allergiat:</span>
                              <p className="text-xs text-slate-700 mt-0.5 bg-indigo-50/50 p-2 rounded border border-indigo-100/50 italic">
                                "{order.additionalNotes}"
                              </p>
                            </div>
                          )}
                          <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-baseline">
                            <span className="text-xs font-bold text-slate-800">Yhteensä paidat/maksettava:</span>
                            <span className="text-sm font-black text-indigo-600 font-mono">{order.totalPrice.toFixed(2)} €</span>
                          </div>
                        </div>

                        {/* Special Callout for Ready Orders */}
                        {order.status === 'valmis' && (
                          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
                            <div className="bg-emerald-100 text-emerald-700 p-2 rounded-full shrink-0">
                              <CheckCircle className="w-5 h-5" />
                            </div>
                            <div>
                              <h5 className="text-sm font-bold text-emerald-900">Ruoka on valmista noudettavaksi!</h5>
                              <p className="text-xs text-emerald-700 mt-0.5">
                                Tervetuloa noutamaan tilaustasi tiskiltä tilausnumerolla tai nimelläsi. Hyvää ruokahalua!
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past Orders History */}
          {pastOrders.length > 0 && (
            <div className="space-y-4" id="past-orders-section">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Menneet tilaukset ({pastOrders.length})</h2>
              <div className="space-y-3" id="past-orders-list">
                {pastOrders.map((order) => {
                  const statusInfo = STATUS_LABELS[order.status] || { text: order.status, color: "text-slate-600", bg: "bg-slate-100" };
                  return (
                    <div
                      key={order.id}
                      id={`past-order-row-${order.id}`}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500">#{order.id.slice(-5).toUpperCase()}</span>
                          <span className="text-xs text-slate-400">
                            {new Date(order.createdAt).toLocaleDateString('fi-FI')} klo {new Date(order.createdAt).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate mt-1 font-medium">
                          {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold text-slate-950 font-mono">{order.totalPrice.toFixed(2)} €</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
