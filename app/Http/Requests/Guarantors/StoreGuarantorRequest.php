<?php

namespace App\Http\Requests\Guarantors;

use Illuminate\Foundation\Http\FormRequest;

class StoreGuarantorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Normaliza CPF, CNPJ, CEP e UF antes de validar.
     */
    protected function prepareForValidation(): void
    {
        $personType = strtoupper((string) $this->input('personType', 'PF'));
        if (! in_array($personType, ['PF', 'PJ'], true)) {
            $personType = 'PF';
        }

        $this->merge([
            'personType' => $personType,
            'cpf'        => $this->input('cpf')     ? preg_replace('/\D/', '', (string) $this->input('cpf'))     : null,
            'cnpj'       => $this->input('cnpj')    ? preg_replace('/\D/', '', (string) $this->input('cnpj'))    : null,
            'zipCode'    => $this->input('zipCode') ? preg_replace('/\D/', '', (string) $this->input('zipCode')) : null,
            'state'      => $this->input('state')   ? strtoupper((string) $this->input('state'))                 : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'personType'        => ['required', 'in:PF,PJ'],

            // Nome (PF: nome completo / PJ: razão social) — sempre obrigatório
            'name'              => ['required', 'string', 'max:255'],

            // ── Campos exclusivos de Pessoa Física ─────────────────────────
            'cpf'               => ['required_if:personType,PF', 'nullable', 'string', 'size:11', 'unique:guarantors,cpf'],
            'rg'                => ['nullable', 'string', 'max:20'],
            'nationality'       => ['required_if:personType,PF', 'nullable', 'string', 'max:80'],
            'maritalStatus'     => ['required_if:personType,PF', 'nullable', 'string', 'max:40'],

            // ── Campos exclusivos de Pessoa Jurídica ───────────────────────
            'cnpj'              => ['required_if:personType,PJ', 'nullable', 'string', 'size:14', 'unique:guarantors,cnpj'],
            'tradeName'         => ['required_if:personType,PJ', 'nullable', 'string', 'max:255'],
            'stateRegistration' => ['required_if:personType,PJ', 'nullable', 'string', 'max:30'],

            // ── Endereço — opcional (mas validado por formato quando preenchido) ──
            'street'            => ['nullable', 'string', 'max:255'],
            'number'            => ['nullable', 'string', 'max:20'],
            'neighborhood'      => ['nullable', 'string', 'max:120'],
            'city'              => ['nullable', 'string', 'max:120'],
            'state'             => ['nullable', 'string', 'size:2'],
            'zipCode'           => ['nullable', 'string', 'size:8'],

            // Vínculo NxN com clientes — único campo opcional do formulário
            'clientIds'         => ['nullable', 'array'],
            'clientIds.*'       => ['integer', 'exists:clients,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'personType.required'        => 'Selecione se o fiador é Pessoa Física ou Jurídica.',
            'name.required'              => 'Informe o nome do fiador (ou Razão Social).',

            'cpf.required_if'            => 'Informe o CPF do fiador.',
            'cpf.size'                   => 'O CPF deve conter 11 dígitos numéricos.',
            'cpf.unique'                 => 'Já existe um fiador cadastrado com este CPF.',
            'nationality.required_if'    => 'Informe a nacionalidade.',
            'maritalStatus.required_if'  => 'Informe o estado civil.',

            'cnpj.required_if'           => 'Informe o CNPJ da empresa.',
            'cnpj.size'                  => 'O CNPJ deve conter 14 dígitos numéricos.',
            'cnpj.unique'                => 'Já existe um fiador cadastrado com este CNPJ.',
            'tradeName.required_if'      => 'Informe o Nome Fantasia.',
            'stateRegistration.required_if' => 'Informe a Inscrição Estadual (ou "ISENTO").',

            'state.size'                 => 'A UF deve ter 2 caracteres (ex: MG).',
            'zipCode.size'               => 'O CEP deve conter 8 dígitos numéricos.',
        ];
    }
}
