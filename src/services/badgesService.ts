import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getLocalAgendamentos,
  getLocalRecebimentosProdutos,
  getLocalAlteracoesEndereco,
  getLocalTabelaInventario,
  getLocalCompras,
  getLocalWhatsAppConversas,
} from './mockStorage';
import { getUnitEquivalents, itemMatchesUserUnit } from './sessionHelper';
import { WHATSAPP_MODULE_ENABLED } from '../lib/permissions';

export interface ModuleBadges {
  agendamentos: number;
  recebimento: number;
  alocacao: number;
  cadastros: number;
  inventario: number;
  compras: number;
  whatsapp?: number;
}

export interface AgendamentoTabBadges {
  pendentes: number;
  recebidosHoje: number;
}

export const badgesService = {
  async obterBadges(unidadeNegocio?: string): Promise<ModuleBadges> {
    const supabase = getSupabase();

    if (isSupabaseConfigured && supabase) {
      try {
        let qAgendamentos = supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Pendente', 'Confirmado', 'Em trânsito']);
        if (unidadeNegocio) {
          qAgendamentos = qAgendamentos.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }

        let qRecebimentos = supabase
          .from('recebimentos_produtos')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Recebido', 'Pendente', 'Em Conferência']);
        if (unidadeNegocio) {
          qRecebimentos = qRecebimentos.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }

        let qAlocacao = supabase
          .from('alteracoes_endereco')
          .select('id', { count: 'exact', head: true })
          .eq('alterado_sistema', false);
        if (unidadeNegocio) {
          qAlocacao = qAlocacao.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }

        let qInventario = supabase
          .from('inventario')
          .select('id', { count: 'exact', head: true })
          .eq('corrigido', false)
          .not('qtd_contada', 'is', null);
        if (unidadeNegocio) {
          qInventario = qInventario.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }

        let qCompras = supabase
          .from('compras')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Solicitado', 'solicitado']);
        if (unidadeNegocio) {
          const equivs = getUnitEquivalents(unidadeNegocio);
          qCompras = qCompras.or(`unidade_negocio.in.(${equivs.join(',')}),unidade_negocio.is.null`);
        }

        const [
          agendamentosRes,
          recebimentosRes,
          alocacaoRes,
          inventarioRes,
          comprasRes,
        ] = await Promise.allSettled([
          qAgendamentos,
          qRecebimentos,
          qAlocacao,
          qInventario,
          qCompras,
        ]);

        const agendamentosCount =
          agendamentosRes.status === 'fulfilled' ? agendamentosRes.value.count || 0 : 0;
        const recebimentoCount =
          recebimentosRes.status === 'fulfilled' ? recebimentosRes.value.count || 0 : 0;
        const alocacaoCount =
          alocacaoRes.status === 'fulfilled' ? alocacaoRes.value.count || 0 : 0;
        const inventarioCount =
          inventarioRes.status === 'fulfilled' ? inventarioRes.value.count || 0 : 0;

        let comprasCount = 0;
        if (
          comprasRes.status === 'fulfilled' &&
          !comprasRes.value.error &&
          typeof comprasRes.value.count === 'number'
        ) {
          comprasCount = comprasRes.value.count;
        } else {
          // Fallback gracioso para local se a tabela Supabase falhar ou estiver indisponível
          const locais = getLocalCompras();
          comprasCount = locais.filter((c) => {
            const st = (c.status || '').toLowerCase().trim();
            const matchStatus = st === 'solicitado';
            const matchUnit =
              !unidadeNegocio || !c.unidade_negocio || itemMatchesUserUnit(c.unidade_negocio, unidadeNegocio);
            return matchStatus && matchUnit;
          }).length;
        }

        let whatsappCount = 0;
        if (WHATSAPP_MODULE_ENABLED) {
          try {
            const { count } = await supabase
              .from('whatsapp_conversas')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'aguardando');
            whatsappCount = count || 0;
          } catch {}
        }

        return {
          agendamentos: agendamentosCount,
          recebimento: recebimentoCount,
          alocacao: alocacaoCount,
          cadastros: 0,
          inventario: inventarioCount,
          compras: comprasCount,
          whatsapp: whatsappCount,
        };
      } catch (err) {
        console.warn('Erro ao carregar badges via Supabase, usando local:', err);
      }
    }

    // Fallback Local
    const matchUnidade = (item: { unidade_negocio?: string }) =>
      !unidadeNegocio || !item.unidade_negocio || itemMatchesUserUnit(item.unidade_negocio, unidadeNegocio);

    const localAgendamentos = getLocalAgendamentos().filter(
      (a) =>
        (a.status === 'Pendente' || (a.status as string) === 'Confirmado' || (a.status as string) === 'Em trânsito') &&
        matchUnidade(a)
    ).length;
    const localRecebimentos = getLocalRecebimentosProdutos().filter(
      (r) =>
        (r.status === 'Recebido' || (r.status as string) === 'Pendente' || (r.status as string) === 'Em Conferência') &&
        matchUnidade(r)
    ).length;
    // Alocação: apenas da tabela alteracoes_endereco com alterado_sistema = false
    const localAlocacao = getLocalAlteracoesEndereco().filter(
      (alt) => alt.alterado_sistema === false && matchUnidade(alt)
    ).length;
    const localInventario = getLocalTabelaInventario().filter(
      (i) =>
        i.qtd_contada !== null &&
        i.qtd_contada !== undefined &&
        !i.corrigido &&
        Number(i.qtd_contada) !== Number(i.qtd_disponivel) &&
        matchUnidade(i)
    ).length;
    const localCompras = getLocalCompras().filter((c) => {
      const st = (c.status || '').toLowerCase().trim();
      const matchStatus = st === 'solicitado';
      return matchStatus && matchUnidade(c);
    }).length;
    const localWhatsApp = WHATSAPP_MODULE_ENABLED
      ? getLocalWhatsAppConversas().filter((c) => c.status === 'aguardando' && matchUnidade(c)).length
      : 0;

    return {
      agendamentos: localAgendamentos,
      recebimento: localRecebimentos,
      alocacao: localAlocacao,
      cadastros: 0,
      inventario: localInventario,
      compras: localCompras,
      whatsapp: localWhatsApp,
    };
  },

  /**
   * Badges específicos das abas do menu Agendamentos:
   * - Aba Pendentes: quantidade de agendamentos pendentes (espelha a badge do menu lateral)
   * - Aba Recebidos: apenas notas recebidas com data de hoje
   * - Aba Cancelados: sem badge (0)
   */
  async obterBadgesAgendamento(unidadeNegocio?: string): Promise<AgendamentoTabBadges> {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);

    if (isSupabaseConfigured && supabase) {
      try {
        let qAgendamentos = supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Pendente', 'Confirmado', 'Em trânsito']);
        if (unidadeNegocio) {
          qAgendamentos = qAgendamentos.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }

        let qRecebidosHoje = supabase
          .from('agendamentos')
          .select('id, data_entrega, data_prevista')
          .eq('status', 'Recebido')
          .or(`data_entrega.eq.${today},and(data_entrega.is.null,data_prevista.eq.${today})`);
        if (unidadeNegocio) {
          qRecebidosHoje = qRecebidosHoje.in('unidade_negocio', getUnitEquivalents(unidadeNegocio));
        }

        const [agRes, recRes] = await Promise.allSettled([qAgendamentos, qRecebidosHoje]);

        const pendentes = agRes.status === 'fulfilled' ? agRes.value.count || 0 : 0;
        const recebidosHoje = recRes.status === 'fulfilled' ? recRes.value.data?.length || 0 : 0;

        return { pendentes, recebidosHoje };
      } catch (err) {
        console.warn('Erro ao carregar contadores de agendamentos via Supabase:', err);
      }
    }

    // Fallback Local
    const matchUnidade = (item: { unidade_negocio?: string }) =>
      !unidadeNegocio || !item.unidade_negocio || itemMatchesUserUnit(item.unidade_negocio, unidadeNegocio);

    const localPendentes = getLocalAgendamentos().filter(
      (a) =>
        (a.status === 'Pendente' || (a.status as string) === 'Confirmado' || (a.status as string) === 'Em trânsito') &&
        matchUnidade(a)
    ).length;

    const localRecebidosHoje = getLocalAgendamentos().filter(
      (a) =>
        a.status === 'Recebido' &&
        matchUnidade(a) &&
        ((a.data_entrega && a.data_entrega === today) ||
          (!a.data_entrega && a.data_prevista === today))
    ).length;

    return {
      pendentes: localPendentes,
      recebidosHoje: localRecebidosHoje,
    };
  },
};
