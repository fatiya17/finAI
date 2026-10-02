"use client";

import { useState, useRef, useEffect } from "react";
import { AppState, CategoryItem, ChatMessage, TransactionItem, BudgetBucket, DEFAULT_PROFILE, DEFAULT_CATEGORIES, saveState } from "@/lib/store";
import { parseTransaction } from "@/lib/parser";
import { askFinAi } from "@/lib/ai";
import { Settings, Send, Bot, Wallet, Target, PiggyBank, History, MessageSquare, LayoutDashboard, Plus, Trash2, Edit } from "lucide-react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { format } from "date-fns";
import { id } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

export function Dashboard({ state, setState }: { state: AppState, setState: (s: AppState) => void }) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "transactions" | "chat" | "categories">("dashboard");
  const [inputText, setInputText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [catFormData, setCatFormData] = useState<Partial<CategoryItem>>({});
  const [keywordInput, setKeywordInput] = useState("");

  const [apiKeyInput, setApiKeyInput] = useState(state.profile.geminiApiKey || "");
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState(state.profile.monthlyIncome.toString());

  // kalkulasi turunan
  const totalIncome = state.profile.monthlyIncome;
  
  const getBucketLimit = (bucket: BudgetBucket) => totalIncome * (state.profile.budgetRatio[bucket] / 100);
  const getBucketSpent = (bucket: BudgetBucket) => state.transactions.filter(t => t.bucket === bucket).reduce((acc, t) => acc + t.amount, 0);
  
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
  const spentToday = state.transactions
    .filter(t => t.bucket !== "savings" && new Date(t.createdAt).toISOString().split("T")[0] === todayStr)
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

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const parsed = parseTransaction(inputText, state.categories);
    if (parsed.length > 0) {
      const newTransactions: TransactionItem[] = parsed.map(p => ({
        id: Math.random().toString(36).substring(2, 9),
        title: p.title,
        amount: p.amount,
        categoryId: p.categoryId,
        bucket: p.bucket,
        createdAt: new Date().toISOString()
      }));

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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            
            <div className="lg:col-span-8 space-y-6">
              
              {/* banner alert */}
              <div className={`p-4 rounded-lg border flex flex-col gap-1 ${healthStatus === 'safe' ? 'bg-primary/10 border-primary text-primary' : healthStatus === 'warning' ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400' : 'bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400'}`}>
                <div className="font-medium">Batas Aman Harian: Rp{safeDailySpend.toLocaleString('id-ID')}</div>
                <div className="text-sm">
                  {healthStatus === 'safe' ? "Pengeluaranmu masih terkendali. Pertahankan!" : healthStatus === 'warning' ? "Hati-hati! Pengeluaranmu mulai mendekati batas. Tunda beli yang nggak penting besok." : "Kritis! Kamu udah over-budget. Kurangi jajan dan utamakan kebutuhan pokok!"}
                </div>
              </div>

              {/* input cepat */}
              <div>
                <form onSubmit={handleInputSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Ketik pengeluaranmu, misal: Makan siang 25rb dan kopi 35rb"
                    className="flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-card shadow-sm"
                  />
                  <button type="submit" className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:opacity-90 flex items-center gap-2 shadow-sm">
                    <Send className="w-4 h-4" /> <span className="hidden sm:inline">Catat</span>
                  </button>
                </form>
              </div>

              {/* progress budget */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {[
                  { title: "Kebutuhan Pokok", bucket: "needs", limit: needsLimit, spent: needsSpent, icon: Wallet, color: "bg-emerald-500" },
                  { title: "Gaya Hidup", bucket: "wants", limit: wantsLimit, spent: wantsSpent, icon: Target, color: "bg-amber-500" },
                  { title: "Tabungan", bucket: "savings", limit: savingsLimit, spent: savingsSpent, icon: PiggyBank, color: "bg-violet-500" }
                ].map(b => (
                  <div key={b.bucket} className="bg-card border rounded-xl p-3 md:p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm flex items-center gap-2"><b.icon className="w-4 h-4"/> {b.title}</div>
                      <div className="text-xs font-mono">{Math.round((b.spent/b.limit)*100 || 0)}%</div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${b.color}`} style={{width: `${Math.min((b.spent/b.limit)*100 || 0, 100)}%`}}></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      <span>Rp{b.spent.toLocaleString('id-ID')}</span>
                      <span>Rp{b.limit.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* transaksi terakhir di desktop */}
              <div className="hidden lg:block bg-card border rounded-xl p-6 shadow-sm">
                <h3 className="font-medium text-lg mb-4">Transaksi Terakhir</h3>
                <div className="space-y-3">
                  {state.transactions.slice(0, 5).map(t => {
                    const cat = state.categories.find(c => c.id === t.categoryId) || DEFAULT_CATEGORIES[0];
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 border rounded-xl bg-background">
                        <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${cat.color.replace('bg-', 'bg-').replace('-500', '-500/20')}`}>{cat.emoji}</div>
                           <div>
                             <div className="font-medium text-sm">{t.title}</div>
                             <div className="text-xs text-muted-foreground">{format(new Date(t.createdAt), "dd MMM yyyy, HH:mm", {locale: id})}</div>
                           </div>
                        </div>
                        <div className="font-mono font-medium text-sm">Rp{t.amount.toLocaleString('id-ID')}</div>
                      </div>
                    )
                  })}
                  {state.transactions.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">Belum ada transaksi dicatat.</div>}
                </div>
              </div>

            </div>

            {/* panel chat desktop */}
            <div className="hidden lg:flex lg:col-span-4 flex-col bg-card border rounded-xl shadow-sm overflow-hidden h-[calc(100vh-3rem)] sticky top-6">
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

          </div>
        )}

        {/* view transaksi */}
        {activeTab === "transactions" && (
           <div className="max-w-4xl mx-auto space-y-4">
             <h2 className="font-medium text-xl md:text-2xl">Riwayat Transaksi</h2>
             <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y">
                  {state.transactions.map(t => {
                      const cat = state.categories.find(c => c.id === t.categoryId) || DEFAULT_CATEGORIES[0];
                      return (
                        <div key={t.id} className="flex items-center justify-between p-4 bg-background">
                          <div className="flex items-center gap-3">
                             <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl md:text-2xl ${cat.color.replace('bg-', 'bg-').replace('-500', '-500/20')}`}>{cat.emoji}</div>
                             <div>
                               <div className="font-medium text-sm">{t.title}</div>
                               <div className="text-xs text-muted-foreground">{format(new Date(t.createdAt), "dd MMM yyyy, HH:mm", {locale: id})} &bull; {cat.name}</div>
                             </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="font-mono font-medium text-sm">Rp{t.amount.toLocaleString('id-ID')}</div>
                            <button onClick={() => deleteTransaction(t.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>
                      )
                  })}
                  {state.transactions.length === 0 && <div className="p-8 text-center text-muted-foreground">Belum ada transaksi.</div>}
                </div>
             </div>
           </div>
        )}

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
                    <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl md:text-2xl ${c.color.replace('bg-', 'bg-').replace('-500', '-500/20')}`}>
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
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 relative">
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
                   {["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-slate-500"].map(c => (
                     <button key={c} onClick={() => setCatFormData({...catFormData, color: c})} className={`w-8 h-8 rounded-full ${c} ${catFormData.color === c ? 'ring-2 ring-offset-2 ring-foreground' : ''}`}></button>
                   ))}
                 </div>
               </div>
             </div>
             <div className="mt-6 flex justify-between">
                {editingCategory ? (
                  <button onClick={() => { deleteCategory(editingCategory.id); setShowCategoryModal(false); }} className="px-4 py-2 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl font-medium">Hapus</button>
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
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 relative">
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
                 <label className="text-sm font-medium">Gemini API Key (Opsional)</label>
                 <input 
                    type="password" 
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="AIzaSy..."
                 />
                 <p className="text-xs text-muted-foreground">Digunakan untuk chat pintar. Jika kosong, akan pakai jawaban otomatis standar.</p>
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
                     const newState = {...state, profile: {...state.profile, geminiApiKey: apiKeyInput, monthlyIncome: newIncome}};
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
                 <button 
                   onClick={handleResetData}
                   className="w-full bg-destructive/10 text-destructive py-2 rounded-xl text-sm font-medium"
                 >
                   Reset Semua Data
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
