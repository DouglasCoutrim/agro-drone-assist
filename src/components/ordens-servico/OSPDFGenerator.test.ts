// @ts-nocheck
import { describe, expect, it } from 'bun:test';
import { generateOSPDF } from './OSPDFGenerator';

describe('OS print and sharing HTML', () => {
  it('escapes hostile stored text in both shared and printed documents', () => {
    const attack = '<img src=x onerror="window.pwned=1"><script>window.pwned=1</script>';
    const html = generateOSPDF({ numero: attack, status: 'aberta', descricao_problema: attack,
      diagnostico: attack, modelo_equipamento: attack, clientes: { nome: attack },
      observacoes: '', data_entrada: null } as any,
      [{ descricao: attack, codigo: attack, quantidade: 1, valor_total: 10 }],
      { nome_empresa: attack, logo_url: 'https://example.test/logo.png" onerror="window.pwned=1' } as any, attack);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>window.pwned');
    expect(html).not.toContain('src="https://example.test/logo.png" onerror=');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('&quot; onerror=&quot;');
  });
  it('preserves ordinary text, accents, layout and print behavior', () => {
    const html = generateOSPDF({ numero: 'OS-1', status: 'aberta', descricao_problema: 'Bateria & conexão',
      observacoes: '', clientes: { nome: 'João' }, data_entrada: null } as any, [],
      { nome_empresa: 'Oficina' } as any);
    expect(html).toContain('Bateria &amp; conexão');
    expect(html).toContain('João'); expect(html).toContain('window.print()');
  });
});