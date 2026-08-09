// CPF/CNPJ formatting and validation
export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  // CNPJ: 00.000.000/0000-00
  return digits
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (parseInt(digits[9]) !== check) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return parseInt(digits[10]) === check;
}

export function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(digits[12]) !== check) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return parseInt(digits[13]) === check;
}

export function validateCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return validateCpf(digits);
  if (digits.length === 14) return validateCnpj(digits);
  return false;
}

export function formatCurrency(value: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pt-BR');
}

export function getErrorMessage(error: any): string {
  const raw = typeof error === 'string' ? error : (error?.message || '');
  const msg = raw.toLowerCase();
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) return 'Este registro já está cadastrado (valor duplicado).';
  if (msg.includes('foreign key')) return 'Não é possível concluir: há registros vinculados a este item.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Sem conexão. Verifique sua internet e tente novamente.';
  if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('rls') || msg.includes('policy')) {
    return 'Erro de permissão. Sua conta pode não ter acesso a esta ação.';
  }
  if (msg.includes('invalid input syntax for type uuid')) return 'Um campo de seleção ficou vazio ou inválido. Revise os campos e tente novamente.';
  if (msg.includes('invalid input value for enum')) return 'Um dos valores selecionados não é aceito pelo sistema. Tente outra opção.';
  if (msg.includes('violates not-null')) return 'Um campo obrigatório ficou em branco. Revise o formulário.';
  // Mensagens próprias do app (lançadas com new Error) devem aparecer como estão
  if (raw && raw.length < 200) return raw;
  return 'Algo deu errado. Tente novamente em instantes.';
}

