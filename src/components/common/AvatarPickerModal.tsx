import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Sparkles,
  Camera,
} from 'lucide-react';
import { storageService, PredefinedAvatar } from '../../services/storageService';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhoto: string | null | undefined;
  userName?: string;
  userId?: string;
  onSelectPhoto: (photoUrl: string | null) => Promise<void> | void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  onClose,
  currentPhoto,
  userName = 'Operador',
  userId,
  onSelectPhoto,
}) => {
  const [activeTab, setActiveTab] = useState<'avatares' | 'upload'>('avatares');
  const [avatars, setAvatars] = useState<PredefinedAvatar[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(currentPhoto || null);

  // Upload tab states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedAvatarUrl(currentPhoto || null);
      setUploadFile(null);
      setPreviewUrl(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      carregarAvatares();
    }
  }, [isOpen, currentPhoto]);

  const carregarAvatares = async () => {
    setLoadingAvatars(true);
    try {
      const list = await storageService.listarAvataresPredefinidos();
      setAvatars(list);
    } catch {
      // silencioso
    } finally {
      setLoadingAvatars(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validacao = storageService.validarArquivoFoto(file);
    if (!validacao.valido) {
      setErrorMsg(validacao.erro || 'Arquivo inválido.');
      return;
    }

    setUploadFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSalvarAvatarPredefinido = async () => {
    setErrorMsg(null);
    setUploading(true);
    try {
      await onSelectPhoto(selectedAvatarUrl);
      setSuccessMsg('Avatar salvo com sucesso!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar avatar.';
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleFazerUpload = async () => {
    if (!uploadFile) {
      setErrorMsg('Por favor, selecione uma imagem para enviar.');
      return;
    }

    setErrorMsg(null);
    setUploading(true);
    try {
      const userRefId = userId || 'temp-user';
      const uploadRes = await storageService.uploadFotoPerfil(uploadFile, userRefId);

      if (!uploadRes.success || !uploadRes.url) {
        throw new Error(uploadRes.error || 'Falha ao realizar upload.');
      }

      await onSelectPhoto(uploadRes.url);
      setSuccessMsg('Foto de perfil atualizada com sucesso!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar foto.';
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoverFoto = async () => {
    setErrorMsg(null);
    setUploading(true);
    try {
      await onSelectPhoto(null);
      setSelectedAvatarUrl(null);
      setPreviewUrl(null);
      setUploadFile(null);
      setSuccessMsg('Foto/avatar removido com sucesso!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover foto.';
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Foto de Perfil & Avatar</h3>
              <p className="text-xs text-slate-400">Personalize sua exibição visual no PoliHub</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-3 bg-slate-950/60 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('avatares')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition min-h-[40px] ${
              activeTab === 'avatares'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Avatares Prontos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition min-h-[40px] ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Enviar Minha Foto</span>
          </button>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'avatares' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Selecione um avatar do catálogo:
                </span>
                {selectedAvatarUrl && (
                  <span className="text-[11px] text-blue-400 font-medium">1 selecionado</span>
                )}
              </div>

              {loadingAvatars ? (
                <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Carregando avatares...</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
                  {avatars.map((av) => {
                    const isSelected = selectedAvatarUrl === av.url;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setSelectedAvatarUrl(av.url)}
                        title={av.name}
                        className={`group relative flex flex-col items-center p-2 rounded-2xl border transition text-center cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/40 shadow-lg'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-slate-700 group-hover:border-blue-400 transition bg-slate-800">
                          <img
                            src={av.url}
                            alt={av.name}
                            className="w-full h-full object-cover object-center"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-300 truncate w-full mt-1.5">
                          {av.name}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Preview e Ação */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-500 bg-slate-800 shrink-0">
                    {selectedAvatarUrl ? (
                      <img
                        src={selectedAvatarUrl}
                        alt="Preview"
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                        {userName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Prévia Circular</p>
                    <p className="text-[11px] text-slate-400">Exibição centralizada com object-fit</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={uploading || !selectedAvatarUrl}
                  onClick={handleSalvarAvatarPredefinido}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition disabled:opacity-50 min-h-[38px] shadow-md shadow-blue-600/30"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Confirmar Avatar</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500/70 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-950/40 hover:bg-blue-500/5 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-white mt-3">Clique para selecionar uma foto</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Formatos aceitos: JPG, PNG ou WEBP (máximo 2MB)
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Salva com segurança no bucket <code className="text-slate-400">perfil</code>
                </p>
              </div>

              {/* Preview circular */}
              {previewUrl && (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-500 bg-slate-800 shrink-0">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-400">Foto selecionada</p>
                      <p className="text-[11px] text-slate-300 truncate max-w-[180px]">
                        {uploadFile?.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {uploadFile ? `${(uploadFile.size / 1024).toFixed(0)} KB` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={uploading}
                    onClick={handleFazerUpload}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50 min-h-[38px] shadow-md shadow-emerald-600/30"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>Salvar Foto</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          {currentPhoto ? (
            <button
              type="button"
              disabled={uploading}
              onClick={handleRemoverFoto}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remover Foto Atual</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
