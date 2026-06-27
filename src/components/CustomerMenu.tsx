import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MenuItem, OrderItem, Order } from '../types';
import { ShoppingBag, Plus, Minus, X, Check, Info, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerMenuProps {
  user: {
    uid: string;
    email: string;
    name: string;
    phone?: string;
  };
  onOrderPlaced: () => void;
}

const SEED_MENU_ITEMS: Omit<MenuItem, 'id'>[] = [
  {
    name: "Kermainen Lohikeitto",
    description: "Perinteinen suomalainen täyteläinen lohikeitto tuoreella tillillä ja saaristolaisleivällä.",
    allergens: ["L", "G (pyydettäessä)"],
    price: 15.90,
    category: "Pääruoat",
    imageUrl: "https://images.unsplash.com/photo-1547592165-e1d17fed6005?auto=format&fit=crop&w=600&q=80",
    isSoldOut: false,
    createdAt: Date.now()
  },
  {
    name: "Metsäsienirisotto",
    description: "Kotimaisista tateista ja korvasienistä valmistettu täyteläinen risotto parmesan-juustolla.",
    allergens: ["L", "G"],
    price: 17.50,
    category: "Pääruoat",
    imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=600&q=80",
    isSoldOut: false,
    createdAt: Date.now()
  },
  {
    name: "Poronkäristys",
    description: "Klassinen poronkäristys Lapin porosta, kuohkeaa perunamuusia, suolakurkkuja ja puolukkaa.",
    allergens: ["L", "G"],
    price: 24.90,
    category: "Pääruoat",
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    isSoldOut: false,
    createdAt: Date.now()
  },
  {
    name: "Saaristolaislautanen",
    description: "Graavattua lohta, sillivalikoima, keitettyjä uusia perunoita ja ruisleipää.",
    allergens: ["L"],
    price: 12.50,
    category: "Alkuruoat",
    imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80",
    isSoldOut: false,
    createdAt: Date.now()
  },
  {
    name: "Lämmin Leipäjuusto",
    description: "Klassinen uunissa paistettu leipäjuusto kermakastikkeessa lakkahillon kera.",
    allergens: ["G"],
    price: 8.90,
    category: "Jälkiruoat",
    imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80",
    isSoldOut: false,
    createdAt: Date.now()
  },
  {
    name: "Puolukkajäädyke",
    description: "Raikas puolukkajäädyke kinuskikastikkeella ja paahdetulla valkosuklaalla.",
    allergens: ["L", "G"],
    price: 7.90,
    category: "Jälkiruoat",
    imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80",
    isSoldOut: false,
    createdAt: Date.now()
  },
  {
    name: "Raparperilimonadi",
    description: "Käsityönä valmistettu raikas ja hieman hapan raparperilimonadi.",
    allergens: [],
    price: 4.50,
    category: "Juomat",
    imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
    isSoldOut: false,
    createdAt: Date.now()
  }
];

export default function CustomerMenu({ user, onOrderPlaced }: CustomerMenuProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["Kaikki", "Alkuruoat", "Pääruoat", "Jälkiruoat", "Juomat"]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Kaikki");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [allergenQuery, setAllergenQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cart State
  const [cart, setCart] = useState<{ [itemId: string]: { item: MenuItem; quantity: number } }>({});
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [pickupTimeType, setPickupTimeType] = useState<'heti' | 'kellonaika'>('heti');
  const [pickupTimeValue, setPickupTimeValue] = useState<string>("");
  const [additionalNotes, setAdditionalNotes] = useState<string>("");
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const menuRef = collection(db, 'menu');
      let snapshot;
      try {
        snapshot = await getDocs(menuRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'menu');
      }
      let items: MenuItem[] = [];
      
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as MenuItem);
      });

      // If database is completely empty, populate it with seed items for a great first-time experience
      if (items.length === 0) {
        for (const seed of SEED_MENU_ITEMS) {
          let docRef;
          try {
            docRef = await addDoc(menuRef, seed);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'menu');
          }
          items.push({ id: docRef.id, ...seed } as MenuItem);
        }
      }

      // Sort by creation time so they stay in stable order
      items.sort((a, b) => b.createdAt - a.createdAt);
      setMenuItems(items);
    } catch (err: any) {
      console.error("Error fetching menu items: ", err);
      setError("Valikon lataus epäonnistui. Yritä uudelleen.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    if (item.isSoldOut) return;
    setCart(prev => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          item,
          quantity: existing ? existing.quantity + 1 : 1
        }
      };
    });
  };

  const handleUpdateQuantity = (itemId: string, change: number) => {
    setCart(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const newQty = existing.quantity + change;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: {
          ...existing,
          quantity: newQty
        }
      };
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(prev => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const cartItems = Object.values(cart) as Array<{ item: MenuItem; quantity: number }>;
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.item.price * item.quantity), 0);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItemCount === 0) return;
    
    // Validate custom pickup time
    if (pickupTimeType === 'kellonaika' && !pickupTimeValue) {
      alert("Valitse noutoaika.");
      return;
    }

    try {
      setOrderSubmitting(true);
      const ordersRef = collection(db, 'orders');
      
      const orderItems: OrderItem[] = cartItems.map(cartItem => ({
        id: cartItem.item.id,
        name: cartItem.item.name,
        price: cartItem.item.price,
        quantity: cartItem.quantity
      }));

      const newOrder: Omit<Order, 'id'> = {
        customerId: user.uid,
        customerName: user.name || "Asiakas",
        customerPhone: user.phone || "",
        customerEmail: user.email,
        items: orderItems,
        totalPrice: Number(cartTotal.toFixed(2)),
        pickupTimeType,
        pickupTimeValue: pickupTimeType === 'kellonaika' ? pickupTimeValue : undefined,
        additionalNotes: additionalNotes.trim(),
        status: 'vastaanotettu',
        createdAt: Date.now()
      };

      try {
        await addDoc(ordersRef, newOrder);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'orders');
      }
      
      setCart({});
      setAdditionalNotes("");
      setPickupTimeValue("");
      setPickupTimeType("heti");
      setIsCartOpen(false);
      setOrderSuccess(true);
      
      // Notify parent to switch tabs or show orders
      setTimeout(() => {
        setOrderSuccess(false);
        onOrderPlaced();
      }, 2500);

    } catch (err) {
      console.error("Error placing order: ", err);
      alert("Tilauksen lähetys epäonnistui. Yritä uudelleen.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === "Kaikki" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAllergen = allergenQuery === "" || 
                            item.allergens.some(a => a.toLowerCase().includes(allergenQuery.toLowerCase()));
    return matchesCategory && matchesSearch && matchesAllergen;
  });

  return (
    <div className="relative" id="customer-menu-section">
      {/* Hero Banner */}
      <div className="bg-slate-900 text-slate-100 py-12 px-8 rounded-2xl mb-8 relative overflow-hidden" id="menu-hero">
        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80')" }}></div>
        <div className="relative z-10 max-w-2xl" id="hero-content">
          <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full">Paikallista & Tuoretta</span>
          <h1 className="text-4xl font-sans font-extrabold tracking-tight text-white mt-3 mb-2">Bistro Kivi - Tilauspalvelu</h1>
          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            Tilaa herkulliset pohjoismaiset annokset ennakkoon suoraan puhelimellasi. Valitse noutoaika ja nauti ravintolatasoisesta ruuasta vaivattomasti.
          </p>
        </div>
      </div>

      {/* Main Menu Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8" id="menu-filters">
        {/* Search Bars */}
        <div className="md:col-span-8 space-y-3">
          <input
            type="text"
            id="menu-search-input"
            placeholder="Hae ruokalajia tai ainesosaa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder-slate-400 text-xs shadow-sm transition-all"
          />
        </div>
        <div className="md:col-span-4">
          <input
            type="text"
            id="allergen-filter-input"
            placeholder="Rajaa allergeenilla (esim. L, G)..."
            value={allergenQuery}
            onChange={(e) => setAllergenQuery(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder-slate-400 text-xs shadow-sm transition-all"
          />
        </div>

        {/* Category Selector */}
        <div className="md:col-span-12 flex flex-wrap gap-2 overflow-x-auto pb-2" id="category-scroller">
          {categories.map((category) => (
            <button
              key={category}
              id={`category-btn-${category.toLowerCase()}`}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                selectedCategory === category
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500" id="menu-loading-spinner">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-sm">Ladataan ruokalistaa...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-sm border border-red-100" id="menu-error-banner">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200" id="menu-empty-state">
          <p className="text-slate-500 text-sm">Hakukriteereilläsi ei löytynyt annoksia.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="menu-items-grid">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              id={`menu-item-card-${item.id}`}
              className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row relative ${
                item.isSoldOut ? 'opacity-60' : ''
              }`}
            >
              {item.imageUrl && (
                <div className="w-full md:w-40 h-40 md:h-auto relative shrink-0 bg-slate-100">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {item.isSoldOut && (
                    <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                      <span className="bg-red-500 text-white px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                        Loppuunmyyty
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="p-5 flex flex-col justify-between flex-grow">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className="text-base font-bold text-slate-900 font-sans leading-snug">{item.name}</h3>
                    <span className="text-base font-bold text-indigo-600 font-mono shrink-0">
                      {item.price.toFixed(2)} €
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{item.description}</p>
                  
                  {item.allergens.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-4">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Allergeenit:</span>
                      {item.allergens.map((allergen, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          {allergen}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100">
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {item.category}
                  </span>
                  
                  {!item.isSoldOut ? (
                    <button
                      id={`add-to-cart-${item.id}`}
                      onClick={() => handleAddToCart(item)}
                      className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Lisää ostoskoriin
                    </button>
                  ) : (
                    <span className="text-slate-400 text-xs font-medium">Ei saatavilla</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Cart Button (shows on mobile/desktop when items in cart) */}
      <AnimatePresence>
        {cartItemCount > 0 && (
          <motion.button
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 50 }}
            id="floating-cart-toggle"
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 transition-transform active:scale-95 animate-pulse"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-white text-indigo-700 text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full border-2 border-indigo-600">
                {cartItemCount}
              </span>
            </div>
            <span className="text-sm font-bold pr-1 hidden sm:inline">Ostoskori ({cartTotal.toFixed(2)} €)</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Success Notification */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            id="order-success-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
          >
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg border border-slate-200 flex flex-col items-center">
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full mb-4">
                <Check className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Tilaus lähetetty!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kiitos tilauksestasi! Keittiö on vastaanottanut tilauksesi. Voit seurata valmistumista tilaukset-välilehdellä.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer Overlay */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              id="cart-drawer-backdrop"
              className="fixed inset-0 bg-black z-50"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              id="cart-drawer"
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-50 shadow-2xl z-50 flex flex-col border-l border-slate-200"
            >
              {/* Header */}
              <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center" id="cart-drawer-header">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-slate-900" />
                  <h2 className="text-lg font-bold text-slate-900">Ostoskori</h2>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                    {cartItemCount} kpl
                  </span>
                </div>
                <button
                  id="close-cart-drawer"
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-grow overflow-y-auto p-6 space-y-4" id="cart-items-container">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                    <ShoppingBag className="w-12 h-12 stroke-[1.5] mb-3" />
                    <p className="text-sm">Ostoskorisi on tyhjä</p>
                  </div>
                ) : (
                  cartItems.map(({ item, quantity }) => (
                    <div
                      key={item.id}
                      id={`cart-item-row-${item.id}`}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-3"
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-14 h-14 object-cover rounded-lg shrink-0 bg-slate-50"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="flex-grow flex flex-col justify-between min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                          <button
                            id={`remove-cart-item-${item.id}`}
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-slate-300 hover:text-slate-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                            <button
                              id={`decrease-cart-qty-${item.id}`}
                              type="button"
                              onClick={() => handleUpdateQuantity(item.id, -1)}
                              className="px-2 py-1 hover:bg-slate-200 text-slate-500 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-3 py-1 text-xs font-mono font-bold text-slate-800">
                              {quantity}
                            </span>
                            <button
                              id={`increase-cart-qty-${item.id}`}
                              type="button"
                              onClick={() => handleUpdateQuantity(item.id, 1)}
                              className="px-2 py-1 hover:bg-slate-200 text-slate-500 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-indigo-600 font-mono">
                            {(item.price * quantity).toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order Form */}
              {cartItems.length > 0 && (
                <form onSubmit={handleSubmitOrder} className="bg-white border-t border-slate-200 p-6 space-y-4" id="order-submit-form">
                  {/* Pickup Time */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Valitse noutoaika
                    </label>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <button
                        type="button"
                        id="pickup-time-type-now"
                        onClick={() => setPickupTimeType('heti')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          pickupTimeType === 'heti'
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Clock className="w-4 h-4" /> Heti (n. 15-20 min)
                      </button>
                      <button
                        type="button"
                        id="pickup-time-type-later"
                        onClick={() => setPickupTimeType('kellonaika')}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          pickupTimeType === 'kellonaika'
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Clock className="w-4 h-4" /> Valitse aika
                      </button>
                    </div>

                    {pickupTimeType === 'kellonaika' && (
                      <input
                        type="time"
                        id="pickup-time-input"
                        required
                        value={pickupTimeValue}
                        onChange={(e) => setPickupTimeValue(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                      />
                    )}
                  </div>

                  {/* Additional Notes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Erityisruokavaliot & allergiat tai lisätiedot
                    </label>
                    <textarea
                      id="additional-notes-input"
                      rows={2}
                      placeholder="Esim. sipuliallergia, kastike erikseen tms."
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none transition-all"
                    />
                  </div>

                  {/* Summary & Submit */}
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-bold text-slate-500">Yhteensä:</span>
                      <span className="text-xl font-bold text-indigo-600 font-mono">
                        {cartTotal.toFixed(2)} €
                      </span>
                    </div>

                    <button
                      type="submit"
                      id="submit-order-btn"
                      disabled={orderSubmitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold py-3 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
                    >
                      {orderSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Lähetetään tilausta...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Vahvista ja tilaa
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
