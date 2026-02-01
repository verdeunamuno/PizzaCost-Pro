import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Settings, Search, Trash2, Download, Upload, BarChart3, ShoppingCart, Banknote, Pizza as PizzaIcon, Beaker, FileUp, FileDown } from 'lucide-react';
import { IngredientCost, Pizza, AppSettings, Ticket, Unit, PizzaIngredient } from './types';
import CostsModal from './components/CostsModal';
import SettingsModal from './components/SettingsModal';
import PizzaModal from './components/PizzaModal';
import PizzaCard from './components/PizzaCard';
import Dashboard from './components/Dashboard';
import SalesModal from './components/SalesModal';
import ReportsModal from './components/ReportsModal';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  // Ordenar y renumerar pizzas automáticamente
  const sortAndRenumberPizzas = (pizzaList: Pizza[]): Pizza[] => {
    return [...pizzaList]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p, idx) => ({ ...p, number: idx + 1 }));
  };

  const [ingredients, setIngredients] = useState<IngredientCost[]>(() => {
    const saved = localStorage.getItem('noctambula_ingredients');
    return saved ? JSON.parse(saved) : [];
  });

  const [pizzas, setPizzas] = useState<Pizza[]>(() => {
    const saved = localStorage.getItem('noctambula_pizzas');
    const parsed = saved ? JSON.parse(saved) : [];
    return sortAndRenumberPizzas(parsed);
  });

  const [tickets, setTickets] = useState<Ticket[]>(() => {
    const saved = localStorage.getItem('noctambula_tickets');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('noctambula_settings');
    return saved ? JSON.parse(saved) : { decimals: 3, currency: '€', glovoCommission: 20 };
  });

  const [isGlovoMode, setIsGlovoMode] = useState(false);
  const [isLabMode, setIsLabMode] = useState(false);
  const [isCostsOpen, setIsCostsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPizzaModalOpen, setIsPizzaModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  
  const [editingPizza, setEditingPizza] = useState<Pizza | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{id: string, name: string} | null>(null);

  // Persistencia en LocalStorage
  useEffect(() => { localStorage.setItem('noctambula_ingredients', JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem('noctambula_pizzas', JSON.stringify(pizzas)); }, [pizzas]);
  useEffect(() => { localStorage.setItem('noctambula_tickets', JSON.stringify(tickets)); }, [tickets]);
  useEffect(() => { localStorage.setItem('noctambula_settings', JSON.stringify(settings)); }, [settings]);

  const handleDeleteTicket = (id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id));
  };

  // --- FUNCIONES JSON ---
  const handleExportJSON = () => {
    const data = {
      ingredients,
      pizzas,
      tickets,
      settings,
      version: "2.5",
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Noctambula_FullBackup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.ingredients) setIngredients(json.ingredients);
        if (json.pizzas) setPizzas(sortAndRenumberPizzas(json.pizzas));
        if (json.tickets) setTickets(json.tickets);
        if (json.settings) setSettings(json.settings);
        alert("Copia de seguridad JSON restaurada correctamente.");
      } catch (err) {
        alert("Error al leer el archivo JSON. Asegúrate de que es un archivo de copia válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  // -----------------------------

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const ingredientHeaders = ['INGREDIENTE', 'UNIDAD', 'PRECIO_COMPRA', 'PVP_VENTA_EXTRA', 'VENTA_ACTIVA'];
      const ingredientData = ingredients.map(i => [i.name.toUpperCase(), i.unit, i.pricePerUnit, i.defaultSalePrice || 0, i.showInSales ? 'SI' : 'NO']);
      const wsIng = XLSX.utils.aoa_to_sheet([ingredientHeaders, ...ingredientData]);
      XLSX.utils.book_append_sheet(wb, wsIng, "1-COSTES_BASE");

      const recipeHeaders = ['PIZZA_NOMBRE', 'PVP_PIZZA', 'INGREDIENTE', 'CANTIDAD', 'UNIDAD_AUTO'];
      const recipeData: any[] = [];
      pizzas.forEach(p => {
        p.ingredients.forEach((ing, idx) => {
          recipeData.push([idx === 0 ? p.name : '', idx === 0 ? p.salePrice : '', ing.name, ing.amount, ing.unit]);
        });
      });
      const wsRec = XLSX.utils.aoa_to_sheet([recipeHeaders, ...recipeData]);
      XLSX.utils.book_append_sheet(wb, wsRec, "2-RECETAS_PIZZAS");

      XLSX.writeFile(wb, `Noctambula_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch(e) { alert("Error al generar el Excel."); }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetIngName = workbook.SheetNames.find(n => n.includes('COSTES') || n.includes('1'));
        const sheetIng = sheetIngName ? workbook.Sheets[sheetIngName] : workbook.Sheets[workbook.SheetNames[0]];
        let newIngredients: IngredientCost[] = [];
        
        if (sheetIng) {
          const rawIngRows = XLSX.utils.sheet_to_json(sheetIng) as any[];
          newIngredients = rawIngRows.map(row => {
            const norm: any = {};
            Object.keys(row).forEach(k => norm[k.trim().toUpperCase()] = row[k]);
            return {
              id: crypto.randomUUID(),
              name: String(norm['INGREDIENTE'] || norm['NOMBRE'] || '').trim().toUpperCase(),
              unit: (String(norm['UNIDAD'] || 'Kg').toUpperCase().includes('L') ? 'L' : (String(norm['UNIDAD'] || '').toUpperCase().includes('UD') ? 'Ud' : 'Kg')) as Unit,
              pricePerUnit: parseFloat(norm['PRECIO_COMPRA'] || norm['PRECIO'] || 0),
              defaultSalePrice: parseFloat(norm['PVP_VENTA_EXTRA'] || norm['PVP'] || 0),
              showInSales: String(norm['VENTA_ACTIVA'] || '').toUpperCase() === 'SI'
            };
          }).filter(i => i.name !== '');
        }

        const sheetRecName = workbook.SheetNames.find(n => n.includes('RECETAS') || n.includes('2'));
        const sheetRec = sheetRecName ? workbook.Sheets[sheetRecName] : workbook.Sheets[workbook.SheetNames[1]];
        let newPizzas: Pizza[] = [];

        if (sheetRec) {
          const rawRecRows = XLSX.utils.sheet_to_json(sheetRec) as any[];
          let currentPizza: Pizza | null = null;
          
          rawRecRows.forEach(row => {
            const norm: any = {};
            Object.keys(row).forEach(k => norm[k.trim().toUpperCase()] = row[k]);
            const pizzaNameFromRow = String(norm['PIZZA_NOMBRE'] || norm['PIZZA'] || '').trim();
            const ingName = String(norm['INGREDIENTE'] || '').trim().toUpperCase();
            
            if (pizzaNameFromRow) {
              if (currentPizza) newPizzas.push(currentPizza);
              currentPizza = {
                id: crypto.randomUUID(),
                number: 0,
                name: pizzaNameFromRow.toUpperCase(),
                salePrice: parseFloat(norm['PVP_PIZZA'] || norm['PVP'] || 0),
                isActive: true,
                ingredients: []
              };
            }
            if (currentPizza && ingName) {
              currentPizza.ingredients.push({
                id: crypto.randomUUID(),
                name: ingName,
                amount: parseFloat(norm['CANTIDAD'] || 0),
                unit: (String(norm['UNIDAD_AUTO'] || 'Kg').toUpperCase().includes('L') ? 'L' : (String(norm['UNIDAD_AUTO'] || '').toUpperCase().includes('UD') ? 'Ud' : 'Kg')) as Unit
              });
            }
          });
          if (currentPizza) newPizzas.push(currentPizza);
        }

        if (newIngredients.length > 0 || newPizzas.length > 0) {
          if (newIngredients.length > 0) setIngredients(newIngredients);
          if (newPizzas.length > 0) setPizzas(sortAndRenumberPizzas(newPizzas));
          alert("Base de datos actualizada con éxito.");
        }
      } catch(err) { alert("Error al importar el archivo."); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleAddPizza = (pizzaData: Omit<Pizza, 'id' | 'number'>) => {
    const newPizza: Pizza = { ...pizzaData, id: crypto.randomUUID(), number: 0, isActive: true };
    setPizzas(prev => sortAndRenumberPizzas([...prev, newPizza]));
    setIsPizzaModalOpen(false);
  };

  const handleUpdatePizza = (pizzaData: Pizza) => {
    setPizzas(prev => sortAndRenumberPizzas(prev.map(p => p.id === pizzaData.id ? pizzaData : p)));
    setIsPizzaModalOpen(false);
    setEditingPizza(undefined);
  };

  const filteredPizzas = useMemo(() => {
    return pizzas.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [pizzas, searchTerm]);

  return (
    <div className={`min-h-screen pizza-bg flex flex-col transition-all duration-700 ${isLabMode ? 'bg-purple-950/30' : ''}`}>
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/90 border-b border-zinc-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-5 shrink-0">
            <div className="flex items-center gap-3">
              <img src="https://www.noctambulapizza.com/wp-content/uploads/2024/05/NOCWEBFAV-02.png" alt="Noctambula" className="h-10 w-auto" />
              <PizzaIcon className={`w-6 h-6 transition-colors duration-500 ${isLabMode ? 'text-purple-500' : 'text-noctambula'} animate-pulse`} />
            </div>

            <div className="relative hidden lg:block w-48 xl:w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-noctambula transition-colors w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar receta..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-[11px] font-bold text-white focus:border-noctambula/50 transition-all outline-none" 
              />
            </div>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-800 shadow-inner">
            <div className="flex items-center gap-2 px-2 border-r border-zinc-800">
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isGlovoMode ? 'text-yellow-500' : 'text-zinc-600'}`}>Glovo</span>
              <button onClick={() => setIsGlovoMode(!isGlovoMode)} className={`relative w-8 h-4 rounded-full transition-colors ${isGlovoMode ? 'bg-yellow-500' : 'bg-zinc-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isGlovoMode ? 'right-0.5' : 'left-0.5'}`}></div>
              </button>
            </div>
            <div className="flex items-center gap-2 px-2 border-r border-zinc-800">
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isLabMode ? 'text-purple-500' : 'text-zinc-600'}`}>LAB</span>
              <button onClick={() => setIsLabMode(!isLabMode)} className={`relative w-8 h-4 rounded-full transition-colors ${isLabMode ? 'bg-purple-500' : 'bg-zinc-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isLabMode ? 'right-0.5' : 'left-0.5'}`}></div>
              </button>
            </div>
            <div className="flex items-center gap-1 pl-1">
              <button onClick={handleExportExcel} className="flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-all" title="Exportar Excel">
                <FileDown className="w-3.5 h-3.5 text-noctambula" />
                <span className="text-[7px] font-black text-noctambula uppercase">EXP. EXCEL</span>
              </button>
              <label className="flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer" title="Importar Excel">
                <FileUp className="w-3.5 h-3.5 text-noctambula" />
                <span className="text-[7px] font-black text-noctambula uppercase">IMP. EXCEL</span>
                <input type="file" className="hidden" accept=".xlsx" onChange={handleImportExcel} />
              </label>
              
              <div className="w-[1px] h-6 bg-zinc-800 mx-1"></div>
              
              <button onClick={handleExportJSON} className="flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-all" title="Exportar JSON Backup">
                <FileDown className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[7px] font-black text-zinc-500 uppercase">EXP. JSON</span>
              </button>
              <label className="flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer" title="Importar JSON Backup">
                <FileUp className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[7px] font-black text-zinc-500 uppercase">IMP. JSON</span>
                <input type="file" className="hidden" accept=".json" onChange={handleImportJSON} />
              </label>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setIsDashboardOpen(true)} className="p-2.5 text-noctambula hover:bg-zinc-800 rounded-lg transition-all" title="Rentabilidad"><BarChart3 className="w-5 h-5" /></button>
            <button onClick={() => setIsReportsOpen(true)} className="p-2.5 text-noctambula hover:bg-zinc-800 rounded-lg transition-all" title="Caja"><Banknote className="w-5 h-5" /></button>
            <button onClick={() => setIsSalesOpen(true)} className="p-2.5 text-noctambula hover:bg-zinc-800 rounded-lg transition-all" title="Ventas"><ShoppingCart className="w-5 h-5" /></button>
            <button onClick={() => setIsCostsOpen(true)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-xl active:scale-95 ${isLabMode ? 'bg-purple-600 text-white' : 'bg-noctambula text-black'}`}>COSTES</button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 text-zinc-600 hover:text-white transition-colors"><Settings className="w-6 h-6" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-8">
        <div className="flex items-end justify-between mb-12 border-b border-zinc-800/50 pb-8">
          <div>
            <h2 className={`text-2xl font-black uppercase tracking-tighter leading-none ${isLabMode ? 'text-purple-400' : 'text-white'}`}>
              {isLabMode ? 'Pizzería Experimental' : 'Gestión Noctámbula'}
            </h2>
            <div className="flex items-center gap-3 mt-4">
              <div className={`h-1 w-12 rounded-full ${isLabMode ? 'bg-purple-600' : 'bg-noctambula'}`}></div>
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.4em]">Noctámbula Pizza Co. / Sistema de Gestión</p>
            </div>
          </div>
          <button onClick={() => { setEditingPizza(undefined); setIsPizzaModalOpen(true); }} className={`px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-2xl transition-all active:scale-95 ${isLabMode ? 'bg-purple-600 text-white shadow-purple-900/40' : 'bg-noctambula text-black shadow-yellow-900/20'}`}>
            <Plus className="w-5 h-5" /> Nueva Receta
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPizzas.map((p) => (
            <PizzaCard key={p.id} pizza={p} ingredientsCosts={ingredients} settings={settings} isGlovoMode={isGlovoMode} isLabMode={isLabMode} onEdit={() => { setEditingPizza(p); setIsPizzaModalOpen(true); }} onDelete={() => setConfirmDelete({id: p.id, name: p.name})} />
          ))}
          {filteredPizzas.length === 0 && (
            <div className="col-span-full py-32 text-center border-4 border-dashed border-zinc-900 rounded-[4rem]">
              <PizzaIcon className="w-16 h-16 text-zinc-800 mx-auto mb-6 opacity-20" />
              <p className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[10px]">No hay recetas en el sistema</p>
            </div>
          )}
        </div>
      </main>

      {isCostsOpen && <CostsModal isOpen={isCostsOpen} onClose={() => setIsCostsOpen(false)} ingredients={ingredients} setIngredients={setIngredients} settings={settings} />}
      {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} setSettings={setSettings} />}
      {isDashboardOpen && <Dashboard isOpen={isDashboardOpen} onClose={() => setIsDashboardOpen(false)} pizzas={pizzas} ingredientsCosts={ingredients} settings={settings} isGlovoMode={isGlovoMode} />}
      {isSalesOpen && <SalesModal isOpen={isSalesOpen} onClose={() => setIsSalesOpen(false)} pizzas={pizzas} ingredientsCosts={ingredients} setIngredients={setIngredients} settings={settings} isGlovoMode={isGlovoMode} onSaveTicket={(t) => setTickets(prev => [...prev, t])} lastTicketNumber={tickets.length} />}
      {isReportsOpen && <ReportsModal isOpen={isReportsOpen} onClose={() => setIsReportsOpen(false)} tickets={tickets} onDeleteTicket={handleDeleteTicket} ingredientsCosts={ingredients} settings={settings} />}
      {isPizzaModalOpen && (
        <PizzaModal isOpen={isPizzaModalOpen} onClose={() => setIsPizzaModalOpen(false)} onSubmit={editingPizza ? handleUpdatePizza : handleAddPizza} initialData={editingPizza} ingredientsCosts={ingredients} settings={settings} onOpenCosts={() => setIsCostsOpen(true)} isLabMode={isLabMode} onAddIngredientToDatabase={(name, unit) => setIngredients([...ingredients, { id: crypto.randomUUID(), name: name.toUpperCase(), unit, pricePerUnit: 0 }])} />
      )}
      
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 p-10 rounded-[3rem] border border-zinc-800 text-center max-w-sm w-full shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-600/10 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-red-600/20 shadow-lg shadow-red-900/10"><Trash2 className="w-10 h-10" /></div>
            <h3 className="text-2xl font-black text-white uppercase mb-3 tracking-tighter leading-none">¿Eliminar {confirmDelete.name}?</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-10 leading-relaxed">Esta acción es permanente.</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-5 bg-zinc-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all">Cancelar</button>
              <button onClick={() => { setPizzas(prev => sortAndRenumberPizzas(prev.filter(p => p.id !== confirmDelete.id))); setConfirmDelete(null); }} className="flex-1 py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-900/20">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;