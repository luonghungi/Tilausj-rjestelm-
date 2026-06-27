import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { User, Mail, Phone, Calendar, Search, MessageSquare } from 'lucide-react';

export default function AdminUsers() {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      // Query users where role is customer
      const q = query(usersRef, where('role', '==', 'customer'), orderBy('createdAt', 'desc'));
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'users');
      }
      const items: UserProfile[] = [];
      
      snapshot.forEach((doc) => {
        items.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsersList(items);
    } catch (err: any) {
      console.error("Error fetching users list: ", err);
      setError("Asiakasrekisterin lataus epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = usersList.filter(u => {
    const term = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(term) || 
           u.email.toLowerCase().includes(term) || 
           (u.phone && u.phone.includes(term));
  });

  return (
    <div className="space-y-6" id="admin-users-section">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" id="admin-users-header">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Asiakashallinta</h1>
          <p className="text-xs text-slate-500 mt-0.5">Lista rekisteröityneistä asiakkaista ja heidän yhteystiedoistaan.</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="users-search-input"
            placeholder="Hae nimellä, sähköpostilla..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500" id="users-loading">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
          <p className="text-xs">Ladataan asiakasrekisteriä...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-sm border border-red-100" id="users-error">
          {error}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-500 text-xs font-semibold" id="users-empty">
          Hakua vastaavia rekisteröityneitä asiakkaita ei löytynyt.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="users-grid-container">
          {filteredUsers.map((item) => (
            <div
              key={item.uid}
              id={`user-card-${item.uid}`}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all space-y-4"
            >
              {/* Profile Main */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center font-black text-sm shrink-0 uppercase">
                  {item.name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate leading-snug">{item.name}</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">
                    Asiakas
                  </span>
                </div>
              </div>

              {/* Contact details */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                {/* Email */}
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <a href={`mailto:${item.email}`} className="hover:underline truncate text-slate-900 font-bold">
                    {item.email}
                  </a>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  {item.phone ? (
                    <a href={`tel:${item.phone}`} className="hover:underline text-slate-900 font-mono font-bold">
                      {item.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">Ei puhelinnumeroa</span>
                  )}
                </div>

                {/* Registered Date */}
                <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-1">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium">
                    Liittynyt: {item.createdAt ? new Date(item.createdAt).toLocaleDateString('fi-FI') : 'Tuntematon'}
                  </span>
                </div>
              </div>

              {/* Instant Actions */}
              <div className="flex gap-2 pt-2">
                <a
                  id={`email-action-${item.uid}`}
                  href={`mailto:${item.email}`}
                  className="w-1/2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-center rounded-lg text-[11px] border border-slate-200 transition-colors flex items-center justify-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5" /> Sähköposti
                </a>
                {item.phone ? (
                  <a
                    id={`call-action-${item.uid}`}
                    href={`tel:${item.phone}`}
                    className="w-1/2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-center rounded-lg text-[11px] transition-all flex items-center justify-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" /> Soita
                  </a>
                ) : (
                  <button
                    disabled
                    id={`call-action-disabled-${item.uid}`}
                    className="w-1/2 py-2 bg-slate-100 text-slate-400 font-semibold rounded-lg text-[11px] border border-slate-200/50 cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" /> Ei numeroa
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
