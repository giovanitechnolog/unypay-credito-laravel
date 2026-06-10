<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Regra de validação de CPF (algoritmo oficial dos dois dígitos verificadores
 * da Receita Federal). Aceita CPF com ou sem máscara — extrai apenas dígitos
 * antes de validar. Mensagem padrão em PT-BR.
 *
 * Uso:
 *   'cpf' => ['nullable', 'string', new \App\Rules\Cpf()]
 */
class Cpf implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // 1) Normalização: aceita máscara (000.000.000-00) ou só dígitos.
        $digits = preg_replace('/\D/', '', (string) $value);

        // 2) Tem que ter exatamente 11 dígitos.
        if (strlen($digits) !== 11) {
            $fail('O CPF informado é inválido.');
            return;
        }

        // 3) Rejeita sequências triviais (11111111111, 22222222222...) que
        //    matematicamente passariam no DV mas não são CPFs reais.
        if (preg_match('/^(\d)\1{10}$/', $digits)) {
            $fail('O CPF informado é inválido.');
            return;
        }

        // 4) Algoritmo dos dois dígitos verificadores.
        for ($t = 9; $t < 11; $t++) {
            $sum = 0;
            for ($i = 0; $i < $t; $i++) {
                $sum += ((int) $digits[$i]) * (($t + 1) - $i);
            }
            $rest = ($sum * 10) % 11;
            if ($rest === 10) {
                $rest = 0;
            }
            if ($rest !== (int) $digits[$t]) {
                $fail('O CPF informado é inválido.');
                return;
            }
        }
    }
}
