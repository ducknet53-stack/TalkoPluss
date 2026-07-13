import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Type, Palette, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { uploadImage } from '../lib/imgbb';
import toast from 'react-hot-toast';

interface CreateStoryModalProps {
  onClose: () => void;
}

const TEXT_STYLES = [
  { id: 'sans', name: 'Modern', className: 'font-sans' },
  { id: 'serif', name: 'Zarif', className: 'font-serif italic' },
  { id: 'mono', name: 'Kod', className: 'font-mono' },
  { id: 'handwriting', name: 'El Yazısı', className: 'font-cursive font-medium' },
  { id: 'impact', name: 'Kalın', className: 'font-sans font-black uppercase tracking-wider' }
];

const TEXT_COLORS = [
  { id: '#ffffff', name: 'Beyaz', className: 'bg-white border border-gray-300' },
  { id: '#000000', name: 'Siyah', className: 'bg-black border border-gray-600' },
  { id: '#3b82f6', name: 'Mavi', className: 'bg-blue-500' },
  { id: '#10b981', name: 'Yeşil', className: 'bg-emerald-500' },
  { id: '#f59e0b', name: 'Sarı', className: 'bg-amber-500' },
  { id: '#ef4444', name: 'Kırmızı', className: 'bg-red-500' },
  { id: '#ec4899', name: 'Pembe', className: 'bg-pink-500' },
  { id: '#a855f7', name: 'Mor', className: 'bg-purple-500' },
  { id: '#f97316', name: 'Turuncu', className: 'bg-orange-500' }
];

export default function CreateStoryModal({ onClose }: CreateStoryModalProps) {
  const { currentUser, userProfile } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textStyle, setTextStyle] = useState('sans');
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen geçerli bir görsel dosyası seçin.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handlePublish = async () => {
    if (!currentUser || !selectedFile) return;

    setIsPublishing(true);
    const toastId = toast.loading('Durum paylaşılıyor...');

    try {
      const url = await uploadImage(selectedFile);
      if (!url) {
        throw new Error('Görsel yüklenemedi.');
      }

      const storyId = doc(collection(db, 'stories')).id;
      const now = Date.now();
      
      await setDoc(doc(db, 'stories', storyId), {
        id: storyId,
        userId: currentUser.uid,
        username: userProfile?.username || 'Kullanıcı',
        userPhotoURL: userProfile?.photoURL || null,
        imageUrl: url,
        text: text.trim() || null,
        textColor,
        textStyle,
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000 // 24 Hours
      });

      toast.success('Durum başarıyla paylaşıldı!', { id: toastId });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Durum paylaşılırken bir hata oluştu.', { id: toastId });
    } finally {
      setIsPublishing(false);
    }
  };

  const selectedStyleClass = TEXT_STYLES.find(s => s.id === textStyle)?.className || 'font-sans';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900 text-white rounded-3xl w-full max-w-lg overflow-hidden border border-gray-800 shadow-2xl relative flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            📸 Hikâye Paylaş
          </h2>
          <button 
            onClick={onClose}
            disabled={isPublishing}
            className="p-1.5 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {!previewUrl ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-gray-950/40"
            >
              <div className="p-4 bg-gray-800 rounded-full text-blue-400">
                <Upload size={32} />
              </div>
              <p className="font-semibold text-gray-300">Fotoğraf Yükle</p>
              <p className="text-xs text-gray-500">Paylaşmak istediğiniz bir görsel seçin</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="flex flex-col gap-6 flex-1">
              {/* Photo Preview with Text Overlay */}
              <div className="relative aspect-[9/16] w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-black shadow-lg border border-gray-800 group">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover select-none pointer-events-none" 
                />
                
                {/* Text Overlay */}
                {text && (
                  <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/10 select-none pointer-events-none">
                    <p 
                      style={{ color: textColor }}
                      className={`text-center break-words text-lg font-bold select-none text-shadow-md max-w-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${selectedStyleClass}`}
                    >
                      {text}
                    </p>
                  </div>
                )}

                <button 
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setText('');
                  }}
                  className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Editing Controls */}
              <div className="space-y-4">
                {/* Text Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Type size={14} /> Fotoğraf Üzerine Metin
                  </label>
                  <input 
                    type="text" 
                    placeholder="Metin ekleyin..." 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={100}
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white transition-all"
                  />
                </div>

                {text && (
                  <>
                    {/* Font Style Select */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                        Yazı Stili
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {TEXT_STYLES.map(style => (
                          <button
                            key={style.id}
                            onClick={() => setTextStyle(style.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              textStyle === style.id 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'bg-gray-850 text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                          >
                            <span className={style.className}>{style.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text Color Select */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Palette size={14} /> Yazı Rengi
                      </label>
                      <div className="flex flex-wrap gap-2.5">
                        {TEXT_COLORS.map(color => (
                          <button
                            key={color.id}
                            onClick={() => setTextColor(color.id)}
                            className={`w-7 h-7 rounded-full transition-all flex items-center justify-center ${color.className} ${
                              textColor === color.id ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : 'hover:scale-105'
                            }`}
                            title={color.name}
                          >
                            {textColor === color.id && (
                              <div className={`w-2 h-2 rounded-full ${color.id === '#ffffff' ? 'bg-black' : 'bg-white'}`} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {previewUrl && (
          <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-950/20">
            <button
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setText('');
              }}
              disabled={isPublishing}
              className="px-4 py-2 text-sm font-medium hover:bg-gray-800 text-gray-300 rounded-xl transition-all"
            >
              Vazgeç
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md hover:shadow-blue-500/15 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isPublishing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Paylaşılıyor...
                </>
              ) : (
                'Paylaş'
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
