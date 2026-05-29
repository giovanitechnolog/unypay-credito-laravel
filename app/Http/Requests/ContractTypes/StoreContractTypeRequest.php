<?php

namespace App\Http\Requests\ContractTypes;

use Illuminate\Foundation\Http\FormRequest;

class StoreContractTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name'      => ['required', 'string', 'max:255', 'unique:contract_types,name'],
            'slug'      => ['nullable', 'string', 'max:255', 'unique:contract_types,slug'],
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
