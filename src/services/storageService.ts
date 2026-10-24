import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { usuariosService } from './usuariosService';

export interface PredefinedAvatar {
  id: string;
  name: string;
  url: string;
}

// Avatares ilustrados modernos pré-definidos para fallback ou escolha rápida
const FALLBACK_AVATARS: PredefinedAvatar[] = [
  {
    id: 'avatar-1',
    name: 'Operador Logístico 1',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Logistica1&backgroundColor=0284c7',
  },
  {
    id: 'avatar-2',
    name: 'Operadora Logística 2',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Operadora2&backgroundColor=0d9488',
  },
  {
    id: 'avatar-3',
    name: 'Gestor de Armazém',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=GestorArmazem&backgroundColor=f59e0b',
  },
  {
    id: 'avatar-4',
    name: 'Assistente Operacional',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AssistenteOp&backgroundColor=6366f1',
  },
  {
    id: 'avatar-5',
    name: 'Conferente de Carga',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Conferente&backgroundColor=ec4899',
  },
  {
    id: 'avatar-6',
    name: 'Supervisor de Turno',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Supervisor&backgroundColor=10b981',
  },
  {
    id: 'avatar-7',
    name: 'Controlador de Frota',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Frota&backgroundColor=8b5cf6',
  },
  {
    id: 'avatar-8',
    name: 'Especialista em Estoque',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Estoque&backgroundColor=f43f5e',
  },
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export const storageService = {
  /**
   * Lista avatares pré-definidos do bucket 'Avatares' do Supabase Storage.
   * Se o bucket estiver vazio ou inacessível, retorna coleção de avatares prontos.
   */
  async listarAvataresPredefinidos(): Promise<PredefinedAvatar[]> {
    const supabase = getSupabase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.storage.from('Avatares').list('', {
          limit: 50,
          sortBy: { column: 'name', order: 'asc' },
        });

        if (!error && data && data.length > 0) {
          const files = data.filter((item) => !item.id.endsWith('/'));
          if (files.length > 0) {
            return files.map((file, idx) => {
              const { data: urlData } = supabase.storage
                .from('Avatares')
                .getPublicUrl(file.name);
              return {
                id: `supabase-avatar-${idx}-${file.name}`,
                name: file.name.replace(/\.[^/.]+$/, ''),
                url: urlData.publicUrl,
              };
            });
          }
        }
      } catch (err) {
        console.warn('Bucket Avatares não pôde ser listado, usando fallback:', err);
      }
    }

    return FALLBACK_AVATARS;
  },

  /**
   * Valida arquivo de foto para garantir tamanho e tipo aceitos
   */
  validarArquivoFoto(file: File): { valido: boolean; erro?: string } {
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      return {
        valido: false,
        erro: 'Formato inválido. Selecione uma imagem nos formatos JPG, PNG ou WEBP.',
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return {
        valido: false,
        erro: `O arquivo excede o limite máximo permitido de 2MB (tamanho atual: ${(file.size / 1024 / 1024).toFixed(1)}MB).`,
      };
    }
    return { valido: true };
  },

  /**
   * Converte arquivo para data URL Base64 para fallback local
   */
  converterParaBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Faz upload da foto pessoal do usuário para o bucket 'perfil'.
   * Usa deduplicação com upsert no nome de arquivo `${usuarioId}.${ext}`
   * para não acumular arquivos repetidos no Storage.
   */
  async uploadFotoPerfil(
    file: File,
    usuarioId: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const validacao = this.validarArquivoFoto(file);
    if (!validacao.valido) {
      return { success: false, error: validacao.erro };
    }

    const supabase = getSupabase();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${usuarioId}.${ext}`;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('perfil')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true, // Substitui a foto anterior sem duplicar
            contentType: file.type,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('perfil')
            .getPublicUrl(fileName);

          // Timestamp para evitar cache do navegador na mesma URL
          const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
          return { success: true, url: publicUrl };
        } else {
          console.warn('Erro ao subir foto para bucket perfil no Supabase:', uploadError);
        }
      } catch (err) {
        console.warn('Exceção ao fazer upload no bucket perfil:', err);
      }
    }

    // Fallback: se o Supabase não estiver configurado ou RLS bloquear upload,
    // converte para base64 localmente para manter a funcionalidade para o usuário
    try {
      const base64Url = await this.converterParaBase64(file);
      return { success: true, url: base64Url };
    } catch {
      return { success: false, error: 'Falha ao processar arquivo de imagem localmente.' };
    }
  },

  /**
   * Salva a referência da foto ou avatar no cadastro do usuário
   */
  async salvarFotoUsuario(usuarioId: string, fotoUrl: string | null): Promise<void> {
    await usuariosService.atualizarUsuario(usuarioId, { foto: fotoUrl });
  },
};
