"use client";

import { useState } from "react";
import { AppState, DEFAULT_CATEGORIES, UserProfile } from "@/lib/store";
import { Wallet, PiggyBank, Target, Settings, ArrowRight, Check } from "lucide-react";

export function Onboarding({
  state,
  onComplete
}: {
  state: AppState;
  onComplete: (profile: UserProfile, categories: any[]) => void;
}) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<UserProfile>(state.profile);
  const [categories, setCategories] = useState(state.categories);

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleComplete = () => {
    const finalProfile = { ...profile, isOnboarded: true };
    onComplete(finalProfile, categories);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl text-card-foreground">
        {/* progress bar */}
        <div className="flex bg-muted/50 h-2">
          <div className="bg-primary transition-all duration-300 h-full" style={{ width: `${(step / 4) * 100}%` }} />
        </div>

        <div className="p-4 sm:p-6">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-medium tracking-tight">Halo! Kenalan Dulu Yuk 👋</h2>
                <p className="text-muted-foreground text-base">FinAi siap bantu ngatur uang kamu biar nggak boncos di akhir bulan.</p>
              </div>
              
              <div className="space-y-6">
                <div className="flex flex-col gap-[5px]">
                  <label className="text-sm font-medium">Nama Panggilan</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                    className="flex h-10 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Misal: Budi"
                  />
                </div>
                <div className="flex flex-col gap-[5px]">
                  <label className="text-sm font-medium">Status Saat Ini</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {["mahasiswa", "first-jobber", "umum"].map(role => (
                      <button
                        key={role}
                        onClick={() => setProfile({ ...profile, role: role as any })}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${profile.role === role ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      >
                        <span className="capitalize font-medium">{role.replace("-", " ")}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-[5px]">
                  <label className="text-sm font-medium">Tujuan Utama Finansial (Bisa pilih lebih dari satu)</label>
                  <div className="flex flex-wrap gap-2 justify-between">
                    {[
                      "Dana Darurat", "Beli Gadget", "Liburan", 
                      "Beli Kendaraan", "Tabungan Masa Depan", "Bebas Utang", 
                      "Investasi", "Menikah"
                    ].map(goal => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => {
                          const newGoals = profile.financialGoal.includes(goal) 
                            ? profile.financialGoal.filter(g => g !== goal)
                            : [...profile.financialGoal, goal];
                          setProfile({ ...profile, financialGoal: newGoals });
                        }}
                        className={`grow text-center px-4 py-2 rounded-full border text-sm font-medium transition-all ${profile.financialGoal.includes(goal) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:border-primary/50 text-muted-foreground'}`}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-medium tracking-tight">Pemasukan & Anggaran 💰</h2>
                <p className="text-muted-foreground text-base">Berapa uang sakumu, dan gimana kamu mau baginya?</p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-[5px]">
                  <label className="text-sm font-medium">Pemasukan / Uang Saku Bulanan</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground font-mono">Rp</span>
                    <input
                      type="text"
                      value={profile.monthlyIncome ? profile.monthlyIncome.toLocaleString('id-ID') : ""}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, "");
                        setProfile({ ...profile, monthlyIncome: Number(val) });
                      }}
                      className="flex h-10 w-full rounded-xl border bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono tabular-nums"
                      placeholder="1.500.000"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[1500000, 2500000, 4500000].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setProfile({ ...profile, monthlyIncome: amount })}
                        className="px-3 py-1 text-xs border rounded-full hover:bg-muted font-mono"
                      >
                        Rp{amount.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                  <label className="text-sm font-medium">Strategi 50/30/20 (Bisa digeser)</label>
                  <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500"/> Kebutuhan Pokok (Needs)</span>
                        <span className="font-mono bg-muted px-2 py-1 rounded text-xs">{profile.budgetRatio.needs}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Untuk makan, transport, kos, dan tagihan rutin.</p>
                      <input type="range" min="10" max="80" value={profile.budgetRatio.needs} 
                        onChange={e => {
                          const val = Number(e.target.value);
                          const remaining = 100 - val;
                          setProfile({...profile, budgetRatio: {needs: val, wants: Math.floor(remaining * 0.6), savings: Math.ceil(remaining * 0.4)}});
                        }}
                        className="w-full accent-emerald-500 h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="flex items-center gap-2"><Target className="w-4 h-4 text-amber-500"/> Gaya Hidup (Wants)</span>
                        <span className="font-mono bg-muted px-2 py-1 rounded text-xs">{profile.budgetRatio.wants}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Untuk hiburan, nongkrong, kuota, atau belanja hobi.</p>
                      <input type="range" min="10" max="80" value={profile.budgetRatio.wants} 
                        onChange={e => {
                          const val = Number(e.target.value);
                          const remaining = 100 - val;
                          setProfile({...profile, budgetRatio: {wants: val, needs: Math.floor(remaining * 0.6), savings: Math.ceil(remaining * 0.4)}});
                        }}
                        className="w-full accent-amber-500 h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="flex items-center gap-2"><PiggyBank className="w-4 h-4 text-violet-500"/> Tabungan (Savings)</span>
                        <span className="font-mono bg-muted px-2 py-1 rounded text-xs">{profile.budgetRatio.savings}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Untuk dana darurat atau simpanan masa depan.</p>
                      <input type="range" min="5" max="80" value={profile.budgetRatio.savings} 
                        onChange={e => {
                          const val = Number(e.target.value);
                          const remaining = 100 - val;
                          setProfile({...profile, budgetRatio: {savings: val, needs: Math.floor(remaining * 0.6), wants: Math.ceil(remaining * 0.4)}});
                        }}
                        className="w-full accent-violet-500 h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
                    </div>
                  </div>
                  
                  {profile.budgetRatio.needs + profile.budgetRatio.wants + profile.budgetRatio.savings !== 100 && (
                    <p className="text-red-500 text-xs">Total persentase harus 100%</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-medium tracking-tight">Kategori Pengeluaran 🏷️</h2>
                <p className="text-muted-foreground text-base">Cek kategori awal ini, kamu bisa sesuaikan nanti di dashboard.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2">
                {categories.map((c, i) => (
                  <div key={c.id} className="p-3 border rounded-xl flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${c.color.replace('bg-', 'bg-').replace('-500', '-500/20')} ${c.color.replace('bg-', 'text-').replace('-500', '-600')}`}>
                      {c.emoji}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground uppercase">{c.bucket}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-medium tracking-tight">Personalisasi Tampilan 🎨</h2>
                <p className="text-muted-foreground text-base">Pilih warna favoritmu agar aplikasi lebih personal.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Tema</label>
                  <div className="flex gap-4">
                    {["light", "dark", "system"].map(theme => (
                      <button
                        key={theme}
                        onClick={() => {
                          const newProfile = { ...profile, themeMode: theme as any };
                          setProfile(newProfile);
                          
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
                          const hueSatLight = isDark ? darkColorMap[newProfile.accentColor || 'blue'] : colorMap[newProfile.accentColor || 'blue'];
                          document.documentElement.style.setProperty("--primary", hueSatLight);
                        }}
                        className={`flex-1 py-3 border-2 rounded-xl capitalize font-medium transition-all ${profile.themeMode === theme ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Warna Aksen</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
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
                          const newProfile = { ...profile, accentColor: accent.id as any };
                          setProfile(newProfile);
                          
                          const isDark = document.documentElement.classList.contains("dark");
                          const colorMap: Record<string, string> = { blue: "205 71% 41%", violet: "263 42% 56%", pink: "338 100% 73%", yellow: "36 100% 67%", green: "150 38% 54%" };
                          const darkColorMap: Record<string, string> = { blue: "201 100% 91%", violet: "263 100% 88%", pink: "338 100% 91%", yellow: "56 87% 85%", green: "149 68% 75%" };
                          const hueSatLight = isDark ? darkColorMap[accent.id] : colorMap[accent.id];
                          document.documentElement.style.setProperty("--primary", hueSatLight);
                        }}
                        className="h-12 flex items-center justify-center transition-transform hover:scale-105"
                      >
                        <div 
                           className={`w-8 h-8 rounded-full ${profile.accentColor === accent.id ? "ring-2 ring-offset-2 ring-foreground" : ""}`} 
                           style={{ backgroundColor: profile.themeMode === "dark" || (profile.themeMode === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? accent.darkHex : accent.hex }}
                        ></div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* nav footer */}
          <div className="mt-10 flex items-center justify-between pt-6 border-t">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className="px-4 py-2 border rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Kembali
            </button>
            
            {step < 4 ? (
              <button
                onClick={nextStep}
                disabled={(step === 1 && !profile.name) || (step === 2 && !profile.monthlyIncome)}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:bg-muted disabled:text-muted-foreground"
              >
                Lanjut <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
              >
                Mulai Gunakan FinAi <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
