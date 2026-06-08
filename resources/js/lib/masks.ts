/** Máscara dinâmica de telefone brasileiro: fixo (10 dígitos) ou celular (11 dígitos). */
export const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 14);
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .substring(0, 15);
};
