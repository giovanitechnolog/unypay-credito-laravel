<?php

namespace App\Http\Requests\ContractTypes;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateContractTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $contractTypeId = $this->route('contractType')?->id ?? $this->route('contractType');

        return [
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('contract_types', 'name')->ignore($contractTypeId),
            ],
            'slug' => [
                'nullable', 'string', 'max:255',
                Rule::unique('contract_types', 'slug')->ignore($contractTypeId),
            ],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Informe o nome do tipo de contrato.',
            'name.unique'   => 'Já existe um tipo de contrato com este nome.',
            'slug.unique'   => 'Já existe um tipo de contrato com este identificador.',
        ];
    }
}
