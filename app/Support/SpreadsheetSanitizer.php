<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Helpers de normalização para dados sujos vindos das planilhas dos clientes.
 *
 * Cada método aqui deve ser pequeno, puro (sem efeitos colaterais) e testável
 * isoladamente. A regra geral: receber qualquer formato razoável e devolver o
 * formato canônico que o banco aceita.
 */
class SpreadsheetSanitizer
{
    /**
     * Converte qualquer representação em decimal (BR ou EN). Aceita:
     *  - "R$ 1.234,56" -> 1234.56
     *  - "1234,56"     -> 1234.56
     *  - "1234.56"     -> 1234.56
     *  - 1234.56 (float/int)
     *  - "" / null     -> $default
     */
    public static function toDecimal(mixed $value, float $default = 0.0): float
    {
        if ($value === null || $value === '') {
            return $default;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }

        $s = trim((string) $value);
        $s = preg_replace('/[^\d,.\-]/u', '', $s);

        if ($s === '' || $s === '-' || $s === null) {
            return $default;
        }

        $hasComma = str_contains($s, ',');
        $hasDot   = str_contains($s, '.');

        if ($hasComma && $hasDot) {
            // Formato BR: ponto = milhar, vírgula = decimal -> "1.234,56"
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
        } elseif ($hasComma) {
            $s = str_replace(',', '.', $s);
        }

        return is_numeric($s) ? (float) $s : $default;
    }

    /**
     * Converte uma taxa em fração decimal padrão do banco. Hierárquica:
     *  - "2,00%" / "10%"          -> 0.02 / 0.10
     *  - 2 (interpretado como 2%) -> 0.02
     *  - 0.02                     -> 0.02 (já em fração)
     *
     * Regra: se o valor decimal for > 1, assume percentual e divide por 100.
     */
    public static function toRate(mixed $value, float $default = 0.0): float
    {
        if ($value === null || $value === '') {
            return $default;
        }
        $raw = is_string($value) ? trim($value) : $value;
        $hasPercentSign = is_string($raw) && str_contains($raw, '%');

        $decimal = self::toDecimal($raw, $default);

        if ($hasPercentSign || $decimal > 1) {
            return $decimal / 100.0;
        }
        return $decimal;
    }

    /**
     * Converte qualquer formato de data em string Y-m-d. Aceita:
     *  - DateTime / Carbon
     *  - Float "Excel serial" (43831, etc.)
     *  - "2024-09-10 00:00:00"
     *  - "10/09/2024"
     *  - null/"" -> null
     */
    public static function toDate(mixed $value): ?string
    {
        if ($value === null || $value === '' || $value === '-') {
            return null;
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (is_numeric($value)) {
            try {
                return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d');
            } catch (\Throwable) {
                // Cai no parse abaixo
            }
        }
        $s = trim((string) $value);
        // Remove qualquer "00:00:00" residual antes de tentar parsear
        $s = preg_replace('/\s+\d{1,2}:\d{2}(:\d{2})?$/', '', $s);

        try {
            // Carbon tenta vários formatos. Para BR (dd/mm/aaaa) usamos createFromFormat
            if (preg_match('#^\d{1,2}/\d{1,2}/\d{4}$#', $s)) {
                return Carbon::createFromFormat('d/m/Y', $s)->format('Y-m-d');
            }
            return Carbon::parse($s)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Reconhece SIM / NÃO / true / 1 / yes etc. e devolve bool.
     */
    public static function toBool(mixed $value, bool $default = false): bool
    {
        if ($value === null || $value === '') {
            return $default;
        }
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return (float) $value != 0.0;
        }
        $s = mb_strtolower(trim((string) $value));
        return in_array($s, ['sim', 's', 'yes', 'y', 'true', 't', '1', 'verdadeiro'], true);
    }

    /**
     * Mapeia o texto da coluna "Base multa" para o enum aceito pelo banco.
     */
    public static function mapPenaltyBase(?string $raw): string
    {
        $s = mb_strtolower(trim((string) $raw));
        return match (true) {
            str_contains($s, 'parcela')                          => 'installment',
            str_contains($s, 'débito') || str_contains($s, 'debito') => 'debt',
            str_contains($s, 'contrato')                         => 'contract',
            default                                              => 'installment',
        };
    }

    /**
     * Mapeia o texto da coluna "Status origem" para o enum da tabela installments.
     */
    public static function mapInstallmentStatus(?string $raw): string
    {
        $s = mb_strtolower(trim((string) $raw));
        if ($s === '') {
            return 'A vencer';
        }
        return match (true) {
            str_contains($s, 'parcial')   => 'Pago parcial',
            $s === 'pago'                 => 'Pago',
            str_contains($s, 'pago')      => 'Pago',
            str_contains($s, 'vencido')   => 'Vencido',
            str_contains($s, 'atras')     => 'Vencido',
            str_contains($s, 'aberto')    => 'A vencer',
            default                       => 'A vencer',
        };
    }

    /**
     * Normaliza um nome de cliente para servir de chave de upsert.
     * Tira acentos, baixa para minúsculas, colapsa espaços e remove pontos finais.
     */
    public static function normalizeName(string $name): string
    {
        $n = trim($name);
        $n = Str::ascii($n);
        $n = mb_strtolower($n);
        $n = preg_replace('/\s+/u', ' ', $n);
        $n = rtrim($n, '.');
        return $n;
    }

    /**
     * Heurística simples PF vs PJ baseada em sufixos comuns da razão social.
     */
    public static function inferPersonType(string $name): string
    {
        $haystack = mb_strtolower($name);
        // Delimitador "#" para não conflitar com o "/" do padrão "s/a".
        $patterns = ['ltda', 's\.?\s*a\.?', 's/a', 'eireli', '\bmei\b', '\bepp\b', '\bme\b', 'associa'];
        foreach ($patterns as $p) {
            if (preg_match("#{$p}#u", $haystack)) {
                return 'PJ';
            }
        }
        return 'PF';
    }

    /**
     * Verifica se a linha da planilha é "vazia o suficiente" para ser ignorada
     * (todas as células vazias ou contendo o texto "Totais").
     */
    public static function isMeaninglessRow(array $row, array $keyCols = []): bool
    {
        if ($keyCols !== []) {
            foreach ($keyCols as $col) {
                $v = $row[$col] ?? null;
                if ($v !== null && trim((string) $v) !== '') {
                    if (mb_strtolower(trim((string) $v)) === 'totais') {
                        return true;
                    }
                    return false;
                }
            }
            return true;
        }
        foreach ($row as $v) {
            if ($v !== null && trim((string) $v) !== '') {
                return false;
            }
        }
        return true;
    }
}
