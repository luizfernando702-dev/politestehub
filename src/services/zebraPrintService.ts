/**
 * POLIHUB — SERVIÇO CENTRALIZADO DE IMPRESSÃO DE ETIQUETAS ZEBRA
 *
 * Responsável por:
 * 1. Receber dados de qualquer módulo (Coletas, Produtos, Paletes, etc.)
 * 2. Formatar e calcular dimensões, margens e área útil de impressão térmica
 * 3. Gerar código ZPL II (Zebra Programming Language) puro
 * 4. Gerar HTML de alta precisão milimétrica (@page 100mm x 50mm)
 * 5. Disparar a impressão térmica sem distorção e sem cabeçalhos/rodapés de navegador
 * 6. Suporte a cópias e download/cópia de script ZPL
 */

import {
  ConfiguracaoEtiquetaZebra,
  DadosEtiquetaColeta,
  DadosEtiquetaCriticaAvaria,
  DadosEtiquetaProdutoAgendamento,
  DadosEtiquetaProdutoAvulso,
  DadosEtiquetaProdutoAvaria,
  ResultadoImpressao,
  TipoModeloEtiqueta,
} from '../types/impressao';
import QRCode from 'qrcode';

export const CONFIG_PADRAO_ZEBRA: ConfiguracaoEtiquetaZebra = {
  larguraMm: 100,
  alturaMm: 50,
  densidadeDpi: 203, // 8 dots/mm (padrão de impressoras térmicas Zebra industriais e desktop)
  orientacao: 'landscape',
};

class ZebraPrintService {
  /**
   * Formata os dados de coleta para as linhas legíveis da etiqueta
   */
  formatarLinhasColeta(dados: DadosEtiquetaColeta): {
    linha1: string;
    linha2: string;
    linhasExtras?: string[];
  } {
    const numColeta = (dados.numero_coleta || '').trim();
    const linha1 = numColeta ? `COLETA: ${numColeta.toUpperCase()}` : 'COLETA: (NÃO INFORMADA)';

    let linha2 = '';
    const linhasExtras: string[] = [];

    if (dados.opcao_destino === 'cliente_retira') {
      const cidade = (dados.cidade_retirada || '').trim().toUpperCase();
      const uf = (dados.uf_retirada || '').trim().toUpperCase();
      const local = [cidade, uf].filter(Boolean).join('/');
      linha2 = local ? `CLIENTE RETIRA — ${local}` : 'CLIENTE RETIRA';
    } else if (dados.opcao_destino === 'endereco_alternativo') {
      const end = dados.endereco_alternativo;
      if (end) {
        const partesL1 = [
          end.logradouro ? end.logradouro.trim().toUpperCase() : '',
          end.complemento ? end.complemento.trim().toUpperCase() : '',
          end.setor ? `SETOR ${end.setor.trim().toUpperCase()}` : '',
        ].filter(Boolean);

        linha2 = partesL1.join(', ');

        const partesL2 = [
          end.cidade && end.uf
            ? `${end.cidade.trim().toUpperCase()}/${end.uf.trim().toUpperCase()}`
            : end.cidade
            ? end.cidade.trim().toUpperCase()
            : '',
          end.cep ? `CEP: ${end.cep.trim().toUpperCase()}` : '',
        ].filter(Boolean);

        if (partesL2.length > 0) {
          linhasExtras.push(partesL2.join(' — '));
        }
      }
    } else {
      // 'sem_destino' -> Nenhuma segunda linha
      linha2 = '';
    }

    return { linha1, linha2, linhasExtras };
  }

  /**
   * Gera código ZPL II puro compatível com qualquer impressora térmica Zebra
   * - Área útil de 8cm x 5cm (80mm x 50mm = 640 dots) começando da DIREITA para a ESQUERDA
   * - Logotipo pré-impresso ao lado DIREITO (2cm = 20mm = 160 dots de 640 a 800) 100% livre
   */
  gerarZplColeta(
    dados: DadosEtiquetaColeta,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const { linha1, linha2, linhasExtras } = this.formatarLinhasColeta(dados);
    const copias = Math.max(1, dados.copias || 1);

    // 203 DPI: 100mm = ~800 dots, 50mm = ~400 dots
    const dotsWidth = Math.round((config.larguraMm * config.densidadeDpi) / 25.4);
    const dotsHeight = Math.round((config.alturaMm * config.densidadeDpi) / 25.4);

    // O logotipo pré-impresso fica ao lado DIREITO (últimos 2cm = 160 dots de 640 a 800).
    // A área útil (8cm = 640 dots) começa da DIREITA para a ESQUERDA:
    // Alinhamento à direita (R) para começar adjacente ao logotipo e desenvolver para a esquerda
    const startX = 20;
    const usefulWidth = 600; // Margem de segurança de ~20 dots antes do logotipo aos 640 dots

    let zpl = `^XA\n`;
    zpl += `^PW${dotsWidth}\n`;
    zpl += `^LL${dotsHeight}\n`;
    zpl += `^LH0,0\n`;
    zpl += `^CI28\n`; // Suporte UTF-8

    // Linha 1: Número da Coleta (Fonte grande, alinhada da direita para a esquerda)
    zpl += `^FO${startX},50^A0N,64,60^FB${usefulWidth},1,0,R^FD${this.escaparZpl(linha1)}^FS\n`;

    // Linha 2 e extras, caso existam (alinhadas da direita para a esquerda)
    if (linha2) {
      if (dados.opcao_destino === 'cliente_retira') {
        zpl += `^FO${startX},150^A0N,44,42^FB${usefulWidth},2,0,R^FD${this.escaparZpl(linha2)}^FS\n`;
      } else {
        // Endereço alternativo
        zpl += `^FO${startX},135^A0N,34,32^FB${usefulWidth},2,0,R^FD${this.escaparZpl(linha2)}^FS\n`;
        if (linhasExtras && linhasExtras.length > 0) {
          let offsetY = 185;
          for (const extra of linhasExtras) {
            zpl += `^FO${startX},${offsetY}^A0N,32,30^FB${usefulWidth},1,0,R^FD${this.escaparZpl(extra)}^FS\n`;
            offsetY += 40;
          }
        }
      }
    }

    // Informação de rodapé sutil da nota/PoliHub (da direita para a esquerda)
    if (dados.numero_nota_fiscal || dados.cliente) {
      const infoRodape = [
        dados.numero_nota_fiscal ? `NF: ${dados.numero_nota_fiscal}` : '',
        dados.cliente ? dados.cliente.substring(0, 30).toUpperCase() : '',
      ].filter(Boolean).join(' | ');

      zpl += `^FO${startX},${dotsHeight - 55}^A0N,22,22^FB${usefulWidth},1,0,R^FD${this.escaparZpl(infoRodape)}^FS\n`;
    }

    // Quantidade de cópias
    zpl += `^PQ${copias},0,1,Y\n`;
    zpl += `^XZ\n`;

    return zpl;
  }

  /**
   * Gera HTML de alta fidelidade para pré-visualização e impressão térmica
   * - Área útil de 8cm x 5cm (80mm x 50mm) começando da DIREITA para a ESQUERDA
   * - Área reservada de 2cm para o logotipo pré-impresso ao lado DIREITO (livre de impressão)
   */
  gerarHtmlColeta(
    dados: DadosEtiquetaColeta,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const { linha1, linha2, linhasExtras } = this.formatarLinhasColeta(dados);
    const copias = Math.max(1, dados.copias || 1);

    const etiquetaHtml = `
      <div class="zebra-etiqueta-page zebra-coleta-page" style="
        width: ${config.larguraMm}mm;
        height: ${config.alturaMm}mm;
        max-width: ${config.larguraMm}mm;
        max-height: ${config.alturaMm}mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        font-family: 'Arial Black', Arial, Helvetica, sans-serif;
        color: #000000;
        background: #ffffff;
        page-break-after: always;
        overflow: hidden;
      ">
        <!-- 1. ÁREA ÚTIL DE IMPRESSÃO: 8cm x 5cm (80mm x 50mm) - COMEÇA DA DIREITA PARA A ESQUERDA -->
        <div style="
          width: 80mm;
          min-width: 80mm;
          max-width: 80mm;
          height: 50mm;
          box-sizing: border-box;
          padding: 4mm 6mm 3mm 4mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: right;
          align-items: flex-end;
          overflow: hidden;
        ">
          <div style="flex: 1; width: 100%; display: flex; flex-direction: column; justify-content: center; gap: 2.5mm; text-align: right; align-items: flex-end;">
            <!-- Linha 1: Número da Coleta (Alinhado da Direita para a Esquerda) -->
            <div style="
              width: 100%;
              font-size: 20pt;
              font-weight: 900;
              line-height: 1.1;
              letter-spacing: 0.3px;
              text-transform: uppercase;
              word-break: break-word;
              text-align: right;
            ">
              ${this.escaparHtml(linha1)}
            </div>

            <!-- Linha 2: Destino (se aplicável) -->
            ${
              linha2
                ? `
              <div style="
                width: 100%;
                font-size: ${dados.opcao_destino === 'cliente_retira' ? '15pt' : '12pt'};
                font-weight: 800;
                line-height: 1.2;
                text-transform: uppercase;
                word-break: break-word;
                text-align: right;
              ">
                ${this.escaparHtml(linha2)}
              </div>
            `
                : ''
            }

            <!-- Linhas Extras de Endereço -->
            ${
              linhasExtras && linhasExtras.length > 0
                ? linhasExtras
                    .map(
                      (extra) => `
                  <div style="
                    width: 100%;
                    font-size: 11pt;
                    font-weight: 700;
                    line-height: 1.2;
                    text-transform: uppercase;
                    word-break: break-word;
                    text-align: right;
                  ">
                    ${this.escaparHtml(extra)}
                  </div>
                `
                    )
                    .join('')
                : ''
            }
          </div>

          <!-- Rodapé Operacional da Etiqueta (Alinhado à Direita) -->
          <div style="
            width: 100%;
            border-top: 1.5px solid #000000;
            padding-top: 1.5mm;
            margin-top: 1.5mm;
            display: flex;
            justify-content: flex-end;
            gap: 4mm;
            align-items: center;
            font-family: Arial, sans-serif;
            font-size: 7.5pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.2px;
            text-align: right;
          ">
            <span>${this.escaparHtml(dados.cliente ? dados.cliente.slice(0, 28) : 'POLIHUB LOGÍSTICA')}</span>
            <span>${dados.numero_nota_fiscal ? `NF: ${this.escaparHtml(dados.numero_nota_fiscal)}` : ''}</span>
          </div>
        </div>

        <!-- 2. ÁREA RESERVADA PARA O LOGOTIPO PRÉ-IMPRESSO (2cm = 20mm) AO LADO DIREITO -->
        <!-- Nada é impresso nesta coluna para não sobrepor o logotipo da bobina -->
        <div style="
          width: 20mm;
          min-width: 20mm;
          max-width: 20mm;
          height: 50mm;
          background: transparent;
          box-sizing: border-box;
        "></div>
      </div>
    `;

    // Multiplica pelas cópias solicitadas
    return Array(copias).fill(etiquetaHtml).join('\n');
  }

  /**
   * Gera código ZPL II para Etiqueta de Produto com Crítica / Avaria
   * Respeita:
   * - Dimensões: 10cm x 5cm (100mm x 50mm = 800 x 400 dots a 203 DPI)
   * - Área útil: 8cm x 5cm (80mm x 50mm = 640 dots de largura) começando da DIREITA para a ESQUERDA
   * - Área de 2cm (20mm = 160 dots) reservada para logotipo pré-impresso ao lado DIREITO: NENHUM dado é impresso nela
   * - Destaque máximo: Texto AVARIA em tamanho grande
   */
  gerarZplCriticaAvaria(
    dados: DadosEtiquetaCriticaAvaria,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const copias = Math.max(1, dados.copias || 1);
    const dotsWidth = Math.round((config.larguraMm * config.densidadeDpi) / 25.4); // 800 dots
    const dotsHeight = Math.round((config.alturaMm * config.densidadeDpi) / 25.4); // 400 dots

    // O logotipo pré-impresso fica ao lado DIREITO (últimos 160 dots / 20mm).
    // A área útil (8cm) começa da DIREITA para a ESQUERDA:
    const startX = 20;
    const usefulWidth = 600; // Margem de segurança de ~20 dots antes do logotipo aos 640 dots

    let zpl = `^XA\n`;
    zpl += `^PW${dotsWidth}\n`;
    zpl += `^LL${dotsHeight}\n`;
    zpl += `^LH0,0\n`;
    zpl += `^CI28\n`; // Suporte UTF-8

    // 1. Número da Nota Fiscal (da direita para a esquerda)
    zpl += `^FO${startX},35^A0N,34,32^FB${usefulWidth},1,0,R^FD${this.escaparZpl(`NF: ${dados.notaFiscal}`)}^FS\n`;

    // 2. Produto (código ou descrição, da direita para a esquerda)
    zpl += `^FO${startX},80^A0N,34,32^FB${usefulWidth},1,0,R^FD${this.escaparZpl(`PRODUTO: ${dados.produto}`)}^FS\n`;

    // 3. Data da ocorrência / recebimento (da direita para a esquerda)
    zpl += `^FO${startX},125^A0N,32,30^FB${usefulWidth},1,0,R^FD${this.escaparZpl(`DATA: ${dados.data}`)}^FS\n`;

    // 4. Texto AVARIA em tamanho significativamente maior, ocupando posição de destaque
    // Altura 92 dots, largura 88 dots, alinhado da direita para a esquerda na área útil
    zpl += `^FO${startX},215^A0N,96,92^FB${usefulWidth},1,0,R^FDAVARIA^FS\n`;

    // Quantidade de cópias
    zpl += `^PQ${copias},0,1,Y\n`;
    zpl += `^XZ\n`;

    return zpl;
  }

  /**
   * Gera HTML para Pré-Visualização e Impressão Térmica de Produto com Avaria
   * Respeita:
   * - Dimensão total: 10cm x 5cm (100mm x 50mm)
   * - Área útil de 8cm x 5cm (80mm x 50mm) começando da DIREITA para a ESQUERDA
   * - Área de 2cm reservada para logotipo (20mm) ao lado DIREITO (100% livre)
   * - Destaque máximo no texto "AVARIA"
   */
  gerarHtmlCriticaAvaria(
    dados: DadosEtiquetaCriticaAvaria,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const copias = Math.max(1, dados.copias || 1);

    const etiquetaHtml = `
      <div class="zebra-etiqueta-page zebra-avaria-page" style="
        width: ${config.larguraMm}mm;
        height: ${config.alturaMm}mm;
        max-width: ${config.larguraMm}mm;
        max-height: ${config.alturaMm}mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        background: #ffffff;
        color: #000000;
        overflow: hidden;
        page-break-after: always;
        font-family: Arial, Helvetica, sans-serif;
      ">
        <!-- 1. ÁREA ÚTIL DE IMPRESSÃO (8cm x 5cm = 80mm x 50mm): COMEÇA DA DIREITA PARA A ESQUERDA -->
        <div style="
          width: 80mm;
          min-width: 80mm;
          max-width: 80mm;
          height: 50mm;
          box-sizing: border-box;
          padding: 4mm 6mm 3mm 4mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: right;
          align-items: flex-end;
          overflow: hidden;
        ">
          <!-- Metadados: NF, Produto, Data (da direita para a esquerda) -->
          <div style="width: 100%; display: flex; flex-direction: column; gap: 1.5mm; text-align: right; align-items: flex-end;">
            <div style="
              width: 100%;
              font-size: 13pt;
              font-weight: 900;
              line-height: 1.15;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              color: #000000;
              text-align: right;
            ">
              NF: ${this.escaparHtml(dados.notaFiscal)}
            </div>
            <div style="
              width: 100%;
              font-size: 12pt;
              font-weight: 800;
              line-height: 1.15;
              text-transform: uppercase;
              letter-spacing: 0.2px;
              word-break: break-word;
              color: #000000;
              text-align: right;
            ">
              PRODUTO: ${this.escaparHtml(dados.produto)}
            </div>
            <div style="
              width: 100%;
              font-size: 11pt;
              font-weight: 700;
              line-height: 1.15;
              text-transform: uppercase;
              color: #000000;
              text-align: right;
            ">
              DATA: ${this.escaparHtml(dados.data)}
            </div>
          </div>

          <!-- Texto AVARIA em tamanho grande e com bastante destaque (alinhado da direita para a esquerda) -->
          <div style="
            width: 100%;
            text-align: right;
            padding-bottom: 2mm;
            padding-top: 1mm;
          ">
            <div style="
              font-family: 'Arial Black', Arial, sans-serif;
              font-size: 30pt;
              font-weight: 900;
              letter-spacing: 2px;
              line-height: 1;
              text-transform: uppercase;
              color: #000000;
              text-align: right;
            ">
              AVARIA
            </div>
          </div>
        </div>

        <!-- 2. ÁREA RESERVADA PARA O LOGOTIPO PRÉ-IMPRESSO (2cm = 20mm) AO LADO DIREITO -->
        <!-- Nada é impresso nesta coluna para não sobrepor o logotipo pré-impresso -->
        <div style="
          width: 20mm;
          min-width: 20mm;
          max-width: 20mm;
          height: 50mm;
          background: transparent;
          box-sizing: border-box;
        "></div>
      </div>
    `;

    return Array(copias).fill(etiquetaHtml).join('\n');
  }

  /**
   * Compõe o Numeral Identificador conforme regra estrita:
   * diamesnotafiscal000quantidadeproduto
   * DATA (DDMM) + NÚMERO DA NOTA FISCAL (apenas números) + 000 + QUANTIDADE DO PRODUTO (apenas números)
   * Exemplo: Data 04/10, NF 175850, Quantidade 12 -> 041017585000012
   */
  comporNumeralIdentificador(dataStr: string, nfStr: string, quantidade: number | string): string {
    let diaMes = '';
    if (dataStr) {
      const isoMatch = dataStr.match(/^\d{4}-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const [, mm, dd] = isoMatch;
        diaMes = `${dd}${mm}`;
      } else {
        const brMatch = dataStr.match(/^(\d{1,2})[/-](\d{1,2})/);
        if (brMatch) {
          const dd = brMatch[1].padStart(2, '0');
          const mm = brMatch[2].padStart(2, '0');
          diaMes = `${dd}${mm}`;
        }
      }
    }
    if (!diaMes) {
      const hoje = new Date();
      const dd = String(hoje.getDate()).padStart(2, '0');
      const mm = String(hoje.getMonth() + 1).padStart(2, '0');
      diaMes = `${dd}${mm}`;
    }

    const nfNumeros = (nfStr || '').replace(/\D/g, '') || '0';
    const qtdNum = Math.max(0, Math.round(Number(quantidade) || 0));

    return `${diaMes}${nfNumeros}000${qtdNum}`;
  }

  /**
   * Gera imagem Data URL do QR Code.
   * REGRA CRÍTICA: O conteúdo do QR Code contém SOMENTE o nome do produto.
   */
  async gerarQrCodeDataUrl(nomeProduto: string): Promise<string> {
    try {
      const texto = (nomeProduto || '').trim();
      return await QRCode.toDataURL(texto, {
        margin: 0,
        width: 160,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.warn('Erro ao gerar QR code data URL:', err);
      return '';
    }
  }

  /**
   * Gera código ZPL II para Etiqueta de Produto de Agendamento (Recebimento da Nota)
   * Hierarquia visual:
   * 1. ENDEREÇO — maior destaque da etiqueta (fonte grande)
   * 2. CONFERIDO — destaque visual secundário
   * 3. PRODUTO e NOTA FISCAL — mesmo tamanho de fonte
   * 4. QR CODE — leitura ótica com SOMENTE o nome do produto
   * 5. QUANTIDADE NÃO É EXIBIDA EM LINHA SEPARADA — codificada no numeral: diamesnotafiscal000quantidadeproduto
   * 6. NUMERAL IDENTIFICADOR — codificado no rodapé (diamesnotafiscal000quantidadeproduto)
   * Área útil 8cm x 5cm (640 dots) começando da DIREITA para a ESQUERDA
   * Logotipo pré-impresso ao lado DIREITO (2cm = 160 dots de 640 a 800) 100% livre
   */
  gerarZplProdutoAgendamento(
    dados: DadosEtiquetaProdutoAgendamento,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const copias = Math.max(1, dados.copias || 1);
    const dotsWidth = Math.round((config.larguraMm * config.densidadeDpi) / 25.4); // 800 dots
    const dotsHeight = Math.round((config.alturaMm * config.densidadeDpi) / 25.4); // 400 dots

    const startX = 20;
    const usefulWidth = 600; // Margem de segurança de ~20 dots antes do logotipo aos 640 dots

    let zpl = `^XA\n`;
    zpl += `^PW${dotsWidth}\n`;
    zpl += `^LL${dotsHeight}\n`;
    zpl += `^LH0,0\n`;
    zpl += `^CI28\n`; // Suporte UTF-8

    // 1. PRODUTO (Topo, tamanho 32x30, alinhado à direita da área útil antes do QR Code)
    zpl += `^FO${startX},25^A0N,32,30^FB${usefulWidth - 145},2,0,R^FD${this.escaparZpl(dados.produto)}^FS\n`;

    // 2. NOTA FISCAL (Mesmo tamanho de fonte do Produto: 32x30)
    zpl += `^FO${startX},95^A0N,32,30^FB${usefulWidth - 145},1,0,R^FD${this.escaparZpl(`NF: ${dados.notaFiscal}`)}^FS\n`;

    // 3. QR CODE (Contém SOMENTE o nome do produto - posicionado no quadrante superior direito da área útil)
    // ^BQ: normal orientation, model 2, magnification 4, error correction Q
    zpl += `^FO480,25^BQN,2,4,Q,7^FDQA,${this.escaparZpl(dados.produto.trim())}^FS\n`;

    // 4. CONFERIDO (Destaque secundário, claramente visível: 44x40)
    zpl += `^FO${startX},165^A0N,44,40^FB${usefulWidth},1,0,R^FDC O N F E R I D O^FS\n`;

    // 5. ENDEREÇO (MAIOR DESTAQUE DA ETIQUETA: 72x70)
    zpl += `^FO${startX},225^A0N,72,70^FB${usefulWidth},1,0,R^FD${this.escaparZpl(dados.endereco || 'SEM ENDEREÇO')}^FS\n`;

    // 6. LINHA DIVISÓRIA SUTIL ACIMA DO NUMERAL IDENTIFICADOR
    zpl += `^FO${startX},325^GB${usefulWidth},2,2^FS\n`;

    // 7. NUMERAL IDENTIFICADOR (Codifica diamesnotafiscal000quantidadeproduto com excelente legibilidade: 26x24)
    zpl += `^FO${startX},340^A0N,26,24^FB${usefulWidth},1,0,R^FD${this.escaparZpl(dados.numeralIdentificador)}^FS\n`;

    // Quantidade de cópias
    zpl += `^PQ${copias},0,1,Y\n`;
    zpl += `^XZ\n`;

    return zpl;
  }

  /**
   * Gera HTML de alta fidelidade para Pré-Visualização e Impressão Térmica de Produto de Agendamento
   * Respeita rigorosamente a hierarquia visual:
   * 1. ENDEREÇO — maior destaque da etiqueta
   * 2. CONFERIDO — destaque visual secundário
   * 3. PRODUTO e NOTA FISCAL — mesmo tamanho de fonte
   * 4. QR CODE — leitura ótica com SOMENTE o nome do produto
   * 5. QUANTIDADE NÃO É EXIBIDA EM LINHA SEPARADA — codificada no numeral: diamesnotafiscal000quantidadeproduto
   * 6. NUMERAL IDENTIFICADOR — codificado no rodapé (diamesnotafiscal000quantidadeproduto)
   */
  gerarHtmlProdutoAgendamento(
    dados: DadosEtiquetaProdutoAgendamento,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const copias = Math.max(1, dados.copias || 1);

    const qrCodeImg = dados.qrCodeDataUrl
      ? `<img src="${dados.qrCodeDataUrl}" alt="QR Code" style="width: 20mm; height: 20mm; object-fit: contain; display: block;" />`
      : `<div style="width: 20mm; height: 20mm; border: 1px dashed #000; display: flex; align-items: center; justify-content: center; font-size: 6pt; font-family: monospace;">QR CODE</div>`;

    const etiquetaHtml = `
      <div class="zebra-etiqueta-page zebra-produto-agendamento-page" style="
        width: ${config.larguraMm}mm;
        height: ${config.alturaMm}mm;
        max-width: ${config.larguraMm}mm;
        max-height: ${config.alturaMm}mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        background: #ffffff;
        color: #000000;
        overflow: hidden;
        page-break-after: always;
        font-family: Arial, Helvetica, sans-serif;
      ">
        <!-- 1. ÁREA ÚTIL DE IMPRESSÃO (8cm x 5cm = 80mm x 50mm): COMEÇA DA DIREITA PARA A ESQUERDA -->
        <div style="
          width: 80mm;
          min-width: 80mm;
          max-width: 80mm;
          height: 50mm;
          box-sizing: border-box;
          padding: 3mm 5mm 2.5mm 3.5mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: right;
          align-items: flex-end;
          overflow: hidden;
        ">
          <!-- Bloco Superior: Produto, NF e QR Code (Quantidade não exibida em linha separada) -->
          <div style="width: 100%; display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; gap: 2.5mm;">
            <!-- Informações textuais (Produto e NF) -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 1.5mm; text-align: right; min-width: 0;">
              <!-- PRODUTO (Mesmo tamanho de fonte da NF) -->
              <div style="
                font-size: 11pt;
                font-weight: 900;
                line-height: 1.15;
                text-transform: uppercase;
                letter-spacing: 0.2px;
                color: #000000;
                word-break: break-word;
              ">
                ${this.escaparHtml(dados.produto)}
              </div>

              <!-- NOTA FISCAL (Mesmo tamanho de fonte do Produto) -->
              <div style="
                font-size: 11pt;
                font-weight: 900;
                line-height: 1.15;
                text-transform: uppercase;
                letter-spacing: 0.2px;
                color: #000000;
              ">
                NF: ${this.escaparHtml(dados.notaFiscal)}
              </div>
            </div>

            <!-- QR Code (Contém SOMENTE o nome do produto) -->
            <div style="width: 20mm; height: 20mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              ${qrCodeImg}
            </div>
          </div>

          <!-- Bloco Intermediário: CONFERIDO (Destaque visual secundário) -->
          <div style="width: 100%; text-align: right; padding-top: 1mm; padding-bottom: 0.5mm;">
            <div style="
              font-family: 'Arial Black', Arial, sans-serif;
              font-size: 14pt;
              font-weight: 900;
              letter-spacing: 2px;
              line-height: 1;
              text-transform: uppercase;
              color: #000000;
            ">
              C O N F E R I D O
            </div>
          </div>

          <!-- Bloco Principal: ENDEREÇO (MAIOR DESTAQUE VISUAL DA ETIQUETA) -->
          <div style="width: 100%; text-align: right; padding-bottom: 0.5mm;">
            <div style="
              font-family: 'Arial Black', Arial, sans-serif;
              font-size: 22pt;
              font-weight: 900;
              letter-spacing: 0.8px;
              line-height: 1.05;
              text-transform: uppercase;
              color: #000000;
              word-break: break-word;
            ">
              ${this.escaparHtml(dados.endereco || 'SEM ENDEREÇO')}
            </div>
          </div>

          <!-- Bloco Inferior: NUMERAL IDENTIFICADOR (Codifica diamesnotafiscal000quantidadeproduto) -->
          <div style="
            width: 100%;
            border-top: 1.5px solid #000000;
            padding-top: 1mm;
            text-align: right;
            font-family: 'Courier New', Courier, monospace;
            font-size: 9.5pt;
            font-weight: 900;
            letter-spacing: 1.8px;
            color: #000000;
          ">
            ${this.escaparHtml(dados.numeralIdentificador)}
          </div>
        </div>

        <!-- 2. ÁREA RESERVADA PARA O LOGOTIPO PRÉ-IMPRESSO (2cm = 20mm) AO LADO DIREITO -->
        <!-- Nada é impresso nesta coluna para não sobrepor o logotipo pré-impresso -->
        <div style="
          width: 20mm;
          min-width: 20mm;
          max-width: 20mm;
          height: 50mm;
          background: transparent;
          box-sizing: border-box;
        "></div>
      </div>
    `;

    return Array(copias).fill(etiquetaHtml).join('\n');
  }

  /**
   * -------------------------------------------------------------
   * ETIQUETA AVULSA — IDENTIFICAÇÃO DO PRODUTO (CADASTRO > PRODUTOS)
   * Utilizada SOMENTE para identificação do produto.
   * Conteúdo: Exclusivamente a DESCRIÇÃO DO PRODUTO.
   * Sem Avaria, sem Bloqueado, sem Data, sem Quantidade, sem Código adicional, sem NF.
   * Área útil 8cm x 5cm (640 dots) começando da DIREITA para a ESQUERDA
   * Logotipo pré-impresso ao lado DIREITO (2cm = 160 dots de 640 a 800) 100% livre
   * -------------------------------------------------------------
   */
  gerarZplProdutoAvulso(
    dados: DadosEtiquetaProdutoAvulso,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const copias = Math.max(1, dados.copias || 1);
    const dotsWidth = Math.round((config.larguraMm * config.densidadeDpi) / 25.4); // 800 dots
    const dotsHeight = Math.round((config.alturaMm * config.densidadeDpi) / 25.4); // 400 dots

    const startX = 20;
    const usefulWidth = 600; // Margem de segurança de ~20 dots antes do logotipo aos 640 dots

    let zpl = `^XA\n`;
    zpl += `^PW${dotsWidth}\n`;
    zpl += `^LL${dotsHeight}\n`;
    zpl += `^LH0,0\n`;
    zpl += `^CI28\n`; // Suporte UTF-8

    const texto = this.escaparZpl((dados.produto || '').trim().toUpperCase());
    const endTexto = (dados.endereco || '').trim().toUpperCase();
    const len = texto.length;

    if (endTexto) {
      // 1. Descrição do Produto (Bloco superior)
      let fontH = 38;
      let fontW = 34;
      let lines = 3;
      let posY = 35;

      if (len <= 30) {
        fontH = 46;
        fontW = 42;
        lines = 2;
        posY = 45;
      } else if (len <= 65) {
        fontH = 36;
        fontW = 32;
        lines = 3;
        posY = 35;
      } else {
        fontH = 26;
        fontW = 22;
        lines = 4;
        posY = 25;
      }
      zpl += `^FO${startX},${posY}^A0N,${fontH},${fontW}^FB${usefulWidth},${lines},0,R^FD${texto}^FS\n`;

      // 2. Linha divisória
      zpl += `^FO${startX},210^GB${usefulWidth},2,2^FS\n`;

      // 3. Rótulo ENDEREÇO
      zpl += `^FO${startX},225^A0N,20,18^FB${usefulWidth},1,0,R^FDENDERECO^FS\n`;

      // 4. Valor do Endereço (Grande destaque visual)
      const lenEnd = endTexto.length;
      const fontEndH = lenEnd > 14 ? 50 : 64;
      const fontEndW = lenEnd > 14 ? 46 : 60;
      zpl += `^FO${startX},255^A0N,${fontEndH},${fontEndW}^FB${usefulWidth},1,0,R^FD${this.escaparZpl(endTexto)}^FS\n`;
    } else {
      // Layout sem endereço: ocupa o centro da etiqueta
      let fontH = 44;
      let fontW = 40;
      let lines = 3;
      let posY = 130;

      if (len <= 25) {
        fontH = 60;
        fontW = 56;
        lines = 2;
        posY = 145;
      } else if (len <= 55) {
        fontH = 46;
        fontW = 42;
        lines = 3;
        posY = 120;
      } else if (len <= 110) {
        fontH = 34;
        fontW = 30;
        lines = 5;
        posY = 85;
      } else {
        fontH = 26;
        fontW = 22;
        lines = 7;
        posY = 55;
      }
      zpl += `^FO${startX},${posY}^A0N,${fontH},${fontW}^FB${usefulWidth},${lines},0,R^FD${texto}^FS\n`;
    }

    zpl += `^PQ${copias},0,1,Y\n`;
    zpl += `^XZ\n`;

    return zpl;
  }

  gerarHtmlProdutoAvulso(
    dados: DadosEtiquetaProdutoAvulso,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const copias = Math.max(1, dados.copias || 1);
    const texto = (dados.produto || '').trim();
    const endTexto = (dados.endereco || '').trim();
    const len = texto.length;

    let fontSizePt = '18pt';
    if (endTexto) {
      if (len <= 30) {
        fontSizePt = '18pt';
      } else if (len <= 65) {
        fontSizePt = '14pt';
      } else {
        fontSizePt = '11.5pt';
      }
    } else {
      if (len <= 25) {
        fontSizePt = '25pt';
      } else if (len <= 55) {
        fontSizePt = '18pt';
      } else if (len <= 110) {
        fontSizePt = '13.5pt';
      } else {
        fontSizePt = '11pt';
      }
    }

    const etiquetaHtml = `
      <div class="zebra-etiqueta-page zebra-produto-avulso-page" style="
        width: ${config.larguraMm}mm;
        height: ${config.alturaMm}mm;
        max-width: ${config.larguraMm}mm;
        max-height: ${config.alturaMm}mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        background: #ffffff;
        color: #000000;
        overflow: hidden;
        page-break-after: always;
        font-family: Arial, Helvetica, sans-serif;
      ">
        <!-- 1. ÁREA ÚTIL DE IMPRESSÃO (8cm x 5cm = 80mm x 50mm): COMEÇA DA DIREITA PARA A ESQUERDA -->
        <div style="
          width: 80mm;
          min-width: 80mm;
          max-width: 80mm;
          height: 50mm;
          box-sizing: border-box;
          padding: 4mm 6mm 3.5mm 4mm;
          display: flex;
          flex-direction: column;
          justify-content: ${endTexto ? 'space-between' : 'center'};
          text-align: right;
          align-items: flex-end;
          overflow: hidden;
        ">
          <!-- Descrição do Produto -->
          <div style="
            width: 100%;
            font-size: ${fontSizePt};
            font-weight: 900;
            line-height: 1.2;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #000000;
            word-break: break-word;
          ">
            ${this.escaparHtml(texto)}
          </div>

          ${endTexto ? `
            <div style="width: 100%; border-top: 1.5px solid #000000; margin: 1mm 0 0.5mm 0;"></div>
            <div style="width: 100%; text-align: right;">
              <div style="font-size: 7.5pt; font-weight: 700; color: #475569; letter-spacing: 1px; text-transform: uppercase; line-height: 1;">
                ENDEREÇO
              </div>
              <div style="
                font-family: 'Arial Black', Arial, sans-serif;
                font-size: ${endTexto.length > 12 ? '17pt' : '22pt'};
                font-weight: 900;
                line-height: 1.05;
                letter-spacing: 0.5px;
                color: #000000;
                word-break: break-word;
                text-transform: uppercase;
              ">
                ${this.escaparHtml(endTexto)}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- 2. ÁREA RESERVADA PARA O LOGOTIPO PRÉ-IMPRESSO (2cm = 20mm) AO LADO DIREITO -->
        <div style="
          width: 20mm;
          min-width: 20mm;
          max-width: 20mm;
          height: 50mm;
          background: transparent;
          box-sizing: border-box;
        "></div>
      </div>
    `;

    return Array(copias).fill(etiquetaHtml).join('\n');
  }

  /**
   * -------------------------------------------------------------
   * ETIQUETA DE AVARIA (CADASTRO > PRODUTOS)
   * Conteúdo:
   * - PRODUTO (identificação do campo)
   * - Descrição do produto (segundo destaque)
   * - Data da impressão (gerada automaticamente se não fornecida, menor destaque)
   * - AVARIA (maior destaque da etiqueta)
   * - BLOQUEADO (se marcado como bloqueada, destaque visual enfático)
   * Área útil 8cm x 5cm (640 dots) da DIREITA para a ESQUERDA
   * 2cm livres à direita para logotipo pré-impresso
   * -------------------------------------------------------------
   */
  gerarZplProdutoAvaria(
    dados: DadosEtiquetaProdutoAvaria,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const copias = Math.max(1, dados.copias || 1);
    const dotsWidth = Math.round((config.larguraMm * config.densidadeDpi) / 25.4); // 800
    const dotsHeight = Math.round((config.alturaMm * config.densidadeDpi) / 25.4); // 400

    const startX = 20;
    const usefulWidth = 600;

    let zpl = `^XA\n`;
    zpl += `^PW${dotsWidth}\n`;
    zpl += `^LL${dotsHeight}\n`;
    zpl += `^LH0,0\n`;
    zpl += `^CI28\n`; // Suporte UTF-8

    const dataStr = dados.data || new Date().toLocaleDateString('pt-BR');
    const bloqueado = Boolean(dados.bloqueado);
    const prodTexto = (dados.produto || '').trim().toUpperCase();
    const lenProd = prodTexto.length;

    // 1. Identificador do campo: "PRODUTO"
    zpl += `^FO${startX},20^A0N,20,18^FB${usefulWidth},1,0,R^FDPRODUTO^FS\n`;

    // 2. Descrição do Produto (Segundo destaque)
    const fontH = lenProd > 50 ? 26 : 32;
    const fontW = lenProd > 50 ? 24 : 30;
    const lines = lenProd > 50 ? 3 : 2;
    zpl += `^FO${startX},45^A0N,${fontH},${fontW}^FB${usefulWidth},${lines},0,R^FD${this.escaparZpl(prodTexto)}^FS\n`;

    // 3. Data de impressão (Menor destaque)
    zpl += `^FO${startX},115^A0N,20,18^FB${usefulWidth},1,0,R^FDDATA: ${this.escaparZpl(dataStr)}^FS\n`;

    // 4. Linha divisória sutil
    zpl += `^FO${startX},145^GB${usefulWidth},2,2^FS\n`;

    // 5. "AVARIA" (Maior destaque da etiqueta)
    if (bloqueado) {
      zpl += `^FO${startX},165^A0N,64,60^FB${usefulWidth},1,0,R^FDAVARIA^FS\n`;
      // 6. "BLOQUEADO" (Destaque visual enfático)
      zpl += `^FO${startX},260^A0N,44,40^FB${usefulWidth},1,0,R^FD[ BLOQUEADO ]^FS\n`;
    } else {
      zpl += `^FO${startX},195^A0N,80,75^FB${usefulWidth},1,0,R^FDAVARIA^FS\n`;
    }

    zpl += `^PQ${copias},0,1,Y\n`;
    zpl += `^XZ\n`;

    return zpl;
  }

  gerarHtmlProdutoAvaria(
    dados: DadosEtiquetaProdutoAvaria,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): string {
    const copias = Math.max(1, dados.copias || 1);
    const dataStr = dados.data || new Date().toLocaleDateString('pt-BR');
    const bloqueado = Boolean(dados.bloqueado);
    const prodTexto = (dados.produto || '').trim();
    const lenProd = prodTexto.length;
    const fontProdSize = lenProd > 60 ? '11.5pt' : lenProd > 35 ? '13pt' : '14.5pt';

    const etiquetaHtml = `
      <div class="zebra-etiqueta-page zebra-produto-avaria-page" style="
        width: ${config.larguraMm}mm;
        height: ${config.alturaMm}mm;
        max-width: ${config.larguraMm}mm;
        max-height: ${config.alturaMm}mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        background: #ffffff;
        color: #000000;
        overflow: hidden;
        page-break-after: always;
        font-family: Arial, Helvetica, sans-serif;
      ">
        <!-- 1. ÁREA ÚTIL DE IMPRESSÃO (8cm x 5cm = 80mm x 50mm): COMEÇA DA DIREITA PARA A ESQUERDA -->
        <div style="
          width: 80mm;
          min-width: 80mm;
          max-width: 80mm;
          height: 50mm;
          box-sizing: border-box;
          padding: 3.5mm 5.5mm 3.5mm 3.5mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: right;
          align-items: flex-end;
          overflow: hidden;
        ">
          <!-- Topo: Campo PRODUTO + Descrição + Data -->
          <div style="width: 100%; display: flex; flex-direction: column; gap: 0.8mm; text-align: right; min-width: 0;">
            <div style="
              font-size: 8pt;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
              color: #475569;
              line-height: 1;
            ">
              PRODUTO
            </div>
            <div style="
              font-size: ${fontProdSize};
              font-weight: 900;
              line-height: 1.15;
              text-transform: uppercase;
              letter-spacing: 0.2px;
              color: #000000;
              word-break: break-word;
            ">
              ${this.escaparHtml(prodTexto)}
            </div>
            <div style="
              font-size: 8.5pt;
              font-weight: 700;
              line-height: 1.2;
              text-transform: uppercase;
              color: #1e293b;
              margin-top: 0.5mm;
            ">
              DATA: ${this.escaparHtml(dataStr)}
            </div>
          </div>

          <!-- Linha Divisória -->
          <div style="width: 100%; border-top: 1.5px solid #000000; margin: 1mm 0;"></div>

          <!-- Bloco Principal: AVARIA (Maior Destaque) e BLOQUEADO (se marcado) -->
          <div style="width: 100%; text-align: right; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 1mm;">
            <div style="
              font-family: 'Arial Black', Arial, sans-serif;
              font-size: ${bloqueado ? '26pt' : '32pt'};
              font-weight: 900;
              letter-spacing: 3px;
              line-height: 1;
              text-transform: uppercase;
              color: #000000;
            ">
              AVARIA
            </div>
            ${bloqueado ? `
              <div style="
                font-family: 'Arial Black', Arial, sans-serif;
                font-size: 13pt;
                font-weight: 900;
                letter-spacing: 2px;
                text-transform: uppercase;
                background: #000000;
                color: #ffffff;
                padding: 1mm 3mm;
                border-radius: 2px;
                line-height: 1;
                display: inline-block;
              ">
                BLOQUEADO
              </div>
            ` : ''}
          </div>
        </div>

        <!-- 2. ÁREA RESERVADA PARA O LOGOTIPO PRÉ-IMPRESSO (2cm = 20mm) AO LADO DIREITO -->
        <div style="
          width: 20mm;
          min-width: 20mm;
          max-width: 20mm;
          height: 50mm;
          background: transparent;
          box-sizing: border-box;
        "></div>
      </div>
    `;

    return Array(copias).fill(etiquetaHtml).join('\n');
  }

  /**
   * Imprime um lote de etiquetas de produtos (por exemplo, todas as linhas de produtos de uma Nota Fiscal)
   * Gera todas as páginas em uma única fila de impressão Zebra e concatena o ZPL correspondente
   */
  async imprimirLoteProdutosAgendamento(
    loteDados: DadosEtiquetaProdutoAgendamento[],
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): Promise<ResultadoImpressao> {
    try {
      if (!loteDados || loteDados.length === 0) {
        return {
          sucesso: false,
          mensagem: 'Nenhum produto fornecido para impressão em lote.',
        };
      }

      // Prepara dados de cada etiqueta assincronamente (QR codes e numerais)
      const dadosPreparados: DadosEtiquetaProdutoAgendamento[] = await Promise.all(
        loteDados.map(async (item) => {
          let qrCode = item.qrCodeDataUrl;
          if (!qrCode && item.produto) {
            qrCode = await this.gerarQrCodeDataUrl(item.produto);
          }
          let numeral = item.numeralIdentificador;
          if (!numeral) {
            numeral = this.comporNumeralIdentificador(item.data, item.notaFiscal, item.quantidade);
          }
          return {
            ...item,
            qrCodeDataUrl: qrCode,
            numeralIdentificador: numeral,
          };
        })
      );

      // Concatena HTML de todas as etiquetas
      const conteudoHtml = dadosPreparados
        .map((item) => this.gerarHtmlProdutoAgendamento(item, config))
        .join('\n');

      // Concatena ZPL de todas as etiquetas
      const zplLote = dadosPreparados
        .map((item) => this.gerarZplProdutoAgendamento(item, config))
        .join('\n');

      const folhaCss = `
        @page {
          size: ${config.larguraMm}mm ${config.alturaMm}mm;
          margin: 0mm;
        }
        @media print {
          html, body {
            width: ${config.larguraMm}mm;
            height: ${config.alturaMm}mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .zebra-etiqueta-page {
            page-break-after: always;
            box-shadow: none !important;
            border: none !important;
          }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          background: #ffffff;
          font-family: Arial, Helvetica, sans-serif;
        }
      `;

      // Cria um iframe invisível para envio direto à impressora
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Falha ao inicializar o canal de impressão.');
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>PoliHub — Impressão Zebra Lote (${dadosPreparados.length} Etiquetas)</title>
            <style>${folhaCss}</style>
          </head>
          <body>
            ${conteudoHtml}
          </body>
        </html>
      `);
      doc.close();

      // Aguarda renderização dos estilos e imagens
      await new Promise((resolve) => setTimeout(resolve, 450));

      const win = iframe.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }

      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 6000);

      return {
        sucesso: true,
        mensagem: `${dadosPreparados.length} etiqueta(s) enviada(s) para impressão Zebra com sucesso.`,
        zplGerado: zplLote,
      };
    } catch (err: any) {
      console.error('[ZebraPrintService] Erro ao imprimir lote:', err);
      return {
        sucesso: false,
        mensagem: `Erro na impressão do lote: ${err?.message || 'Falha desconhecida.'}`,
      };
    }
  }

  /**
   * Imprime a etiqueta utilizando uma janela ou iframe isolado com regras CSS @page 100mm x 50mm
   */
  async imprimirEtiqueta(
    tipo: TipoModeloEtiqueta,
    dados: any,
    config: ConfiguracaoEtiquetaZebra = CONFIG_PADRAO_ZEBRA
  ): Promise<ResultadoImpressao> {
    try {
      let conteudoHtml = '';
      let zpl: string | undefined = undefined;

      if (tipo === 'coleta') {
        conteudoHtml = this.gerarHtmlColeta(dados as DadosEtiquetaColeta, config);
        zpl = this.gerarZplColeta(dados as DadosEtiquetaColeta, config);
      } else if (tipo === 'critica_avaria') {
        conteudoHtml = this.gerarHtmlCriticaAvaria(dados as DadosEtiquetaCriticaAvaria, config);
        zpl = this.gerarZplCriticaAvaria(dados as DadosEtiquetaCriticaAvaria, config);
      } else if (tipo === 'produto_agendamento') {
        // Assegura que o QR Code data URL foi gerado
        if (!dados.qrCodeDataUrl && dados.produto) {
          dados.qrCodeDataUrl = await this.gerarQrCodeDataUrl(dados.produto);
        }
        // Assegura que o Numeral Identificador foi composto
        if (!dados.numeralIdentificador) {
          dados.numeralIdentificador = this.comporNumeralIdentificador(
            dados.data,
            dados.notaFiscal,
            dados.quantidade
          );
        }
        conteudoHtml = this.gerarHtmlProdutoAgendamento(dados as DadosEtiquetaProdutoAgendamento, config);
        zpl = this.gerarZplProdutoAgendamento(dados as DadosEtiquetaProdutoAgendamento, config);
      } else if (tipo === 'produto_avulso') {
        conteudoHtml = this.gerarHtmlProdutoAvulso(dados as DadosEtiquetaProdutoAvulso, config);
        zpl = this.gerarZplProdutoAvulso(dados as DadosEtiquetaProdutoAvulso, config);
      } else if (tipo === 'produto_avaria') {
        conteudoHtml = this.gerarHtmlProdutoAvaria(dados as DadosEtiquetaProdutoAvaria, config);
        zpl = this.gerarZplProdutoAvaria(dados as DadosEtiquetaProdutoAvaria, config);
      } else {
        return {
          sucesso: false,
          mensagem: `Modelo de etiqueta "${tipo}" ainda não implementado.`,
        };
      }

      const folhaCss = `
        @page {
          size: ${config.larguraMm}mm ${config.alturaMm}mm;
          margin: 0mm;
        }
        @media print {
          html, body {
            width: ${config.larguraMm}mm;
            height: ${config.alturaMm}mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .zebra-etiqueta-page {
            page-break-after: always;
            box-shadow: none !important;
            border: none !important;
          }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          background: #ffffff;
          font-family: Arial, Helvetica, sans-serif;
        }
      `;

      // Cria um iframe invisível para envio direto à impressora
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Falha ao inicializar o canal de impressão.');
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>PoliHub — Impressão Zebra (${tipo.toUpperCase()})</title>
            <style>${folhaCss}</style>
          </head>
          <body>
            ${conteudoHtml}
          </body>
        </html>
      `);
      doc.close();

      // Aguarda renderização dos estilos e executa a impressão
      await new Promise((resolve) => setTimeout(resolve, 350));

      const win = iframe.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }

      // Limpeza do iframe após a impressão
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // ignora caso já tenha sido removido
        }
      }, 5000);

      return {
        sucesso: true,
        mensagem: 'Etiqueta enviada para impressão Zebra com sucesso.',
        zplGerado: zpl,
      };
    } catch (err: any) {
      console.error('[ZebraPrintService] Erro ao imprimir:', err);
      return {
        sucesso: false,
        mensagem: `Erro na impressão: ${err?.message || 'Falha desconhecida.'}`,
      };
    }
  }

  /**
   * Permite copiar o código ZPL para a área de transferência
   */
  async copiarZpl(zpl: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(zpl);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[ZebraPrintService] Erro ao copiar ZPL:', e);
      return false;
    }
  }

  /**
   * Permite baixar um arquivo .zpl para envio via linha de comando ou utilitários Zebra
   */
  baixarArquivoZpl(nomeArquivo: string, zpl: string): void {
    const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo.endsWith('.zpl') ? nomeArquivo : `${nomeArquivo}.zpl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private escaparZpl(texto: string): string {
    return (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos para compatibilidade com fontes ZPL nativas padrão A0
      .replace(/[\^~]/g, '');
  }

  private escaparHtml(texto: string): string {
    return (texto || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const zebraPrintService = new ZebraPrintService();
