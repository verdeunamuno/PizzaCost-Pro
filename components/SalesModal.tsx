import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, ShoppingCart, Trash2, ReceiptText, Pizza as PizzaIcon, CheckCircle2, Search, Package, Plus, Minus, Printer } from 'lucide-react';
import { Pizza, IngredientCost, AppSettings, Ticket, TicketItem } from '../types';
import ReactDOM from 'react-dom';

interface SalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pizzas: Pizza[];
  ingredientsCosts: IngredientCost[];
  setIngredients: React.Dispatch<React.SetStateAction<IngredientCost[]>>;
  settings: AppSettings;
  isGlovoMode: boolean;
  onSaveTicket: (ticket: Ticket) => void;
  lastTicketNumber: number;
}

const SalesModal: React.FC<SalesModalProps> = ({ isOpen, onClose, pizzas, ingredientsCosts, setIngredients, settings, isGlovoMode, onSaveTicket, lastTicketNumber }) => {
  const [orderItems, setOrderItems] = useState<TicketItem[]>([]);
  const [activeTab, setActiveTab] = useState<'pizzas' | 'extras'>('pizzas');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [currentTicketForPrint, setCurrentTicketForPrint] = useState<Ticket | null>(null);
  const [isPrintingPhase, setIsPrintingPhase] = useState(false);
  
  const ticketEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al añadir items para ver siempre el final de la cuenta
  useEffect(() => {
    if (ticketEndRef.current) {
      ticketEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [orderItems]);

  // LÓGICA DE IMPRESIÓN SEGURA
  useEffect(() => {
    if (isPrintingPhase && currentTicketForPrint) {
      const timer = setTimeout(() => {
        document.body.classList.add('printing-ticket');
        window.print();
        document.body.classList.remove('printing-ticket');
        setIsPrintingPhase(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isPrintingPhase, currentTicketForPrint]);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const handleAddItem = (item: { id: string, name: string, salePrice: number, costPrice: number, ingredients?: any[] }) => {
    const existingIdx = orderItems.findIndex(i => i.id === item.id);
    if (existingIdx !== -1) {
      updateQuantity(existingIdx, orderItems[existingIdx].quantity + 1);
    } else {
      setOrderItems([...orderItems, {
        id: item.id,
        name: item.name,
        quantity: 1,
        salePrice: item.salePrice,
        costPrice: item.costPrice,
        ingredients: item.ingredients || []
      }]);
    }
  };

  const updateQuantity = (idx: number, newQty: number) => {
    if (newQty <= 0) {
      setOrderItems(orderItems.filter((_, i) => i !== idx));
      return;
    }
    const updated = [...orderItems];
    updated[idx].quantity = newQty;
    setOrderItems(updated);
  };

  const calculatePizzaCost = (pizza: Pizza) => {
    return pizza.ingredients.reduce((acc, ing) => {
      const dbItem = ingredientsCosts.find(db => db.name.toLowerCase() === ing.name.toLowerCase());
      return acc + (Number(ing.amount) * (dbItem?.pricePerUnit || 0));
    }, 0);
  };

  const totals = useMemo(() => {
    const totalVenta = orderItems.reduce((acc, i) => acc + (i.salePrice * i.quantity), 0);
    const totalCosto = orderItems.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);
    const baseImponible = totalVenta / 1.10;
    
    let profit = 0;
    if (isGlovoMode) {
      const glovoFee = totalVenta * (settings.glovoCommission / 100);
      profit = baseImponible - glovoFee - totalCosto;
    } else {
      profit = baseImponible - totalCosto;
    }
    
    return { totalVenta, totalCosto, profit };
  }, [orderItems, isGlovoMode, settings.glovoCommission]);

  const handleFinishSale = () => {
    if (orderItems.length === 0) return;
    
    const newTicket: Ticket = {
      id: crypto.randomUUID(),
      ticketNumber: lastTicketNumber + 1,
      date: new Date().toISOString(),
      items: [...orderItems],
      totalVenta: totals.totalVenta,
      totalCosto: totals.totalCosto,
      totalProfit: totals.profit,
      isGlovo: isGlovoMode
    };

    setCurrentTicketForPrint(newTicket);
    onSaveTicket(newTicket);
    setShowSuccessToast(true);
    setOrderItems([]);
    setIsPrintingPhase(true);
  };

  const qrUrl = "https://www.google.com/search?q=Noctambula+Pizza+Co+Reseñas";

  const renderPrintableTicket = isPrintingPhase && currentTicketForPrint && ReactDOM.createPortal(
    <div className="printable-ticket-content">
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <img src="https://www.noctambulapizza.com/wp-content/uploads/2024/05/NOCWEBFAV-02.png" alt="Logo" style={{ width: '30mm', marginBottom: '5px', display: 'block', margin: '0 auto' }} />
        <h1 style={{ fontSize: '16px', fontWeight: '900', margin: '0' }}>NOCTÁMBULA PIZZA CO.</h1>
        <p style={{ margin: '5px 0', fontSize: '9px' }}>
          C/ 12 de octubre, 8, 14001 Córdoba<br />
          CIF B56304413 | Tfno. 744793393<br />
          info@NoctambulaPizza.com
        </p>
      </div>
      
      <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '5px 0', margin: '8px 0', fontSize: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Ticket #{currentTicketForPrint.ticketNumber}</span>
          <span>{new Date(currentTicketForPrint.date).toLocaleDateString()}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: '8px', marginTop: '2px' }}>
          {new Date(currentTicketForPrint.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <tbody>
          {currentTicketForPrint.items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: '3px 0' }}>{item.name} x{item.quantity}</td>
              <td style={{ textAlign: 'right' }}>{(item.quantity * item.salePrice).toFixed(2)}€</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '8px', borderTop: '1px solid black', paddingTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
          <span>Base Imponible:</span>
          <span>{(currentTicketForPrint.totalVenta / 1.10).toFixed(2)}€</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
          <span>IVA (10%):</span>
          <span>{(currentTicketForPrint.totalVenta - (currentTicketForPrint.totalVenta / 1.10)).toFixed(2)}€</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', marginTop: '4px' }}>
          <span>TOTAL:</span>
          <span>{currentTicketForPrint.totalVenta.toFixed(2)}€</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '9px' }}>
        <p style={{ marginBottom: '8px' }}>¡Danos tu opinión noctámbula!</p>
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrUrl)}`} alt="QR" style={{ width: '25mm', filter: 'contrast(1.5)', display: 'block', margin: '0 auto' }} />
        <p style={{ marginTop: '12px', fontWeight: 'bold' }}>GRACIAS POR TU VISITA</p>
      </div>
    </div>,
    document.getElementById('printable-ticket')!
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
      {renderPrintableTicket}
      
      {showSuccessToast && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] bg-noctambula text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-6 h-6" /> Venta Registrada con Éxito
        </div>
      )}

      <div className="bg-zinc-950 w-full max-w-6xl h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-zinc-800 animate-in zoom-in duration-300 relative">
        <div className="px-8 py-6 bg-zinc-900 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-noctambula rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-900/20"><ShoppingCart className="text-black w-6 h-6" /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Venta de Tickets</h2>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{isGlovoMode ? 'Modo Glovo Activo' : 'Venta Directa'}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors"><X className="w-8 h-8" /></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col p-8 overflow-hidden bg-zinc-950">
            <div className="flex items-center justify-between gap-6 mb-8">
              <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
                <button onClick={() => setActiveTab('pizzas')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'pizzas' ? 'bg-noctambula text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Pizzas</button>
                <button onClick={() => setActiveTab('extras')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'extras' ? 'bg-noctambula text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Extras / Bebidas</button>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4" />
                <input type="text" placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-noctambula" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeTab === 'pizzas' ? (
                  pizzas.filter(p => p.isActive !== false && p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                    <button key={p.id} onClick={() => handleAddItem({ id: p.id, name: p.name, salePrice: p.salePrice || 0, costPrice: calculatePizzaCost(p), ingredients: p.ingredients })} className="group flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-left hover:border-noctambula transition-all active:scale-95 shadow-sm">
                      <PizzaIcon className="w-5 h-5 text-noctambula" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-black uppercase text-[10px] truncate leading-tight mb-0.5">{p.name}</div>
                        <div className="text-[10px] font-black text-noctambula">{p.salePrice?.toFixed(2)}{settings.currency}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  ingredientsCosts.filter(i => i.showInSales && i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
                    <button key={e.id} onClick={() => handleAddItem({ id: e.id, name: e.name, salePrice: e.defaultSalePrice || 0, costPrice: e.pricePerUnit })} className="group flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-left hover:border-orange-500 transition-all active:scale-95 shadow-sm">
                      <Package className="w-5 h-5 text-orange-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-black uppercase text-[10px] truncate leading-tight mb-0.5">{e.name}</div>
                        <div className="text-[10px] font-black text-orange-500">{(e.defaultSalePrice || 0).toFixed(2)}{settings.currency}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="w-[440px] bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-2xl">
            <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4"><ReceiptText className="w-6 h-6 text-noctambula" /><h3 className="text-xs font-black text-white uppercase tracking-widest">Resumen Ticket</h3></div>
              <span className="text-sm font-black text-zinc-300 uppercase tracking-tighter">#{lastTicketNumber + 1}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {orderItems.map((item, idx) => (
                <div key={idx} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-black text-white uppercase truncate">{item.name}</span>
                    <span className="text-[11px] font-black text-white">{(item.quantity * item.salePrice).toFixed(2)}{settings.currency}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-900/50">
                    <div className="flex items-center bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden h-8">
                      <button onClick={() => updateQuantity(idx, item.quantity - 1)} className="p-2 text-zinc-500 hover:text-white"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-10 text-center text-[10px] font-black text-white">{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, item.quantity + 1)} className="p-2 text-zinc-500 hover:text-white"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                    <button onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))} className="text-zinc-700 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <div ref={ticketEndRef} />
            </div>

            <div className="p-8 bg-zinc-950 border-t border-zinc-800 space-y-4">
              <div className="flex justify-between items-center opacity-80">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Gasto Material</span>
                <span className="text-sm font-black text-red-500">{totals.totalCosto.toFixed(2)}{settings.currency}</span>
              </div>
              <div className="flex justify-between items-center opacity-80">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Beneficio Neto</span>
                <span className="text-sm font-black text-noctambula">{totals.profit.toFixed(2)}{settings.currency}</span>
              </div>
              
              <div className="pt-2 border-t border-zinc-900">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Cobrar</span>
                  <div className="text-4xl font-black text-white leading-none">{totals.totalVenta.toFixed(2)}{settings.currency}</div>
                </div>
              </div>
              
              <button 
                onClick={handleFinishSale} 
                disabled={orderItems.length === 0 || isPrintingPhase} 
                className="w-full py-5 bg-noctambula text-black rounded-[1.5rem] font-black text-[10px] uppercase flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 shadow-xl mt-2 group"
              >
                <Printer className={`w-5 h-5 ${isPrintingPhase ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'}`} /> 
                {isPrintingPhase ? 'Preparando Impresora...' : 'Registrar Venta e Imprimir'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesModal;