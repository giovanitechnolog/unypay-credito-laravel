<?php

namespace App\Http\Requests\Guarantors;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateGuarantorRequest extends FormRequest
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
        // O id vem do route binding ({guarantor})
        $guarantorId = $this->route('guarantor');
        if (is_object($guarantorId) && method_exists($guarantorId, 'getKey')) {
            $guarantorId = $guarantorId->getKey();
        }

        return [
            'personType'        => ['required', 'in:PF,PJ'],
            'name'              => ['required', 'string', 'max:255'],
            'email'             => ['nullable', 'email', 'max:255'],
            'phone'             => ['nullable', 'string', 'max:20'],

            'cpf'               => [
                'required_if:personType,PF', 'nullable', 'string', 'size:11',
                Rule::unique('guarantors', 'cpf')->ignore($guarantorId),
            ],
            'rg'                => ['nullable', 'string', 'max:20'],
            'nationality'       => ['required_if:personType,PF', 'nullable', 'string', 'max:80'],
            'maritalStatus'     => ['required_if:personType,PF', 'nullable', 'string', 'max:40'],

            'cnpj'              => [
                'required_if:personType,PJ', 'nullable', 'string', 'size:14',
                Rule::unique('guarantors', 'cnpj')->ignore($guarantorId),
            ],
            'tradeName'         => ['required_if:personType,PJ', 'nullable', 'string', 'max:255'],
            // Inscrição Estadual é opcional (PJs podem ser isentas / sem cadastro).
            'stateRegistration' => ['nullable', 'string', 'max:30'],

            'street'            => ['nullable', 'string', 'max:255'],
            'number'            => ['nullable', 'string', 'max:20'],
            'complement'        => ['nullable', 'string', 'max:255'],
            'neighborhood'      => ['nullable', 'string', 'max:120'],
            'city'              => ['nullable', 'string', 'max:120'],
            'state'             => ['nullable', 'string', 'size:2'],
            'zipCode'           => ['nullable', 'string', 'size:8'],

            'clientIds'         => ['nullable', 'array'],
            'clientIds.*'       => ['integer', 'exists:clients,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'personType.required'           => 'Selecione se a pessoa é Pessoa Física ou Jurídica.',
            'name.required'                 => 'Informe o nome da pessoa (ou Razão Social).',

            'cpf.required_if'               => 'Informe o CPF da pessoa.',
            'cpf.size'                      => 'O CPF deve conter 11 dígitos numéricos.',
            'cpf.unique'                    => 'Já existe outra pessoa cadastrada com este CPF.',
            'nationality.required_if'       => 'Informe a nacionalidade.',
            'maritalStatus.required_if'     => 'Informe o estado civil.',

            'cnpj.required_if'              => 'Informe o CNPJ da empresa.',
            'cnpj.size'                     => 'O CNPJ deve conter 14 dígitos numéricos.',
            'cnpj.unique'                   => 'Já existe outra pessoa cadastrada com este CNPJ.',
            'tradeName.required_if'         => 'Informe o Nome Fantasia.',

            'state.size'                    => 'A UF deve ter 2 caracteres (ex: MG).',
            'zipCode.size'                  => 'O CEP deve conter 8 dígitos numéricos.',
        ];
    }
}
