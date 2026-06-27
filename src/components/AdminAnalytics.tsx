import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Order, OrderItem } from '../types';
import {
  TrendingUp,
  ShoppingBag,
  Euro,
  Award,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Color palette for charts
const COLORS = ['#4f46e5', '#f97316', '#10b981', '#a855f7', '#06b6d4', '#ec4899', '#3b82f6'];

export default function AdminAnalytics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Realtime subscription to ALL orders for real-time analytics!
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'asc')); // Oldest first to process chronological trends easily

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(fetchedOrders);
      setLoading(false);
    }, (err) => {
      console.error("Analytics orders fetch error: ", err);
      setError("Datan lataaminen tilastoja varten epäonnistui.");
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, []);

  // Filter out cancelled orders for pure financial metrics
  const validOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'peruutettu');
  }, [orders]);

  // Compute overall KPI metrics
  const metrics = useMemo(() => {
    const totalOrdersCount = validOrders.length;
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const averageOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;
    
    // Calculate pending orders (received or preparing)
    const activeOrdersCount = orders.filter(o => o.status === 'vastaanotettu' || o.status === 'valmistetaan').length;

    return {
      totalRevenue,
      totalOrdersCount,
      averageOrderValue,
      activeOrdersCount
    };
  }, [orders, validOrders]);

  // Parse Daily Revenue and Daily Orders (Chronological)
  const dailyData = useMemo(() => {
    const dateMap: Record<string, { key: string; revenue: number; orders: number; timestamp: number }> = {};

    validOrders.forEach(order => {
      const dateObj = new Date(order.createdAt);
      // Format YYYY-MM-DD for sorting
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const sortKey = `${year}-${month}-${day}`;
      
      // Format DD.MM. for presentation
      const label = `${dateObj.getDate()}.${dateObj.getMonth() + 1}.`;

      if (!dateMap[sortKey]) {
        dateMap[sortKey] = {
          key: label,
          revenue: 0,
          orders: 0,
          timestamp: order.createdAt
        };
      }
      dateMap[sortKey].revenue += order.totalPrice || 0;
      dateMap[sortKey].orders += 1;
    });

    // Sort by sortKey (YYYY-MM-DD) so charts are chronological
    return Object.keys(dateMap)
      .sort()
      .map(key => ({
        date: dateMap[key].key,
        'Liikevaihto (€)': parseFloat(dateMap[key].revenue.toFixed(2)),
        'Tilaukset (kpl)': dateMap[key].orders
      }));
  }, [validOrders]);

  // Parse Popular Menu Items
  const popularItemsData = useMemo(() => {
    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    validOrders.forEach(order => {
      order.items.forEach((item: OrderItem) => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = {
            name: item.name,
            quantity: 0,
            revenue: 0
          };
        }
        itemMap[item.name].quantity += item.quantity || 1;
        itemMap[item.name].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 7) // Top 7 items
      .map(item => ({
        name: item.name,
        'Myyty kpl': item.quantity,
        'Tuotto (€)': parseFloat(item.revenue.toFixed(2))
      }));
  }, [validOrders]);

  // Parse Hourly Traffic / Revenue Peaks (00:00 - 23:00 grouped into lunch, dinner, afternoon, evening peaks)
  const hourlyData = useMemo(() => {
    const hourlyBins: Record<number, { hourLabel: string; revenue: number; orders: number }> = {};
    
    // Pre-populate business hours for a neat visual timeline (10:00 - 22:00)
    for (let h = 10; h <= 22; h++) {
      hourlyBins[h] = {
        hourLabel: `${h}:00`,
        revenue: 0,
        orders: 0
      };
    }

    validOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      // Only record in bins if within business hours, or dynamically allocate
      if (hour >= 10 && hour <= 22) {
        hourlyBins[hour].revenue += order.totalPrice || 0;
        hourlyBins[hour].orders += 1;
      }
    });

    return Object.keys(hourlyBins)
      .map(Number)
      .sort((a, b) => a - b)
      .map(h => ({
        hour: hourlyBins[h].hourLabel,
        'Myynti (€)': parseFloat(hourlyBins[h].revenue.toFixed(2)),
        'Tilausten määrä': hourlyBins[h].orders
      }));
  }, [validOrders]);

  // Status Distribution Pie Chart Data
  const statusDistributionData = useMemo(() => {
    const statusMap: Record<string, { name: string; value: number }> = {
      vastaanotettu: { name: 'Vastaanotettu', value: 0 },
      valmistetaan: { name: 'Valmistetaan', value: 0 },
      valmis: { name: 'Valmis noudettavaksi', value: 0 },
      nouto_ok: { name: 'Noudettu', value: 0 },
      peruutettu: { name: 'Peruutettu', value: 0 }
    };

    orders.forEach(order => {
      if (statusMap[order.status]) {
        statusMap[order.status].value += 1;
      }
    });

    return Object.values(statusMap).filter(item => item.value > 0);
  }, [orders]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500" id="analytics-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
        <p className="text-xs font-semibold">Lasketaan analytiikkaa ja luodaan kaavioita...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-100 text-center text-sm" id="analytics-error">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8" id="admin-analytics-view">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Ravintolan Analytiikka</h1>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse" /> REAALIAIKAINEN
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Seuraa myyntejä, suosituimpia annoksia ja tilausvirtoja sekunnin tarkkuudella.</p>
        </div>
        
        <div className="text-[11px] bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-500 font-semibold flex items-center gap-1.5 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Kaikki kertyneet tilaukset ({orders.length} kpl)</span>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="analytics-kpi-grid">
        {/* KPI 1: Kokonaisliikevaihto */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between" id="kpi-revenue">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kokonaisliikevaihto</span>
              <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
                {metrics.totalRevenue.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Euro className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Kaikki hyväksytyt ja toimitetut tilaukset</span>
          </div>
        </div>

        {/* KPI 2: Tilaukset yhteensä */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between" id="kpi-orders">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tilaukset yhteensä</span>
              <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
                {metrics.totalOrdersCount} <span className="text-xs font-semibold text-slate-400">kpl</span>
              </span>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-500 font-semibold">
            Peruutettuja tilauksia: <span className="font-bold text-red-500">{orders.length - metrics.totalOrdersCount} kpl</span>
          </div>
        </div>

        {/* KPI 3: Keskimääräinen ostoskori */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between" id="kpi-aov">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Keskiostos (AOV)</span>
              <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
                {metrics.averageOrderValue.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-500 font-semibold">
            Liikevaihto jaettuna tilausmäärällä
          </div>
        </div>

        {/* KPI 4: Aktiiviset keittiössä */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between" id="kpi-active">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Keittiössä nyt</span>
              <span className="text-2xl font-extrabold text-indigo-600 font-mono mt-1 block">
                {metrics.activeOrdersCount} <span className="text-xs font-semibold text-indigo-400">tilausta</span>
              </span>
            </div>
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-500 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
            <span>Vastaanotetut & työn alla olevat</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="charts-main-grid">
        
        {/* Chart 1: Päivittäinen liikevaihto & tilausmäärä */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col" id="chart-daily-revenue-box">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> Päivittäinen myynti & tilausmäärät
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Liikevaihdon ja tilausmäärien kehitys päivittäin</p>
          </div>
          
          <div className="h-72 w-full text-xs">
            {dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">Ei tarpeeksi tilausdataa kaaviolle.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#4f46e5" fontSize={10} tickLine={false} unit="€" />
                  <YAxis yAxisId="right" orientation="right" stroke="#f97316" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff' }}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                  <Bar yAxisId="left" dataKey="Liikevaihto (€)" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={28} />
                  <Line yAxisId="right" type="monotone" dataKey="Tilaukset (kpl)" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Suosituimmat Menu-annokset */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col" id="chart-popular-items-box">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" /> Suosituimmat tuotteet (Top 7)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Katsotuimmat ja myydyimmät annokset kpl-määrällisesti</p>
          </div>

          <div className="h-72 w-full text-xs">
            {popularItemsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">Ei myytyjä annoksia tilaushistoriassa.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularItemsData} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} tickLine={false} width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff' }}
                  />
                  <Bar dataKey="Myyty kpl" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16}>
                    {popularItemsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Liikevaihdon tunti- ja kellonaikatrendit */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col" id="chart-hourly-box">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-orange-500" /> Tilaustrendit kellonajan mukaan (Busiest Hours)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Myynnin ja kävijävirtojen huiput klo 10:00 - 22:00 välillä</p>
          </div>

          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} unit="€" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff' }}
                />
                <Area type="monotone" dataKey="Myynti (€)" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Tilaustilojen jakauma & Pikatietoa */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between" id="chart-status-pie-box">
          <div>
            <div className="mb-4 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-600" /> Tilausten tilajakauma
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Nykyisten tilausten jakauma eri työvaiheissa</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* Pie Chart */}
              <div className="h-44 w-full flex justify-center relative">
                {statusDistributionData.length === 0 ? (
                  <div className="flex items-center text-slate-400">Ei dataa tilaustiloista.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                {/* Center count info */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-extrabold text-slate-900">{orders.length}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Tilausta</span>
                </div>
              </div>

              {/* Pie Legends with metrics */}
              <div className="space-y-2 text-xs">
                {statusDistributionData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="font-semibold text-slate-600 text-[11px]">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{item.value} kpl</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-start gap-2 mt-4">
            <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <div className="text-[10px] text-slate-500 leading-relaxed font-medium">
              <span className="font-bold text-slate-800">Pro-Vinkki:</span> Ruuhka-aikoina (usein klo 11:00 - 13:00 ja 17:00 - 19:00) voit käyttää ruokalistahallintaa asettaaksesi suosituimpia tai hitaammin valmistuvia annoksia <span className="text-red-500 font-bold">"Loppuunmyyty"</span>-tilaan keittiön työmäärän tasaamiseksi.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
