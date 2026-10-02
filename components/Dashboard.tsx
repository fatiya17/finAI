"use client";

import { useState, useRef, useEffect } from "react";
import { AppState, CategoryItem, ChatMessage, TransactionItem, TransactionType, BudgetBucket, DEFAULT_PROFILE, DEFAULT_CATEGORIES, saveState } from "@/lib/store";
import { parseTransaction } from "@/lib/parser";
import { askFinAi } from "@/lib/ai";
import { Settings, Send, Bot, Wallet, Target, PiggyBank, History, MessageSquare, LayoutDashboard, Plus, Trash2, Edit, Download, Upload, RotateCcw, PieChart, ShieldCheck, Calendar, Coffee } from "lucide-react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { format } from "date-fns";
import { id } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

export function Dashboard({ state, setState }: { state: AppState, setState: (s: AppState) => void }) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions" | "insights" | "chat" | "categories">("dashboard");
  const [inputText, setInputText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Migrate legacy 500 colors to pastel 200/300
  useEffect(() => {
    const hasLegacyColors = state.categories.some(c => c.color.includes('500'));
    if (hasLegacyColors) {
      const newCategories = state.categories.map(c => ({
        ...c,
        color: c.color.replace('slate-500', 'slate-300').replace('500', '200')
      }));
      setState({ ...state, categories: newCategories });
    }
  }, [state, setState]);

  const [showSettings, setShowSettings] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [catFormData, setCatFormData] = useState<Partial<CategoryItem>>({});
  const [keywordInput, setKeywordInput] = useState("");
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);
  const [txType, setTxType] = useState<TransactionType>("expense");

  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState(state.profile.monthlyIncome.toString());

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const currentMonthTransactions = state.transactions.filter(t => {
    const d = new Date(t.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const additionalIncome = currentMonthTransactions
    .filter(t => t.type === "income" || t.bucket === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  // kalkulasi turunan
  const totalIncome = state.profile.monthlyIncome + additionalIncome;
  
  const getBucketLimit = (bucket: BudgetBucket) => totalIncome * ((state.profile.budgetRatio[bucket as keyof typeof state.profile.budgetRatio] || 0) / 100);
  const getBucketSpent = (bucket: BudgetBucket) => currentMonthTransactions.filter(t => t.bucket === bucket && t.type !== "income").reduce((acc, t) => acc + t.amount, 0);
  
  const needsLimit = getBucketLimit("needs");
  const needsSpent = getBucketSpent("needs");
  const wantsLimit = getBucketLimit("wants");
  const wantsSpent = getBucketSpent("wants");
  const savingsLimit = getBucketLimit("savings");
  const savingsSpent = getBucketSpent("savings");

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - today.getDate() + 1;
  
  const todayStr = today.toISOString().split("T")[0];
  const spentToday = currentMonthTransactions
    .filter(t => t.bucket !== "savings" && t.type !== "income" && new Date(t.createdAt).toISOString().split("T")[0] === todayStr)
    .reduce((acc, t) => acc + t.amount, 0);
  
  const spentBeforeToday = (needsSpent + wantsSpent) - spentToday;
  const totalNeedsWantsLimit = needsLimit + wantsLimit;
  
  // limit harian base dihitung dari sisa awal hari ini
  const baseDailyLimit = Math.max(0, (totalNeedsWantsLimit - spentBeforeToday) / remainingDays);
  
  // jatah aman hari ini = budget harian - pengeluaran hari ini
  const safeDailySpend = Math.max(0, Math.floor(baseDailyLimit - spentToday));

  // nentuin status peringatan
  const needsWantsSpent = needsSpent + wantsSpent;
  const needsWantsLimit = needsLimit + wantsLimit;
  const spendRatio = needsWantsLimit > 0 ? needsWantsSpent / needsWantsLimit : 1;
  
  let healthStatus = "safe";
  if (spendRatio > 0.9) healthStatus = "critical";
  else if (spendRatio > 0.75) healthStatus = "warning";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.chats, activeTab]);

  useEffect(() => {
    // Migrasi: tambahkan kategori default (seperti Pemasukan Tambahan) jika belum ada di state pengguna lama
    const missingDefaults = DEFAULT_CATEGORIES.filter(dc => !state.categories.find(sc => sc.id === dc.id));
    if (missingDefaults.length > 0) {
      setState({ ...state, categories: [...state.categories, ...missingDefaults] });
    }
  }, []);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const parsed = parseTransaction(inputText, state.categories);
    if (parsed.length > 0) {
      const newTransactions: TransactionItem[] = parsed.map(p => {
        let finalCatId = p.categoryId;
        let finalBucket = p.bucket;
        
        if (txType === "income") {
          const incomeCat = state.categories.find(c => c.bucket === "income") || DEFAULT_CATEGORIES.find(c => c.bucket === "income")!;
          finalCatId = incomeCat.id;
          finalBucket = "income";
        }
        
        return {
          id: Math.random().toString(36).substring(2, 9),
          type: txType,
          title: p.title,
          amount: p.amount,
          categoryId: finalCatId,
          bucket: finalBucket,
          createdAt: new Date().toISOString()
        };
      });

      setState({
        ...state,
        transactions: [...newTransactions, ...state.transactions].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      });
      setInputText("");
    } else {
      alert("Format tidak dikenali. Coba: 'Makan siang 25rb'");
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: "user",
      content: chatInput,
      createdAt: new Date().toISOString()
    };

    const updatedChats = [...state.chats, userMsg];
    setState({ ...state, chats: updatedChats });
    setChatInput("");
    setIsChatLoading(true);

    const aiResponseText = await askFinAi(chatInput, state, updatedChats);
    
    const aiMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: "assistant",
      content: aiResponseText,
      createdAt: new Date().toISOString()
    };

    setState({ ...state, chats: [...updatedChats, aiMsg] });
    setIsChatLoading(false);
  };

  const handleResetData = () => {
    if(confirm("Yakin ingin menghapus semua data dan mengulang onboarding?")) {
       setState({
         profile: DEFAULT_PROFILE,
         categories: DEFAULT_CATEGORIES,
         transactions: [],
         chats: []
       });
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finai_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedState = JSON.parse(event.target?.result as string);
        if (importedState.profile && importedState.transactions) {
          setState(importedState);
          alert("Data berhasil dipulihkan!");
          setShowSettings(false);
        } else {
          alert("Format file tidak sesuai.");
        }
      } catch (error) {
        alert("Gagal membaca file backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const deleteTransaction = (id: string) => {
     setState({...state, transactions: state.transactions.filter(t => t.id !== id)});
  };

  const openCategoryModal = (cat?: CategoryItem) => {
    if (cat) {
      setEditingCategory(cat);
      setCatFormData({ ...cat });
      setKeywordInput(cat.keywords.join(", "));
    } else {
      setEditingCategory(null);
      setCatFormData({ name: "", emoji: "📦", color: "bg-slate-500", bucket: "needs", keywords: [] });
      setKeywordInput("");
    }
    setShowCategoryModal(true);
  };

  const saveCategory = () => {
    if (!catFormData.name || !catFormData.emoji) return;
    
    let newCats = [...state.categories];
    if (editingCategory) {
      newCats = newCats.map(c => c.id === editingCategory.id ? { ...c, ...catFormData } as CategoryItem : c);
    } else {
      newCats.push({
        id: "c" + Date.now(),
        ...(catFormData as Omit<CategoryItem, "id">)
      });
    }
    setState({ ...state, categories: newCats });
    setShowCategoryModal(false);
  };

  const deleteCategory = (id: string) => {
    setState({ ...state, categories: state.categories.filter(c => c.id !== id) });
  };

  return (
    <div className="flex h-screen bg-background flex-col lg:flex-row overflow-hidden">
      {/* header hp */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2 font-medium text-xl text-primary">
          <Bot className="w-6 h-6" /> FinAI
        </div>
        <button onClick={() => setShowSettings(true)} className="p-2 border rounded-xl"><Settings className="w-5 h-5"/></button>
      </header>

      {/* sidebar desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card h-full">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 font-medium text-xl md:text-2xl text-primary mb-1">
            <Bot className="w-7 h-7" /> FinAI
          </div>
          <div className="text-sm text-muted-foreground">Hai, {state.profile.name}!</div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
            { id: "transactions", icon: History, label: "Transaksi" },
            { id: "insights", icon: PieChart, label: "Laporan" },
            { id: "categories", icon: Wallet, label: "Kategori" },
            { id: "chat", icon: MessageSquare, label: "FinAI Advisor" }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${activeTab === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <item.icon className="w-5 h-5" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button onClick={() => setShowSettings(true)} className="flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium hover:bg-muted">
            <Settings className="w-5 h-5" /> Pengaturan
          </button>
        </div>
      </aside>

      {/* area konten utama */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6 relative">
        
        {/* view dashboard */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-4 md:gap-6 pb-24 lg:pb-6">
            
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
               <div className="flex flex-col gap-3">
                 <div>
                   <h1 className="text-2xl font-semibold">Welcome Back, {state.profile.name}</h1>
                   <p className="text-sm text-muted-foreground mt-0.5">Here's a clear overview of your financial performance</p>
                 </div>
               </div>

               <div className="flex items-center gap-2 md:gap-3 mt-2 md:mt-0">
                 <div className="px-3 md:px-4 py-2 bg-card border rounded-xl text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2 shadow-sm">
                    <Calendar className="w-4 h-4"/> {format(new Date(), "MMM yyyy", {locale: id})}
                 </div>
                 <button onClick={() => setShowSettings(true)} className="px-3 md:px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs md:text-sm font-medium hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap">
                    Ubah Budget
                 </button>
               </div>
            </div>

            {/* KPI Cards (Top Row) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
               {/* Card 1: Pemasukan */}
               <div className="bg-card border rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-center overflow-hidden">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-2 md:p-2.5 bg-green-500/10 text-green-500 rounded-lg md:rounded-xl"><Wallet className="w-4 h-4 md:w-5 md:h-5"/></div>
                    <div className="text-xs md:text-sm font-medium text-muted-foreground">Pemasukan</div>
                  </div>
                  <div className="text-lg md:text-2xl font-bold mt-3 md:mt-4 truncate">Rp{totalIncome.toLocaleString('id-ID')}</div>
                  <div className="text-[10px] md:text-xs text-green-500 mt-1 font-medium truncate">
                     +Rp{additionalIncome.toLocaleString('id-ID')} Ekstra
                  </div>
               </div>

               {/* Cards 2-4: Budgets */}
               {[
                 { title: "Kebutuhan", limit: needsLimit, spent: needsSpent, icon: Target, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                 { title: "Gaya Hidup", limit: wantsLimit, spent: wantsSpent, icon: Coffee, color: "text-amber-500", bg: "bg-amber-500/10" },
                 { title: "Tabungan", limit: savingsLimit, spent: savingsSpent, icon: PiggyBank, color: "text-violet-500", bg: "bg-violet-500/10" }
               ].map(b => (
                 <div key={b.title} className="bg-card border rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-center overflow-hidden">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`p-2 md:p-2.5 rounded-lg md:rounded-xl ${b.bg} ${b.color}`}><b.icon className="w-4 h-4 md:w-5 md:h-5"/></div>
                      <div className="text-xs md:text-sm font-medium text-muted-foreground">{b.title}</div>
                    </div>
                    <div className="text-lg md:text-2xl font-bold mt-3 md:mt-4 truncate">Rp{b.spent.toLocaleString('id-ID')}</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">
                       {Math.round((b.spent/b.limit)*100 || 0)}% dari Rp{b.limit.toLocaleString('id-ID')}
                    </div>
                 </div>
               ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main Content (Left Column) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Batas Aman Harian (Mobile Only, Above Quick Input) */}
                <div className="lg:hidden bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
                  <div className="text-primary flex-shrink-0">
                     <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                     <div className="text-[10px] font-bold text-primary/80 uppercase tracking-widest">Batas Aman Harian</div>
                     <div className="font-bold text-xl text-primary mt-0.5">Rp{safeDailySpend.toLocaleString('id-ID')}</div>
                  </div>
                </div>

                {/* Quick Input Bar */}
                <div className="bg-card border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
                   <div className="flex p-1 bg-muted rounded-xl w-full sm:w-auto shrink-0">
                     <button onClick={() => setTxType("expense")} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${txType === 'expense' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>Pengeluaran</button>
                     <button onClick={() => setTxType("income")} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${txType === 'income' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>Pemasukan</button>
                   </div>
                   <form onSubmit={handleInputSubmit} className="flex gap-2 w-full">
                     <input
                       type="text"
                       value={inputText}
                       onChange={(e) => setInputText(e.target.value)}
                       placeholder={txType === 'expense' ? "Makan siang 25.000" : "Bonus project 500.000"}
                       className="flex-1 bg-background border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                     />
                     <button type="submit" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shrink-0">
                       <Plus className="w-4 h-4"/> Catat
                     </button>
                   </form>
                </div>

                {/* Transaksi Terakhir (styled like Employee List) */}
                <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                   <div className="p-5 border-b flex justify-between items-center">
                      <h3 className="font-semibold text-base">Transaksi Terakhir</h3>
                      <button onClick={() => setActiveTab("transactions")} className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Lihat Semua ↗</button>
                   </div>
                   <div className="divide-y">
                     <div className="grid grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 text-[10px] md:text-xs font-medium text-muted-foreground bg-muted/30">
                        <div className="col-span-7 md:col-span-5">Nama Transaksi</div>
                        <div className="col-span-3 hidden md:block">Kategori</div>
                        <div className="col-span-2 hidden md:block">Tanggal</div>
                        <div className="col-span-5 md:col-span-2 text-right">Nominal</div>
                     </div>
                     {state.transactions.slice(0, 5).map(t => {
                        const cat = state.categories.find(c => c.id === t.categoryId) || DEFAULT_CATEGORIES.find(c => c.id === t.categoryId) || DEFAULT_CATEGORIES[0];
                        return (
                          <div key={t.id} className="grid grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 items-center text-xs md:text-sm hover:bg-muted/10 transition-colors">
                             <div className="col-span-7 md:col-span-5 flex items-center gap-2 md:gap-3 overflow-hidden">
                                <div className="text-lg md:text-xl shrink-0 flex items-center justify-center">
                                   {cat.emoji}
                                </div>
                                <span className="font-medium truncate">{t.title}</span>
                             </div>
                             <div className="col-span-3 hidden md:block truncate">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${cat.color.replace('bg-', 'bg-').replace('-500', '-500/10')} ${cat.color.replace('bg-', 'text-')}`}>
                                  {cat.name}
                                </span>
                             </div>
                             <div className="col-span-2 hidden md:block text-muted-foreground text-[10px] md:text-xs truncate">
                                {format(new Date(t.createdAt), "dd MMM", {locale: id})}
                             </div>
                             <div className={`col-span-5 md:col-span-2 text-right font-semibold truncate ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : ''}`}>
                                {t.type === 'income' ? '+' : ''}Rp{t.amount.toLocaleString('id-ID')}
                             </div>
                          </div>
                        )
                     })}
                     {state.transactions.length === 0 && <div className="p-8 text-center text-xs md:text-sm text-muted-foreground">Belum ada transaksi.</div>}
                   </div>
                </div>
              </div>

              {/* Right Column containing Batas Aman & Chat Panel */}
              <div className="hidden lg:flex lg:col-span-4 flex-col gap-6">
                 {/* Batas Aman Card (Desktop Only) */}
                 <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 flex items-center gap-4">
                  <div className="text-primary flex-shrink-0">
                     <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                     <div className="text-xs font-bold text-primary/80 uppercase tracking-widest">Batas Aman Harian</div>
                     <div className="font-bold text-2xl text-primary mt-0.5">Rp{safeDailySpend.toLocaleString('id-ID')}</div>
                  </div>
                 </div>

                 {/* panel chat desktop */}
                 <div className="hidden lg:flex flex-col bg-card border rounded-2xl shadow-sm overflow-hidden h-[500px]">
                   <div className="p-4 border-b bg-muted/30 font-medium flex items-center gap-2">
                     <Bot className="w-5 h-5 text-primary" /> FinAI Advisor
                   </div>
                   <div className="flex-1 overflow-y-auto p-4 space-y-4">
                     {state.chats.length === 0 ? (
                        <div className="text-center space-y-4 mt-10">
                          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Bot className="w-8 h-8 text-primary" />
                          </div>
                          <p className="text-sm text-muted-foreground">Halo! Coba tanya aku soal tips hemat atau evaluasi pengeluaranmu minggu ini.</p>
                        </div>
                     ) : (
                       state.chats.map(msg => (
                         <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                           <div className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted border rounded-tl-none'}`}>
                              <ReactMarkdown 
                                components={{
                                  ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal pl-4 space-y-1 my-2" {...props} />,
                                  li: ({node, ...props}) => <li className="" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                           </div>
                           <div className="text-[10px] text-muted-foreground mt-1">{format(new Date(msg.createdAt), "HH:mm")}</div>
                         </div>
                       ))
                     )}
                     {isChatLoading && (
                       <div className="mr-auto max-w-[85%] flex items-start">
                          <div className="p-3 bg-muted border rounded-lg rounded-tl-none text-sm text-muted-foreground animate-pulse">Mengetik...</div>
                       </div>
                     )}
                     <div ref={chatEndRef} />
                   </div>
                   <div className="p-4 border-t bg-background">
                     <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                       <button onClick={() => setChatInput("Cek pengeluaranku minggu ini dong, boros di mana ya?")} className="shrink-0 text-[10px] px-3 py-1.5 border rounded-full hover:bg-muted font-medium">Cek pengeluaran</button>
                       <button onClick={() => setChatInput("Berapa batas aman jajanku hari ini?")} className="shrink-0 text-[10px] px-3 py-1.5 border rounded-full hover:bg-muted font-medium">Batas aman jajan</button>
                     </div>
                     <form onSubmit={handleChatSubmit} className="flex gap-2 mt-2">
                       <input
                         type="text"
                         value={chatInput}
                         onChange={(e) => setChatInput(e.target.value)}
                         placeholder="Tanya FinAI..."
                         className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-muted/30"
                       />
                       <button type="submit" disabled={isChatLoading} className="bg-primary text-primary-foreground p-2 rounded-xl hover:opacity-90 disabled:opacity-50">
                         <Send className="w-4 h-4" />
                       </button>
                     </form>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* view transaksi */}
        {activeTab === "transactions" && (
           <div className="max-w-4xl mx-auto space-y-4">
             <h2 className="font-medium text-xl md:text-2xl">Riwayat Transaksi</h2>
             <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y">
                  {state.transactions.map(t => {
                      const cat = state.categories.find(c => c.id === t.categoryId) || DEFAULT_CATEGORIES.find(c => c.id === t.categoryId) || DEFAULT_CATEGORIES[0];
                      return (
                        <div key={t.id} className="flex items-center justify-between p-4 bg-background">
                          <div className="flex items-center gap-3">
                             <div className="w-12 h-12 flex items-center justify-center text-3xl shrink-0">{cat.emoji}</div>
                             <div>
                               <div className="font-medium text-sm">{t.title}</div>
                               <div className="text-xs text-muted-foreground">{format(new Date(t.createdAt), "dd MMM yyyy, HH:mm", {locale: id})} &bull; {cat.name}</div>
                             </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className={`font-mono font-medium text-sm ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : ''}`}>
                              {t.type === 'income' ? '+' : ''}Rp{t.amount.toLocaleString('id-ID')}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => setEditingTransaction(t)} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Edit className="w-4 h-4"/></button>
                              <button onClick={() => { if (window.confirm("Yakin ingin menghapus transaksi ini secara permanen?")) deleteTransaction(t.id); }} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </div>
                        </div>
                      )
                  })}
                  {state.transactions.length === 0 && <div className="p-8 text-center text-muted-foreground">Belum ada transaksi.</div>}
                </div>
             </div>
           </div>
        )}

        {/* view insight / laporan */}
        {activeTab === "insights" && (() => {
          const twColors: Record<string, string> = {
            "bg-slate-500": "#64748b",
            "bg-amber-500": "#f59e0b",
            "bg-rose-500": "#f43f5e",
            "bg-violet-500": "#8b5cf6",
            "bg-green-500": "#22c55e",
            "bg-blue-500": "#3b82f6",
            "bg-emerald-500": "#10b981",
            "bg-slate-300": "#cbd5e1",
            "bg-amber-200": "#faf6b7",
            "bg-rose-200": "#ffd1e2",
            "bg-violet-200": "#d9c2ff",
            "bg-green-200": "#99e7bf",
            "bg-blue-200": "#d1efff",
            "bg-emerald-200": "#99e7bf",
          };

          const expensesByCategory = state.categories.map(cat => {
            const spent = currentMonthTransactions
              .filter(t => t.categoryId === cat.id && t.type !== "income")
              .reduce((acc, t) => acc + t.amount, 0);
            return { ...cat, spent };
          }).filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent);
          
          const totalMonthlyExpense = expensesByCategory.reduce((acc, c) => acc + c.spent, 0);
          const remainingBudget = totalIncome - totalMonthlyExpense;
          
          const radius = 50;
          const circumference = 2 * Math.PI * radius;
          let currentOffset = 0;

          return (
            <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
               {/* Header */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <h1 className="text-2xl font-semibold">Laporan & Analisis</h1>
                 <div className="flex items-center gap-3">
                   <div className="px-4 py-2 bg-card border rounded-xl text-sm font-medium text-muted-foreground flex items-center gap-2 shadow-sm">
                      <Calendar className="w-4 h-4"/> {format(new Date(), "MMM yyyy", {locale: id})}
                   </div>
                 </div>
               </div>

               {/* Top KPIs (4 cards) */}
               <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                  <div className="col-span-2 lg:col-span-2 bg-primary text-primary-foreground rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
                     <div className="text-xs md:text-sm font-medium text-primary-foreground/80 mb-2">Total Pengeluaran</div>
                     <div className="text-2xl md:text-3xl font-bold truncate mt-auto">Rp{totalMonthlyExpense.toLocaleString('id-ID')}</div>
                  </div>
                  <div className="col-span-1 bg-card border rounded-2xl p-3 md:p-4 shadow-sm flex flex-col justify-center overflow-hidden">
                     <div className="flex items-center gap-2">
                       <div className="p-1.5 md:p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><Wallet className="w-4 h-4"/></div>
                       <div className="text-[10px] md:text-xs font-medium text-emerald-600 dark:text-emerald-400 truncate">Total Pemasukan</div>
                     </div>
                     <div className="text-sm md:text-lg font-bold mt-2 md:mt-3 truncate">Rp{totalIncome.toLocaleString('id-ID')}</div>
                  </div>

                  <div className="col-span-1 bg-card border rounded-2xl p-3 md:p-4 shadow-sm flex flex-col justify-center overflow-hidden">
                     <div className="flex items-center gap-2">
                       <div className="p-1.5 md:p-2 bg-violet-500/10 text-violet-500 rounded-lg"><Target className="w-4 h-4"/></div>
                       <div className="text-[10px] md:text-xs font-medium text-violet-600 dark:text-violet-400 truncate">Sisa Budget</div>
                     </div>
                     <div className="text-sm md:text-lg font-bold mt-2 md:mt-3 truncate">Rp{remainingBudget.toLocaleString('id-ID')}</div>
                  </div>

                  <div className="col-span-1 bg-card border rounded-2xl p-3 md:p-4 shadow-sm flex flex-col justify-center overflow-hidden">
                     <div className="flex items-center gap-2">
                       <div className="p-1.5 md:p-2 bg-rose-500/10 text-rose-500 rounded-lg"><PieChart className="w-4 h-4"/></div>
                       <div className="text-[10px] md:text-xs font-medium text-rose-600 dark:text-rose-400 truncate">Paling Besar</div>
                     </div>
                     <div className="text-sm md:text-lg font-bold mt-2 md:mt-3 truncate">{expensesByCategory[0] ? `Rp${expensesByCategory[0].spent.toLocaleString('id-ID')}` : '-'}</div>
                  </div>
               </div>

               {/* Charts Row */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  {/* Chart 1: Tren Pengeluaran */}
                  <div className="bg-card border rounded-2xl p-5 shadow-sm min-h-[300px] flex flex-col">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-base md:text-lg">Tren Pengeluaran</h3>
                        <div className="flex bg-muted rounded-lg p-1 text-[10px] font-medium">
                           <button className="px-3 py-1.5 rounded bg-background shadow-sm text-foreground">Bulan Ini</button>
                        </div>
                     </div>
                     <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 pt-10 pb-2 border-b relative px-2">
                        {(() => {
                           const weeklySpend = [1, 2, 3, 4].map(w => {
                             const startDay = (w - 1) * 7 + 1;
                             const endDay = w === 4 ? 31 : w * 7;
                             const spent = currentMonthTransactions
                               .filter(t => t.type !== "income")
                               .filter(t => {
                                 const day = new Date(t.createdAt).getDate();
                                 return day >= startDay && day <= endDay;
                               })
                               .reduce((acc, t) => acc + t.amount, 0);
                             return { week: w, spent };
                           });
                           const maxWeeklySpend = Math.max(...weeklySpend.map(w => w.spent), 1);
                           
                           return weeklySpend.map(data => {
                             const percentage = (data.spent / maxWeeklySpend) * 100;
                             return (
                               <div key={data.week} className="flex-1 flex flex-col justify-end items-center gap-2 group relative h-full">
                                  <div className="w-full max-w-[50px] bg-primary/30 rounded-t-lg transition-all group-hover:bg-primary/50 relative" style={{height: `${percentage || 5}%`}}>
                                     {/* Tooltip on hover */}
                                     <div className="hidden group-hover:block absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-10">
                                       Minggu {data.week}<br/>Rp{(data.spent/1000).toFixed(0)}K
                                     </div>
                                  </div>
                                  <span className="text-[10px] font-medium text-muted-foreground absolute -bottom-6">Mg {data.week}</span>
                               </div>
                             )
                           });
                        })()}
                     </div>
                  </div>

                  {/* Popular Categories (Donut) */}
                  <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
                     <div className="flex justify-between items-center w-full mb-2">
                        <h3 className="font-semibold text-sm md:text-base">Kategori Populer</h3>
                     </div>
                     <div className="relative w-36 h-36 md:w-44 md:h-44 my-4">
                        {totalMonthlyExpense > 0 ? (
                           <>
                              <svg viewBox="0 0 120 120" className="-rotate-90 w-full h-full drop-shadow-sm">
                                 <circle r={radius} cx={60} cy={60} fill="transparent" stroke="currentColor" className="text-muted/20" strokeWidth="16" />
                                 {expensesByCategory.slice(0, 4).map(cat => {
                                    const strokeLength = (cat.spent / totalMonthlyExpense) * circumference;
                                    const offset = currentOffset;
                                    currentOffset += strokeLength;
                                    return (
                                      <circle 
                                        key={cat.id} 
                                        r={radius} cx={60} cy={60} 
                                        fill="transparent" 
                                        stroke={twColors[cat.color] || "#888"} 
                                        strokeWidth="16" 
                                        strokeDasharray={`${strokeLength} ${circumference}`} 
                                        strokeDashoffset={-offset} 
                                        className="transition-all duration-1000 ease-out" 
                                      />
                                    )
                                 })}
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <div className="text-[10px] text-muted-foreground font-medium">Semua</div>
                                <div className="font-bold mt-0.5 text-xs md:text-sm">Rp{(totalMonthlyExpense / 1000).toFixed(0)}K</div>
                              </div>
                           </>
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Belum ada data</div>
                        )}
                     </div>
                     {/* Legend */}
                     <div className="w-full grid grid-cols-2 gap-y-3 gap-x-2 text-[10px] md:text-xs mt-2">
                        {expensesByCategory.slice(0, 4).map(cat => (
                           <div key={cat.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className={`w-2 h-2 rounded-full ${cat.color} shrink-0`}></span>
                                <span className="truncate">{cat.name}</span>
                              </div>
                              <span className="font-medium shrink-0 ml-1">{Math.round((cat.spent/totalMonthlyExpense)*100)}%</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Bottom Cards: Category Breakdown */}
               <div className="grid grid-cols-1 gap-4 md:gap-6">
                  {/* Av. Check / Pengeluaran Terbesar (Horizontal Bars) */}
                  <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-sm md:text-base">Rincian per Kategori</h3>
                        <button onClick={() => setActiveTab("categories")} className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">Lihat Semua ↗</button>
                     </div>
                     <div className="space-y-5 flex-1">
                        {expensesByCategory.slice(0, 5).map(cat => {
                           const percentage = (cat.spent / totalMonthlyExpense) * 100;
                           return (
                             <div key={cat.id} className="flex items-center gap-3">
                                <div className="w-24 md:w-32 text-xs md:text-sm font-medium flex items-center gap-2 truncate">
                                   <div className={`w-2 h-2 rounded-full ${cat.color} shrink-0`}></div>
                                   <span className="truncate">{cat.name}</span>
                                </div>
                                <div className="flex-1 h-2 md:h-2.5 bg-muted rounded-full overflow-hidden">
                                   <div className={`h-full ${cat.color} rounded-r-full`} style={{width: `${percentage}%`}}></div>
                                </div>
                                <div className="w-20 md:w-24 text-right text-xs md:text-sm font-bold truncate">
                                   Rp{cat.spent.toLocaleString('id-ID')}
                                </div>
                             </div>
                           )
                        })}
                        {expensesByCategory.length === 0 && (
                           <div className="text-center text-sm text-muted-foreground py-10">Belum ada data pengeluaran</div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          );
        })()}

        {/* view chat hp */}
        {activeTab === "chat" && (
          <div className="flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden h-[calc(100vh-8rem)] lg:h-[calc(100vh-2rem)]">
              <div className="p-4 border-b bg-muted/30 font-medium flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" /> FinAI Advisor
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {state.chats.length === 0 ? (
                   <div className="text-center space-y-4 mt-10">
                     <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                       <Bot className="w-8 h-8 text-primary" />
                     </div>
                     <p className="text-sm text-muted-foreground">Halo! Coba tanya aku soal tips hemat atau evaluasi pengeluaranmu minggu ini.</p>
                   </div>
                ) : (
                  state.chats.map(msg => (
                    <div key={msg.id} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                      <div className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted border rounded-tl-none'}`}>
                         <ReactMarkdown 
                           components={{
                             ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                             ol: ({node, ...props}) => <ol className="list-decimal pl-4 space-y-1 my-2" {...props} />,
                             li: ({node, ...props}) => <li className="" {...props} />,
                             strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                             p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                           }}
                         >
                           {msg.content}
                         </ReactMarkdown>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">{format(new Date(msg.createdAt), "HH:mm")}</div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="mr-auto max-w-[85%] flex items-start">
                     <div className="p-3 bg-muted border rounded-lg rounded-tl-none text-sm text-muted-foreground animate-pulse">Mengetik...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 border-t bg-background">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button onClick={() => setChatInput("Cek pengeluaranku minggu ini dong, boros di mana ya?")} className="shrink-0 text-xs px-3 py-1.5 border rounded-full hover:bg-muted">Cek pengeluaran</button>
                  <button onClick={() => setChatInput("Berapa batas aman jajanku hari ini?")} className="shrink-0 text-xs px-3 py-1.5 border rounded-full hover:bg-muted">Batas aman jajan</button>
                </div>
                <form onSubmit={handleChatSubmit} className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Tanya FinAI..."
                    className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button type="submit" disabled={isChatLoading} className="bg-primary text-primary-foreground p-2 rounded-xl hover:opacity-90 disabled:opacity-50">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
        )}

        {/* view kategori */}
        {activeTab === "categories" && (
           <div className="max-w-4xl mx-auto space-y-4">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-medium text-xl md:text-2xl">Kategori Pengeluaran</h2>
                <button onClick={() => openCategoryModal()} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 w-full sm:w-auto">
                  <Plus className="w-4 h-4"/> Tambah Kategori
                </button>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.categories.map(c => (
                  <div key={c.id} onClick={() => openCategoryModal(c)} className="p-4 border rounded-xl flex items-center gap-4 bg-card cursor-pointer hover:border-primary transition-colors">
                    <div className="shrink-0 w-12 h-12 flex items-center justify-center text-3xl">
                      {c.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground uppercase">{c.bucket}</div>
                      {c.keywords.length > 0 && <div className="text-[10px] text-muted-foreground mt-1 truncate">Katakunci: {c.keywords.join(", ")}</div>}
                    </div>
                  </div>
                ))}
             </div>
           </div>
        )}
      </main>

      {/* nav bawah hp */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex items-center justify-around p-2 pb-safe">
        {[
          { id: "dashboard", icon: LayoutDashboard, label: "Home" },
          { id: "transactions", icon: History, label: "Riwayat" },
          { id: "insights", icon: PieChart, label: "Laporan" },
          { id: "categories", icon: Wallet, label: "Kategori" },
          { id: "chat", icon: MessageSquare, label: "FinAI" }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${activeTab === item.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* modal kategori */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
             <h2 className="text-xl font-medium mb-4">{editingCategory ? "Edit Kategori" : "Tambah Kategori"}</h2>
             <div className="space-y-4">
               <div className="grid grid-cols-4 gap-4">
                 <div className="col-span-1 flex flex-col gap-[5px] relative">
                   <label className="text-sm font-medium">Emoji</label>
                   <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-full h-[42px] flex items-center justify-center border rounded-xl text-xl md:text-2xl hover:bg-muted transition-colors">
                     {catFormData.emoji}
                   </button>
                   {showEmojiPicker && (
                     <div className="absolute top-full mt-2 z-50 left-0">
                       <EmojiPicker 
                         theme={state.profile.themeMode === 'dark' ? Theme.DARK : state.profile.themeMode === 'light' ? Theme.LIGHT : Theme.AUTO}
                         onEmojiClick={(e) => {
                           setCatFormData({...catFormData, emoji: e.emoji});
                           setShowEmojiPicker(false);
                         }} 
                       />
                     </div>
                   )}
                 </div>
                 <div className="col-span-3 flex flex-col gap-[5px]">
                   <label className="text-sm font-medium">Nama Kategori</label>
                   <input type="text" value={catFormData.name} onChange={e => setCatFormData({...catFormData, name: e.target.value})} className="w-full h-[42px] border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Misal: Makan Siang" />
                 </div>
               </div>
               <div className="flex flex-col gap-[5px]">
                 <label className="text-sm font-medium">Jenis Anggaran (Bucket)</label>
                 <select value={catFormData.bucket} onChange={e => setCatFormData({...catFormData, bucket: e.target.value as BudgetBucket})} className="w-full h-[42px] border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary">
                   <option value="needs">Needs (Kebutuhan Pokok)</option>
                   <option value="wants">Wants (Gaya Hidup)</option>
                   <option value="savings">Savings (Tabungan)</option>
                 </select>
               </div>
               <div className="flex flex-col gap-[5px]">
                 <label className="text-sm font-medium">Kata Kunci (Pisahkan dengan koma)</label>
                 <textarea 
                   value={keywordInput} 
                   onChange={e => {
                     setKeywordInput(e.target.value);
                     setCatFormData({...catFormData, keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean)});
                   }} 
                   className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary h-20" 
                   placeholder="Misal: gojek, grab, bensin" 
                 />
               </div>
               <div className="flex flex-col gap-[5px]">
                 <label className="text-sm font-medium">Warna Label</label>
                 <div className="flex gap-2">
                   {[
                     "bg-emerald-200",
                     "bg-blue-200",
                     "bg-amber-200",
                     "bg-rose-200",
                     "bg-violet-200",
                     "bg-slate-300"
                   ].map(c => (
                     <button key={c} onClick={() => setCatFormData({...catFormData, color: c})} className={`w-8 h-8 rounded-full ${c} ${catFormData.color === c || catFormData.color === c.replace('200', '500').replace('300', '500') ? 'ring-2 ring-offset-2 ring-foreground' : ''}`}></button>
                   ))}
                 </div>
               </div>
             </div>
             <div className="mt-6 flex justify-between">
                {editingCategory ? (
                  <button onClick={() => { if (window.confirm("Yakin ingin menghapus kategori ini secara permanen?")) { deleteCategory(editingCategory.id); setShowCategoryModal(false); } }} className="px-4 py-2 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl font-medium">Hapus</button>
                ) : <div></div>}
                <div className="flex gap-3">
                  <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 border rounded-xl font-medium hover:bg-muted">Batal</button>
                  <button onClick={saveCategory} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90">Simpan</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* modal setting */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
             <h2 className="text-xl font-medium mb-4">Pengaturan</h2>
             
             <div className="space-y-4">
               <div className="flex flex-col gap-[5px]">
                 <label className="text-sm font-medium">Pemasukan Bulanan</label>
                 <div className="relative flex items-center">
                   <span className="absolute left-3 text-muted-foreground text-sm">Rp</span>
                   <input 
                      type="text"
                      value={new Intl.NumberFormat('id-ID').format(parseInt(monthlyIncomeInput.replace(/\D/g, '')) || 0)}
                      onChange={(e) => setMonthlyIncomeInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                   />
                 </div>
                 <p className="text-xs text-muted-foreground">Basis perhitungan Batas Aman Harian.</p>
               </div>

               <div className="flex flex-col gap-[5px]">
                  <label className="text-sm font-medium">Tema Warna</label>
                  <div className="flex gap-2">
                    {["light", "dark", "system"].map(theme => (
                      <button
                        key={theme}
                        onClick={() => {
                          const newProfile = { ...state.profile, themeMode: theme as any };
                          setState({ ...state, profile: newProfile });
                          let isDark = false;
                          if (theme === "dark") {
                            document.documentElement.classList.add("dark");
                            isDark = true;
                          } else if (theme === "light") {
                            document.documentElement.classList.remove("dark");
                          } else {
                            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                              document.documentElement.classList.add("dark");
                              isDark = true;
                            } else {
                              document.documentElement.classList.remove("dark");
                            }
                          }
                          
                          const colorMap: Record<string, string> = { blue: "205 71% 41%", violet: "263 42% 56%", pink: "338 100% 73%", yellow: "36 100% 67%", green: "150 38% 54%" };
                          const darkColorMap: Record<string, string> = { blue: "201 100% 91%", violet: "263 100% 88%", pink: "338 100% 91%", yellow: "56 87% 85%", green: "149 68% 75%" };
                          const hueSatLight = isDark ? darkColorMap[newProfile.accentColor] : colorMap[newProfile.accentColor];
                          document.documentElement.style.setProperty("--primary", hueSatLight);
                        }}
                        className={`flex-1 py-2 border rounded-xl capitalize text-sm ${state.profile.themeMode === theme ? 'bg-primary text-primary-foreground border-primary' : ''}`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="flex flex-col gap-[5px]">
                  <label className="text-sm font-medium">Warna Aksen</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { id: "blue", hex: "#1e73b1", darkHex: "#d1efff" },
                      { id: "violet", hex: "#8560c0", darkHex: "#d9c2ff" },
                      { id: "pink", hex: "#ff73a7", darkHex: "#ffd1e2" },
                      { id: "yellow", hex: "#ffbd59", darkHex: "#faf6b7" },
                      { id: "green", hex: "#5cb588", darkHex: "#99e7bf" }
                    ].map(accent => (
                      <button
                        key={accent.id}
                        onClick={() => {
                          const newState = { ...state, profile: { ...state.profile, accentColor: accent.id as any } };
                          setState(newState);
                          // auto apply buat preview
                          const isDark = document.documentElement.classList.contains("dark");
                          const colorMap: Record<string, string> = { blue: "205 71% 41%", violet: "263 42% 56%", pink: "338 100% 73%", yellow: "36 100% 67%", green: "150 38% 54%" };
                          const darkColorMap: Record<string, string> = { blue: "201 100% 91%", violet: "263 100% 88%", pink: "338 100% 91%", yellow: "56 87% 85%", green: "149 68% 75%" };
                          const hueSatLight = isDark ? darkColorMap[accent.id] : colorMap[accent.id];
                          document.documentElement.style.setProperty("--primary", hueSatLight);
                        }}
                        className="h-10 flex items-center justify-center transition-transform hover:scale-105"
                      >
                        <div 
                           className={`w-6 h-6 rounded-full ${state.profile.accentColor === accent.id ? 'ring-2 ring-offset-2 ring-foreground' : ''}`}
                           style={{ backgroundColor: state.profile.themeMode === 'dark' || (state.profile.themeMode === 'system' && window.matchMedia("(prefers-color-scheme: dark)").matches) ? accent.darkHex : accent.hex }}
                        ></div>
                      </button>
                    ))}
                  </div>
               </div>

               <div className="pt-4 border-t flex flex-col gap-2">
                 <button 
                   onClick={() => {
                     const newIncome = parseInt(monthlyIncomeInput.replace(/\D/g, '')) || 0;
                     const newState = {...state, profile: {...state.profile, monthlyIncome: newIncome}};
                     setState(newState);
                     saveState(newState);
                     
                     // apply tema
                     const theme = newState.profile.themeMode;
                     if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                       document.documentElement.classList.add("dark");
                     } else {
                       document.documentElement.classList.remove("dark");
                     }

                     // apply warna
                     const isDark = document.documentElement.classList.contains("dark");
                     const colorMap: Record<string, string> = { blue: "205 71% 41%", violet: "263 42% 56%", pink: "338 100% 73%", yellow: "36 100% 67%", green: "338 100% 91%" };
                     const darkColorMap: Record<string, string> = { blue: "201 100% 91%", violet: "263 100% 88%", pink: "338 100% 91%", yellow: "56 87% 85%", green: "149 68% 75%" };
                     const hueSatLight = isDark ? (darkColorMap[newState.profile.accentColor] || darkColorMap["blue"]) : (colorMap[newState.profile.accentColor] || colorMap["blue"]);
                     document.documentElement.style.setProperty("--primary", hueSatLight);

                     setShowSettings(false);
                   }}
                   className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium"
                 >
                   Simpan & Tutup
                 </button>
                 <div className="grid grid-cols-3 gap-2">
                   <button 
                     onClick={handleExportData}
                     className="flex flex-col items-center justify-center gap-1 p-2 border rounded-xl hover:bg-muted text-xs font-medium text-muted-foreground transition-colors"
                   >
                     <Download className="w-4 h-4" />
                     Export
                   </button>
                   <label className="flex flex-col items-center justify-center gap-1 p-2 border rounded-xl hover:bg-muted text-xs font-medium text-muted-foreground transition-colors cursor-pointer">
                     <Upload className="w-4 h-4" />
                     Import
                     <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                   </label>
                   <button 
                     onClick={handleResetData}
                     className="flex flex-col items-center justify-center gap-1 p-2 border rounded-xl hover:bg-muted text-xs font-medium text-muted-foreground transition-colors"
                   >
                     <RotateCcw className="w-4 h-4" />
                     Reset
                   </button>
                 </div>
               </div>
             </div>
          </div>
        </div>
      )}
      {/* modal edit transaksi */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingTransaction(null)}>
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
             <h2 className="text-xl font-medium mb-4">Edit Transaksi</h2>
             <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
                  <button onClick={() => setEditingTransaction({...editingTransaction, type: "expense"})} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${editingTransaction.type !== 'income' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>Pengeluaran</button>
                  <button onClick={() => {
                    const incomeCat = state.categories.find(c => c.bucket === "income") || DEFAULT_CATEGORIES.find(c => c.bucket === "income")!;
                    setEditingTransaction({
                      ...editingTransaction, 
                      type: "income",
                      categoryId: incomeCat.id,
                      bucket: "income"
                    });
                  }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${editingTransaction.type === 'income' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>Pemasukan</button>
                </div>
                <div className="flex flex-col gap-[5px]">
                   <label className="text-sm font-medium">Nama Transaksi</label>
                   <input type="text" value={editingTransaction.title} onChange={e => {
                     const newTitle = e.target.value;
                     const lowerText = newTitle.toLowerCase();
                     let newCatId = editingTransaction.categoryId;
                     let newBucket = editingTransaction.bucket;

                     for (const cat of state.categories) {
                       if (cat.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
                         newCatId = cat.id;
                         newBucket = cat.bucket;
                         break;
                       }
                     }
                     
                     setEditingTransaction({
                       ...editingTransaction, 
                       title: newTitle,
                       categoryId: newCatId,
                       bucket: newBucket
                     });
                   }} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex flex-col gap-[5px]">
                   <label className="text-sm font-medium">Nominal (Rp)</label>
                   <input 
                     type="text" 
                     value={editingTransaction.amount ? new Intl.NumberFormat('id-ID').format(editingTransaction.amount) : ""} 
                     onChange={e => {
                       const valStr = e.target.value.replace(/\D/g, '');
                       setEditingTransaction({...editingTransaction, amount: valStr ? parseInt(valStr, 10) : 0});
                     }} 
                     className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                   />
                </div>
                <div className="flex flex-col gap-[5px]">
                   <label className="text-sm font-medium">Kategori</label>
                   <select value={editingTransaction.categoryId} onChange={e => {
                     const cat = state.categories.find(c => c.id === e.target.value);
                     if(cat) setEditingTransaction({...editingTransaction, categoryId: cat.id, bucket: cat.bucket});
                   }} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                     {state.categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                   </select>
                </div>
             </div>
             <div className="mt-6 flex justify-end gap-3">
               <button onClick={() => setEditingTransaction(null)} className="px-4 py-2 border rounded-xl font-medium hover:bg-muted">Batal</button>
               <button onClick={() => {
                 setState({...state, transactions: state.transactions.map(t => t.id === editingTransaction.id ? editingTransaction : t)});
                 setEditingTransaction(null);
               }} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90">Simpan</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
