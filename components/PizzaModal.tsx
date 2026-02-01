import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Search, Calculator, Database, Euro, Eye, EyeOff, Beaker, Sparkles, Brain, Loader2 } from 'lucide-react';
import { Pizza, IngredientCost, PizzaIngredient, AppSettings, Unit } from '../types';
import { GoogleGenAI } from "@google/genai";

interface PizzaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pizza: any) => void;
  initialData?: Pizza;
  ingredientsCosts: IngredientCost[];
  settings: AppSettings;
  onOpenCosts: () => void;
  onAddIngredientToDatabase: (name: string, unit: Unit) => void;
  isLabMode?: boolean;
}

const PizzaModal: React.FC<PizzaModalProps> = ({ isOpen, onClose, onSubmit, initialData, ingredientsCosts, settings, onOpenCosts, onAddIngredientToDatabase, isLabMode }) => {
  const [name, setName] = useState(initialData?.name?.toUpperCase() || '');
  const [salePrice, setSalePrice] = useState<string>(initialData?.salePrice ? String(initialData.salePrice) : '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [ingredients, setIngredients] = useState<PizzaIngredient[]>(initialData?.ingredients || []);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [showFullListIdx, setShowFullListIdx] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  
  const lastInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ingredients.length > 0) {
      setTimeout(() => {
        lastInputRef.current?.focus();
      }, 100);
    }
  }, [ingredients.length]);

  const addIngredientRow = () => {
    setIngredients([...ingredients, { id: crypto.randomUUID(), name: '', amount: 0, unit: 'Kg' }]);
  };

  const removeIngredientRow = (id: string) => {
    setIngredients(ingredients.filter(i => i.id !== id));
  };

  const updateIngredient = (id: string, field: keyof PizzaIngredient, value: any) => {
    setIngredients(prev => prev.map(i => {
      if (i.id === id) {
        if (field === 'name') {
          const uppercasedValue = value.toUpperCase();
          const found = ingredientsCosts.find(db => db.name.toLowerCase() === uppercasedValue.toLowerCase());
          return { ...i, [field]: uppercasedValue, unit: found ? found.unit : i.unit };
        }
        return { ...i, [field]: value };
      }
      return i;
    }));
  };

  const sortedIngredients = useMemo(() => {
    return [...ingredientsCosts].sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredientsCosts]);

  const suggestions = useMemo(() => {
    if (!searchTerm) return [];
    return sortedIngredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, sortedIngredients]);

  const calculateRowCost = (ing: PizzaIngredient) => {
    const dbItem = ingredientsCosts.find(db => db.name.toLowerCase() === ing.name.toLowerCase());
    if (!dbItem) return 0;
    return (Number(ing.amount) || 0) * dbItem.pricePerUnit;
  };

  const totalCost = ingredients.reduce((acc, ing) => acc + calculateRowCost(ing), 0);
  const numericSalePriceIVA = parseFloat(salePrice) || 0;
  const basePrice = numericSalePriceIVA / 1.10;
  const profit = numericSalePriceIVA > 0 ? basePrice - totalCost : 0;
  const marginPercent = numericSalePriceIVA > 0 ? (profit / basePrice) * 100 : 0;

  const handleAiAnalysis = async () => {
    if (!name || ingredients.length === 0) return;
    setIsAiAnalyzing(true);
    setAiFeedback(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Como experto consultor gastronómico para "Noctámbula Pizza Co.", analiza esta receta:
      Modelo: ${name}
      Ingredientes: ${ingredients.map(i => `${i.name} (${i.amount}${i.unit})`).join(', ')}
      Coste de Materiales: ${totalCost.toFixed(2)}€
      PVP actual (IVA incl): ${salePrice}€
      Margen Neto: ${marginPercent.toFixed(1)}%

      Dame 3 bloques de consejos quirúrgicos y directos:
      1. RENTABILIDAD: Análisis del precio vs coste. ¿Es competitivo? ¿Dónde perdemos margen?
      2. PERFIL DE SABOR: Equilibrio de ingredientes y potencial de éxito en carta.
      3. ESCANDALLO Y MERMA: ¿Cómo optimizar el uso de estos ingredientes para reducir desperdicio o mejorar el proceso operativo?
      
      IMPORTANTE: No sugieras nombres nuevos, el nombre "${name}" ya es definitivo. Responde en formato lista con emojis.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setAiFeedback(response.text || "La IA no ha podido generar un análisis en este momento.");
    } catch (error) {
      setAiFeedback("Error conectando con la IA. Revisa tu conexión a internet.");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || ingredients.length === 0) return;
    onSubmit({ 
      id: initialData?.id, 
      name: name.toUpperCase(), 
      salePrice: numericSalePriceIVA,
      isActive,
      ingredients: ingredients.map(ing => ({ ...ing, name: ing.name.toUpperCase() }))
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className={`bg-zinc-950 w-full max-w-6xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border animate-in slide-in-from-bottom-8 duration-500 transition-colors ${isLabMode ? 'border-purple-500/50' : 'border-zinc-800'}`}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <div className={`px-8 py-6 border-b flex items-center justify-between shrink-0 z-[60] transition-colors ${isLabMode ? 'bg-purple-950/20 border-purple-900/50' : 'bg-zinc-950 border-zinc-800'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${isLabMode ? 'bg-purple-600' : 'bg-noctambula shadow-lg shadow-yellow-900/20'}`}>
                {isLabMode ? <Beaker className="text-white w-6 h-6" /> : <Plus className="text-black w-6 h-6" />}
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                {isLabMode ? 'Laboratorio de Recetas' : (initialData ? 'Editar Receta' : 'Nueva Receta')}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              {/* BOTÓN MEJORA CON IA SIEMPRE VISIBLE */}
              <button 
                type="button"
                onClick={handleAiAnalysis}
                disabled={isAiAnalyzing || !name}
                className={`relative group flex items-center gap-2 px-6 py-2.5 bg-noctambula text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:grayscale overflow-hidden shadow-[0_0_20px_rgba(254,240,30,0.4)] hover:shadow-[0_0_30px_rgba(254,240,30,0.6)]`}
              >
                {/* EFECTO DE LUZ/BRILLO */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none"></div>
                {isAiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 animate-pulse" />}
                <span className="relative z-10">{isAiAnalyzing ? 'Consultando...' : 'Mejora con IA'}</span>
              </button>

              <button 
                type="button" 
                onClick={() => setIsActive(!isActive)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${isActive ? (isLabMode ? 'bg-purple-600/10 border-purple-500 text-purple-400' : 'bg-noctambula/10 border-noctambula text-noctambula') : 'bg-zinc-900 border-zinc-700 text-zinc-500'}`}
              >
                {isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-[10px] font-black uppercase tracking-widest">{isActive ? 'ACTIVA' : 'APAGADA'}</span>
              </button>
              <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-8 h-8" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            <div className="flex-1 p-8 overflow-y-auto space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">Nombre del Modelo</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value.toUpperCase())}
                    placeholder="MARGARITA REAL..."
                    className={`w-full text-3xl font-black bg-transparent border-b-4 focus:border-opacity-100 text-white outline-none py-2 px-1 transition-all placeholder:text-zinc-800 ${isLabMode ? 'border-purple-900 focus:border-purple-500' : 'border-zinc-900 focus:border-noctambula'}`}
                    required
                  />
                </div>
                
                <div className={`p-6 rounded-[2rem] border flex flex-col gap-4 transition-colors ${isLabMode ? 'bg-purple-900/10 border-purple-800' : 'bg-zinc-900 border-zinc-800'}`}>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-500 uppercase mb-2 tracking-widest">PVP (IVA 10% Incl.)</label>
                    <div className="relative">
                      <Euro className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isLabMode ? 'text-purple-400' : 'text-noctambula'}`} />
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value.replace(',', '.'))}
                        placeholder="0.00"
                        className={`w-full pl-12 pr-4 py-3 bg-zinc-950 border-2 border-transparent focus:border-opacity-100 rounded-2xl outline-none font-black text-2xl text-white shadow-sm transition-all ${isLabMode ? 'focus:border-purple-500' : 'focus:border-noctambula'}`}
                      />
                    </div>
                  </div>
                  
                  {numericSalePriceIVA > 0 && (
                    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-black text-zinc-500 uppercase">Margen Real</span>
                        <span className={`text-xl font-black ${marginPercent > 30 ? (isLabMode ? 'text-purple-400' : 'text-noctambula') : 'text-zinc-400'}`}>{marginPercent.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-900 pt-2">
                        <span className="text-[10px] font-black text-zinc-500 uppercase">Beneficio Neto</span>
                        <span className="text-xl font-black text-white">{profit.toFixed(settings.decimals)}{settings.currency}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <div className="sticky top-[-2rem] z-50 bg-zinc-950 pt-4 pb-6 border-b border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ingredientes y Pesos</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={onOpenCosts} className="flex items-center gap-2 bg-zinc-900 text-zinc-400 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-zinc-800 transition-all border border-zinc-800">
                      <Database className="w-3 h-3" /> Base de Datos
                    </button>
                    <button type="button" onClick={addIngredientRow} className={`text-[10px] font-black flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 ${isLabMode ? 'bg-purple-600 text-white shadow-purple-900/30' : 'bg-noctambula text-black shadow-yellow-900/20'}`}>
                      <Plus className="w-4 h-4" /> Añadir
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-6">
                  {ingredients.map((ing, idx) => {
                    const dbItem = ingredientsCosts.find(db => db.name.toLowerCase() === ing.name.toLowerCase());
                    const isMissing = ing.name && !dbItem;
                    const isLast = idx === ingredients.length - 1;

                    return (
                      <div key={ing.id} className="grid grid-cols-12 gap-4 p-4 rounded-3xl bg-zinc-900/50 border border-zinc-900 hover:border-zinc-700 transition-all group">
                        <div className="col-span-6 relative flex items-center gap-3">
                          <input 
                            ref={isLast ? lastInputRef : null}
                            type="text" 
                            value={ing.name}
                            onChange={(e) => {
                              updateIngredient(ing.id, 'name', e.target.value.toUpperCase());
                              setSearchTerm(e.target.value);
                              setActiveSearchIdx(idx);
                              setShowFullListIdx(null);
                            }}
                            onFocus={() => { setSearchTerm(ing.name); setActiveSearchIdx(idx); }}
                            placeholder="Ingrediente..."
                            className={`flex-1 bg-transparent font-black outline-none text-base ${isMissing ? 'text-red-500' : 'text-white'}`}
                          />
                          {(activeSearchIdx === idx && suggestions.length > 0) && (
                            <div className="absolute top-full left-0 w-full bg-zinc-900 border border-zinc-700 rounded-2xl z-[3000] mt-1 shadow-2xl max-h-48 overflow-y-auto">
                              {suggestions.map((s) => (
                                <button key={s.id} type="button" onMouseDown={() => { updateIngredient(ing.id, 'name', s.name.toUpperCase()); updateIngredient(ing.id, 'unit', s.unit); setActiveSearchIdx(null); }}
                                  className={`w-full text-left px-4 py-2 text-white text-xs font-bold flex justify-between hover:text-black ${isLabMode ? 'hover:bg-purple-500' : 'hover:bg-noctambula'}`}
                                >
                                  <span>{s.name}</span>
                                  <span className="text-[10px] opacity-50">{s.unit}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="col-span-3">
                          <input type="text" inputMode="decimal" value={ing.amount || ''} onChange={(e) => updateIngredient(ing.id, 'amount', e.target.value.replace(',', '.'))}
                            className={`w-full bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl text-center font-black text-white outline-none focus:border-opacity-100 ${isLabMode ? 'focus:border-purple-500' : 'focus:border-noctambula'}`} placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-1 text-center self-center text-[10px] font-black text-zinc-600">{ing.unit}</div>
                        <div className="col-span-2 text-right self-center">
                          <span className={`font-black ${isMissing ? 'text-red-900' : (isLabMode ? 'text-purple-400' : 'text-noctambula')}`}>{calculateRowCost(ing).toFixed(settings.decimals)}</span>
                        </div>
                        <button type="button" onClick={() => removeIngredientRow(ing.id)} className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 text-red-900 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI ANALYSIS PANEL - THEMED FOR NOCTAMBULA */}
            {aiFeedback && (
              <div className={`w-full md:w-96 p-8 overflow-y-auto animate-in slide-in-from-right-8 duration-500 transition-colors ${isLabMode ? 'bg-purple-950/20 border-l border-purple-900/50' : 'bg-zinc-900 border-l border-zinc-800'}`}>
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className={`w-5 h-5 ${isLabMode ? 'text-purple-400' : 'text-noctambula'}`} />
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Consultoría IA Noctámbula</h3>
                </div>
                <div className={`text-[11px] font-bold whitespace-pre-line p-6 rounded-[2rem] border shadow-2xl ${isLabMode ? 'text-purple-100/80 bg-zinc-950/50 border-purple-800' : 'text-zinc-200 bg-zinc-950 border-zinc-800 shadow-yellow-900/5'}`}>
                  {aiFeedback}
                </div>
                <button 
                  type="button" 
                  onClick={() => setAiFeedback(null)}
                  className={`mt-6 w-full py-4 text-[10px] font-black uppercase border rounded-2xl transition-all active:scale-95 ${isLabMode ? 'text-purple-400 border-purple-800 hover:bg-purple-900/30' : 'text-zinc-500 border-zinc-800 hover:text-white hover:bg-zinc-800'}`}
                >
                  Cerrar Análisis
                </button>
              </div>
            )}
          </div>

          <div className={`px-8 py-6 border-t flex flex-col md:flex-row items-center justify-between gap-6 shrink-0 z-[70] transition-colors ${isLabMode ? 'bg-purple-950/30 border-purple-900/50' : 'bg-zinc-950 border-zinc-900'}`}>
            <div className="flex items-center gap-5">
              <div className={`p-3 rounded-2xl shadow-xl transition-all ${isLabMode ? 'bg-purple-600 shadow-purple-900/30' : 'bg-noctambula shadow-yellow-900/20'}`}>
                <Calculator className="text-black w-8 h-8" />
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] font-black uppercase block tracking-widest mb-0.5">Coste Total Receta</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-white text-4xl font-black leading-none">{totalCost.toFixed(settings.decimals)}</span>
                  <span className={`text-xl font-bold ${isLabMode ? 'text-purple-400' : 'text-noctambula'}`}>{settings.currency}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <button type="submit" className={`flex-1 md:flex-none px-14 py-4 font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-[10px] ${isLabMode ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/40' : 'bg-noctambula hover:bg-[#e2d71a] text-black shadow-yellow-900/20'}`}>Guardar Modelo</button>
            </div>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default PizzaModal;