import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MenuItem } from '../types';
import { Plus, Edit3, Trash2, Eye, EyeOff, Save, X, DollarSign, Tag, Info } from 'lucide-react';

export default function AdminMenu() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form States for Add/Edit
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  // Fields
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [category, setCategory] = useState<string>("Pääruoat");
  const [allergensText, setAllergensText] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");

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
      const items: MenuItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as MenuItem);
      });
      // Sort by creation time
      items.sort((a, b) => b.createdAt - a.createdAt);
      setMenuItems(items);
    } catch (err: any) {
      console.error("Error fetching menu for admin: ", err);
      setError("Ruokalistan lataaminen epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddForm = () => {
    setEditingItem(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategory("Pääruoat");
    setAllergensText("");
    setImageUrl("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price.toString());
    setCategory(item.category);
    setAllergensText(item.allergens.join(', '));
    setImageUrl(item.imageUrl || "");
    setIsFormOpen(true);
  };

  const handleToggleSoldOut = async (item: MenuItem) => {
    try {
      const itemRef = doc(db, 'menu', item.id);
      const newStatus = !item.isSoldOut;
      try {
        await updateDoc(itemRef, {
          isSoldOut: newStatus
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `menu/${item.id}`);
      }
      setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, isSoldOut: newStatus } : m));
    } catch (err) {
      console.error("Error toggling sold out: ", err);
      alert("Tilan päivitys epäonnistui.");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Haluatko varmasti poistaa tämän tuotteen ruokalistalta?")) return;
    try {
      const itemRef = doc(db, 'menu', itemId);
      try {
        await deleteDoc(itemRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `menu/${itemId}`);
      }
      setMenuItems(prev => prev.filter(m => m.id !== itemId));
    } catch (err) {
      console.error("Error deleting menu item: ", err);
      alert("Poistaminen epäonnistui.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      alert("Täytä vähintään nimi ja hinta.");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) {
      alert("Hinnan on oltava kelvollinen numero.");
      return;
    }

    const allergenList = allergensText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const menuData = {
      name: name.trim(),
      description: description.trim(),
      price: priceNum,
      category,
      allergens: allergenList,
      imageUrl: imageUrl.trim() || undefined,
      isSoldOut: editingItem ? editingItem.isSoldOut : false,
      createdAt: editingItem ? editingItem.createdAt : Date.now()
    };

    try {
      if (editingItem) {
        // Edit existing item
        const itemRef = doc(db, 'menu', editingItem.id);
        try {
          await updateDoc(itemRef, menuData);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `menu/${editingItem.id}`);
        }
        setMenuItems(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...menuData } : m));
      } else {
        // Add new item
        const menuRef = collection(db, 'menu');
        let docRef;
        try {
          docRef = await addDoc(menuRef, menuData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'menu');
        }
        setMenuItems(prev => [{ id: docRef.id, ...menuData } as MenuItem, ...prev]);
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error("Error saving menu item: ", err);
      alert("Tallentaminen epäonnistui. Yritä uudelleen.");
    }
  };

  return (
    <div className="space-y-6" id="admin-menu-section">
      {/* Header and Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm" id="admin-menu-header">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Ruokalistan Hallinta</h1>
          <p className="text-xs text-slate-500 mt-0.5">Lisää uusia annoksia, muokkaa hintoja tai merkitse tuotteita loppuunmyydyiksi.</p>
        </div>
        <button
          id="add-new-item-btn"
          onClick={handleOpenAddForm}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 animate-none"
        >
          <Plus className="w-4 h-4" /> Lisää uusi annos
        </button>
      </div>

      {/* Main Grid or Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500" id="admin-menu-loading">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
          <p className="text-xs">Ladataan ruokalistaa...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-sm border border-red-100" id="admin-menu-error">
          {error}
        </div>
      ) : menuItems.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm" id="admin-menu-empty">
          <p className="text-slate-500 text-xs font-semibold">Ruokalista on tyhjä. Klikkaa yltä lisätäksesi ensimmäisen tuotteen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="admin-menu-items-grid">
          {menuItems.map((item) => (
            <div
              key={item.id}
              id={`admin-item-card-${item.id}`}
              className={`bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col sm:flex-row justify-between transition-all ${
                item.isSoldOut ? 'border-red-200 bg-red-50/10 opacity-75' : 'border-slate-200'
              }`}
            >
              {/* Left detail side */}
              <div className="p-4 flex gap-3 flex-grow">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg shrink-0 bg-slate-50"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate leading-snug">{item.name}</h3>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold shrink-0">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">{item.description}</p>
                  
                  {item.allergens.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400">Tagit:</span>
                      {item.allergens.map((a, idx) => (
                        <span key={idx} className="bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-bold px-1 rounded">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right price / controls side */}
              <div className="px-4 pb-4 sm:p-4 border-t sm:border-t-0 sm:border-l border-slate-100 flex sm:flex-col justify-between items-center sm:justify-center gap-3 shrink-0 bg-slate-50/50 sm:w-44">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block font-bold">Hinta</span>
                  <span className="text-base font-black text-slate-900 font-mono">{item.price.toFixed(2)} €</span>
                </div>

                <div className="flex sm:flex-col gap-2 w-full">
                  {/* Toggle availability */}
                  <button
                    id={`toggle-soldout-${item.id}`}
                    onClick={() => handleToggleSoldOut(item)}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[10px] font-bold transition-colors w-full border ${
                      item.isSoldOut
                        ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    {item.isSoldOut ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Loppu (Piilotettu)</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Myynnissä (Näkyy)</span>
                      </>
                    )}
                  </button>

                  <div className="flex gap-1.5 w-full">
                    {/* Edit button */}
                    <button
                      id={`edit-item-${item.id}`}
                      onClick={() => handleOpenEditForm(item)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg flex-grow flex justify-center hover:bg-slate-50 transition-colors"
                      title="Muokkaa"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete button */}
                    <button
                      id={`delete-item-${item.id}`}
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-lg flex-grow flex justify-center hover:bg-red-50 transition-colors"
                      title="Poista"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over Form Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" id="menu-form-overlay">
          {/* Backdrop */}
          <div
            onClick={() => setIsFormOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
          />

          {/* Drawer Form Container */}
          <div className="relative w-full max-w-md bg-slate-50 shadow-2xl h-full flex flex-col border-l border-slate-200 z-10 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center" id="form-header">
              <h2 className="text-base font-bold text-slate-900">
                {editingItem ? "Muokkaa Annosta" : "Lisää Uusi Annos"}
              </h2>
              <button
                id="close-form-btn"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-5" id="menu-form">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Annoksen nimi *
                </label>
                <input
                  type="text"
                  id="form-item-name"
                  required
                  placeholder="Esim. Metsäsienirisotto"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Kuvaus *
                </label>
                <textarea
                  id="form-item-desc"
                  required
                  rows={3}
                  placeholder="Kuvaile annosta, sen ainesosia ja valmistustapaa..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Hinta (€) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">€</span>
                    <input
                      type="text"
                      id="form-item-price"
                      required
                      placeholder="14.90"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Kategoria
                  </label>
                  <select
                    id="form-item-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  >
                    <option value="Alkuruoat">Alkuruoat</option>
                    <option value="Pääruoat">Pääruoat</option>
                    <option value="Jälkiruoat">Jälkiruoat</option>
                    <option value="Juomat">Juomat</option>
                  </select>
                </div>
              </div>

              {/* Allergens */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Allergeenimerkit (pilkulla erotettuina)
                </label>
                <input
                  type="text"
                  id="form-item-allergens"
                  placeholder="esim. L, G, V, Pähkinätön"
                  value={allergensText}
                  onChange={(e) => setAllergensText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
                <span className="text-[10px] text-slate-400 block mt-1">Esim: L = laktoositon, G = gluteeniton, V = vegaaninen.</span>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Kuvan URL-osoite (vapaaehtoinen)
                </label>
                <input
                  type="url"
                  id="form-item-image"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200/60 flex gap-3">
                <button
                  type="button"
                  id="cancel-form-bottom"
                  onClick={() => setIsFormOpen(false)}
                  className="w-1/2 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors"
                >
                  Peruuta
                </button>
                <button
                  type="submit"
                  id="save-form-item"
                  className="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-all"
                >
                  <Save className="w-4 h-4" /> Tallenna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
