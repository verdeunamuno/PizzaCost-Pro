import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Banknote, Package, BarChart3, Trash2, AlertTriangle, PieChart as PieChartIcon, TrendingUp, FileText, Printer } from 'lucide-react';
import { Ticket, IngredientCost, AppSettings } from '../types';
import Chart from 'chart.js/auto';
import ReactDOM from 'react-dom';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
  onDeleteTicket: (id: string) => void;
  ingredientsCosts: IngredientCost[];
  settings: AppSettings;
}

const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose, tickets, onDeleteTicket, ingredientsCosts, settings }) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'annual'>('daily');
  const [ticketToDelete, setTicketToDelete] = useState<{id: string, number: number} | null>(null);
  const [isPreparingPDF, setIsPreparingPDF] = useState(false);
  const [chartImages, setChartImages] = useState<{ pie: string; bar: string } | null>(null);
  
  // Estado para la reimpresión de tickets
  const [ticketToReprint, setTicketToReprint] = useState<Ticket | null>(null);
  const [isReprintingPhase, setIsReprintingPhase] = useState(false);
  
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartInstance = useRef<Chart | null>(null);
  const barChartInstance = useRef<Chart | null>(null);

  const filteredTickets = useMemo(() => {
    const now = new Date();
    return tickets.filter(t => {
      const ticketDate = new Date(t.date);
      if (period === 'daily') return ticketDate.toDateString() === now.toDateString();
      if (period === 'weekly') {
        const diff = now.getTime() - ticketDate.getTime();
        return diff < 7 * 24 * 60 * 60 * 1000;
      }
      if (period === 'monthly') return ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
      if (period === 'annual') return ticketDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [tickets, period]);

  const stats = useMemo(() => {
    const totalVenta = filteredTickets.reduce((acc, t) => acc + t.totalVenta, 0);
    const totalCosto = filteredTickets.reduce((acc, t) => acc + t.totalCosto, 0);
    const totalProfit = filteredTickets.reduce((acc, t) => acc + t.totalProfit, 0);
    
    let glovoCount = 0;
    let normalCount = 0;
    
    const productSales: { [name: string]: number } = {};
    const dailyStats: { [date: string]: { venta: number, costo: number } } = {};
    const ingredientUsage: { [name: string]: { amount: number, unit: string, cost: number } } = {};
    
    filteredTickets.forEach(t => {
      if (t.isGlovo) glovoCount++; else normalCount++;

      const dateKey = new Date(t.date).toLocaleDateString();
      if (!dailyStats[dateKey]) dailyStats[dateKey] = { venta: 0, costo: 0 };
      dailyStats[dateKey].venta += t.totalVenta;
      dailyStats[dateKey].costo += t.totalCosto;

      t.items.forEach(item => {
        productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
        item.ingredients.forEach(ing => {
          const totalAmount = ing.amount * item.quantity;
          if (!ingredientUsage[ing.name]) ingredientUsage[ing.name] = { amount: 0, unit: ing.unit, cost: 0 };
          ingredientUsage[ing.name].amount += totalAmount;
          const dbItem = ingredientsCosts.find(db => db.name.toLowerCase() === ing.name.toLowerCase());
          if (dbItem) ingredientUsage[ing.name].cost += totalAmount * dbItem.pricePerUnit;
        });
      });
    });

    return { totalVenta, totalCosto, totalProfit, ingredientUsage, productSales, dailyStats, glovoCount, normalCount };
  }, [filteredTickets, ingredientsCosts]);

  useEffect(() => {
    if (pieChartRef.current && Object.keys(stats.productSales).length > 0) {
      if (pieChartInstance.current) pieChartInstance.current.destroy();
      const entries = (Object.entries(stats.productSales) as [string, number][]).sort((a,b) => b[1] - a[1]).slice(0, 6);
      pieChartInstance.current = new Chart(pieChartRef.current, {
        type: 'doughnut',
        data: {
          labels: entries.map(e => e[0]),
          datasets: [{
            data: entries.map(e => e[1]),
            backgroundColor: ['#fef01e', '#eab308', '#ca8a04', '#a16207', '#713f12', '#452c10'],
            borderWidth: 2,
            borderColor: '#09090b'
          }]
        },
        options: {
          animation: { duration: 0 },
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { color: '#ffffff', font: { weight: 'bold' } } }
          },
          cutout: '70%'
        }
      });
    }

    if (barChartRef.current && Object.keys(stats.dailyStats).length > 0) {
      if (barChartInstance.current) barChartInstance.current.destroy();
      const dates = Object.keys(stats.dailyStats).slice(-7);
      barChartInstance.current = new Chart(barChartRef.current, {
        type: 'bar',
        data: {
          labels: dates,
          datasets: [
            { label: 'Ventas', data: dates.map(d => stats.dailyStats[d].venta), backgroundColor: '#fef01e', borderRadius: 8 },
            { label: 'Gasto Material', data: dates.map(d => stats.dailyStats[d].costo), backgroundColor: '#ef4444', borderRadius: 8 }
          ]
        },
        options: {
          animation: { duration: 0 },
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { grid: { color: '#18181b' }, ticks: { color: '#71717a' } },
            x: { grid: { display: false }, ticks: { color: '#71717a' } }
          },
          plugins: {
            legend: { labels: { color: '#71717a', font: { weight: 'bold' } } }
          }
        }
      });
    }
  }, [stats]);

  // LÓGICA DE REIMPRESIÓN INDIVIDUAL
  useEffect(() => {
    if (isReprintingPhase && ticketToReprint) {
      const timer = setTimeout(() => {
        document.body.classList.add('printing-ticket');
        window.print();
        document.body.classList.remove('printing-ticket');
        setIsReprintingPhase(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isReprintingPhase, ticketToReprint]);

  const handleExportPDF = () => {
    setIsPreparingPDF(true);
    const pieImg = pieChartRef.current?.toDataURL('image/png') || '';
    const barImg = barChartRef.current?.toDataURL('image/png') || '';
    setChartImages({ pie: pieImg, bar: barImg });
    setTimeout(() => {
      document.body.classList.add('printing-report');
      window.print();
      document.body.classList.remove('printing-report');
      setIsPreparingPDF(false);
    }, 600);
  };

  const confirmDelete = () => {
    if (ticketToDelete) {
      onDeleteTicket(ticketToDelete.id);
      setTicketToDelete(null);
    }
  };

  const handleReprint = (ticket: Ticket) => {
    setTicketToReprint(ticket);
    setIsReprintingPhase(true);
  };

  const periodText = period === 'daily' ? 'DIARIO' : period === 'weekly' ? 'SEMANAL' : period === 'monthly' ? 'MENSUAL' : 'ANUAL';

  const printableReport = ReactDOM.createPortal(
    <div className="printable-report-content" style={{ color: 'black' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '4px solid #fef01e', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <img src="https://www.noctambulapizza.com/wp-content/uploads/2024/05/NOCWEBFAV-02.png" alt="Logo" style={{ height: '60px', marginBottom: '10px' }} />
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900' }}>NOCTÁMBULA PIZZA CO.</h1>
          <p style={{ margin: '5px 0', fontSize: '11px', color: '#666' }}>
            SISTEMA DE GESTIÓN PROFESIONAL<br />
            C/ 12 de octubre, 8, 14001 Córdoba<br />
            CIF B56304413 | Tfno. 744793393
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#ca8a04' }}>INFORME DE GESTIÓN</h2>
          <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>PERIODO {periodText}</p>
          <p style={{ margin: 0, fontSize: '10px' }}>Fecha emisión: {new Date().toLocaleString()}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '40px' }}>
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '15px', border: '1px solid #eee' }}>
          <span style={{ fontSize: '10px', fontWeight: '900', color: '#888', textTransform: 'uppercase' }}>Ventas Brutas</span>
          <div style={{ fontSize: '24px', fontWeight: '900', marginTop: '5px' }}>{stats.totalVenta.toFixed(2)}{settings.currency}</div>
        </div>
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '15px', border: '1px solid #eee' }}>
          <span style={{ fontSize: '10px', fontWeight: '900', color: '#888', textTransform: 'uppercase' }}>Costo Producción</span>
          <div style={{ fontSize: '24px', fontWeight: '900', marginTop: '5px', color: '#ef4444' }}>{stats.totalCosto.toFixed(2)}{settings.currency}</div>
        </div>
        <div style={{ background: '#fef01e33', padding: '20px', borderRadius: '15px', border: '2px solid #fef01e' }}>
          <span style={{ fontSize: '10px', fontWeight: '900', color: '#ca8a04', textTransform: 'uppercase' }}>Margen Neto</span>
          <div style={{ fontSize: '24px', fontWeight: '900', marginTop: '5px' }}>{stats.totalProfit.toFixed(2)}{settings.currency}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }}>
        <div>
          <h3 style={{ fontSize: '11px', fontWeight: '900', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>EL REY DE LA NOCHE</h3>
          {chartImages?.pie && <img src={chartImages.pie} style={{ width: '100%', height: 'auto' }} alt="Pie Chart" />}
        </div>
        <div>
          <h3 style={{ fontSize: '11px', fontWeight: '900', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>BALANCE DIARIO</h3>
          {chartImages?.bar && <img src={chartImages.bar} style={{ width: '100%', height: 'auto' }} alt="Bar Chart" />}
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: '11px', fontWeight: '900', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>DESGLOSE DE CONSUMO Y COSTES</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f9f9f9' }}>
              <th style={{ padding: '10px' }}>Producto / Ingrediente</th>
              <th style={{ padding: '10px' }}>Cantidad</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Costo Total</th>
            </tr>
          </thead>
          <tbody>
            {(Object.entries(stats.ingredientUsage) as [string, any][])
              .sort((a,b) => b[1].cost - a[1].cost)
              .map(([name, data]) => (
                <tr key={name} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{name}</td>
                  <td style={{ padding: '10px' }}>{data.amount.toFixed(3)} {data.unit}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{data.cost.toFixed(2)}{settings.currency}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '10px', color: '#999' }}>
        Documento generado automáticamente por el Sistema Noctámbula Pro. Confidencial y de uso interno.
      </div>
    </div>,
    document.getElementById('printable-report')!
  );

  const qrUrl = "https://www.google.com/search?q=Noctambula+Pizza+Co+Reseñas";
  
  // Portal para reimpresión de ticket individual
  const printableTicket = ticketToReprint && ReactDOM.createPortal(
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
          <span>Ticket #{ticketToReprint.ticketNumber}</span>
          <span>{new Date(ticketToReprint.date).toLocaleDateString()}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: '8px', marginTop: '2px' }}>
          {new Date(ticketToReprint.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <tbody>
          {ticketToReprint.items.map((item, idx) => (
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
          <span>{(ticketToReprint.totalVenta / 1.10).toFixed(2)}€</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
          <span>IVA (10%):</span>
          <span>{(ticketToReprint.totalVenta - (ticketToReprint.totalVenta / 1.10)).toFixed(2)}€</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', marginTop: '4px' }}>
          <span>TOTAL:</span>
          <span>{ticketToReprint.totalVenta.toFixed(2)}€</span>
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
      {/* EXCLUSIVIDAD DE PORTALES PARA EVITAR SOLAPAMIENTOS */}
      {isPreparingPDF && printableReport}
      {isReprintingPhase && printableTicket}
      
      <div className="bg-zinc-950 w-full max-w-7xl h-[95vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-zinc-800 animate-in zoom-in duration-300 relative">
        
        {ticketToDelete && (
          <div className="absolute inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-zinc-900 p-10 rounded-[3rem] border border-zinc-800 text-center max-w-sm w-full shadow-3xl">
              <div className="w-20 h-20 bg-red-600/10 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-red-600/20 shadow-lg shadow-red-900/10"><AlertTriangle className="w-10 h-10" /></div>
              <h3 className="text-2xl font-black text-white uppercase mb-3 tracking-tighter leading-none">¿Eliminar Ticket #{ticketToDelete.number}?</h3>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-10 leading-relaxed">Esta acción restará la venta de los informes y es permanente.</p>
              <div className="flex gap-4">
                <button onClick={() => setTicketToDelete(null)} className="flex-1 py-5 bg-zinc-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all">Cancelar</button>
                <button onClick={confirmDelete} className="flex-1 py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-900/20">Confirmar</button>
              </div>
            </div>
          </div>
        )}

        <div className="px-8 py-6 bg-zinc-900 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-noctambula rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-900/20">
              <Banknote className="text-black w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Caja Registradora / Análisis Visual</h2>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={handleExportPDF}
              className={`flex items-center gap-2 px-6 py-2.5 bg-noctambula text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl hover:bg-[#e2d71a] ${isPreparingPDF ? 'opacity-50' : ''}`}
            >
              {isPreparingPDF ? <Printer className="w-4 h-4 animate-bounce" /> : <FileText className="w-4 h-4" />}
              <span>{isPreparingPDF ? 'Preparando...' : 'Exportar PDF'}</span>
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors ml-4"><X className="w-8 h-8" /></button>
          </div>
        </div>

        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex gap-4 mb-8">
            {['daily', 'weekly', 'monthly', 'annual'].map((p) => (
              <button key={p} onClick={() => setPeriod(p as any)} className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border ${period === p ? 'bg-noctambula text-black border-noctambula shadow-lg shadow-yellow-900/10' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}>
                {p === 'daily' ? 'Hoy' : p === 'weekly' ? 'Semana' : p === 'monthly' ? 'Mes' : 'Anual'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-zinc-900 p-8 rounded-[2rem] border border-zinc-800">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Venta Total Bruta</span>
              <div className="text-4xl font-black text-white">{stats.totalVenta.toFixed(2)}{settings.currency}</div>
            </div>
            <div className="bg-zinc-900 p-8 rounded-[2rem] border border-zinc-800">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Costo Material</span>
              <div className="text-4xl font-black text-red-600">{stats.totalCosto.toFixed(2)}{settings.currency}</div>
            </div>
            <div className="bg-noctambula/10 p-8 rounded-[2rem] border border-noctambula/30">
              <span className="text-[10px] font-black text-noctambula uppercase tracking-widest mb-2 block">Margen Neto</span>
              <div className="text-4xl font-black text-white">{stats.totalProfit.toFixed(2)}{settings.currency}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-800 h-[380px] flex flex-col">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase mb-4 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-noctambula" /> El Rey de la Noche (Top Ventas)
              </h3>
              <div className="flex-1 relative">
                <canvas ref={pieChartRef}></canvas>
              </div>
            </div>
            <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-800 h-[380px] flex flex-col">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-noctambula" /> Balance Ventas vs Gastos
              </h3>
              <div className="flex-1 relative">
                <canvas ref={barChartRef}></canvas>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-zinc-900/50 rounded-[2.5rem] border border-zinc-800 p-8">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                <Package className="w-4 h-4 text-noctambula" /> Consumo de Materiales
              </h3>
              <div className="space-y-4">
                {(Object.entries(stats.ingredientUsage) as [string, { amount: number, unit: string, cost: number }][])
                  .sort((a,b) => b[1].cost - a[1].cost)
                  .map(([name, data]) => (
                  <div key={name} className="flex items-center justify-between bg-zinc-950 p-6 rounded-2xl border border-zinc-900 hover:border-zinc-800 transition-all">
                    <div className="flex-1">
                      <div className="text-[11px] font-black text-white uppercase mb-1">{name}</div>
                      <div className="text-red-600 font-black text-xl">{data.amount.toFixed(3)} <span className="text-[10px]">{data.unit}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-noctambula">{data.cost.toFixed(2)}{settings.currency}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/50 rounded-[2.5rem] border border-zinc-800 p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-noctambula" /> Historial de Operaciones
                </h3>
                <div className="flex gap-3">
                  <div className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[9px] font-black uppercase text-zinc-400">
                    Normal: <span className="text-white ml-1">{stats.normalCount}</span>
                  </div>
                  <div className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-[9px] font-black uppercase text-yellow-500">
                    Glovo: <span className="text-white ml-1">{stats.glovoCount}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {filteredTickets.slice().reverse().map(t => (
                  <div key={t.id} className={`flex items-center justify-between p-5 rounded-2xl border transition-all group relative overflow-hidden ${t.isGlovo ? 'bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500' : 'bg-zinc-950 border-zinc-900 hover:border-zinc-700'}`}>
                    
                    {t.isGlovo && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[100px] font-black text-yellow-500/10 pointer-events-none select-none italic z-0 leading-none">G</span>
                    )}
                    
                    <div className="flex items-center gap-5 relative z-10">
                       <div className="flex flex-col gap-2 items-center">
                          <button onClick={() => setTicketToDelete({id: t.id, number: t.ticketNumber})} className="p-2.5 bg-red-950/20 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all shadow-sm">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleReprint(t)} className="p-2.5 bg-zinc-800 text-zinc-400 hover:bg-noctambula hover:text-black rounded-lg transition-all shadow-sm">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                       </div>
                      <div>
                        <div className="text-[11px] font-black text-white uppercase flex items-center gap-2">
                          TICKET #{t.ticketNumber}
                          {t.isGlovo && <span className="px-2 py-0.5 bg-yellow-500 text-black rounded text-[7px] font-black uppercase">GLOVO</span>}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-bold">{new Date(t.date).toLocaleDateString()} - {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                    <div className="text-right relative z-10">
                      <div className="text-xl font-black text-white">{t.totalVenta.toFixed(2)}{settings.currency}</div>
                      <div className={`text-[9px] font-black uppercase ${t.isGlovo ? 'text-yellow-500' : 'text-noctambula'}`}>Neto: {t.totalProfit.toFixed(2)}{settings.currency}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsModal;