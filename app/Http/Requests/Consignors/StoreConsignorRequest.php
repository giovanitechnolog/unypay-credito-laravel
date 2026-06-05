<?php

namespace App\Http\Requests\Consignors;

use Illuminate\Foundation\Http\FormRequest;

class StoreConsignorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Normaliza document (CPF/CNPJ), CEP e UF antes de validar.
     * Mantém somente dígitos para evitar duplicidade por máscara diferente.
     */
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
        return [
            // Dados gerais
            'name'     => ['required', 'string', 'max:255'],
            // 11 dígitos = CPF, 14 = CNPJ; aceita ambos.
            'document' => ['nullable', 'string', 'min:11', 'max:14', 'unique:consignors,document'],
            'phone'    => ['nullable', 'string', 'max:30'],
            'email'    => ['nullable', 'email', 'max:320'],

            // Endereço — todos opcionais, mas validados por formato quando preenchidos
            'street'       => ['nullable', 'string', 'max:255'],
            'number'       => ['nullable', 'string', 'max:20'],
            'neighborhood' => ['nullable', 'string', 'max:120'],
            'zipCode'      => ['nullable', 'string', 'size:8'],
            'complement'   => ['nullable', 'string', 'max:120'],
            'city'         => ['nullable', 'string', 'max:120'],
            'state'        => ['nullable', 'string', 'size:2'],

            // Contas bancárias (1:N) — array OPCIONAL. Quando enviado, cada item é validado.
            'bankAccounts'                 => ['nullable', 'array'],
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
            'name.required'                          => 'Informe o nome ou razão social do credor.',
            'document.min'                           => 'O documento deve conter 11 (CPF) ou 14 (CNPJ) dígitos numéricos.',
            'document.max'                           => 'O documento deve conter 11 (CPF) ou 14 (CNPJ) dígitos numéricos.',
            'document.unique'                        => 'Já existe um credor cadastrado com este documento.',
            'state.size'                             => 'A UF deve ter 2 caracteres (ex: MG).',
            'zipCode.size'                           => 'O CEP deve conter 8 dígitos numéricos.',

            'bankAccounts.*.bankName.required_with'    => 'Informe o banco da conta bancária.',
            'bankAccounts.*.accountType.required_with' => 'Informe o tipo da conta (Corrente ou Poupança).',
            'bankAccounts.*.accountType.in'            => 'O tipo da conta deve ser Corrente ou Poupança.',
        ];
    }
}
