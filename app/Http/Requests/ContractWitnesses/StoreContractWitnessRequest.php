<?php

namespace App\Http\Requests\ContractWitnesses;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Valida UMA testemunha de contrato (nome + CPF).
 *
 * 💡 Uso na prática:
 *   1. Como FormRequest tradicional em rota dedicada (testes isolados).
 *   2. Como provedor de regras estáticas para o ContractController, que
 *      recebe `witnesses[]` (JSON no FormData) e monta rules para cada índice.
 */
class StoreContractWitnessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(self::normalize($this->all()));
    }

    public function rules(): array
    {
        return self::rulesFor();
    }

    public function messages(): array
    {
        return self::messagesFor();
    }

    public static function rulesFor(string $prefix = ''): array
    {
        $p = $prefix === '' ? '' : rtrim($prefix, '.') . '.';

        return [
            "{$p}name" => ['required', 'string', 'max:255'],
            "{$p}cpf"  => ['required', 'string', 'size:11', 'max:14'],
        ];
    }

    public static function messagesFor(string $prefix = ''): array
    {
        $p = $prefix === '' ? '' : rtrim($prefix, '.') . '.';

        return [
            "{$p}name.required" => 'Informe o nome da testemunha.',
            "{$p}name.max"      => 'O nome da testemunha não pode ultrapassar 255 caracteres.',
            "{$p}cpf.required"  => 'Informe o CPF da testemunha.',
            "{$p}cpf.size"      => 'O CPF deve conter 11 dígitos numéricos.',
        ];
    }

    /**
     * Normaliza CPF (apenas dígitos) e trim no nome antes de validar/persistir.
     */
    public static function normalize(array $witness): array
    {
        if (isset($witness['name'])) {
            $witness['name'] = trim((string) $witness['name']);
        }

        if (! empty($witness['cpf'])) {
            $witness['cpf'] = preg_replace('/\D/', '', (string) $witness['cpf']);
        }

        return $witness;
    }
}
