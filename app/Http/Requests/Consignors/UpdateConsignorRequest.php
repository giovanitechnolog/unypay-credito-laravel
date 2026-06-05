<?php

namespace App\Http\Requests\Consignors;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateConsignorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'document' => $this->input('document') ? preg_replace('/\D/', '', (string) $this->input('document')) : null,
            'zipCode'  => $this->input('zipCode')  ? preg_replace('/\D/', '', (string) $this->input('zipCode'))  : null,
            'state'    => $this->input('state')    ? strtoupper((string) $this->input('state'))                  : null,
        ]);
    }

    public function rules(): array
    {
        // O parâmetro de rota é "consignor" (route model binding ou inteiro).
        $consignorId = $this->route('consignor');
        if (is_object($consignorId) && method_exists($consignorId, 'getKey')) {
            $consignorId = $consignorId->getKey();
        }

        return [
            'name'     => ['required', 'string', 'max:255'],
            'document' => [
                'nullable', 'string', 'min:11', 'max:14',
                // 🚀 Ignora o próprio registro na regra de unicidade.
                Rule::unique('consignors', 'document')->ignore($consignorId),
            ],
            'phone'    => ['nullable', 'string', 'max:30'],
            'email'    => ['nullable', 'email', 'max:320'],

            'street'       => ['nullable', 'string', 'max:255'],
            'number'       => ['nullable', 'string', 'max:20'],
            'neighborhood' => ['nullable', 'string', 'max:120'],
            'zipCode'      => ['nullable', 'string', 'size:8'],
            'complement'   => ['nullable', 'string', 'max:120'],
            'city'         => ['nullable', 'string', 'max:120'],
            'state'        => ['nullable', 'string', 'size:2'],

            'bankAccounts'                 => ['nullable', 'array'],
            // Permite reutilizar contas já existentes (id presente) ou criar novas (sem id).
            'bankAccounts.*.id'            => ['nullable', 'integer', 'exists:consignor_bank_accounts,id'],
            'bankAccounts.*.bankName'      => ['required_with:bankAccounts', 'string', 'max:255'],
            'bankAccounts.*.agency'        => ['nullable', 'string', 'max:20'],
            'bankAccounts.*.accountNumber' => ['nullable', 'string', 'max:30'],
            'bankAccounts.*.accountType'   => ['required_with:bankAccounts', 'in:corrente,poupanca'],
            'bankAccounts.*.pixKey'        => ['nullable', 'string', 'max:140'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'                            => 'Informe o nome ou razão social do credor.',
            'document.min'                             => 'O documento deve conter 11 (CPF) ou 14 (CNPJ) dígitos numéricos.',
            'document.max'                             => 'O documento deve conter 11 (CPF) ou 14 (CNPJ) dígitos numéricos.',
            'document.unique'                          => 'Já existe outro credor cadastrado com este documento.',
            'state.size'                               => 'A UF deve ter 2 caracteres (ex: MG).',
            'zipCode.size'                             => 'O CEP deve conter 8 dígitos numéricos.',

            'bankAccounts.*.bankName.required_with'    => 'Informe o banco da conta bancária.',
            'bankAccounts.*.accountType.required_with' => 'Informe o tipo da conta (Corrente ou Poupança).',
            'bankAccounts.*.accountType.in'            => 'O tipo da conta deve ser Corrente ou Poupança.',
        ];
    }
}
