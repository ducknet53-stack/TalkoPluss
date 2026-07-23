import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Key, ShieldCheck, Lock, ExternalLink, Info, CheckCircle2, AlertOctagon, AlertCircle } from 'lucide-react';

interface GoogleSuspendedScreenProps {
  onBypass?: () => void;
}

export default function GoogleSuspendedScreen({ onBypass }: GoogleSuspendedScreenProps) {
  const [clickCount, setClickCount] = useState(0);
  const [showAdminBypassModal, setShowAdminBypassModal] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Secret bypass trigger: Clicking Google logo 5 times
  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      setShowAdminBypassModal(true);
      setClickCount(0);
    }
  };

  const handleBypassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === '4558') {
      localStorage.setItem('talko_google_shutdown_disabled', 'true');
      if (onBypass) onBypass();
    } else {
      setErrorMsg('Geçersiz Google Cloud Sistem Güvenlik Anahtarı!');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#f8f9fa] text-[#202124] flex flex-col justify-between font-sans overflow-y-auto select-none">
      {/* Official Top Bar */}
      <header className="border-b border-[#dadce0] bg-white px-6 py-3.5 flex items-center justify-between shadow-xs sticky top-0 z-50">
        <div 
          onClick={handleLogoClick}
          className="flex items-center gap-3 cursor-default"
        >
          {/* Official Google Color SVG */}
          <svg className="w-7 h-7" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <div className="flex flex-col">
            <span className="text-base font-medium text-[#5f6368] tracking-tight leading-none">
              Google <span className="font-semibold text-[#202124]">Trust &amp; Safety</span>
            </span>
            <span className="text-[10px] text-[#80868b] mt-0.5 font-medium tracking-wide">
              GOOGLE CLOUD SECURITY &amp; POLICY ENFORCEMENT
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
            HİZMET ASKIYA ALINDI
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-[#dadce0] rounded-2xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
          {/* Top Warning Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#d93025]" />

          {/* Title Header */}
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-7 h-7 sm:w-8 sm:h-8 text-[#d93025]" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#d93025] uppercase tracking-wider mb-1">
                <span>Google Cloud Policy Enforcement Notice</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#202124] tracking-tight leading-snug">
                Google Hizmet Şartları ve Topluluk İhlali Bildirimi
              </h1>
              <p className="text-sm text-[#5f6368] mt-1.5">
                Bu web uygulaması ve bağlı sunucu altyapısı Google Güvenlik Politikaları gereğince durdurulmuştur.
              </p>
            </div>
          </div>

          {/* Detailed Notice Content */}
          <div className="space-y-4 text-[#3c4043] text-sm leading-relaxed border-t border-[#f1f3f4] pt-6">
            {/* Red Alert Callout */}
            <div className="p-4 bg-red-50/80 border border-red-200/90 rounded-xl text-red-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#b31412] text-sm sm:text-base">
                <AlertTriangle className="w-5 h-5 text-[#d93025] shrink-0" />
                <span>Erişim Engelleme Nedeni: Küfür ve Uygunsuz İçerik Tespiti</span>
              </div>
              <p className="text-xs sm:text-sm text-[#8c1d18] leading-relaxed">
                Google Otomatik Güvenlik ve İçerik Moderasyon Sistemleri (Google AI Safety Filters) tarafından gerçekleştirilen sistem taramalarında, bu platform üzerinde **Topluluk Kuralları, Küfür, Hakaret ve Saldırgan Dil İçeren Mesajlaşma** tespiti yapılmıştır.
              </p>
            </div>

            <p className="text-[#3c4043]">
              Google Güvenlik Politikaları uyarınca, kullanıcıların güvenliğini tehdit eden, yoğun küfür, hakaret veya nefret söylemi barındıran uygulamalar otomatik olarak erişime kapatılır ve canlı veri akışı durdurulur.
            </p>

            {/* Official Report Table */}
            <div className="bg-[#f8f9fa] border border-[#e8eaed] rounded-xl p-4 space-y-2.5 font-mono text-xs text-[#3c4043]">
              <div className="flex justify-between border-b border-[#e8eaed] pb-2 text-[#5f6368]">
                <span>İhlal Referans Kodu:</span>
                <span className="font-bold text-[#d93025]">GOOG-SAFETY-403-PROFANITY</span>
              </div>
              <div className="flex justify-between border-b border-[#e8eaed] pb-2 text-[#5f6368]">
                <span>Dosya / Vaka No:</span>
                <span className="font-medium text-[#202124]">CASE-2026-904812-ENF</span>
              </div>
              <div className="flex justify-between border-b border-[#e8eaed] pb-2 text-[#5f6368]">
                <span>Karar Veren Birim:</span>
                <span className="font-medium text-[#202124]">Google Trust &amp; Safety Enforcement Team</span>
              </div>
              <div className="flex justify-between border-b border-[#e8eaed] pb-2 text-[#5f6368]">
                <span>İşlem Durumu:</span>
                <span className="font-bold text-[#d93025]">Uygulama Durduruldu (Suspended)</span>
              </div>
              <div className="flex justify-between text-[#5f6368]">
                <span>Google Cloud Proje ID:</span>
                <span className="font-medium text-[#202124]">talko-b5468 (Cloud Enforcement)</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-[#70757a] pt-1">
              <Info className="w-4 h-4 text-[#80868b] shrink-0 mt-0.5" />
              <span>
                Veri güvenliği kapsamında kullanıcı verileri korunmaktadır. Ancak canlı mesajlaşma servisleri inceleme tamamlanana kadar pasif konumdadır.
              </span>
            </div>
          </div>

          {/* Action Area */}
          <div className="mt-8 pt-6 border-t border-[#dadce0] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  window.location.href = 'https://myaccount.google.com';
                }}
                className="px-5 py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] active:bg-[#174ea6] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                Google Hesabına Dön
              </button>

              <button
                onClick={() => {
                  alert("Google İtiraz Talebi: Talebiniz Google Trust & Safety güvenlik birimine iletilmiştir. Dosya İnceleme Süresi: 24-48 saat.");
                }}
                className="px-4 py-2.5 bg-white hover:bg-[#f1f3f4] text-[#1a73e8] border border-[#dadce0] text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Karara İtiraz Et
              </button>
            </div>

            <div className="text-xs text-[#70757a] flex items-center gap-1 font-mono">
              <Lock className="w-3.5 h-3.5 text-[#80868b]" />
              <span>STATUS: ENFORCED</span>
            </div>
          </div>
        </div>
      </main>

      {/* Secret System Authentication Modal */}
      {showAdminBypassModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#dadce0] space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3 border-[#f1f3f4]">
              <div className="flex items-center gap-2 font-bold text-[#202124]">
                <ShieldCheck className="w-5 h-5 text-[#1a73e8]" />
                <span className="text-sm sm:text-base">Google Cloud - Sistem Doğrulaması</span>
              </div>
              <button 
                onClick={() => setShowAdminBypassModal(false)}
                className="text-[#70757a] hover:text-[#202124] text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#5f6368] leading-relaxed">
              Google Cloud yetkili sistem yöneticisi doğrulama anahtarını giriniz.
            </p>

            <form onSubmit={handleBypassSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#3c4043] mb-1">
                  Yönetici Güvenlik Anahtarı
                </label>
                <input
                  type="password"
                  placeholder="Güvenlik Anahtarı"
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full px-3.5 py-2.5 border border-[#dadce0] rounded-xl text-sm focus:outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                  autoFocus
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errorMsg}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Key className="w-4 h-4" />
                  Doğrula ve Erişimi Aç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Footer */}
      <footer className="border-t border-[#dadce0] bg-white px-6 py-4 text-xs text-[#70757a] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span>Google Cloud Platform &bull; Safe Browsing &amp; Content Moderation &bull; All Rights Reserved</span>
        </div>
        <div className="flex gap-4">
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="hover:underline">Gizlilik</a>
          <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="hover:underline">Şartlar</a>
          <a href="https://support.google.com" target="_blank" rel="noreferrer" className="hover:underline">Yardım</a>
        </div>
      </footer>
    </div>
  );
}


